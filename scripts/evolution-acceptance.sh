#!/usr/bin/env bash
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/corteo-evolution.XXXXXX")"
export CORTEO_STORE_DIR="$T/library" CORTEO_MEDIA_INBOX="$T/inbox" CORTEO_EXPORT_DIR="$T/exports" CC_RENDER_GL=swangle
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
mkdir -p "$CORTEO_STORE_DIR" "$CORTEO_MEDIA_INBOX" "$CORTEO_EXPORT_DIR" "$T/home"
cd "$REPO"
FFPROBE="$(node -p "require('@ffprobe-installer/ffprobe').path")"
before="$(git -C "$REPO" status --porcelain)"
step_name="setup"
started=$SECONDS
fail() { printf 'EVOLUTION=FAIL step=%s scratch=%s\n' "$step_name" "$T" >&2; }
trap fail ERR
step() { step_name="$1"; started=$SECONDS; printf 'step %s\n' "$step_name"; }
done_step() { printf 'step %s seconds=%s\n' "$step_name" "$((SECONDS - started))"; }

step profiles
for host in grok muse claude-duet; do "$REPO/scripts/corteo" host show "$host" --json > "$T/profile-$host.json"; done
HOME="$T/home" "$REPO/scripts/corteo" host install muse --json > "$T/install.json"
cmp "$T/home/.config/muse/skills/corteo/SKILL.md" "$REPO/skills/corteo/SKILL.md"
done_step

step roundtrip
ffmpeg -y -hide_banner -loglevel error -f lavfi -i 'color=c=0x224466:s=1280x720:d=3:r=30' -c:v libx264 -pix_fmt yuv420p "$T/inbox/clip.mp4"
"$REPO/scripts/corteo" inbox --host grok --json > "$T/roundtrip.json"
ROUNDTRIP="$(node -p 'require(process.argv[1]).exportPath' "$T/roundtrip.json")"
"$FFPROBE" -v error -show_streams -show_format -of json "$ROUNDTRIP" > "$T/roundtrip-probe.json"
node -e 'const p=require(process.argv[1]);const v=p.streams.find(s=>s.codec_type==="video");if(v.width!==720||v.height!==1280||Math.abs(Number(p.format.duration)-3)>0.1)process.exit(1)' "$T/roundtrip-probe.json"
done_step

step song-film
node - "$T/song.wav" <<'NODE'
const fs = require('fs'), rate = 22050, seconds = 12, total = rate * seconds;
const samples = new Float32Array(total); let seed = 987654321;
for (let beat = 0; beat < seconds * 2; beat++) {
  const start = Math.round(beat * 0.5 * rate), loud = beat < seconds ? 0.35 : 0.9;
  for (let i = 0; i < 0.04 * rate && start + i < total; i++) { const t = i / rate; samples[start + i] += loud * 0.7 * Math.exp(-t * 80) * Math.sin(2 * Math.PI * 1200 * t); }
  if (beat % 4 === 0) for (let i = 0; i < 0.25 * rate && start + i < total; i++) { const t = i / rate; samples[start + i] += loud * 0.5 * Math.exp(-t * 6) * Math.sin(2 * Math.PI * 55 * t); }
}
const data = Buffer.alloc(total * 2);
for (let i = 0; i < total; i++) { seed = (Math.imul(1103515245, seed) + 12345) >>> 0; const v = samples[i] + 0.01 * (seed / 4294967296 * 2 - 1); data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2); }
const h = Buffer.alloc(44); h.write('RIFF'); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40); fs.writeFileSync(process.argv[2], Buffer.concat([h, data]));
NODE
printf 'uno\ndos\ntres\ncuatro\n' > "$T/song.txt"
ffmpeg -y -hide_banner -loglevel error -f lavfi -i 'nullsrc=s=360x640,geq=r=255*X/W:g=80:b=255*Y/H' -frames:v 1 -threads 1 "$T/still-a.png"
ffmpeg -y -hide_banner -loglevel error -f lavfi -i 'nullsrc=s=360x640,geq=r=255*Y/H:g=130:b=255*X/W' -frames:v 1 -threads 1 "$T/still-b.png"
"$REPO/scripts/corteo" song-film --audio "$T/song.wav" --stills "$T/still-a.png,$T/still-b.png" --to 12s --resolution 720p --out "$T/film.mp4" --json > "$T/film.json"
node -e 'const r=require(process.argv[1]);if(!r.ok||r.lyricsSource!=="txt"||r.lines.length!==4||r.cutGrid!=="downbeat")process.exit(1)' "$T/film.json"
"$FFPROBE" -v error -show_streams -show_format -of json "$T/film.mp4" > "$T/film-probe.json"
node -e 'const p=require(process.argv[1]);const v=p.streams.find(s=>s.codec_type==="video");if(v.width!==720||v.height!==1280||Math.abs(Number(p.format.duration)-12)>0.2||p.streams.filter(s=>s.codec_type==="audio").length!==1)process.exit(1)' "$T/film-probe.json"
done_step

step shorts
npx tsx src/agent/tools/shorts-host-flow.verify.ts
done_step
step router
node scripts/harness/router.verify.mjs
done_step
step delegate
npx tsx server/brain/delegate.verify.ts
done_step
step ide-door
node scripts/harness/ide-door.verify.mjs
done_step
if [[ "${EVOLUTION_LIVE:-0}" == 1 ]]; then
  step brain-live
  npm run brain:status | grep -q '"running":true'
  node --input-type=module -e 'import {readFileSync} from "node:fs";const home=process.env.CORTEO_HARNESS_HOME||process.env.HOME+"/.corteo-harness";const key=JSON.parse(readFileSync(home+"/our-free-model/settings.json")).forwardKey;const state=JSON.parse(readFileSync(home+"/brain.json"));const r=await fetch(`http://127.0.0.1:${state.routerPort}/v1/models`,{headers:{Authorization:`Bearer ${key}`}});const j=await r.json();if(!r.ok||j.data.length!==3)process.exit(1)'
  done_step
fi
step clean
after="$(git -C "$REPO" status --porcelain)"
[[ "$before" == "$after" ]]
rm -rf "$T"
done_step
trap - ERR
printf 'EVOLUTION=PASS\n'
