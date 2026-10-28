import { join } from 'node:path';
import { readJson, writePrivateJson } from './lib.mjs';

export async function probeLanes({ port, key, candidates, timeoutMs, pauseMs = 300, fetchImpl = fetch }) {
  const result = {};
  for (let index = 0; index < candidates.length; index++) {
    const lane = candidates[index];
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let status = 0;
    try {
      const response = await fetchImpl(`http://127.0.0.1:${port}/v1/chat/completions`, {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: lane, max_tokens: 16, temperature: 0,
          messages: [{ role: 'system', content: 'Responde solo con la palabra: listo' }, { role: 'user', content: '¿Listo?' }] }),
        signal: controller.signal,
      });
      status = response.status;
      const body = status === 200 ? await response.json() : null;
      const message = body?.choices?.[0]?.message;
      const prose = typeof message?.content === 'string' && Boolean(message.content.trim());
      const reasoning = typeof message?.reasoning_content === 'string' && Boolean(message.reasoning_content.trim());
      result[lane] = { ok: status === 200 && (prose || reasoning), status, latencyMs: Date.now() - start, prose,
        ...(status !== 200 ? { error: `http_${status}` } : {}) };
    } catch (error) {
      result[lane] = { ok: false, status, latencyMs: Date.now() - start, prose: false,
        error: controller.signal.aborted ? 'timeout' : 'request_failed' };
    } finally {
      clearTimeout(timer);
    }
    if (pauseMs && index < candidates.length - 1) await new Promise((resolve) => setTimeout(resolve, pauseMs));
  }
  return result;
}

export async function readBrainState(home) {
  return await readJson(join(home, 'brain.json')) ?? {};
}

export async function writeBrainState(home, patch) {
  const state = { ...await readBrainState(home), ...patch };
  await writePrivateJson(join(home, 'brain.json'), state);
  return state;
}
