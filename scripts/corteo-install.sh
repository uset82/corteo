#!/usr/bin/env bash
# Idempotent installer for any corteo bot's Linux VM.
#
#   curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/scripts/corteo-install.sh | bash
#
# Installs nvm and Node 24 if needed, clones or updates ~/corteo, installs
# dependencies, turns paid providers off, and renders a 2 second test MP4.
# No API keys. The free-model harness is optional and is not installed here.
#
# Shells on a Grok Bot VM export NPM_CONFIG_PREFIX. nvm refuses to start while
# that variable is set, so it is cleared here and nowhere else. The user's rc
# files are left to nvm's own installer.
set -euo pipefail
umask 022
unset NPM_CONFIG_PREFIX npm_config_prefix

REPO_URL_DEFAULT="https://github.com/uset82/corteo.git"
REF_DEFAULT="main"
NODE_MAJOR="24"
NVM_VERSION="v0.40.8"

fail_printed=0
say() { printf '[corteo] %s\n' "$*"; }
die() { fail_printed=1; printf '[corteo] FAIL: %s\n' "$*" >&2; printf 'CORTEO_SELF_TEST=FAIL\n'; exit 1; }
on_exit() {
  local code=$?
  if (( code != 0 && fail_printed == 0 )); then
    printf 'CORTEO_SELF_TEST=FAIL\n'
  fi
}
trap on_exit EXIT

script_file=""
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  script_file="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
fi

DIR="${CORTEO_DIR:-$HOME/corteo}"
REF="${CORTEO_REF:-$REF_DEFAULT}"
if [[ -n "$script_file" ]]; then
  checkout="$(cd "$(dirname "$script_file")/.." && pwd)"
  if [[ -f "$checkout/package.json" && -f "$checkout/cli/main.ts" ]]; then
    ORIGIN="${CORTEO_GIT_URL:-$checkout}"
  else
    ORIGIN="${CORTEO_GIT_URL:-$REPO_URL_DEFAULT}"
  fi
else
  ORIGIN="${CORTEO_GIT_URL:-$REPO_URL_DEFAULT}"
fi

ensure_node() {
  # nvm aborts if this is set, including the lowercase form npm writes.
  unset NPM_CONFIG_PREFIX npm_config_prefix
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    say "installing nvm $NVM_VERSION"
    curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
  fi
  local nounset=0
  case $- in *u*) nounset=1 ;; esac
  set +u
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  if (( nounset )); then set -u; fi
  if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]')" != "$NODE_MAJOR" ]]; then
    say "installing Node $NODE_MAJOR"
    nvm install "$NODE_MAJOR"
  fi
  nvm alias default "$NODE_MAJOR" >/dev/null
  nvm use "$NODE_MAJOR" >/dev/null
  hash -r
  local major
  major="$(node -p 'Number(process.versions.node.split(".")[0])')"
  if [[ "$major" -lt 24 ]]; then
    die "corteo needs Node 24 (got $(node -v)). nvm did not switch. Unset NPM_CONFIG_PREFIX and run this installer again."
  fi
  say "node $(node -v)"
}

ensure_repo() {
  mkdir -p "$(dirname "$DIR")"
  if [[ -d "$DIR/.git" ]]; then
    say "updating $DIR"
    # Stay on the branch that was cloned. Forcing main would replace a
    # working install when the remote's main is a different line.
    git -C "$DIR" pull --ff-only || true
  elif [[ -d "$DIR" && -n "$(ls -A "$DIR" 2>/dev/null || true)" ]]; then
    die "$DIR exists and is not a git checkout"
  else
    say "cloning $ORIGIN into $DIR"
    if [[ -d "$ORIGIN/.git" ]]; then
      git clone "$ORIGIN" "$DIR"
    else
      git clone --branch "$REF" "$ORIGIN" "$DIR"
    fi
  fi
}

system_chrome() {
  local candidate
  for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "$candidate" >/dev/null 2>&1; then
      command -v "$candidate"
      return 0
    fi
  done
  return 1
}

ensure_browser() {
  local chrome=""
  chrome="$(system_chrome || true)"
  if [[ -n "$chrome" ]]; then
    export CC_BROWSER_EXECUTABLE="$chrome"
    say "using system Chrome for renders: $chrome"
    say "skipping the Remotion headless-shell download"
    return 0
  fi
  say "no system Chrome; downloading Remotion's headless shell now so the first render does not"
  node --input-type=module -e 'import { ensureBrowser } from "@remotion/renderer"; await ensureBrowser({ chromeMode: "headless-shell" });'
}

ensure_deps() {
  cd "$DIR"
  if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
    die "ffmpeg and ffprobe must be installed (apt-get install -y ffmpeg)"
  fi
  say "ffmpeg $(ffmpeg -version | head -n 1)"
  if ! command -v nvidia-smi >/dev/null 2>&1; then
    export ONNXRUNTIME_NODE_INSTALL=skip
    export CC_RENDER_GL="${CC_RENDER_GL:-swangle}"
  fi
  say "npm install"
  npm install
  ensure_browser
}

write_env() {
  local env_file="$DIR/.env.corteo"
  if [[ ! -f "$env_file" ]]; then
    cat >"$env_file" <<'EOF'
# Written by scripts/corteo-install.sh. Paid providers stay off.
# The free-model harness is optional and is not configured here.
OPENCHATCUT_PROVIDERS=off
OPENCHATCUT_DEV_HEAP_MB=6144
EOF
    chmod 600 "$env_file"
  elif ! grep -q '^OPENCHATCUT_PROVIDERS=' "$env_file"; then
    printf '\nOPENCHATCUT_PROVIDERS=off\n' >>"$env_file"
  fi
  if [[ -n "${CC_BROWSER_EXECUTABLE:-}" ]] && ! grep -q '^CC_BROWSER_EXECUTABLE=' "$env_file"; then
    printf 'CC_BROWSER_EXECUTABLE=%s\n' "$CC_BROWSER_EXECUTABLE" >>"$env_file"
  fi
  if [[ -n "${CC_RENDER_GL:-}" ]] && ! grep -q '^CC_RENDER_GL=' "$env_file"; then
    printf 'CC_RENDER_GL=%s\n' "$CC_RENDER_GL" >>"$env_file"
  fi
}

self_test() {
  local step="setup" work clip out asset duration
  work="$(mktemp -d "${TMPDIR:-/tmp}/corteo-self-test.XXXXXX")"
  trap 'printf "[corteo] self-test step failed: %s\n" "$step" >&2; printf "[corteo] self-test files kept at %s\n" "$work" >&2' ERR
  clip="$work/clip.mp4"
  out="$work/corteo-self-test.mp4"
  mkdir -p "$work"
  step="ffmpeg clip"
  say "generating a 2 second test clip"
  ffmpeg -y -hide_banner -loglevel error \
    -f lavfi -i "color=c=0x1a1a1a:s=640x360:d=2:r=30" \
    -f lavfi -i "anullsrc=r=48000:cl=stereo" \
    -t 2 -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$clip"
  export OPENCHATCUT_PROVIDERS=off
  export OPENCHATCUT_DATA_DIR="$work/library"
  export OPENCHATCUT_DEV_HEAP_MB=6144
  export CC_RENDER_GL=swangle
  unset OPENCHATCUT_DEV_PROFILE_ID || true
  cd "$DIR"
  step="project new"
  say "creating a project and importing the clip"
  npm run --silent corteo -- project new "corteo self-test" --fps 30 --size 640x360 --json >/dev/null
  step="media import"
  npm run --silent corteo -- media import "$clip" --apply --json >/dev/null
  step="media ls"
  asset="$(npm run --silent corteo -- media ls --json | node -e '
    let raw = "";
    process.stdin.on("data", (chunk) => { raw += chunk; });
    process.stdin.on("end", () => {
      const parsed = JSON.parse(raw);
      const asset = (parsed.assets || [])[0];
      if (!asset || !asset.id) process.exit(1);
      process.stdout.write(asset.id);
    });
  ')"
  step="place clip"
  say "placing the clip and rendering"
  npm run --silent corteo -- tools call edit_item \
    --args "{\"adds\":[{\"type\":\"video\",\"assetId\":\"${asset}\",\"fromFrame\":0}]}" \
    --apply --json >/dev/null
  step="render"
  npm run --silent corteo -- render --out "$out" --to 2s --resolution 480p --quiet
  step="ffprobe duration"
  duration="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$out")"
  node -e '
    const duration = Number(process.argv[1]);
    if (!Number.isFinite(duration) || duration < 1.5 || duration > 2.5) {
      console.error("duration out of range: " + process.argv[1]);
      process.exit(1);
    }
  ' "$duration"
  trap - ERR
  rm -rf "$work"
  say "self-test passed (${duration}s); artifacts removed"
}

ensure_node
ensure_repo
ensure_deps
write_env
# A conditional call would disable set -e inside self_test. A subshell keeps it
# on, and the ERR trap names the step that failed.
self_test_status=0
(
  set -euo pipefail
  self_test
) || self_test_status=$?
if (( self_test_status != 0 )); then
  die "self-test failed"
fi
printf 'CORTEO_SELF_TEST=PASS\n'
printf 'CORTEO_DIR=%s\n' "$DIR"
printf 'CORTEO_MCP_URL=http://127.0.0.1:5199/api/external-mcp/mcp\n'
printf 'CORTEO_START=cd %s && npm run corteo:local\n' "$DIR"
say "PASS"
