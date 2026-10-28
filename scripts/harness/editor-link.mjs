import { request } from 'node:http';

function callEditor(base, path, method, body) {
  const url = new URL(base);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('editor must be loopback HTTP');
  const port = Number(url.port || 80);
  const host = `127.0.0.1:${port}`;
  const payload = body === undefined ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, timeout: 3000,
      headers: { Host: host, Origin: `http://${host}`, 'Sec-Fetch-Site': 'same-origin',
        'Content-Type': 'application/json', ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}) } }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(text) }); }
        catch { reject(new Error('editor returned invalid JSON')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end(payload);
  });
}

export async function linkEditor({ editorUrl, forwardKey, forwardPort }) {
  let current;
  try { current = await callEditor(editorUrl, '/api/keys', 'GET'); }
  catch (error) {
    return ['ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH'].includes(error.code) || error.message === 'timeout'
      ? 'skipped' : 'failed';
  }
  if (current.status !== 200) return 'failed';
  try {
    if (current.body?.keys?.LLM_DSH_API_KEY?.configured) {
      const check = await callEditor(editorUrl, '/api/keys/test', 'POST', { page: 'llm/dsh', overrides: {} });
      if (check.status === 200 && check.body?.ok === true) return 'already';
    }
    const update = await callEditor(editorUrl, '/api/keys', 'POST', {
      LLM_DSH_API_KEY: forwardKey, LLM_DSH_BASE_URL: `http://127.0.0.1:${forwardPort}/v1`,
    });
    return update.status === 200 ? 'linked' : 'failed';
  } catch { return 'failed'; }
}
