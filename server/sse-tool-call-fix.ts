// Several DeepSeek Harness free lanes open a tool call with a bare
// `{"index":0}` delta. @ai-sdk/openai-compatible requires a `function` object
// on every tool-call delta and rejects the whole stream otherwise, even though
// it buffers the call until a later delta carries the name.
import { Transform } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';

type SseLineFix = (line: string) => string;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Give tool-call deltas without a `function` object an empty one. Other lines pass through untouched. */
export function fixToolCallDeltaLine(line: string): string {
  if (!line.startsWith('data:')) return line;
  const payload = line.slice(5).trim();
  if (!payload.includes('tool_calls')) return line;
  let chunk: unknown;
  try {
    chunk = JSON.parse(payload);
  } catch {
    return line;
  }
  if (!isRecord(chunk) || !Array.isArray(chunk.choices)) return line;
  let changed = false;
  for (const choice of chunk.choices) {
    if (!isRecord(choice) || !isRecord(choice.delta) || !Array.isArray(choice.delta.tool_calls)) continue;
    for (const call of choice.delta.tool_calls) {
      if (!isRecord(call)) continue;
      // StepFun-compatible gateways put an empty `type` on continuation chunks; the
      // chunk schema wants the literal `function`, so the placeholder has to go.
      if (call.type === '') {
        delete call.type;
        changed = true;
      }
      if (!isRecord(call.function)) {
        call.function = {};
        changed = true;
      }
    }
  }
  return changed ? `data: ${JSON.stringify(chunk)}` : line;
}

/** Apply `fix` to every complete SSE line, holding back a partial line until its newline arrives. */
export function sseLineTransform(fix: SseLineFix): Transform {
  const decoder = new StringDecoder('utf8');
  let pending = '';
  const fixLine = (line: string): string => {
    const cr = line.endsWith('\r');
    const fixed = fix(cr ? line.slice(0, -1) : line);
    return cr ? `${fixed}\r` : fixed;
  };
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      pending += decoder.write(chunk);
      const lastNewline = pending.lastIndexOf('\n');
      if (lastNewline === -1) {
        callback();
        return;
      }
      const complete = pending.slice(0, lastNewline);
      pending = pending.slice(lastNewline + 1);
      callback(null, `${complete.split('\n').map(fixLine).join('\n')}\n`);
    },
    flush(callback) {
      pending += decoder.end();
      callback(null, pending ? fixLine(pending) : undefined);
    },
  });
}
