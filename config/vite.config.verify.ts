import assert from 'node:assert/strict';
import { allowedHostsFromEnv, applyAuthoritativeLocalProvider, providersOffFromEnv } from './vite.config.ts';

const inherited = { LLM_PROVIDER: 'openai' };
applyAuthoritativeLocalProvider(
  inherited,
  'export LLM_PROVIDER = "deepseek" # checkout selection wins\n',
);
assert.equal(
  inherited.LLM_PROVIDER,
  'deepseek',
  '.env.local uses dotenv quoting/export/comment syntax and overrides inherited process env',
);

const singleQuoted = { LLM_PROVIDER: 'openai' };
applyAuthoritativeLocalProvider(singleQuoted, "LLM_PROVIDER='anthropic' # quoted provider\n");
assert.equal(singleQuoted.LLM_PROVIDER, 'anthropic');

const absent = { LLM_PROVIDER: 'gemini' };
applyAuthoritativeLocalProvider(absent, 'OTHER_SETTING=value\n');
const explicitlyEmpty = { LLM_PROVIDER: 'openai' };
applyAuthoritativeLocalProvider(explicitlyEmpty, 'LLM_PROVIDER= # use repository default\n');
assert.equal(
  explicitlyEmpty.LLM_PROVIDER,
  '',
  'an explicit local provider setting still shadows inherited process env when empty',
);

assert.equal(absent.LLM_PROVIDER, 'gemini', 'an absent local provider preserves inherited selection');

assert.equal(providersOffFromEnv({}), false, 'the local-only switch stays off by default');
assert.equal(providersOffFromEnv({ OPENCHATCUT_PROVIDERS: 'on' }), false);
assert.equal(providersOffFromEnv({ OPENCHATCUT_PROVIDERS: 'off' }), true,
  'the browser define follows the same exact-match process env value as the server gate');

assert.deepEqual(allowedHostsFromEnv({}), ['.cursorvm.com', 'localhost']);
assert.deepEqual(
  allowedHostsFromEnv({ OPENCHATCUT_ALLOWED_HOSTS: ' editor.example.com, ,corteo.uset82.workers.dev ' }),
  ['.cursorvm.com', 'localhost', 'editor.example.com', 'corteo.uset82.workers.dev'],
  'comma-separated hosts are trimmed and empty entries are dropped',
);

console.log('Vite dotenv provider precedence verification passed');
