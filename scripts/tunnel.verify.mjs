import assert from 'node:assert/strict';
import { tunnelArgs } from './tunnel.mjs';

assert.deepEqual(tunnelArgs('/tmp/tunnel.yml'), ['tunnel', '--config', '/tmp/tunnel.yml', 'run']);

console.log('tunnel.verify: cloudflared is started with the repo config');
