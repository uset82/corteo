#!/usr/bin/env bash
#
# corteo one-click installer for a Linux VM (x86_64 or arm64).
#
#   curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/install.sh | bash
#
# Non-interactive and idempotent. Everything it installs lives under --dir
# (default ~/corteo); user data lives under ~/.openchatcut/dev-profiles/<id>.
#
set -euo pipefail
umask 022

REPO_SLUG="uset82/corteo"
NODE_MAJOR="24"
APP_NAME="corteo"
DEFAULT_DIR="$HOME/corteo"
DEFAULT_HOST="127.0.0.1"
DEFAULT_PORT="5199"
DEFAULT_REF="main"

DIR="$DEFAULT_DIR"
HOST="$DEFAULT_HOST"
PORT="$DEFAULT_PORT"
REF="$DEFAULT_REF"
START=1
WITH_DESKTOP=0
SKIP_SYSTEM_DEPS=0
UNINSTALL=0
PURGE=0
DRY_RUN=0
CLONE=auto
JSON_MODE=0
PRINT_TOKEN=0
SELF_TEST=0
PORT_EXPLICIT=0
PORT_STATE="free"
EMITTED=0
SELF_TEST_RESULT="skipped"
SELF_TEST_STEP="setup"

# The install used to live in ~/claudia under claudia.service. One install, one
# port: a live old one is stopped and reused instead of building a second tree
# beside it. ~/claudia is never deleted.
LEGACY_DIR="$HOME/claudia"
LEGACY_SERVICE="claudia.service"
LEGACY_ACTION="none"
LEGACY_SERVICE_STATE="none"
MIGRATED_FROM="none"

CURRENT_STAGE="start"

# In --json mode stdout carries exactly one object, so progress moves to
# stderr. A bot reads stdout, a human reads the terminal, and neither has to
# parse the other's format.
say() {
  if (( JSON_MODE == 1 )); then
    printf '[corteo] %s\n' "$*" >&2
  else
    printf '[corteo] %s\n' "$*"
  fi
}

warn() { printf '[corteo] warning: %s\n' "$*" >&2; }

die() {
  printf '[corteo] error: %s\n' "$*" >&2
  exit 1
}

stage() {
  CURRENT_STAGE="$1"
  say "$1"
}

on_exit() {
  local code=$?
  (( code == 0 )) && return 0
  if (( JSON_MODE == 1 && EMITTED == 0 )); then
    printf '{"CORTEO_STATUS":"failed","CORTEO_FAILED_STAGE":"%s"}\n' \
      "$(json_escape "$CURRENT_STAGE")"
  else
    printf 'CORTEO_STATUS=failed\nCORTEO_FAILED_STAGE=%s\n' "$CURRENT_STAGE" >&2
  fi
}
trap on_exit EXIT

usage() {
  cat <<'USAGE'
corteo one-click installer

Usage
  curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/install.sh | bash
  ./install.sh [options]

Options
  --dir <path>          Install root (default: ~/corteo)
  --host <addr>         Bind address (default: 127.0.0.1)
  --port <port>         Editor port (default: 5199)
  --ref <branch|tag>    Git ref to install (default: main)
  --no-start            Install everything and print the values, but do not start
  --with-desktop        Download the Electron binary too (desktop development)
  --skip-system-deps    Do not try to install Chromium libraries for rendering
  --clone               Always clone into --dir, even when run from a checkout
  --uninstall           Stop and remove the service (keeps the app and data)
  --purge               With --uninstall: also delete the app and profile data
  --dry-run             Print the plan and exit without changing anything
  --json                Print one JSON object instead of CORTEO_* lines
  --print-token         Put the MCP token in the output (default: its path)
  --self-test           After installing, render 2 seconds and report PASS
  -h, --help            Show this help

The installer never prompts. It prints CORTEO_* values that an agent can parse,
and writes the same values to <dir>/corteo.env. With --json the same keys come
back as one object on stdout and every progress line moves to stderr.

The MCP token is not printed unless you ask with --print-token. The default
output carries CORTEO_MCP_TOKEN_FILE, a 0600 file the bot reads for itself, so
the secret never has to travel through a chat transcript.

--self-test proves the install renders: it creates a project, imports a
generated 2 second clip, renders it at 480p and checks the duration with
ffprobe. It reports CORTEO_SELF_TEST=PASS, or "pass" in the --json object.

An install from before the rename (~/claudia with claudia.service) is stopped,
disabled and moved into ~/corteo, keeping its checkout and its MCP token, so
there is only one install on one port. ~/claudia is never deleted: when ~/corteo
already exists, the old root is left in place and only its service is stopped.
USAGE
}

need_value() {
  [[ $# -ge 2 && -n "$2" ]] || die "option $1 needs a value"
}

# --dir and the default root are compared to decide the migration, so both go
# through this: same ~ expansion, same absolute form, no trailing slash.
normalize_dir() {
  local value="$1"
  case "$value" in
    "~") value="$HOME" ;;
    "~/"*) value="$HOME/${value#\~/}" ;;
    /*) ;;
    *) value="$PWD/$value" ;;
  esac
  printf '%s' "${value%/}"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dir) need_value "$1" "${2:-}"; DIR="$2"; shift 2 ;;
      --dir=*) DIR="${1#*=}"; shift ;;
      --host) need_value "$1" "${2:-}"; HOST="$2"; shift 2 ;;
      --host=*) HOST="${1#*=}"; shift ;;
      --port) need_value "$1" "${2:-}"; PORT="$2"; PORT_EXPLICIT=1; shift 2 ;;
      --port=*) PORT="${1#*=}"; PORT_EXPLICIT=1; shift ;;
      --ref) need_value "$1" "${2:-}"; REF="$2"; shift 2 ;;
      --ref=*) REF="${1#*=}"; shift ;;
      --no-start) START=0; shift ;;
      --with-desktop) WITH_DESKTOP=1; shift ;;
      --skip-system-deps) SKIP_SYSTEM_DEPS=1; shift ;;
      --clone) CLONE=1; shift ;;
      --uninstall) UNINSTALL=1; shift ;;
      --purge) PURGE=1; shift ;;
      --dry-run) DRY_RUN=1; shift ;;
      --json) JSON_MODE=1; shift ;;
      --print-token) PRINT_TOKEN=1; shift ;;
      --self-test) SELF_TEST=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) die "unknown option: $1 (see --help)" ;;
    esac
  done

  DEFAULT_DIR="$(normalize_dir "$DEFAULT_DIR")"
  DIR="$(normalize_dir "$DIR")"

  [[ "$PORT" =~ ^[0-9]+$ ]] && (( PORT >= 1 && PORT <= 65535 )) \
    || die "invalid port: $PORT"
  [[ -n "$HOST" ]] || die "invalid host"
  [[ -n "$REF" ]] || die "invalid ref"

  if (( PURGE == 1 && UNINSTALL == 0 )); then
    die "--purge only works together with --uninstall"
  fi

  APP_DIR="$DIR/app"
  BIN_DIR="$DIR/bin"
  LOG_DIR="$DIR/logs"
  NODE_DIR="$DIR/node"
  SECRETS="$DIR/secrets.env"
  REPORT="$DIR/corteo.env"
  PIDFILE="$DIR/corteo.pid"
  LOG_FILE="$LOG_DIR/corteo.log"
  case "$HOST" in
    0.0.0.0|127.0.0.1|localhost|::) MCP_HOST="127.0.0.1" ;;
    *) MCP_HOST="$HOST" ;;
  esac
  MCP_URL="http://$MCP_HOST:$PORT/api/external-mcp/mcp"
}

refuse_dangerous_dir() {
  case "$DIR" in
    ""|"/"|"$HOME"|"$HOME/") die "refusing to use $DIR as the install root" ;;
  esac
}

port_in_use() {
  (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null && exec 3>&- && return 0
  return 1
}

node_major_of() {
  "$1" -p 'process.versions.node.split(".")[0]' 2>/dev/null || true
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "x64" ;;
    aarch64|arm64) echo "arm64" ;;
    *) die "unsupported architecture: $(uname -m) (need x86_64 or arm64)" ;;
  esac
}

preflight() {
  stage "checking the machine"
  [[ "$(uname -s)" == "Linux" ]] || die "this installer targets Linux VMs; on macOS use the manual steps in README.md"
  ARCH="$(detect_arch)"
  command -v curl >/dev/null 2>&1 || die "curl is required (sudo apt-get install -y curl)"
  command -v git >/dev/null 2>&1 || die "git is required (sudo apt-get install -y git)"
  command -v tar >/dev/null 2>&1 || die "tar is required"
  command -v sha256sum >/dev/null 2>&1 || die "sha256sum is required (coreutils)"
  refuse_dangerous_dir
}

# An explicit --port is a promise, so a busy one stops the install. The default
# is a preference: a bot VM often already has something on 5199, and failing the
# whole install over a default would be a poor trade. MCP_URL is built from PORT
# in parse_args, so it is rebuilt here whenever the port moves.
PORT_SEARCH_LIMIT=20

check_port() {
  if ! port_in_use; then
    PORT_STATE="free"
    return 0
  fi
  if (( PORT_EXPLICIT == 1 )); then
    die "port $PORT is already in use; pass --port <free port> or stop the other process (ss -ltnp | grep $PORT)"
  fi
  local candidate
  for (( candidate = PORT + 1; candidate <= PORT + PORT_SEARCH_LIMIT; candidate++ )); do
    PORT="$candidate"
    if ! port_in_use; then
      PORT_STATE="shifted"
      MCP_URL="http://$MCP_HOST:$PORT/api/external-mcp/mcp"
      warn "the default port was busy; using $PORT"
      return 0
    fi
  done
  die "no free port between $DEFAULT_PORT and $(( DEFAULT_PORT + PORT_SEARCH_LIMIT )); pass --port <free port>"
}

# ── the install from before the rename ───────────────────────────────────────

legacy_present() {
  [[ -d "$LEGACY_DIR" ]]
}

# Only the default root migrates. An explicit --dir is the caller's choice, and
# moving a tree nobody asked us to touch would be a surprise.
detect_legacy() {
  LEGACY_ACTION="none"
  legacy_present || return 0
  if [[ "$DIR" != "$DEFAULT_DIR" ]]; then
    LEGACY_ACTION="ignored"
    return 0
  fi
  if [[ -e "$DIR" ]] && [[ -n "$(ls -A "$DIR" 2>/dev/null || true)" ]]; then
    LEGACY_ACTION="kept-both"
  else
    LEGACY_ACTION="move"
  fi
}

# The old service holds the port, so it has to go before check_port, and before
# the pid file moves with the tree.
stop_legacy() {
  [[ "$LEGACY_ACTION" == "none" || "$LEGACY_ACTION" == "ignored" ]] && return 0
  local unit_dir="$HOME/.config/systemd/user"
  local unit="$unit_dir/$LEGACY_SERVICE"
  local pid_file="$LEGACY_DIR/claudia.pid"

  if command -v systemctl >/dev/null 2>&1; then
    if systemctl --user stop "$LEGACY_SERVICE" >/dev/null 2>&1; then
      LEGACY_SERVICE_STATE="stopped"
    fi
    systemctl --user disable "$LEGACY_SERVICE" >/dev/null 2>&1 || true
    if [[ -f "$unit" ]]; then
      rm -f "$unit"
      systemctl --user daemon-reload >/dev/null 2>&1 || true
      LEGACY_SERVICE_STATE="stopped"
    fi
  fi

  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" >/dev/null 2>&1 || true
      LEGACY_SERVICE_STATE="stopped"
      rm -f "$pid_file"
    fi
  fi

  if [[ "$LEGACY_SERVICE_STATE" == "stopped" ]]; then
    say "stopped and disabled the old $LEGACY_SERVICE"
  fi
}

# A move, not a copy and not a delete: the checkout, the private Node, the
# secrets file and the data profile all keep their contents and their paths
# relative to the root, so the token survives and the user reconnects nothing.
migrate_legacy() {
  case "$LEGACY_ACTION" in
    move)
      stage "moving the old install from $LEGACY_DIR to $DIR"
      mv "$LEGACY_DIR" "$DIR" || die "could not move $LEGACY_DIR to $DIR"
      MIGRATED_FROM="$LEGACY_DIR"
      local pair old new
      for pair in "claudia.env:corteo.env" "claudia.pid:corteo.pid" \
                  "logs/claudia.log:logs/corteo.log" ".env.claudia:.env.corteo"; do
        old="$DIR/${pair%%:*}"
        new="$DIR/${pair##*:}"
        if [[ -f "$old" && ! -e "$new" ]]; then
          mv "$old" "$new"
        fi
      done
      # A checkout installed with --dir pointed at the root, not at root/app.
      if [[ -f "$DIR/package.json" && ! -d "$DIR/app" ]]; then
        APP_DIR="$DIR"
      fi
      say "reused $APP_DIR"
      ;;
    kept-both)
      say "$DIR already exists; left $LEGACY_DIR in place and only stopped its service"
      ;;
  esac
}

print_dry_run() {
  local node_now="not installed"
  if command -v node >/dev/null 2>&1; then
    node_now="$(node --version 2>/dev/null || echo unknown)"
  fi
  local port_state="free"
  if port_in_use; then
    port_state="in-use"
    warn "port $PORT is already in use; the real install would stop here"
  fi
  report CORTEO_STATUS dry-run
  report CORTEO_OS "$(uname -s) $(uname -m)"
  report CORTEO_DIR "$DIR"
  report CORTEO_APP_DIR "$APP_DIR"
  report CORTEO_NODE_SYSTEM "$node_now"
  report CORTEO_NODE_TARGET "$NODE_MAJOR"
  report CORTEO_URL "http://$HOST:$PORT"
  report CORTEO_MCP_URL "$MCP_URL"
  report CORTEO_REF "$REF"
  report CORTEO_START "$START" bool
  report CORTEO_WITH_DESKTOP "$WITH_DESKTOP" bool
  report CORTEO_SKIP_SYSTEM_DEPS "$SKIP_SYSTEM_DEPS" bool
  report CORTEO_SELF_TEST "$(if (( SELF_TEST == 1 )); then printf 'planned'; else printf 'skipped'; fi)"
  report CORTEO_PORT_STATE "$port_state"
  report CORTEO_SERVICE "corteo.service"
  report CORTEO_LOG "$LOG_FILE"
  report CORTEO_LEGACY_DIR "$LEGACY_DIR"
  report CORTEO_LEGACY_ACTION "$LEGACY_ACTION"
  emit
}

ensure_node() {
  stage "ensuring Node.js $NODE_MAJOR"
  NODE_BIN=""
  NPM_BIN=""
  NODE_BIN_DIR=""

  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    local major
    major="$(node_major_of "$(command -v node)")"
    if [[ "$major" == "$NODE_MAJOR" ]]; then
      NODE_BIN="$(command -v node)"
      NPM_BIN="$(command -v npm)"
      NODE_BIN_DIR="$(dirname "$NODE_BIN")"
      say "using system Node $(node --version)"
      return
    fi
    say "system Node is ${major:-unknown}; installing Node $NODE_MAJOR privately"
  fi

  if [[ -x "$NODE_DIR/bin/node" ]] && [[ "$(node_major_of "$NODE_DIR/bin/node")" == "$NODE_MAJOR" ]]; then
    NODE_BIN="$NODE_DIR/bin/node"
    NPM_BIN="$NODE_DIR/bin/npm"
    NODE_BIN_DIR="$NODE_DIR/bin"
    say "reusing private Node $("$NODE_BIN" --version)"
    return
  fi

  local base="https://nodejs.org/dist/latest-v${NODE_MAJOR}.x"
  local tmp
  mkdir -p "$DIR"
  tmp="$(mktemp -d "$DIR/.node-install.XXXXXX")"
  say "downloading Node $NODE_MAJOR for linux-$ARCH"
  curl -fsSL "$base/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt" \
    || die "could not download Node checksums from $base"

  local file expected actual
  file="$(awk -v suffix="-linux-$ARCH.tar.gz" '$2 ~ suffix"$" { print $2; exit }' "$tmp/SHASUMS256.txt")"
  [[ -n "$file" ]] || die "no Node $NODE_MAJOR linux-$ARCH tarball in SHASUMS256.txt"
  expected="$(awk -v name="$file" '$2 == name { print $1; exit }' "$tmp/SHASUMS256.txt")"

  curl -fsSL "$base/$file" -o "$tmp/$file" || die "could not download $file"
  actual="$(sha256sum "$tmp/$file" | awk '{ print $1 }')"
  [[ "$actual" == "$expected" ]] || die "checksum mismatch for $file"

  rm -rf "$NODE_DIR.new"
  mkdir -p "$NODE_DIR.new"
  tar -xzf "$tmp/$file" -C "$NODE_DIR.new" --strip-components=1
  rm -rf "$NODE_DIR"
  mv "$NODE_DIR.new" "$NODE_DIR"
  rm -rf "$tmp"

  NODE_BIN="$NODE_DIR/bin/node"
  NPM_BIN="$NODE_DIR/bin/npm"
  NODE_BIN_DIR="$NODE_DIR/bin"
  [[ -x "$NODE_BIN" ]] || die "Node extraction failed"
  say "installed private Node $("$NODE_BIN" --version) in $NODE_DIR"
}

script_checkout_dir() {
  local source="${BASH_SOURCE[0]:-}"
  [[ -n "$source" && -f "$source" ]] || return 1
  local dir
  dir="$(cd "$(dirname "$source")" >/dev/null 2>&1 && pwd)" || return 1
  [[ -f "$dir/package.json" && -f "$dir/scripts/dev-profile.mjs" && -f "$dir/cli/main.ts" ]] || return 1
  if "$NODE_BIN" -e 'const p=require(process.argv[1]); process.exit(p.name === "openchatcut" ? 0 : 1)' "$dir/package.json" 2>/dev/null; then
    echo "$dir"
    return 0
  fi
  return 1
}

fetch_source() {
  stage "fetching corteo ($REF)"
  local checkout=""
  if [[ "$CLONE" == "auto" ]] && checkout="$(script_checkout_dir)"; then
    APP_DIR="$checkout"
    say "using the current checkout at $APP_DIR"
    return
  fi

  if [[ -e "$APP_DIR" && ! -d "$APP_DIR/.git" ]]; then
    die "$APP_DIR exists and is not a corteo git checkout; remove it or pass another --dir"
  fi

  if [[ -d "$APP_DIR/.git" ]]; then
    local remote
    remote="$(git -C "$APP_DIR" remote get-url origin 2>/dev/null || true)"
    [[ "$remote" == *"$REPO_SLUG"* ]] || die "$APP_DIR is a git checkout of $remote, not $REPO_SLUG"
    git -C "$APP_DIR" fetch --depth 1 origin "$REF" || die "could not fetch $REF from $REPO_SLUG"
    git -C "$APP_DIR" reset --hard FETCH_HEAD
    say "updated $APP_DIR to $REF"
  else
    mkdir -p "$DIR"
    GIT_TERMINAL_PROMPT=0 git clone --depth 1 --branch "$REF" "https://github.com/$REPO_SLUG.git" "$APP_DIR" \
      || die "could not clone $REPO_SLUG"
    say "cloned $REPO_SLUG into $APP_DIR"
  fi
}

install_deps() {
  stage "installing dependencies"
  export PATH="$NODE_BIN_DIR:$PATH"
  export npm_config_audit=false
  export npm_config_fund=false
  export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
  local env_args=(ONNXRUNTIME_NODE_INSTALL=skip)
  if (( WITH_DESKTOP == 0 )); then
    env_args+=(ELECTRON_SKIP_BINARY_DOWNLOAD=1)
  fi
  ( cd "$APP_DIR" && env "${env_args[@]}" "$NPM_BIN" ci --no-audit --no-fund ) \
    || die "npm ci failed (see the output above)"
}

build_cli() {
  stage "building the occ command line"
  export PATH="$NODE_BIN_DIR:$PATH"
  ( cd "$APP_DIR" && "$NPM_BIN" run build:cli ) || die "npm run build:cli failed"
  [[ -f "$APP_DIR/cli-dist/occ.mjs" ]] || die "cli-dist/occ.mjs was not produced"

  mkdir -p "$BIN_DIR"
  local app_q node_q
  app_q="$(printf '%q' "$APP_DIR")"
  node_q="$(printf '%q' "$NODE_BIN")"
  cat > "$BIN_DIR/occ" <<EOF
#!/usr/bin/env bash
set -euo pipefail
APP=$app_q
NODE=$node_q
if [[ -f "\$APP/.git/openchatcut-dev-profile.json" ]]; then
  PROFILE_ID="\$("\$NODE" -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(p.profileId||"")' "\$APP/.git/openchatcut-dev-profile.json" 2>/dev/null || true)"
  if [[ -n "\$PROFILE_ID" ]]; then
    export OPENCHATCUT_DEV_PROFILE_ID="\$PROFILE_ID"
  fi
fi
export OPENCHATCUT_EDITOR_URL="\${OPENCHATCUT_EDITOR_URL:-http://127.0.0.1:$PORT}"
exec "\$NODE" "\$APP/cli-dist/occ.mjs" "\$@"
EOF
  chmod +x "$BIN_DIR/occ"
}

prepare_profile() {
  stage "preparing the isolated data profile"
  ( cd "$APP_DIR" && "$NODE_BIN" scripts/dev-profile.mjs --exec true ) \
    || die "could not prepare the data profile"
}

ensure_token() {
  stage "preparing the MCP token"
  mkdir -p "$DIR"
  if [[ -f "$SECRETS" ]]; then
    # shellcheck disable=SC1090
    . "$SECRETS"
  fi
  if [[ -z "${OPENCHATCUT_MCP_TOKEN:-}" ]]; then
    local token
    token="$(head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=\n')"
    (
      umask 077
      {
        printf 'OPENCHATCUT_MCP_TOKEN=%s\n' "$token"
        printf 'NODE_OPTIONS=--max-old-space-size=6144\n'
      } > "$SECRETS"
    )
  else
    (
      umask 077
      {
        printf 'OPENCHATCUT_MCP_TOKEN=%s\n' "$OPENCHATCUT_MCP_TOKEN"
        printf 'NODE_OPTIONS=%s\n' "${NODE_OPTIONS:---max-old-space-size=6144}"
      } > "$SECRETS"
    )
  fi
  chmod 600 "$SECRETS"
  # shellcheck disable=SC1090
  . "$SECRETS"
  [[ -n "${OPENCHATCUT_MCP_TOKEN:-}" ]] || die "could not create an MCP token"
}

install_system_deps() {
  (( SKIP_SYSTEM_DEPS == 1 )) && return
  stage "checking the Chromium libraries used by export"
  if command -v ldconfig >/dev/null 2>&1 \
    && ldconfig -p 2>/dev/null | grep -q 'libnspr4\.so' \
    && ldconfig -p 2>/dev/null | grep -q 'libnss3\.so'; then
    say "Chromium libraries already present"
    return
  fi

  local packages=(
    libnss3 libnspr4 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1
    libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2
  )
  local version=""
  if [[ -r /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    version="${ID:-}:${VERSION_ID:-}"
  fi
  case "$version" in
    ubuntu:2[4-9]*|debian:1[3-9]*)
      packages+=(libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libasound2t64)
      ;;
    *)
      packages+=(libatk1.0-0 libatk-bridge2.0-0 libcups2 libasound2)
      ;;
  esac

  if [[ "$(id -u)" == "0" ]] && command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq || true
    if apt-get install -y --no-install-recommends "${packages[@]}"; then
      say "installed Chromium libraries"
    else
      warn "could not install every Chromium library; rendering may fail"
      warn "run: apt-get install -y --no-install-recommends ${packages[*]}"
    fi
  else
    warn "rendering needs system libraries that are not installed"
    warn "run: sudo apt-get install -y --no-install-recommends ${packages[*]}"
  fi
}

write_unit() {
  local unit_dir="$HOME/.config/systemd/user"
  mkdir -p "$unit_dir"
  cat > "$unit_dir/corteo.service" <<EOF
[Unit]
Description=corteo video editor and MCP server
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
EnvironmentFile=$SECRETS
Environment=PATH=$NODE_BIN_DIR:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=NODE_ENV=development
ExecStart=/usr/bin/env npm run dev -- --host $HOST --port $PORT
Restart=on-failure
RestartSec=5
KillMode=mixed
TimeoutStopSec=20
StandardOutput=append:$LOG_FILE
StandardError=append:$LOG_FILE

[Install]
WantedBy=default.target
EOF
  UNIT_PATH="$unit_dir/corteo.service"
}

start_nohup() {
  stage "starting corteo with nohup"
  mkdir -p "$LOG_DIR"
  (
    cd "$APP_DIR"
    set -a
    # shellcheck disable=SC1090
    . "$SECRETS"
    set +a
    export PATH="$NODE_BIN_DIR:$PATH"
    if command -v setsid >/dev/null 2>&1; then
      setsid nohup "$NPM_BIN" run dev -- --host "$HOST" --port "$PORT" >>"$LOG_FILE" 2>&1 &
    else
      nohup "$NPM_BIN" run dev -- --host "$HOST" --port "$PORT" >>"$LOG_FILE" 2>&1 &
    fi
    echo $! > "$PIDFILE"
  )
  MANAGER="nohup"
}

start_service() {
  if (( START == 0 )); then
    MANAGER="not-started"
    say "service not started (--no-start)"
    return
  fi

  stage "starting corteo"
  mkdir -p "$LOG_DIR"
  MANAGER="nohup"

  if command -v systemctl >/dev/null 2>&1 && systemctl --user show-environment >/dev/null 2>&1; then
    write_unit
    systemctl --user daemon-reload || true
    if systemctl --user enable --now corteo.service; then
      MANAGER="systemd"
      loginctl enable-linger "$(id -un)" >/dev/null 2>&1 || true
      say "started as a systemd user service"
      return
    fi
    warn "systemd could not start the service; falling back to nohup"
    systemctl --user disable corteo.service >/dev/null 2>&1 || true
    rm -f "$UNIT_PATH"
    systemctl --user daemon-reload >/dev/null 2>&1 || true
  fi

  start_nohup
}

wait_for_health() {
  (( START == 0 )) && return 0
  stage "waiting for the editor and MCP endpoint"
  local host deadline code
  host="$MCP_HOST"
  deadline=$((SECONDS + 300))
  while (( SECONDS < deadline )); do
    if curl -fsS -o /dev/null "http://$host:$PORT/" 2>/dev/null; then
      code="$(curl -s -o /dev/null -w '%{http_code}' \
        -X POST \
        -H "Authorization: Bearer $OPENCHATCUT_MCP_TOKEN" \
        -H 'Content-Type: application/json' \
        -H 'Accept: application/json, text/event-stream' \
        --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"corteo-install","version":"1"}}}' \
        "http://$host:$PORT/api/external-mcp/mcp" 2>/dev/null || true)"
      if [[ "$code" == "200" ]]; then
        say "editor and MCP endpoint are ready"
        return 0
      fi
    fi
    sleep 2
  done

  warn "corteo did not become healthy in time"
  if [[ -f "$LOG_FILE" ]]; then
    warn "last log lines from $LOG_FILE:"
    tail -n 40 "$LOG_FILE" >&2 || true
  fi
  if [[ "$MANAGER" == "systemd" ]]; then
    warn "journal: journalctl --user -u corteo.service -n 40"
  fi
  die "health check failed"
}

read_profile_id() {
  local metadata="$APP_DIR/.git/openchatcut-dev-profile.json"
  [[ -f "$metadata" ]] || return 1
  "$NODE_BIN" -e '
    const fs = require("fs");
    const parsed = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const id = parsed && parsed.profileId;
    if (typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) {
      process.stdout.write(id);
    } else {
      process.exit(1);
    }
  ' "$metadata" 2>/dev/null || return 1
}

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  value="${value//$'\t'/\\t}"
  printf '%s' "$value"
}

REPORT_KEYS=()
REPORT_VALUES=()
REPORT_KINDS=()

# report <key> <value> [raw|bool|stdout-only]
#   raw         a number, emitted unquoted in JSON
#   bool        1/0 in text (the long-standing contract), true/false in JSON
#   stdout-only never written to corteo.env (the token lives in secrets.env)
report() {
  REPORT_KEYS+=("$1")
  REPORT_VALUES+=("$2")
  REPORT_KINDS+=("${3:-string}")
}

# One object on stdout in --json mode, KEY=VALUE lines otherwise. The same keys
# either way, so a human and a bot are reading one contract.
emit() {
  local i
  if (( JSON_MODE == 1 )); then
    printf '{'
    for i in "${!REPORT_KEYS[@]}"; do
      (( i > 0 )) && printf ','
      if [[ "${REPORT_KINDS[$i]}" == "raw" ]]; then
        printf '"%s":%s' "${REPORT_KEYS[$i]}" "${REPORT_VALUES[$i]}"
      elif [[ "${REPORT_KINDS[$i]}" == "bool" ]]; then
        if [[ "${REPORT_VALUES[$i]}" == "1" ]]; then
          printf '"%s":true' "${REPORT_KEYS[$i]}"
        else
          printf '"%s":false' "${REPORT_KEYS[$i]}"
        fi
      else
        printf '"%s":"%s"' "${REPORT_KEYS[$i]}" "$(json_escape "${REPORT_VALUES[$i]}")"
      fi
    done
    printf '}\n'
  else
    for i in "${!REPORT_KEYS[@]}"; do
      printf '%s=%s\n' "${REPORT_KEYS[$i]}" "${REPORT_VALUES[$i]}"
    done
  fi
  EMITTED=1
}

write_report() {
  stage "writing the connection report"
  mkdir -p "$DIR"
  local profile_id="" data_dir="unknown"
  if profile_id="$(read_profile_id)"; then
    data_dir="$HOME/.openchatcut/dev-profiles/$profile_id"
  fi

  report CORTEO_STATUS ok
  report CORTEO_URL "http://$HOST:$PORT"
  report CORTEO_LOCAL_URL "http://127.0.0.1:$PORT"
  report CORTEO_MCP_URL "$MCP_URL"
  report CORTEO_MCP_TOKEN_FILE "$SECRETS"
  report CORTEO_OCC "$BIN_DIR/occ"
  report CORTEO_APP_DIR "$APP_DIR"
  report CORTEO_DATA_DIR "$data_dir"
  report CORTEO_GUIDE "$APP_DIR/documentation/CORTEO_INSTALL.md"
  report CORTEO_LOG "$LOG_FILE"
  report CORTEO_MANAGER "$MANAGER"
  report CORTEO_MIGRATED_FROM "$MIGRATED_FROM"
  report CORTEO_LEGACY_SERVICE "$LEGACY_SERVICE_STATE"
  report CORTEO_PORT_STATE "$PORT_STATE"
  report CORTEO_SELF_TEST "$SELF_TEST_RESULT"
  if (( PRINT_TOKEN == 1 )); then
    report CORTEO_MCP_TOKEN "$OPENCHATCUT_MCP_TOKEN" stdout-only
  fi

  (
    umask 077
    local i
    for i in "${!REPORT_KEYS[@]}"; do
      [[ "${REPORT_KINDS[$i]}" == "stdout-only" ]] && continue
      printf '%s=%s\n' "${REPORT_KEYS[$i]}" "${REPORT_VALUES[$i]}"
    done > "$REPORT"
  )
  chmod 600 "$REPORT"
  emit
}

do_uninstall() {
  stage "uninstalling corteo"
  local unit_dir="$HOME/.config/systemd/user"
  local unit="$unit_dir/corteo.service"

  if command -v systemctl >/dev/null 2>&1; then
    systemctl --user disable --now corteo.service >/dev/null 2>&1 || true
    if [[ -f "$unit" ]]; then
      rm -f "$unit"
      systemctl --user daemon-reload >/dev/null 2>&1 || true
    fi
  fi

  # An install from before the rename is still an install that is running.
  if legacy_present; then
    LEGACY_ACTION="stop"
    stop_legacy
    say "left $LEGACY_DIR in place; remove it yourself if it is not needed"
  fi

  if [[ -f "$PIDFILE" ]]; then
    local pid
    pid="$(cat "$PIDFILE" 2>/dev/null || true)"
    if [[ "$pid" =~ ^[0-9]+$ ]]; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
    rm -f "$PIDFILE"
  fi

  if (( PURGE == 1 )); then
    refuse_dangerous_dir
    local profile_id="" profile_dir="" reader=""
    if [[ -x "$NODE_DIR/bin/node" ]]; then
      reader="$NODE_DIR/bin/node"
    elif command -v node >/dev/null 2>&1; then
      reader="$(command -v node)"
    fi
    if [[ -n "$reader" ]]; then
      NODE_BIN="$reader"
      if profile_id="$(read_profile_id)"; then
        profile_dir="$HOME/.openchatcut/dev-profiles/$profile_id"
      fi
    fi
    say "removing $BIN_DIR $NODE_DIR $SECRETS $REPORT $LOG_DIR"
    rm -rf "$BIN_DIR" "$NODE_DIR" "$LOG_DIR"
    rm -f "$SECRETS" "$REPORT"
    if [[ "$APP_DIR" == "$DIR/app" ]]; then
      say "removing $APP_DIR"
      rm -rf "$APP_DIR"
    else
      warn "leaving $APP_DIR in place: it is the checkout this installer was run from"
    fi
    if [[ -n "$profile_dir" && -d "$profile_dir" ]]; then
      say "removing profile $profile_dir"
      rm -rf "$profile_dir"
    fi
    rmdir "$DIR" 2>/dev/null || true
  else
    say "kept $APP_DIR and the project data (use --purge to delete them)"
  fi

  say "uninstall complete"
}

# ── the self-test ────────────────────────────────────────────────────────────
# Folded in from scripts/corteo-install.sh, which existed only to run these
# steps. The CLI is called through cli-dist/occ.mjs rather than the installed
# wrapper on purpose: the wrapper exports OPENCHATCUT_DEV_PROFILE_ID, and this
# test has to run in its own data directory so it cannot touch real projects.

self_test_body() {
  local work="$1"
  local clip="$work/clip.mp4"
  local out="$work/render.mp4"
  local duration=""
  local cli=("$NODE_BIN" "$APP_DIR/cli-dist/occ.mjs")

  SELF_TEST_STEP="ffmpeg clip"
  printf '%s' "$SELF_TEST_STEP" > "$work/.step"
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

  SELF_TEST_STEP="project new"
  printf '%s' "$SELF_TEST_STEP" > "$work/.step"
  "${cli[@]}" project new "corteo self-test" --fps 30 --size 640x360 --json >/dev/null

  SELF_TEST_STEP="media import"
  printf '%s' "$SELF_TEST_STEP" > "$work/.step"
  "${cli[@]}" media import "$clip" --apply --json >/dev/null

  SELF_TEST_STEP="media ls"
  printf '%s' "$SELF_TEST_STEP" > "$work/.step"
  local asset
  asset="$("${cli[@]}" media ls --json | "$NODE_BIN" -e '
    let raw = "";
    process.stdin.on("data", (chunk) => { raw += chunk; });
    process.stdin.on("end", () => {
      const parsed = JSON.parse(raw);
      const asset = (parsed.assets || [])[0];
      if (!asset || !asset.id) process.exit(1);
      process.stdout.write(asset.id);
    });
  ')"
  [[ -n "$asset" ]] || { say "media ls returned no asset id"; return 1; }

  SELF_TEST_STEP="place clip"
  printf '%s' "$SELF_TEST_STEP" > "$work/.step"
  "${cli[@]}" tools call edit_item \
    --args "{\"adds\":[{\"type\":\"video\",\"assetId\":\"${asset}\",\"fromFrame\":0}]}" \
    --apply --json >/dev/null

  SELF_TEST_STEP="render"
  printf '%s' "$SELF_TEST_STEP" > "$work/.step"
  say "rendering 2 seconds at 480p"
  "${cli[@]}" render --out "$out" --to 2s --resolution 480p --quiet

  SELF_TEST_STEP="ffprobe"
  printf '%s' "$SELF_TEST_STEP" > "$work/.step"
  duration="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$out")"
  "$NODE_BIN" -e '
    const duration = Number(process.argv[1]);
    if (!Number.isFinite(duration) || duration < 1.5 || duration > 2.5) {
      console.error("duration out of range: " + process.argv[1]);
      process.exit(1);
    }
  ' "$duration"
  say "rendered ${duration}s"
}

# A failing command inside a bare call would exit the script through set -e and
# lose the step name, so the body runs in a subshell and reports afterwards.
self_test() {
  stage "self-test"
  command -v ffmpeg >/dev/null 2>&1 \
    || die "the self-test needs ffmpeg (sudo apt-get install -y ffmpeg)"
  command -v ffprobe >/dev/null 2>&1 \
    || die "the self-test needs ffprobe (sudo apt-get install -y ffmpeg)"
  [[ -f "$APP_DIR/cli-dist/occ.mjs" ]] || die "cli-dist/occ.mjs is missing; the self-test cannot run"

  local work status=0
  work="$(mktemp -d "${TMPDIR:-/tmp}/corteo-self-test.XXXXXX")"
  ( set -euo pipefail; self_test_body "$work" ) || status=$?
  if (( status != 0 )); then
    SELF_TEST_RESULT="fail"
    say "self-test files kept at $work"
    die "self-test failed at step '$(cat "$work/.step" 2>/dev/null || printf 'unknown')'"
  fi
  SELF_TEST_RESULT="pass"
  rm -rf "$work"
  say "self-test passed"
}

main() {
  parse_args "$@"

  if (( UNINSTALL == 1 )); then
    if legacy_present; then LEGACY_ACTION="stop"; fi
    if (( DRY_RUN == 1 )); then
      report CORTEO_STATUS dry-run
      report CORTEO_ACTION uninstall
      report CORTEO_DIR "$DIR"
      report CORTEO_PURGE "$PURGE" bool
      report CORTEO_SERVICE "corteo.service"
      report CORTEO_LEGACY_DIR "$LEGACY_DIR"
      report CORTEO_LEGACY_ACTION "$LEGACY_ACTION"
      emit
      exit 0
    fi
    do_uninstall
    exit 0
  fi

  preflight
  detect_legacy
  if (( DRY_RUN == 1 )); then
    print_dry_run
    exit 0
  fi

  stop_legacy
  migrate_legacy
  check_port

  ensure_node
  fetch_source
  install_deps
  build_cli
  prepare_profile
  ensure_token
  install_system_deps
  start_service
  wait_for_health
  if (( SELF_TEST == 1 )); then
    self_test
  fi
  write_report

  say "done"
}

main "$@"
