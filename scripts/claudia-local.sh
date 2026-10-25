#!/usr/bin/env bash
# npm run claudia:local — same Node 24 / prefix fix as scripts/corteo.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/corteo-env.sh"
cd "$CORTEO_ROOT"
npm run sync:mediapipe
npm run sync:whisper-cli
npm run verify:server-tool-catalog
exec node --env-file-if-exists=.env.claudia scripts/claudia-local.mjs
