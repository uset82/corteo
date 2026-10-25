#!/usr/bin/env bash
# P-CL-12. Fresh clone, Node 20 as `node`, NPM_CONFIG_PREFIX set.
# Uses the installer, then only the commands in skills/corteo/SKILL.md.
set -euo pipefail
set -m
pass=0
SERVER_PID=""
LOG=""

fail() {
  pass=2
  printf 'ACCEPTANCE=FAIL\n' >&2
  if [[ -n "$*" ]]; then printf '%s\n' "$*" >&2; fi
  if [[ -n "$LOG" && -f "$LOG" ]]; then
    printf '--- claudia:local log ---\n' >&2
    tail -n 80 "$LOG" >&2 || true
  fi
  exit 1
}

cleanup() {
  local code=$?
  if [[ -n "$SERVER_PID" ]]; then
    kill -- "-$SERVER_PID" 2>/dev/null || kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  if (( code != 0 && pass == 0 )); then
    printf 'ACCEPTANCE=FAIL\n'
  fi
}
trap cleanup EXIT

export NPM_CONFIG_PREFIX="${NPM_CONFIG_PREFIX:-$HOME/.local}"
export npm_config_prefix="$NPM_CONFIG_PREFIX"
mkdir -p "$NPM_CONFIG_PREFIX"

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$node_major" != "20" ]]; then
  fail "node is $(node -v); this test requires Node 20 as the default node"
fi
if [[ -z "${NPM_CONFIG_PREFIX:-}" ]]; then
  fail "NPM_CONFIG_PREFIX is not set"
fi

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(mktemp -d /tmp/corteo-acceptance.XXXXXX)"
export CORTEO_DIR="$ROOT/corteo"
INSTALL_LOG="$ROOT/install.log"
LOG="$ROOT/claudia-local.log"
EXPORT="$ROOT/exports"
mkdir -p "$EXPORT"

if ! bash "$SRC/scripts/claudia-install.sh" | tee "$INSTALL_LOG"; then
  fail "installer failed"
fi
grep -q 'CORTEO_SELF_TEST=PASS' "$INSTALL_LOG" || fail "installer did not print CORTEO_SELF_TEST=PASS"
if grep -q 'Downloading Chrome Headless Shell' "$INSTALL_LOG"; then
  grep -q 'downloading Remotion'"'"'s headless shell now' "$INSTALL_LOG" || fail "headless shell downloaded without the installer saying so"
fi

CORTEO="$CORTEO_DIR/scripts/corteo"
[[ -x "$CORTEO" ]] || fail "wrapper missing: $CORTEO"

pick_port() {
  node <<'EOF'
const net = require('net');
const requested = (process.env.CORTEO_PORT_REQUEST || '').trim();
function free(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}
(async () => {
  if (requested) {
    const port = Number(requested);
    if (!Number.isInteger(port) || port < 1 || port > 65535) process.exit(2);
    if (!(await free(port))) process.exit(3);
    process.stdout.write(String(port));
    return;
  }
  for (let port = 5299; port <= 5399; port += 1) {
    if (await free(port)) {
      process.stdout.write(String(port));
      return;
    }
  }
  process.exit(4);
})();
EOF
}

if [[ -n "${CORTEO_PORT:-}" ]]; then
  PORT="$(CORTEO_PORT_REQUEST="$CORTEO_PORT" pick_port)" || fail "CORTEO_PORT ${CORTEO_PORT} is not free"
else
  PORT="$(pick_port)" || fail "no free port from 5299"
fi
export CORTEO_PORT="$PORT"
export CORTEO_STORE_DIR="$ROOT/library"
mkdir -p "$CORTEO_STORE_DIR"
printf 'ACCEPTANCE_PORT=%s\n' "$CORTEO_PORT"
printf 'ACCEPTANCE_STORE=%s\n' "$CORTEO_STORE_DIR"

pushd "$CORTEO_DIR" >/dev/null
npm run claudia:local >"$LOG" 2>&1 &
SERVER_PID=$!
popd >/dev/null

ready=0
for _ in $(seq 1 180); do
  if curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${CORTEO_PORT}/"; then
    ready=1
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    fail "claudia:local exited before the port opened"
  fi
  sleep 1
done
(( ready == 1 )) || fail "claudia:local did not open port ${CORTEO_PORT}"
if grep -q 'Failed to load url /@fs/src/main.tsx' "$LOG"; then
  fail "vite warmup still requests /@fs/src/main.tsx"
fi

json_field() {
  node -e 'const j=require(process.argv[1]); const path=process.argv[2].split("."); let cur=j; for (const key of path) cur=cur[key]; if (cur===undefined||cur===null) process.exit(1); process.stdout.write(String(cur));' "$1" "$2"
}

check_bars() {
  FRAME="$1" MODE="$2" node "$SRC/remotion/frame-bars.mjs" "$1" "$2"
}

# --- skills/corteo/SKILL.md › Receta rápida ---
WORK="$EXPORT/rapida"
mkdir -p "$WORK"
ffmpeg -y -hide_banner -loglevel error -f lavfi -i "color=c=0x224466:s=1280x720:d=4:r=30" -t 4 -c:v libx264 -pix_fmt yuv420p "$WORK/clip-a.mp4"
ffmpeg -y -hide_banner -loglevel error -f lavfi -i "color=c=0x664422:s=1280x720:d=4:r=30" -t 4 -c:v libx264 -pix_fmt yuv420p "$WORK/clip-b.mp4"
ffmpeg -y -hide_banner -loglevel error -f lavfi -i "sine=frequency=220:sample_rate=48000:duration=2" -t 2 "$WORK/song.wav"
"$CORTEO" project new "Receta rapida" --size 1920x1080 --fps 30 --json > "$WORK/project.json"
"$CORTEO" media import "$WORK/song.wav" --apply --json > "$WORK/import-song.json"
"$CORTEO" media import "$WORK/clip-a.mp4" --apply --json > "$WORK/import-a.json"
"$CORTEO" media import "$WORK/clip-b.mp4" --apply --json > "$WORK/import-b.json"
A="$(json_field "$WORK/import-a.json" ops.0.result.imported.0.id)"
B="$(json_field "$WORK/import-b.json" ops.0.result.imported.0.id)"
SONG="$(json_field "$WORK/import-song.json" ops.0.result.imported.0.id)"
"$CORTEO" tools call edit_item --args "{\"adds\":[{\"type\":\"audio\",\"assetId\":\"$SONG\",\"fromFrame\":0},{\"type\":\"video\",\"assetId\":\"$A\",\"fromFrame\":0},{\"type\":\"video\",\"assetId\":\"$B\",\"fromFrame\":120}]}" --apply --json > "$WORK/place.json"
CLIP_A="$(node -e 'const j=require(process.argv[1]); const row=j.ops[0].result.results.find((item)=>item.placed&&item.placed.kind==="video"&&item.placed.startFrame===0); if(!row) process.exit(1); process.stdout.write(row.placed.itemId)' "$WORK/place.json")"
"$CORTEO" item trim "$CLIP_A" --to 2s --apply --json > "$WORK/trim.json"
"$CORTEO" tools call edit_item --args '{"adds":[{"type":"text","text":"Receta rapida","fromFrame":0,"durationInFrames":50,"fontSize":96,"position":"center"}]}' --apply --json > "$WORK/title.json"
CC_RENDER_GL=swangle "$CORTEO" render --out "$WORK/rapida.mp4" --to-audio --resolution 1080p --quiet
node -e '
const { execFileSync } = require("child_process");
const file = process.argv[1];
const duration = Number(execFileSync("ffprobe", ["-v","error","-show_entries","format=duration","-of","default=nw=1:nk=1", file], { encoding: "utf8" }));
const size = execFileSync("ffprobe", ["-v","error","-select_streams","v:0","-show_entries","stream=width,height","-of","csv=p=0", file], { encoding: "utf8" }).trim().replace(/,+$/, "");
if (!(duration > 1.8 && duration < 2.2)) { console.error("rapida duration " + duration); process.exit(1); }
if (size !== "1920,1080") { console.error("rapida size " + size); process.exit(1); }
' "$WORK/rapida.mp4"

# --- skills/corteo/SKILL.md › Video musical ---
WORK="$EXPORT/musical"
mkdir -p "$WORK"
ffmpeg -y -hide_banner -loglevel error -f lavfi -i "color=c=0x1a1a1a:s=640x360:d=3:r=30" -t 3 -c:v libx264 -pix_fmt yuv420p "$WORK/clip-a.mp4"
ffmpeg -y -hide_banner -loglevel error -f lavfi -i "color=c=0x333355:s=640x360:d=8:r=30" -t 8 -c:v libx264 -pix_fmt yuv420p "$WORK/clip-b.mp4"
ffmpeg -y -hide_banner -loglevel error -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=6" -t 6 "$WORK/song.wav"
printf '%s\n' $'1\n00:00:03,000 --> 00:00:05,000\nprimera linea' > "$WORK/lyrics.srt"
"$CORTEO" --help >/dev/null
"$CORTEO" project new "Video musical" --size 1920x1080 --fps 30 --json > "$WORK/project.json"
"$CORTEO" project list --json > "$WORK/projects.json"
"$CORTEO" media import "$WORK/clip-a.mp4" --apply --json > "$WORK/import-a.json"
"$CORTEO" media import "$WORK/clip-b.mp4" --apply --json > "$WORK/import-b.json"
"$CORTEO" media import "$WORK/song.wav" --apply --json > "$WORK/import-song.json"
"$CORTEO" media ls --json > "$WORK/media.json"
A="$(json_field "$WORK/import-a.json" ops.0.result.imported.0.id)"
B="$(json_field "$WORK/import-b.json" ops.0.result.imported.0.id)"
SONG="$(json_field "$WORK/import-song.json" ops.0.result.imported.0.id)"
"$CORTEO" tools call detect_beats --args "{\"assetId\":\"$SONG\"}" --json > "$WORK/beats.json"
"$CORTEO" tools ls --json > "$WORK/tools.json"
"$CORTEO" tools ls --all --json > "$WORK/tools-all.json"
node -e 'const rows=require(process.argv[1]); if (!rows.some((row)=>row.name==="detect_beats")) process.exit(1);' "$WORK/tools-all.json"
"$CORTEO" tools call edit_item --args "{\"adds\":[{\"type\":\"video\",\"assetId\":\"$A\",\"fromFrame\":0}]}" --apply --json > "$WORK/place-a.json"
"$CORTEO" tools call edit_item --args "{\"adds\":[{\"type\":\"video\",\"assetId\":\"$B\",\"fromFrame\":120}]}" --apply --json > "$WORK/place-b.json"
"$CORTEO" tools call edit_item --args "{\"adds\":[{\"type\":\"audio\",\"assetId\":\"$SONG\",\"fromFrame\":0}]}" --apply --json > "$WORK/place-song.json"
"$CORTEO" tools call edit_item --args '{"adds":[{"type":"text","text":"Video musical","name":"Titulo","fromFrame":30,"durationInFrames":60,"fontSize":120,"color":"#ffffff","fontWeight":700,"align":"center","position":"center"}]}' --apply --json > "$WORK/place-title.json"
CLIP_A="$(json_field "$WORK/place-a.json" ops.0.result.results.0.placed.itemId)"
CLIP_B="$(json_field "$WORK/place-b.json" ops.0.result.results.0.placed.itemId)"
TITLE="$(json_field "$WORK/place-title.json" ops.0.result.results.0.placed.itemId)"
TITLE_FRAME="$(json_field "$WORK/place-title.json" ops.0.result.results.0.placed.startFrame)"
TITLE_TRACK="$(json_field "$WORK/place-title.json" ops.0.result.results.0.placed.track)"
CLIP_TRACK="$(json_field "$WORK/place-a.json" ops.0.result.results.0.placed.track)"
[[ "$TITLE_FRAME" == "30" ]] || fail "title fromFrame landed at $TITLE_FRAME"
[[ "$TITLE_TRACK" != "$CLIP_TRACK" ]] || fail "title landed on the clip track $CLIP_TRACK"
"$CORTEO" item move "$CLIP_B" --start 90 --apply --json > "$WORK/move.json"
"$CORTEO" item split "$CLIP_A" --at 1s --apply --json > "$WORK/split.json"
NEW_ID="$(json_field "$WORK/split.json" ops.0.result.newItemId)"
[[ -n "$NEW_ID" ]] || fail "split did not return newItemId"
"$CORTEO" item rm "$NEW_ID" --apply --json > "$WORK/rm-split.json"
"$CORTEO" item trim "$TITLE" --fade-in 0.4 --fade-out 0.4 --apply --json > "$WORK/fade.json"
"$CORTEO" tools call edit_track --args '{"action":"create","json":{"trackType":"audio","name":"Musica"}}' --apply --json > "$WORK/track-object.json"
printf '%s\n' '{"action":"create","json":"{\"trackType\":\"video\",\"name\":\"Titulos\"}"}' > "$WORK/track.json"
"$CORTEO" tools call edit_track --args @"$WORK/track.json" --apply --json > "$WORK/track-string.json"
"$CORTEO" timeline items --json > "$WORK/before-dup.json"
"$CORTEO" item dup "$CLIP_B" --apply --json > "$WORK/dup.json"
"$CORTEO" timeline items --json > "$WORK/after-dup.json"
COPY="$(node -e '
const before = new Set(require(process.argv[1]).items.map((item) => item.id));
const copy = require(process.argv[2]).items.find((item) => !before.has(item.id));
if (!copy) process.exit(1);
process.stdout.write(copy.id);
' "$WORK/before-dup.json" "$WORK/after-dup.json")"
"$CORTEO" item rm "$COPY" --apply --json > "$WORK/rm.json"
node -e '
const fs = require("fs");
const fps = 30;
const blocks = fs.readFileSync(process.argv[1], "utf8").replace(/^\uFEFF/, "").trim().split(/\n\s*\n/);
const adds = [];
for (const block of blocks) {
  const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const time = lines.find((line) => line.includes("-->"));
  if (!time) continue;
  const toFrame = (stamp) => {
    const [h, m, rest] = stamp.split(":");
    const [s, ms] = rest.split(",");
    return Math.round((Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000) * fps);
  };
  const [start, end] = time.split("-->").map((part) => part.trim().split(/\s/)[0]);
  const fromFrame = toFrame(start);
  adds.push({ type: "text", text: lines.slice(lines.indexOf(time) + 1).join("\n"), fromFrame, durationInFrames: Math.max(1, toFrame(end) - fromFrame), fontSize: 64, position: "bottom", align: "center" });
}
fs.writeFileSync(process.argv[2], JSON.stringify({ adds }));
' "$WORK/lyrics.srt" "$WORK/lyrics-adds.json"
"$CORTEO" tools call edit_item --args @"$WORK/lyrics-adds.json" --apply --json > "$WORK/lyrics.json"
"$CORTEO" project show "Video musical" --doc --out "$WORK/project-doc.json" --json > "$WORK/show.json"
"$CORTEO" timeline show --json > "$WORK/timeline.json"
"$CORTEO" timeline items --json > "$WORK/items.json"
node -e '
const items = require(process.argv[1]).items;
const show = require(process.argv[2]);
const title = process.argv[3];
const clipTrack = process.argv[4];
const splitId = process.argv[5];
const row = items.find((item) => item.id === title);
if (!row || row.startFrame !== 30) process.exit(2);
if (row.track === clipTrack) process.exit(3);
if (items.some((item) => item.id === splitId)) process.exit(4);
const name = show.timelines.find((timeline) => timeline.active) || show.timelines[0];
if (!name || name.name !== "Secuencia 1") process.exit(5);
if (JSON.stringify(items).includes("文字") || JSON.stringify(items).includes("序列")) process.exit(6);
' "$WORK/items.json" "$WORK/timeline.json" "$TITLE" "$CLIP_TRACK" "$NEW_ID"
"$CORTEO" item trim "$CLIP_B" --to 6s --apply --json > "$WORK/trim-b.json"
"$CORTEO" timeline items --json > "$WORK/items.json"
node -e '
const items = require(process.argv[1]).items;
const clipB = items.find((item) => item.id === process.argv[2]);
if (!clipB || clipB.startFrame + clipB.durationInFrames !== 180) {
  console.error(clipB && (clipB.startFrame + clipB.durationInFrames));
  process.exit(7);
}
' "$WORK/items.json" "$CLIP_B"
CC_RENDER_GL=swangle "$CORTEO" render --out "$WORK/musical.mp4" --to-audio --resolution 1080p --quiet
node -e '
const { execFileSync } = require("child_process");
const file = process.argv[1];
const duration = Number(execFileSync("ffprobe", ["-v","error","-show_entries","format=duration","-of","default=nw=1:nk=1", file], { encoding: "utf8" }));
const size = execFileSync("ffprobe", ["-v","error","-select_streams","v:0","-show_entries","stream=width,height","-of","csv=p=0", file], { encoding: "utf8" }).trim().replace(/,+$/, "");
const audio = execFileSync("ffprobe", ["-v","error","-select_streams","a","-show_entries","stream=codec_type","-of","csv=p=0", file], { encoding: "utf8" }).trim();
if (!(duration > 5.9 && duration < 6.1)) { console.error("duration " + duration); process.exit(1); }
if (size !== "1920,1080") { console.error("size " + size); process.exit(1); }
if (!audio.includes("audio")) { console.error("audio " + audio); process.exit(1); }
' "$WORK/musical.mp4"
OPENCHATCUT_RENDER_CONCURRENCY=1 CC_RENDER_GL=swangle "$CORTEO" render --out "$WORK/musical-4k.mp4" --from 0 --to 1s --resolution 4k --quiet
node -e '
const { execFileSync } = require("child_process");
const size = execFileSync("ffprobe", ["-v","error","-select_streams","v:0","-show_entries","stream=width,height","-of","csv=p=0", process.argv[1]], { encoding: "utf8" }).trim().replace(/,+$/, "");
if (size !== "3840,2160") { console.error(size); process.exit(1); }
' "$WORK/musical-4k.mp4"

# --- Lyric video ---
WORK="$EXPORT/lyric"
mkdir -p "$WORK"
ffmpeg -y -hide_banner -loglevel error -f lavfi -i "sine=frequency=330:sample_rate=48000:duration=4" -t 4 "$WORK/song.wav"
printf '%s\n' $'1\n00:00:00,500 --> 00:00:02,000\nsegunda linea' > "$WORK/lyrics.srt"
"$CORTEO" project new "Lyric video" --size 1920x1080 --fps 30 --json > "$WORK/project.json"
"$CORTEO" media import "$WORK/song.wav" --apply --json > "$WORK/import-song.json"
SONG="$(json_field "$WORK/import-song.json" ops.0.result.imported.0.id)"
"$CORTEO" tools call edit_item --args "{\"adds\":[{\"type\":\"audio\",\"assetId\":\"$SONG\",\"fromFrame\":0}]}" --apply --json > "$WORK/place-song.json"
node -e '
const fs = require("fs");
const fps = 30;
const blocks = fs.readFileSync(process.argv[1], "utf8").replace(/^\uFEFF/, "").trim().split(/\n\s*\n/);
const adds = [];
for (const block of blocks) {
  const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const time = lines.find((line) => line.includes("-->"));
  if (!time) continue;
  const toFrame = (stamp) => {
    const [h, m, rest] = stamp.split(":");
    const [s, ms] = rest.split(",");
    return Math.round((Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000) * fps);
  };
  const [start, end] = time.split("-->").map((part) => part.trim().split(/\s/)[0]);
  const fromFrame = toFrame(start);
  adds.push({ type: "text", text: lines.slice(lines.indexOf(time) + 1).join("\n"), fromFrame, durationInFrames: Math.max(1, toFrame(end) - fromFrame), fontSize: 72, position: "center" });
}
fs.writeFileSync(process.argv[2], JSON.stringify({ adds }));
' "$WORK/lyrics.srt" "$WORK/lyrics-adds.json"
"$CORTEO" tools call edit_item --args @"$WORK/lyrics-adds.json" --apply --json > "$WORK/lyrics.json"
LYRIC_FRAME="$(json_field "$WORK/lyrics.json" ops.0.result.results.0.placed.startFrame)"
[[ "$LYRIC_FRAME" == "15" ]] || fail "lyric fromFrame landed at $LYRIC_FRAME"
CC_RENDER_GL=swangle "$CORTEO" render --out "$WORK/lyric.mp4" --to 2s --resolution 1080p --quiet

# --- Short vertical 9:16 ---
WORK="$EXPORT/short"
mkdir -p "$WORK"
ffmpeg -y -hide_banner -loglevel error -f lavfi -i "color=c=black:s=1920x1080:r=30:d=3,geq=r='X/8':g='Y/4':b=128" -t 3 -c:v libx264 -pix_fmt yuv420p "$WORK/wide.mp4"
"$CORTEO" project new "Short" --size 1080x1920 --fps 30 --json > "$WORK/project.json"
"$CORTEO" media import "$WORK/wide.mp4" --apply --json > "$WORK/import.json"
CLIP="$(json_field "$WORK/import.json" ops.0.result.imported.0.id)"
"$CORTEO" tools call edit_item --args "{\"adds\":[{\"type\":\"video\",\"assetId\":\"$CLIP\",\"fromFrame\":0}]}" --apply --json > "$WORK/place.json"
ITEM="$(json_field "$WORK/place.json" ops.0.result.results.0.placed.itemId)"
"$CORTEO" item fit "$ITEM" --mode cover --apply --json > "$WORK/fit-cover.json"
"$CORTEO" tools call edit_item --args "{\"updates\":[{\"type\":\"video\",\"itemId\":\"$ITEM\",\"transform\":{\"x\":-8}}]}" --apply --json > "$WORK/offset.json"
"$CORTEO" tools call edit_item --args '{"adds":[{"type":"text","text":"9:16","fromFrame":15,"durationInFrames":45,"fontSize":96,"position":"bottom"}]}' --apply --json > "$WORK/title.json"
CC_RENDER_GL=swangle "$CORTEO" render --out "$WORK/short-cover.mp4" --to 3s --resolution 1080p --quiet
check_bars "$WORK/short-cover.mp4" cover
"$CORTEO" item fit "$ITEM" --mode contain --background blur --apply --json > "$WORK/fit-blur.json"
CC_RENDER_GL=swangle "$CORTEO" render --out "$WORK/short-blur.mp4" --to 3s --resolution 1080p --quiet
check_bars "$WORK/short-blur.mp4" blur

# --- Motion title ---
WORK="$EXPORT/titulo"
mkdir -p "$WORK"
"$CORTEO" project new "Titulo" --size 1920x1080 --fps 30 --json > "$WORK/project.json"
"$CORTEO" tools call edit_item --args '{"adds":[{"type":"text","text":"entra","fromFrame":0,"durationInFrames":60,"fontSize":140,"fontWeight":700,"position":"center"}]}' --apply --json > "$WORK/place.json"
ITEM="$(json_field "$WORK/place.json" ops.0.result.results.0.placed.itemId)"
"$CORTEO" tools call edit_item --args "{\"updates\":[{\"type\":\"text\",\"itemId\":\"$ITEM\",\"keyframes\":{\"opacity\":[{\"frame\":0,\"value\":0,\"easing\":\"easeOut\"},{\"frame\":15,\"value\":1}],\"y\":[{\"frame\":0,\"value\":12,\"easing\":\"easeOut\"},{\"frame\":20,\"value\":0}]}}]}" --apply --json > "$WORK/motion.json"
"$CORTEO" item trim "$ITEM" --fade-in 0.3 --fade-out 0.3 --apply --json > "$WORK/fade.json"
CC_RENDER_GL=swangle "$CORTEO" render --out "$WORK/titulo.mp4" --to 2s --resolution 1080p --quiet

# --- MCP handshake ---
TOKEN_PATH="$("$CORTEO" mcp token)"
TOKEN="$("$CORTEO" mcp token --show)"
[[ "$TOKEN_PATH" != *"$TOKEN"* ]] || fail "mcp token printed the token with the path"
code_denied="$(curl -sS -o "$ROOT/mcp-denied.json" -w '%{http_code}' -X POST "http://127.0.0.1:${CORTEO_PORT}/api/external-mcp/mcp" -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}')"
[[ "$code_denied" == "403" ]] || fail "MCP without a token returned $code_denied"
code_ok="$(curl -sS -D "$ROOT/mcp-headers.txt" -o "$ROOT/mcp-body.txt" -w '%{http_code}' "http://127.0.0.1:${CORTEO_PORT}/api/external-mcp/mcp" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"corteo-acceptance","version":"0"}}}')"
[[ "$code_ok" == "200" ]] || fail "MCP initialize returned $code_ok"
grep -q 'serverInfo\|protocolVersion' "$ROOT/mcp-body.txt" || fail "MCP body was not a handshake"

if grep -q 'Failed to load url /@fs/src/main.tsx' "$LOG"; then
  fail "vite warmup still requests /@fs/src/main.tsx"
fi

dirty="$(git -C "$CORTEO_DIR" status --short)"
[[ -z "$dirty" ]] || fail "installer left files in the clone: ${dirty}"

pass=1
printf 'ACCEPTANCE=PASS\n'
exit 0
