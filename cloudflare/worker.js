const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
  'X-Content-Type-Options': 'nosniff',
};

const serverPrefixes = ['/api/', '/llm/', '/assemblyai/', '/e2b/', '/upload/', '/export/', '/generate/', '/jobs/'];

const isServerPath = (pathname) => serverPrefixes.some((prefix) => (
  pathname === prefix.slice(0, -1) || pathname.startsWith(prefix)
));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (isServerPath(url.pathname)) {
      return Response.json(
        { error: 'not-found' },
        { status: 404, headers: { 'cache-control': 'no-store', ...isolation } },
      );
    }

    // Vite emits one onnxruntime wasm above Workers' 25 MiB asset limit.
    // The build stores it gzipped beside the original URL; the browser
    // decompresses it from Content-Encoding.
    if (url.pathname.endsWith('.wasm')) {
      const gzipUrl = new URL(`${url.pathname}.gz`, url.origin);
      const gzipped = await env.ASSETS.fetch(new Request(gzipUrl, { method: 'GET' }));
      const gzipType = gzipped.headers.get('content-type') ?? '';
      // A missing .gz falls through the SPA handler and comes back as index.html.
      if (gzipped.ok && !gzipType.includes('text/html')) {
        const headers = new Headers(gzipped.headers);
        headers.set('Content-Type', 'application/wasm');
        headers.set('Content-Encoding', 'gzip');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        for (const [key, value] of Object.entries(isolation)) headers.set(key, value);
        return new Response(gzipped.body, { status: 200, headers });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
