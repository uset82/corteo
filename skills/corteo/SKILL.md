---
name: corteo
description: >
  Use when making or editing a music video, clip, lyric video, title card, or
  animation on this machine. corteo is the local video editor. Install it, start
  it, import media from disk, build a timeline, and export an MP4. Use it even
  if the user only says "edit this video" or "make a lyric video".
---

# corteo

corteo is a local video editor (a fork of OpenChatCut, AGPL v3). It runs on this Linux VM. You drive it from the shell. No API key is required. A browser and the optional Cloudflare tunnel are not required.

The shell prints JSON when you pass `--json`. Put `--silent` before `corteo` so npm does not mix its own banner into the JSON.

```bash
npm run --silent corteo -- <command> --json
```

## Install

On a fresh Debian or Ubuntu box, one shot. It installs Node 24 if needed, clones the repo to `~/corteo`, and renders a 2 second test MP4. Safe to run again.

```bash
curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/scripts/claudia-install.sh | bash
```

PASS looks like `CORTEO_SELF_TEST=PASS`. FAIL looks like `CORTEO_SELF_TEST=FAIL`. ffmpeg must already be installed (`apt-get install -y ffmpeg`). The free-model chat harness is optional and is not part of this install.

## Start

Leave this running in the background when you also want the editor page or MCP. The shell below does not need it.

```bash
cd ~/corteo
npm run claudia:local
```

It listens only on `http://127.0.0.1:5199`. MCP is `http://127.0.0.1:5199/api/external-mcp/mcp`. Paid providers stay off. Stop it with Ctrl+C. If port 5199 is taken, an older editor is still running; stop that process and start again.

## Shell

Run from `~/corteo`. Writes need `--apply`. Without `--apply` the change is thrown away.

Create a project:

```bash
npm run --silent corteo -- project new "Night bus" --size 1920x1080 --fps 30 --json
```

List projects. The first one is the newest, and later commands use it when you omit `--project`.

```bash
npm run --silent corteo -- project list --json
```

Import a file. The path must be absolute. Read `ops[0].result.imported[0].id`.

```bash
npm run --silent corteo -- media import /absolute/path/clip.mp4 --apply --json
npm run --silent corteo -- media ls --json
```

Place that clip on the timeline at frame 0. Use `type` `video`, `audio`, or `image` to match the asset. `fromFrame` is the timeline start.

```bash
npm run --silent corteo -- tools call edit_item --args '{"adds":[{"type":"video","assetId":"ASSET_ID","fromFrame":0}]}' --apply --json
```

Title or lyric line (no asset):

```bash
npm run --silent corteo -- tools call edit_item --args '{"adds":[{"type":"text","text":"primer verso","fromFrame":0,"durationInFrames":90}]}' --apply --json
```

Cut a clip at 2 seconds. The clip id is `placed.itemId` from the add, or a timeline item id.

```bash
npm run --silent corteo -- item split ITEM_ID --at 2s --apply --json
```

Move a clip to frame 90:

```bash
npm run --silent corteo -- item move ITEM_ID --start 90 --apply --json
```

Read the project. `--out` writes the document as JSON for you to read. Editing that file does not change the project. Change it with the commands above.

```bash
npm run --silent corteo -- project show "Night bus" --doc --out ~/corteo-exports/night-bus.json --json
npm run --silent corteo -- timeline show --json
npm run --silent corteo -- timeline items --json
```

Export. The file is written exactly at `--out`. You choose the path. No GPU:

```bash
mkdir -p ~/corteo-exports
CC_RENDER_GL=swangle npm run --silent corteo -- render --out ~/corteo-exports/night-bus.mp4 --resolution 1080p --quiet
```

4K is the same command with `--resolution 4k`. A range is `--from 0 --to 8s`. Check the file with ffprobe.

List every headless command:

```bash
npm run --silent corteo -- tools ls --json
```

## Recipes

Music video from a song and clips:

1. `project new "Title" --size 1920x1080 --fps 30 --json`
2. `media import` the song, then each clip, all with `--apply --json`.
3. Place the song: `edit_item` add `{"type":"audio","assetId":"SONG_ID","fromFrame":0}`.
4. Place each clip on the video track at the frame where it should enter.
5. `item split` and `item trim` to the length you want.
6. Render `--resolution 1080p` or `4k` to `~/corteo-exports/title.mp4`.

Lyric line on screen:

1. Add a text item for each line with `fromFrame` and `durationInFrames` (at 30 fps, 1 second is 30 frames).
2. Read `timeline items --json` and fix a line with another `edit_item` update if the wording is wrong.

Simple title card:

1. New project, 1920x1080.
2. One text add: the title, `fromFrame` 0, `durationInFrames` 90.
3. Render 3 seconds: `--to 3s --resolution 1080p`.

Cuts: split on a frame you choose (`--at 4s`, `--at 120`). The shell does not listen to the song for you. You pick the frames, then split.

## Where files go

- Code: `~/corteo`
- Projects and imported media: the dev profile under `~/.openchatcut/dev-profiles/<id>/`, or `OPENCHATCUT_DATA_DIR` if you set it
- JSON snapshot: whatever path you passed to `--out`
- MP4: whatever path you passed to `render --out`. `~/corteo-exports/` is a good default

## Troubleshooting

- `npm run corteo` says the engine is not Node 24. Run `nvm install 24 && nvm use 24` in this shell. The repo refuses Node 20.
- Render fails with WebGL or a blank file. Export with `CC_RENDER_GL=swangle`. This machine has no GPU.
- Render fails with a missing `.so`. Install Chromium libraries once: `cd ~/corteo && npx playwright install-deps chromium`. Do not put `sudo` in front of `npx`.
- Port 5199 is in use. Another `npm run claudia:local` is still running. The shell works without that server.
- `media import` rejects a relative path. Use an absolute path.
- A command prints a draft and says nothing was committed. Add `--apply`.
- The free-model chat is optional. Skip it unless you specifically need the in-editor chat.
