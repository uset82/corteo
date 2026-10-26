#!/usr/bin/env bash
# Replays the install from bot/skills/corteo-setup/SKILL.md, in a throwaway HOME.
#
# The installer has its own proofs (scripts/install.verify.mjs, the acceptance
# harness). This one answers a different question: is the text a bot will copy
# actually executable? So the commands below are the skill's commands, not
# better versions of them, and `scripts/bot-recipe.verify.mjs` fails the build
# when the two drift apart.
#
# Run it on a clean Linux box:
#   bash scripts/bot-rehearsal.sh
# It prints one timing per step and ends with BOT_REHEARSAL=PASS plus the
# render's ffprobe facts.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL="$REPO/bot/skills/corteo-setup/SKILL.md"
KEEP="${KEEP:-0}"
TMP="$(mktemp -d)"

step() { printf '[rehearsal] %s\n' "$*" >&2; }
fail() {
  printf 'BOT_REHEARSAL=FAIL\n' >&2
  printf '[rehearsal] %s\n' "$*" >&2
  [[ -n "${CORTEO_WORK:-}" && -f "$CORTEO_WORK/corteo-install.log" ]] && tail -n 25 "$CORTEO_WORK/corteo-install.log" >&2
  printf '[rehearsal] kept %s for inspection\n' "$TMP" >&2
  exit 1
}

[[ -f "$SKILL" ]] || fail "missing $SKILL"
[[ -f "$REPO/install.sh" ]] || fail "missing $REPO/install.sh"

# A throwaway HOME is the whole trick: the installer's default --dir is
# $HOME/corteo, so the skill's `~/corteo/corteo.env` resolves to the temp tree
# and nothing on the real machine is touched.
export HOME="$TMP/home"
export CORTEO_WORK="$TMP/workspace"
export CORTEO_SRC="file://$REPO"
mkdir -p "$HOME" "$CORTEO_WORK" || fail "cannot create $TMP"
step "home=$HOME work=$CORTEO_WORK src=$CORTEO_SRC"

# ── Step 1: install, detached, exactly as the skill writes it ───────────────
START=$SECONDS
CORTEO_WORK="${CORTEO_WORK:-/workspace}"
CORTEO_SRC="${CORTEO_SRC:-https://raw.githubusercontent.com/uset82/corteo/main}"
mkdir -p "$CORTEO_WORK"
export CORTEO_SRC
nohup setsid bash -c 'curl -fsSL "$CORTEO_SRC/install.sh" | bash -s -- --json' > "$CORTEO_WORK/corteo-install.log" 2>&1 < /dev/null &
step "step 1 install started in $((SECONDS - START))s"

# ── Step 2: poll once a turn, the way a bot would ───────────────────────────
START=$SECONDS
status=""
for _ in $(seq 1 120); do
  status="$(grep -o '"CORTEO_STATUS":"[a-z]*"' "$CORTEO_WORK/corteo-install.log" || echo "still installing")"
  case "$status" in
    *ok*) break ;;
    *failed*) break ;;
  esac
  sleep 5
done
step "step 2 wait $((SECONDS - START))s -> $status"
case "$status" in
  *ok*) ;;
  *) fail "the installer did not report CORTEO_STATUS=ok (got: $status)" ;;
esac

# ── Step 3: prove it, exactly as the skill writes it ────────────────────────
START=$SECONDS
CORTEO_WORK="${CORTEO_WORK:-/workspace}"
. ~/corteo/corteo.env || fail "the installer did not write ~/corteo/corteo.env"
"$CORTEO_OCC" where --json || fail "occ where failed"
"$CORTEO_OCC" project new "Prueba" --json || fail "occ project new failed"
"$CORTEO_OCC" render --out "$CORTEO_WORK/selftest.mp4" --to 2s --resolution 480p --quiet --detach --json \
  || fail "occ render --detach failed"

# The skill's line is `job wait --timeout 20`, one call per turn. A rehearsal
# has no turns, so it repeats the same line until the job ends.
state="running"
for _ in $(seq 1 30); do
  report="$("$CORTEO_OCC" job wait --timeout 20 --json)"
  state="$(printf '%s' "$report" | node -e 'let s="";process.stdin.on("data",(d)=>{s+=d}).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).state))}catch{process.stdout.write("unreadable")}})')"
  case "$state" in
    done) break ;;
    failed) fail "the self-test render failed" ;;
  esac
done
[[ "$state" == "done" ]] || fail "the self-test render never finished (state: $state)"
step "step 3 where, project new, render $((SECONDS - START))s -> done"

# ── Step 4: the file has to be a real video ─────────────────────────────────
START=$SECONDS
facts_file="$CORTEO_WORK/selftest-ffprobe.json"
ffprobe -v error -show_entries format=duration -show_entries stream=codec_name,width,height -of json "$CORTEO_WORK/selftest.mp4" > "$facts_file" \
  || fail "ffprobe could not read $CORTEO_WORK/selftest.mp4"
video="$(node -e '
const facts = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const stream = (facts.streams ?? [])[0] ?? {};
const duration = Number(facts.format?.duration ?? 0);
const problems = [];
if (stream.codec_name !== "h264") problems.push(`codec ${stream.codec_name}, wanted h264`);
if (stream.width !== 854 && stream.width !== 640) problems.push(`width ${stream.width}`);
if (!(duration > 1.5 && duration < 3)) problems.push(`duration ${duration}`);
if (problems.length) { console.error(problems.join("; ")); process.exit(1); }
process.stdout.write(`${stream.codec_name} ${stream.width}x${stream.height} ${duration.toFixed(2)}s`);
' "$facts_file")" || fail "the self-test render is not the video the skill promises"
step "step 4 ffprobe $((SECONDS - START))s -> $video"

printf 'BOT_REHEARSAL=PASS\n'
printf 'BOT_REHEARSAL_VIDEO=%s\n' "$video"
printf 'BOT_REHEARSAL_LOG=%s\n' "$CORTEO_WORK/corteo-install.log"

if [[ "$KEEP" != "1" ]]; then
  rm -rf -- "${TMP:?}"
else
  printf 'BOT_REHEARSAL_KEPT=%s\n' "$TMP"
fi
