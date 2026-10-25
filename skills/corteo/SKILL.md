---
name: corteo
description: >
  Use when making or editing a music video, clip, lyric video, title card, or
  animation on this machine. corteo is the local video editor. Install it, start
  it, import media from disk, build a timeline, and export an MP4. Use it even
  if the user only says "edit this video" or "make a lyric video".
---

# corteo

corteo is a local video editor (a fork of OpenChatCut, AGPL v3). It runs on this Linux VM. You drive it from the shell. No API key is required. A browser is not required. The Cloudflare tunnel is optional and is not part of making a video.

The shell prints JSON when you pass `--json`. The wrapper below selects Node 24 and clears `NPM_CONFIG_PREFIX`, so it works in a fresh shell whose `node` is still Node 20.

```bash
CORTEO=~/corteo/scripts/corteo
"$CORTEO" --help
```

Do not call `npm run corteo` from a Node 20 shell. That crashes with `ERR_UNKNOWN_BUILTIN_MODULE`. Use `$CORTEO`.

## Install

On a fresh Debian or Ubuntu box, once. It installs Node 24 if needed, clones the repo to `~/corteo`, and renders a 2 second test MP4. Safe to run again. ffmpeg must already be installed (`apt-get install -y ffmpeg`).

```bash
curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/scripts/claudia-install.sh | bash
```

PASS looks like `CORTEO_SELF_TEST=PASS`. FAIL looks like `CORTEO_SELF_TEST=FAIL` plus a line `self-test step failed: <step>`. The free-model chat harness is optional and is not part of this install.

## Start

Leave this running when you also want the editor page or MCP. The shell below does not need it for imports, edits, or render.

```bash
cd ~/corteo
npm run claudia:local
```

It listens only on `http://127.0.0.1:5199`. MCP is `http://127.0.0.1:5199/api/external-mcp/mcp`. Paid providers stay off. Stop it with Ctrl+C.

## Verbs

Run from any directory. Writes need `--apply`. Without `--apply` the change is thrown away.

```bash
CORTEO=~/corteo/scripts/corteo
"$CORTEO" --help
"$CORTEO" project new "Night bus" --size 1920x1080 --fps 30 --json
"$CORTEO" project list --json
"$CORTEO" project show "Night bus" --doc --out ~/corteo-exports/night-bus.json --json
"$CORTEO" media import /absolute/path/clip.mp4 --apply --json
"$CORTEO" media ls --json
"$CORTEO" tools ls --json
"$CORTEO" tools ls --all --json
"$CORTEO" tools call edit_item --args '{"adds":[{"type":"video","assetId":"ASSET_ID","fromFrame":0}]}' --apply --json
"$CORTEO" item move ITEM_ID --start 90 --apply --json
"$CORTEO" item trim ITEM_ID --duration 2s --fade-in 0.4 --fade-out 0.4 --apply --json
"$CORTEO" item split ITEM_ID --at 1s --apply --json
"$CORTEO" item dup ITEM_ID --apply --json
"$CORTEO" item rm ITEM_ID --apply --json
"$CORTEO" timeline show --json
"$CORTEO" timeline items --json
CC_RENDER_GL=swangle "$CORTEO" render --out ~/corteo-exports/night-bus.mp4 --from 0 --to 6s --resolution 1080p --quiet
```

Read ids from the JSON. `node -e` in this repo is CommonJS, and `process.argv[1]` is the file you pass after the script.

```bash
node -e 'const j=require(process.argv[1]); process.stdout.write(j.ops[0].result.imported[0].id)' import.json
node -e 'const j=require(process.argv[1]); process.stdout.write(j.ops[0].result.results[0].placed.itemId)' place.json
node -e 'const j=require(process.argv[1]); process.stdout.write(j.ops[0].result.newItemId)' split.json
```

`media import` needs an absolute path. The asset id is `ops[0].result.imported[0].id`. A placed clip id is `ops[0].result.results[0].placed.itemId`. `fromFrame` on that object is where it actually landed. A split's new piece is `ops[0].result.newItemId` (also `newItemIds`). The original id stays the left piece.

`render --resolution` is `480p`, `720p`, `1080p`, or `4k`. `--from` and `--to` take a frame number or a time (`2s`). No GPU: `CC_RENDER_GL=swangle`. If the render is killed (out of memory), run it again with `OPENCHATCUT_RENDER_CONCURRENCY=1`.

`edit_track` create takes `json` as an object or as a string. An object used to fail schema validation.

```bash
"$CORTEO" tools call edit_track --args '{"action":"list"}' --json
"$CORTEO" tools call edit_track --args '{"action":"create","json":{"trackType":"audio","name":"Musica"}}' --apply --json
printf '%s\n' '{"action":"create","json":"{\"trackType\":\"video\",\"name\":\"Titulos\"}"}' > /tmp/corteo-track.json
"$CORTEO" tools call edit_track --args @/tmp/corteo-track.json --apply --json
```

You do not need `edit_track` before placing audio or a title. Audio with no `trackId` creates an audio track. Text with no `trackId` goes on an overlay above the clips and keeps `fromFrame`.

Text fields: `text`, `fontSize` (pixels), `color` (`#rrggbb`), `fontWeight` (400 or 700), `align` (`left`, `center`, `right`), `position` (`top`, `center`, `bottom`), `durationInFrames`, `fromFrame`.

```bash
"$CORTEO" tools call edit_item --args '{"adds":[{"type":"text","text":"Título","fromFrame":30,"durationInFrames":90,"fontSize":120,"color":"#ffffff","fontWeight":700,"align":"center","position":"center"}]}' --apply --json
```

The new project's timeline is named `Secuencia 1`. A text clip with no `name` is `Texto`.

## MCP

The server refuses a POST without `Authorization: Bearer <token>` (`403`, `invalid request origin`). Settings is a browser page. From the shell:

```bash
"$CORTEO" mcp token
TOKEN="$("$CORTEO" mcp token --show)"
curl -sS -D - http://127.0.0.1:5199/api/external-mcp/mcp \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -o /tmp/corteo-mcp-body \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"corteo","version":"0"}}}'
```

`mcp token` prints the file path and nothing else. `--show` prints the token only on stdout. The endpoint is localhost only. Do not write the token into a repo, a chat log, or a commit.

## Video musical

Song, clips cut on the beat when the analysis finds one, a title, a lyric line, fades, 1080p and a short 4K check.

```bash
CORTEO=~/corteo/scripts/corteo
WORK=~/corteo-exports/musical
mkdir -p "$WORK"
ffmpeg -y -hide_banner -loglevel error -f lavfi -i "color=c=0x1a1a1a:s=640x360:d=3:r=30" -t 3 -c:v libx264 -pix_fmt yuv420p "$WORK/clip-a.mp4"
ffmpeg -y -hide_banner -loglevel error -f lavfi -i "color=c=0x333355:s=640x360:d=3:r=30" -t 3 -c:v libx264 -pix_fmt yuv420p "$WORK/clip-b.mp4"
ffmpeg -y -hide_banner -loglevel error -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=6" -t 6 "$WORK/song.wav"
printf '%s\n' $'1\n00:00:03,000 --> 00:00:05,000\nprimera linea' > "$WORK/lyrics.srt"
"$CORTEO" project new "Video musical" --size 1920x1080 --fps 30 --json
"$CORTEO" media import "$WORK/clip-a.mp4" --apply --json > "$WORK/import-a.json"
"$CORTEO" media import "$WORK/clip-b.mp4" --apply --json > "$WORK/import-b.json"
"$CORTEO" media import "$WORK/song.wav" --apply --json > "$WORK/import-song.json"
A=$(node -e 'const j=require(process.argv[1]); process.stdout.write(j.ops[0].result.imported[0].id)' "$WORK/import-a.json")
B=$(node -e 'const j=require(process.argv[1]); process.stdout.write(j.ops[0].result.imported[0].id)' "$WORK/import-b.json")
SONG=$(node -e 'const j=require(process.argv[1]); process.stdout.write(j.ops[0].result.imported[0].id)' "$WORK/import-song.json")
"$CORTEO" tools call detect_beats --args "{\"assetId\":\"$SONG\"}" --json > "$WORK/beats.json"
"$CORTEO" tools call edit_item --args "{\"adds\":[{\"type\":\"video\",\"assetId\":\"$A\",\"fromFrame\":0}]}" --apply --json > "$WORK/place-a.json"
"$CORTEO" tools call edit_item --args "{\"adds\":[{\"type\":\"video\",\"assetId\":\"$B\",\"fromFrame\":120}]}" --apply --json > "$WORK/place-b.json"
"$CORTEO" tools call edit_item --args "{\"adds\":[{\"type\":\"audio\",\"assetId\":\"$SONG\",\"fromFrame\":0}]}" --apply --json > "$WORK/place-song.json"
"$CORTEO" tools call edit_item --args '{"adds":[{"type":"text","text":"Video musical","name":"Titulo","fromFrame":30,"durationInFrames":60,"fontSize":120,"color":"#ffffff","fontWeight":700,"align":"center","position":"center"}]}' --apply --json > "$WORK/place-title.json"
CLIP_A=$(node -e 'const j=require(process.argv[1]); process.stdout.write(j.ops[0].result.results[0].placed.itemId)' "$WORK/place-a.json")
CLIP_B=$(node -e 'const j=require(process.argv[1]); process.stdout.write(j.ops[0].result.results[0].placed.itemId)' "$WORK/place-b.json")
TITLE=$(node -e 'const j=require(process.argv[1]); process.stdout.write(j.ops[0].result.results[0].placed.itemId)' "$WORK/place-title.json")
"$CORTEO" item move "$CLIP_B" --start 90 --apply --json
"$CORTEO" item split "$CLIP_A" --at 1s --apply --json > "$WORK/split.json"
"$CORTEO" item trim "$TITLE" --fade-in 0.4 --fade-out 0.4 --apply --json
"$CORTEO" tools call edit_track --args '{"action":"create","json":{"trackType":"audio","name":"Musica"}}' --apply --json
printf '%s\n' '{"action":"create","json":"{\"trackType\":\"video\",\"name\":\"Titulos\"}"}' > "$WORK/track.json"
"$CORTEO" tools call edit_track --args @"$WORK/track.json" --apply --json
"$CORTEO" timeline items --json > "$WORK/before-dup.json"
"$CORTEO" item dup "$CLIP_B" --apply --json
"$CORTEO" timeline items --json > "$WORK/after-dup.json"
COPY=$(node -e '
const before = new Set(require(process.argv[1]).items.map((item) => item.id));
const copy = require(process.argv[2]).items.find((item) => !before.has(item.id));
if (!copy) process.exit(1);
process.stdout.write(copy.id);
' "$WORK/before-dup.json" "$WORK/after-dup.json")
"$CORTEO" item rm "$COPY" --apply --json
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
    const [h, m, rest] = stamp.split(":") ;
    const [s, ms] = rest.split(",");
    return Math.round((Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000) * fps);
  };
  const [start, end] = time.split("-->").map((part) => part.trim().split(/\s/)[0]);
  const fromFrame = toFrame(start);
  adds.push({ type: "text", text: lines.slice(lines.indexOf(time) + 1).join("\n"), fromFrame, durationInFrames: Math.max(1, toFrame(end) - fromFrame), fontSize: 64, position: "bottom", align: "center" });
}
fs.writeFileSync(process.argv[2], JSON.stringify({ adds }));
' "$WORK/lyrics.srt" "$WORK/lyrics-adds.json"
"$CORTEO" tools call edit_item --args @"$WORK/lyrics-adds.json" --apply --json
"$CORTEO" timeline show --json
"$CORTEO" timeline items --json > "$WORK/items.json"
mkdir -p ~/corteo-exports
CC_RENDER_GL=swangle "$CORTEO" render --out "$WORK/musical.mp4" --from 0 --to 6s --resolution 1080p --quiet
OPENCHATCUT_RENDER_CONCURRENCY=1 CC_RENDER_GL=swangle "$CORTEO" render --out "$WORK/musical-4k.mp4" --from 0 --to 1s --resolution 4k --quiet
```

`detect_beats` returns `bpm`, `beats` (source seconds), and `confidence`. Trust it when `bpm` is not 0. A tone or speech often returns `bpm: 0` and a note; then you pick the frames, as the `item split` above does. When it does return beats for a timeline clip, pass `itemId` and read `timelineBeatFrames`, then `item split CLIP --at <frame>`.

Clip B is placed at frame 120 and moved to 90 so it starts when clip A (3 seconds) ends. The title's `fromFrame` is 30 and its track is not the clip track. Check both in `place-title.json` (`placed.startFrame`, `placed.track`) and in `timeline items`.

## Lyric video

One song and lines from an `.srt`. The same node block as above builds the text adds. Render the range you care about.

```bash
CORTEO=~/corteo/scripts/corteo
WORK=~/corteo-exports/lyric
mkdir -p "$WORK"
ffmpeg -y -hide_banner -loglevel error -f lavfi -i "sine=frequency=330:sample_rate=48000:duration=4" -t 4 "$WORK/song.wav"
printf '%s\n' $'1\n00:00:00,500 --> 00:00:02,000\nsegunda linea' > "$WORK/lyrics.srt"
"$CORTEO" project new "Lyric video" --size 1920x1080 --fps 30 --json
"$CORTEO" media import "$WORK/song.wav" --apply --json > "$WORK/import-song.json"
SONG=$(node -e 'const j=require(process.argv[1]); process.stdout.write(j.ops[0].result.imported[0].id)' "$WORK/import-song.json")
"$CORTEO" tools call edit_item --args "{\"adds\":[{\"type\":\"audio\",\"assetId\":\"$SONG\",\"fromFrame\":0}]}" --apply --json
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
"$CORTEO" tools call edit_item --args @"$WORK/lyrics-adds.json" --apply --json
CC_RENDER_GL=swangle "$CORTEO" render --out "$WORK/lyric.mp4" --to 2s --resolution 1080p --quiet
```

## Short vertical 9:16

```bash
CORTEO=~/corteo/scripts/corteo
WORK=~/corteo-exports/short
mkdir -p "$WORK"
ffmpeg -y -hide_banner -loglevel error -f lavfi -i "color=c=0x111111:s=1080x1920:d=2:r=30" -t 2 -c:v libx264 -pix_fmt yuv420p "$WORK/clip.mp4"
"$CORTEO" project new "Short" --size 1080x1920 --fps 30 --json
"$CORTEO" media import "$WORK/clip.mp4" --apply --json > "$WORK/import.json"
CLIP=$(node -e 'const j=require(process.argv[1]); process.stdout.write(j.ops[0].result.imported[0].id)' "$WORK/import.json")
"$CORTEO" tools call edit_item --args "{\"adds\":[{\"type\":\"video\",\"assetId\":\"$CLIP\",\"fromFrame\":0}]}" --apply --json
"$CORTEO" tools call edit_item --args '{"adds":[{"type":"text","text":"9:16","fromFrame":15,"durationInFrames":45,"fontSize":96,"position":"bottom"}]}' --apply --json
CC_RENDER_GL=swangle "$CORTEO" render --out "$WORK/short.mp4" --to 1s --resolution 1080p --quiet
```

ffprobe should report `1080x1920`. `--resolution 1080p` keeps the short edge at 1080, so a vertical project stays vertical.

## Motion title

A title that fades and rises. `keyframes` are item-local frames. `y` is a percent of the canvas height.

```bash
CORTEO=~/corteo/scripts/corteo
WORK=~/corteo-exports/titulo
mkdir -p "$WORK"
"$CORTEO" project new "Titulo" --size 1920x1080 --fps 30 --json
"$CORTEO" tools call edit_item --args '{"adds":[{"type":"text","text":"entra","fromFrame":0,"durationInFrames":60,"fontSize":140,"fontWeight":700,"position":"center"}]}' --apply --json > "$WORK/place.json"
ITEM=$(node -e 'const j=require(process.argv[1]); process.stdout.write(j.ops[0].result.results[0].placed.itemId)' "$WORK/place.json")
"$CORTEO" tools call edit_item --args "{\"updates\":[{\"type\":\"text\",\"itemId\":\"$ITEM\",\"keyframes\":{\"opacity\":[{\"frame\":0,\"value\":0,\"easing\":\"easeOut\"},{\"frame\":15,\"value\":1}],\"y\":[{\"frame\":0,\"value\":12,\"easing\":\"easeOut\"},{\"frame\":20,\"value\":0}]}}]}" --apply --json
"$CORTEO" item trim "$ITEM" --fade-in 0.3 --fade-out 0.3 --apply --json
CC_RENDER_GL=swangle "$CORTEO" render --out "$WORK/titulo.mp4" --to 2s --resolution 1080p --quiet
```

## Where files go

- Code: `~/corteo`
- Wrapper: `~/corteo/scripts/corteo` and `~/corteo/bin/corteo`
- Projects and imported media: `~/.openchatcut/dev-profiles/<id>/`
- MCP token file: that same profile, `mcp-token` (or `OPENCHATCUT_MCP_TOKEN` if you set it)
- MP4 and JSON: the path you passed to `--out`. `~/corteo-exports/` is a good default

## Troubleshooting

- `ERR_UNKNOWN_BUILTIN_MODULE` or any crash that names a Node builtin: this shell is on Node 20. Use `~/corteo/scripts/corteo`. `node -v` can stay v20. The wrapper switches to Node 24.
- `nvm is not compatible with the "NPM_CONFIG_PREFIX" environment variable`: run the installer again, or `source ~/corteo/scripts/corteo-env.sh`. Do not unset the variable in your rc files. The next shell will set it again, and the wrapper clears it for corteo only.
- Render fails with WebGL or a blank file. `CC_RENDER_GL=swangle`. This machine has no GPU.
- Render fails with a missing `.so`. `cd ~/corteo && npx playwright install-deps chromium`. Do not put `sudo` in front of `npx`.
- The first render starts downloading a headless Chrome. The installer should have pointed Remotion at system Chrome (`CC_BROWSER_EXECUTABLE`) or downloaded the shell already. Run the installer again. Do not wait for a surprise download in the middle of a video.
- Port 5199 is in use. Another `npm run claudia:local` is still running. Stop that process and start again. The shell works without that server.
- Render is killed or the machine swaps hard. `OPENCHATCUT_RENDER_CONCURRENCY=1` and a shorter `--to`.
- `media import` rejects a relative path. Use an absolute path.
- A command prints a draft and says nothing was committed. Add `--apply`.
- `edit_track` says `/json must be string`. Pass an object (`"json":{"trackType":"audio"}`) or a string of JSON. Both work.
- Text ignores `fromFrame` and sits at the end of the clip. Omit `trackId`. The title goes on the overlay. Read `placed.startFrame` and `placed.track`.
- Audio says `no audio track for placement`. Omit `trackId`. An audio track is created. Or call `edit_track` create as above.
