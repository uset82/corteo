// Forwards https://corteo.uset82.workers.dev to the named tunnel.
// The tunnel's originRequest.httpHostHeader makes Vite see the public host.
// No MCP token and no harness key live here.

export function proxyTarget(requestUrl, tunnelOrigin) {
  if (!tunnelOrigin) throw new Error('TUNNEL_ORIGIN is not set');
  const incoming = new URL(requestUrl);
  const target = new URL(tunnelOrigin);
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    throw new Error('TUNNEL_ORIGIN must be an http(s) URL');
  }
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  target.hash = '';
  return target.toString();
}

export default {
  async fetch(request, env) {
    const target = proxyTarget(request.url, env.TUNNEL_ORIGIN);
    const headers = new Headers(request.headers);
    headers.delete('host');
    const init = {
      method: request.method,
      headers,
      redirect: 'manual',
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
      init.duplex = 'half';
    }
    return fetch(new Request(target, init));
  },
};
