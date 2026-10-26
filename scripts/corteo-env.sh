#!/usr/bin/env bash
# Sourceable environment for corteo on a machine whose default node is not 24
# and whose shells export NPM_CONFIG_PREFIX (nvm refuses to start when it is set).
#
#   source scripts/corteo-env.sh
#
# Unsets the prefix variables, sources nvm, selects the Node from .nvmrc,
# and cd's to the repo. Run it as a script to require Node 24 and exit:
#
#   bash scripts/corteo-env.sh --require-node
if [[ -n "${CORTEO_ENV_READY:-}" ]]; then
  return 0 2>/dev/null || exit 0
fi

_corteo_env_apply() {
  local root nounset=0
  unset NPM_CONFIG_PREFIX npm_config_prefix
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  cd "$root"
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    printf '[corteo] Node 24 is required and nvm is not installed. Run install.sh\n' >&2
    return 1
  fi
  case $- in *u*) nounset=1 ;; esac
  set +u
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  if ! nvm use --silent >/dev/null 2>&1; then
    if (( nounset )); then set -u; fi
    printf '[corteo] Could not select Node from .nvmrc (this shell has %s). Install it with: nvm install 24\n' "$(node -v 2>/dev/null || echo 'no node')" >&2
    return 1
  fi
  if (( nounset )); then set -u; fi
  local major
  major="$(node -p 'Number(process.versions.node.split(".")[0])')"
  if [[ "$major" -lt 24 ]]; then
    printf '[corteo] corteo needs Node 24 (this shell is %s). Run: nvm install 24\n' "$(node -v)" >&2
    return 1
  fi
  if [[ -z "${CC_BROWSER_EXECUTABLE:-}" ]]; then
    local candidate
    for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
      if command -v "$candidate" >/dev/null 2>&1; then
        export CC_BROWSER_EXECUTABLE
        CC_BROWSER_EXECUTABLE="$(command -v "$candidate")"
        break
      fi
    done
  fi
  if [[ -z "${CC_RENDER_GL:-}" ]] && ! command -v nvidia-smi >/dev/null 2>&1; then
    export CC_RENDER_GL=swangle
  fi
  export CORTEO_ROOT="$root"
  export CORTEO_ENV_READY=1
}

_corteo_env_apply || {
  if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
    return 1
  fi
  exit 1
}
