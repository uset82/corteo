import { createServer } from 'node:http';
import { BRAIN_ALIASES, ladderFor } from './ladder.mjs';

const MAX_BODY = 1024 * 1024;
const errorBody = (code, tried) => ({ error: { message: 'brain_unavailable', type: 'brain_unavailable', code, tried } });
const jsonResult = (status, body) => ({ status, body, headers: { 'content-type': 'application/json' } });

function unknownModel(alias) {
  return jsonResult(404, { error: { message: `unknown model ${alias}: use corteo-edit, corteo-draft or corteo-fast`,
    type: 'invalid_request_error', code: 'model_not_found' } });
}

export function createBrainRouter({ brain, getProbe, forwardPort, forwardKey, fetchImpl = fetch, now = Date.now }) {
  async function route({ alias, body }) {
    if (!BRAIN_ALIASES.includes(alias)) return unknownModel(alias);
    const probe = await getProbe();
    if (!probe) return jsonResult(503, errorBody('no_probe', []));
    const lanes = ladderFor(alias, brain, probe);
    const tried = [];
    for (const lane of lanes) {
      const start = now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), brain.aliases[alias].firstByteTimeoutMs);
      let response;
      try {
        response = await fetchImpl(`http://127.0.0.1:${forwardPort}/v1/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${forwardKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, model: lane }),
          signal: controller.signal,
        });
      } catch (error) {
        clearTimeout(timer);
        const ms = now() - start;
        if (controller.signal.aborted) {
          tried.push({ lane, status: 'timeout', ms });
          continue;
        }
        tried.push({ lane, status: 'connection_error', ms });
        if (error?.cause?.code === 'ECONNREFUSED' || error?.code === 'ECONNREFUSED') {
          return jsonResult(503, errorBody('forward_down', tried));
        }
        continue;
      }
      clearTimeout(timer);
      const ms = now() - start;
      const status = response.status;
      if (status === 401 || status === 403) {
        tried.push({ lane, status, ms });
        await response.body?.cancel();
        return jsonResult(502, errorBody('forward_key_rejected', tried));
      }
      if (status === 429 || status === 408 || status === 404 || status >= 500) {
        tried.push({ lane, status, ms });
        await response.body?.cancel();
        continue;
      }
      const headers = {
        'content-type': response.headers.get('content-type') ?? 'application/json',
        'x-corteo-alias': alias, 'x-corteo-lane': lane, 'x-corteo-latency-ms': String(ms),
      };
      return { status, headers, response, alias, tried };
    }
    return jsonResult(503, errorBody('no_lane', tried));
  }

  async function handle(req, res) {
    if (req.headers.authorization !== `Bearer ${forwardKey}`) {
      return sendJson(res, jsonResult(401, { error: { message: 'missing or invalid API key',
        type: 'invalid_request_error', code: 'unauthorized' } }));
    }
    if (req.method === 'GET' && req.url === '/v1/models') {
      return sendJson(res, jsonResult(200, { object: 'list',
        data: BRAIN_ALIASES.map((id) => ({ id, object: 'model', owned_by: 'corteo' })) }));
    }
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      return sendJson(res, jsonResult(404, { error: { message: 'not found' } }));
    }
    let body;
    try {
      const chunks = [];
      let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > MAX_BODY) return sendJson(res, jsonResult(413, { error: { message: 'request too large' } }));
        chunks.push(chunk);
      }
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid body');
    } catch {
      return sendJson(res, jsonResult(400, { error: { message: 'invalid JSON' } }));
    }
    const result = await route({ alias: body.model, body });
    if (!result.response) return sendJson(res, result);
    res.writeHead(result.status, result.headers);
    if (result.headers['content-type'].includes('text/event-stream')) {
      await rewriteSse(result.response, res, result.alias);
    } else if (result.headers['content-type'].includes('application/json')) {
      const text = await result.response.text();
      try {
        const payload = JSON.parse(text);
        if (payload && typeof payload === 'object') payload.model = result.alias;
        res.end(JSON.stringify(payload));
      } catch { res.end(text); }
    } else {
      for await (const chunk of result.response.body ?? []) res.write(chunk);
      res.end();
    }
  }
  return { handle, route };
}

function sendJson(res, result) {
  res.writeHead(result.status, result.headers);
  res.end(JSON.stringify(result.body));
}

async function rewriteSse(response, res, alias) {
  const decoder = new TextDecoder();
  let buffer = '';
  function rewrite(line) {
    const match = /^(data:\s*)(.*)$/.exec(line);
    if (!match || match[2].trim() === '[DONE]') return line;
    try {
      const payload = JSON.parse(match[2]);
      if (payload && typeof payload === 'object') payload.model = alias;
      return match[1] + JSON.stringify(payload);
    } catch { return line; }
  }
  for await (const chunk of response.body ?? []) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) res.write(rewrite(line) + '\n');
  }
  buffer += decoder.decode();
  if (buffer) res.write(rewrite(buffer));
  res.end();
}

export async function startBrainRouter(options) {
  const router = createBrainRouter(options);
  const server = createServer((req, res) => {
    router.handle(req, res).catch(() => {
      if (!res.headersSent) sendJson(res, jsonResult(500, { error: { message: 'router failure' } }));
      else res.destroy();
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, '127.0.0.1', resolve);
  });
  return { server, port: server.address().port };
}
