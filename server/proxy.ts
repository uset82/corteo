// Shared streaming proxy for Vite dev and the Electron embedded server.
// `target()` and `headers()` are evaluated for every request, so settings saved
// through the keystore take effect immediately without exposing keys to browser JS.
import { request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { Agent as HttpAgent } from 'node:http';
import { outboundHttpAgent } from './outbound-proxy.ts';
import { sseLineTransform } from './sse-tool-call-fix.ts';

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => unknown;

// Optional outbound proxy (Clash etc.) for providers blocked by the network.
// node:https does not read HTTPS_PROXY by itself, so we attach a CONNECT
// tunnel agent. The unified resolver (server/outbound-proxy.ts) prefers the
// user-configured PROXY_URL keystore entry and falls back to the standard
// HTTPS_PROXY/HTTP_PROXY environment variables; disabled for plain-http
// targets and when no proxy is configured.
function outboundProxyAgent(): HttpAgent | null {
  return outboundHttpAgent() ?? null;
}

const HOP_BY_HOP = new Set(['host', 'connection', 'keep-alive', 'proxy-authorization', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te', 'trailer']);

// Browser-only headers that must never reach upstream. Cookies are shared across
// every localhost port, so a large accumulated cookie jar on a dev machine would
// otherwise be forwarded verbatim and rejected by provider gateways (431/400).
const NEVER_FORWARD: Record<string, true> = {
  'x-openchatcut-provider': true,
  cookie: true,
};

export interface ProxyRoute {
  /** Target API prefix, evaluated per request. */
  target: (req: IncomingMessage) => string;
  /** Outbound headers, evaluated per request. */
  headers: (req: IncomingMessage) => Record<string, string>;
  /** Normalize generic relay responses so provider SDKs can parse JSON. */
  forceJsonContentType?: boolean;
  /** Replace upstream error bodies with one actionable message. */
  errorMessage?: (status: number, req: IncomingMessage) => string;
  /**
   * Replace a connection-level failure (no upstream response, e.g. ECONNREFUSED)
   * with one actionable message. Returning undefined keeps the generic 502 body.
   */
  networkMessage?: (error: Error, req: IncomingMessage) => string | undefined;
  /** Rewrite each line of a successful `text/event-stream` response. Returning undefined streams it untouched. */
  sseLineFix?: (req: IncomingMessage) => ((line: string) => string) | undefined;
}

export function proxyMiddleware(route: ProxyRoute): Middleware {
  return (req, res) => {
    let target: URL;
    try {
      target = new URL(route.target(req));
      if (target.protocol !== 'http:' && target.protocol !== 'https:') {
        throw new Error('unsupported proxy protocol');
      }
    } catch {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'proxy target is not a valid URL' }));
      return;
    }
    const headers: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!HOP_BY_HOP.has(k.toLowerCase()) && !NEVER_FORWARD[k.toLowerCase()] && v !== undefined) {
        headers[k] = v;
      }
    }
    headers.host = target.host;
    for (const [k, v] of Object.entries(route.headers(req))) if (v) headers[k] = v;
    // A line fix has to read plain text. Asking for `identity` is the only way to be
    // sure: a compressed body would reach the utf8 decoder below and never match.
    const lineFix = route.sseLineFix?.(req);
    if (lineFix) headers['accept-encoding'] = 'identity';

    const basePath = target.pathname.replace(/\/$/, '');
    const rawUrl = req.url ?? '/';
    const queryAt = rawUrl.indexOf('?');
    const requestPath = queryAt === -1 ? rawUrl : rawUrl.slice(0, queryAt);
    const search = new URLSearchParams(target.search);
    if (queryAt !== -1) {
      for (const [name, value] of new URLSearchParams(rawUrl.slice(queryAt + 1))) {
        search.append(name, value);
      }
    }
    const query = search.size > 0 ? `?${search.toString()}` : '';
    const doRequest = target.protocol === 'http:' ? httpRequest : httpsRequest;
    const agent = target.protocol === 'https:' ? outboundProxyAgent() : null;
    const upstream = doRequest({
      host: target.hostname,
      port: target.port || (target.protocol === 'http:' ? 80 : 443),
      method: req.method,
      path: basePath + requestPath + query,
      headers,
      ...(agent ? { agent } : {}),
    }, (upRes) => {
      const status = upRes.statusCode ?? 502;
      if (status >= 400 && route.errorMessage) {
        const chunks: Buffer[] = [];
        upRes.on('data', (chunk) => chunks.push(chunk));
        upRes.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8').slice(0, 2000);
          console.warn(`[proxy] upstream ${status} for ${target.host}${basePath}${requestPath} · ${body}`);
        });
        res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ error: { message: route.errorMessage(status, req) } }));
        return;
      }
      const outHeaders: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(upRes.headers)) {
        if (!HOP_BY_HOP.has(k.toLowerCase()) && v !== undefined) outHeaders[k] = v;
      }
      if (route.forceJsonContentType) {
        const ct = String(outHeaders['content-type'] ?? '');
        if (!ct.includes('application/json') && !ct.includes('text/event-stream')) {
          outHeaders['content-type'] = 'application/json';
        }
      }
      // `identity` is only a request. If upstream compressed anyway, decoding it as
      // utf8 would turn the body into U+FFFD and the rule would silently stop matching,
      // so hand the bytes through untouched and leave `content-encoding` for the caller.
      const encoding = String(outHeaders['content-encoding'] ?? '').toLowerCase();
      const compressed = encoding !== '' && encoding !== 'identity';
      const rewrite = lineFix && !compressed && String(outHeaders['content-type'] ?? '').includes('text/event-stream')
        ? lineFix
        : undefined;
      if (rewrite) delete outHeaders['content-length'];
      res.writeHead(status, outHeaders);
      if (rewrite) upRes.pipe(sseLineTransform(rewrite)).pipe(res);
      else upRes.pipe(res);
    });

    upstream.on('error', (err) => {
      if (!res.headersSent) {
        const message = route.networkMessage?.(err, req);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(message ? { error: { message } } : { error: `upstream request failed: ${err.message}` }));
      } else if (!res.writableEnded) {
        res.end();
      }
    });
    res.on('close', () => upstream.destroy());
    req.pipe(upstream);
  };
}
