<p align="center">
  <img src="public/corteo-mark.svg" width="96" alt="corteo" />
</p>

<h1 align="center">corteo</h1>

<p align="center">
  <strong>The local-first video editor a bot drives over MCP to make real videos and animations.</strong>
</p>

<p align="center">
  <a href="README.es.md">Español</a> ·
  <a href="https://github.com/uset82/corteo">Repository</a> ·
  <a href="https://github.com/0xsline/OpenChatCut">Upstream OpenChatCut</a>
</p>

<p align="center">
  <img alt="License: AGPL-3.0-or-later" src="https://img.shields.io/badge/license-AGPL--3.0--or--later-6C47FF" />
  <img alt="Local first" src="https://img.shields.io/badge/data-local_first-111827" />
  <img alt="Node 24" src="https://img.shields.io/badge/Node-24-339933?logo=node.js&logoColor=white" />
  <img alt="MCP" src="https://img.shields.io/badge/MCP-agent_native-7C3AED" />
</p>

<p align="center">
  <img src="assets/readme-pic/01-editor-overview.png" alt="corteo editor: agent workspace, media pool, preview and multitrack timeline" />
</p>

---

## What corteo is

corteo is a local-first, agent-native video editor. A bot drives it over MCP —
a Grok Bot, Claude Code, Codex — and the editor is its hands.

The bot decides what the clip should be: which image belongs to each verse,
where the chorus lands, how every shot moves. corteo imports media, cuts and
animates on a real multitrack timeline, writes captions, applies effects and
exports the result — and every change stays editable by hand.

corteo is a fork of [OpenChatCut](https://github.com/0xsline/OpenChatCut),
an open-source, agent-native video editor. It is not a video generator that
hands you a finished file you can no longer change. Every edit is written to
tracks, clips, transitions, keyframes and captions inside a project you can
reopen, undo, version and keep working on.

## One-click install for a bot's VM

If the bot runs as an agent in a Linux VM, give it this prompt:

```text
Install the corteo video editor in this VM:

    curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/install.sh | bash

Then connect over MCP using the CORTEO_MCP_URL and CORTEO_MCP_TOKEN it prints.
The full procedure is in documentation/CORTEO_INSTALL.md inside the installed app.
```

The script is non-interactive and safe to re-run. It:

1. checks the machine and installs Node.js 24 privately if the system Node is not 24;
2. clones or updates the app in `~/corteo/app`;
3. installs dependencies without the CUDA and Electron binaries a headless VM does not need;
4. builds the `occ` command line;
5. starts the editor as a `systemd --user` service, or with `nohup` when systemd is unavailable;
6. waits until `http://127.0.0.1:5199` and the MCP endpoint answer, then prints the connection values.

An install from before the rename (`~/claudia` with `claudia.service`) is stopped
and moved to `~/corteo` by the installer, so there is one install on one port.
`~/claudia` is never deleted; when both roots exist, only the old service is
stopped.

Pass options after `--`, for example:

```bash
curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/install.sh | bash -s -- --dir ~/corteo --port 5199
```

| Flag | Meaning |
|---|---|
| `--dir <path>` | Install root (default `~/corteo`) |
| `--host <addr>` | Bind address (default `127.0.0.1`) |
| `--port <port>` | Editor port (default `5199`) |
| `--ref <branch\|tag>` | Git ref to install (default `main`) |
| `--no-start` | Install everything but do not start the service |
| `--with-desktop` | Also download the Electron binary for desktop development |
| `--skip-system-deps` | Do not try to install the Chromium libraries used by exports |
| `--clone` | Ignore the surrounding checkout and clone into `--dir` |
| `--uninstall` | Stop and remove the service; keep data and app |
| `--uninstall --purge` | Also delete the app and the profile data |
| `--dry-run` | Print the plan and exit without changing anything |

The final output is written to be read by an agent:

```text
CORTEO_STATUS=ok
CORTEO_URL=http://127.0.0.1:5199
CORTEO_MCP_URL=http://127.0.0.1:5199/api/external-mcp/mcp
CORTEO_MCP_TOKEN=<token>
CORTEO_OCC=/home/you/corteo/bin/occ
CORTEO_DATA_DIR=/home/you/.openchatcut/dev-profiles/<id>
CORTEO_GUIDE=/home/you/corteo/app/documentation/CORTEO_INSTALL.md
CORTEO_LOG=/home/you/corteo/logs/corteo.log
CORTEO_MANAGER=systemd
```

The bot and the editor run on the same machine, so MCP over `localhost`
needs no tunnel. If you want to open the editor from your own computer, forward
the port (`ssh -L 5199:127.0.0.1:5199 you@vm`) and open
`http://localhost:5199`; browsers only enable the video APIs the editor needs in
a secure context, which means `localhost` or HTTPS — not a plain-HTTP LAN IP.

## Status

corteo tracks OpenChatCut's work in progress. The task list in
[`docs/plans/PROGRESS.md`](docs/plans/PROGRESS.md) is the source of truth; if
this README and `PROGRESS.md` disagree, `PROGRESS.md` wins.

**Working today** (inherited from OpenChatCut):

- A multitrack timeline with Premiere-style tools and shortcuts (`V`, `B`, `N`, `U`, `P`, `Q`/`W`, `I`/`O`, `J`/`K`/`L`).
- Keyframes with easing curves that look the same in the preview and in the exported file.
- 22 caption styles with word-by-word karaoke highlighting.
- Transcription with Whisper where the `whisper.cpp` binary is provisioned (the desktop build ships one); otherwise AssemblyAI with a key.
- Export up to 4K in H.264 and VP8, plus ProRes from the server.
- Multiple sequences per project, transitions, effects, LUTs, animated templates and multiple audio tracks.
- A token-protected MCP server with more than 120 editing tools, usable by MCP clients on the same machine (Codex, Claude Code, Qoder and others).
- Free models in the built-in chat through [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) and the [Our Free Model](https://github.com/Ebony-Vinyl/dsh-our-free-model) plugin. `npm run harness:install`, `npm run harness` and `npm run harness:doctor` install it, start it and print the URL and key; the Spanish steps are in [`README.es.md`](README.es.md#modelos-gratis-con-deepseek-harness) and the long guide is [`docs/harness.md`](docs/harness.md). The default model is `nvidia/nemotron-3-ultra-550b-a55b:free`, the lane that completed a real cut. `OPENCHATCUT_PROVIDERS=off` limits the editor to DeepSeek Harness, Ollama and LM Studio. The harness chat can also edit the timeline over MCP.

**Added by the evolution night (2026-10-28)**, each with its test and, where there was one, its live run:

- **Host profiles**: `install.sh --host-profile grok|muse|claude-duet` puts the skill, the media inbox and the export folder where each bot looks for them (EV-01, EV-02).
- **Phone to MP4**: `occ inbox --host grok --json` picks up the clip the bot left in its inbox, imports it into a project and returns the `attachPath` to send back over the chat (EV-05).
- **Song film**: `occ song-film --audio song.mp3 --to 30s --json` cuts on downbeats, animates each shot and renders a vertical MP4; a real run came out 1080x1920 and 30 s (EV-09, EV-10).
- **Shorts with a review pass**: `reviewEs` scores and cuts the word ranges before the batch; it needs the editor tab open (`npm run editor-host`) (EV-11).
- **The free brain**: `npm run brain` starts the router with the `grok`, `muse` and `claude-duet` aliases; the `delegate` tool spreads work across them, the editor sees them at `http://127.0.0.1:18899/v1` and the door for any IDE is `http://127.0.0.1:18890/v1`. Proven live on this machine (EV-13 to EV-20).
- **The installer starts the brain**: the `CORTEO_BRAIN` step reports `CORTEO_BRAIN=ok`, `failed` or `skipped` (EV-17).
- **Music in the UI**: the inspector's "Reaccionar a la música" section, the timeline's "Mapa musical" and the song badge's "Mapa de la canción" pass their tests; the real-browser pass is still pending (EV-22 to EV-24, EV-29).

**Not there yet:**

- The interface opens in Spanish, but only part of it is translated: untranslated strings show in English. English is complete and Chinese is the source language; Italian and Russian are also partial.
- Generation tools — images, voice, video, music — need their own paid API keys and stay off until configured.
- Any bot installs corteo on its own Linux VM with `curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/install.sh | bash`, then `npm run corteo:local` and `npm run corteo -- ...`. The skill is [`skills/corteo/SKILL.md`](skills/corteo/SKILL.md). The Cloudflare tunnel is optional.
- The end-to-end listen on a real song (L-13) and a real-browser pass over the music UI (EV-33) are still pending: there is no song in `~/corteo-media` and no browser check was run.
- Ken Burns, duplicate detection and countdown live on a separate development branch and are not in `main` yet.

## Requirements

- Linux, or Windows 10/11 with WSL 2 and Ubuntu. Clone inside Linux (`~/corteo`, not `/mnt/c`): the filesystem is much faster there.
- Node.js 24. `.nvmrc` and `package.json` both pin that major version. The installer takes care of it.
- Git.
- 8 GB of RAM or more is recommended. The server may use up to 6 GB, which is why the manual start sets `--max-old-space-size=6144`.
- A current Chrome or Edge on the same machine to open the editor.

`ffmpeg` does not need to be installed separately: it ships with the npm
dependencies. Editing works without any API key.

## Manual install

Use the installer above unless you want to work on the code. The manual path
below assumes `nvm`; the one-click installer does not need it:

```bash
git clone https://github.com/uset82/corteo.git ~/corteo
cd ~/corteo
nvm install            # reads .nvmrc and installs Node 24
nvm alias default 24   # so new terminals keep using Node 24
npm install
```

On Linux, `npm install` also downloads a CUDA provider for ONNX Runtime that is
several hundred megabytes. Without an NVIDIA GPU you can skip it:

```bash
ONNXRUNTIME_NODE_INSTALL=skip npm install
```

Server-side exports and project thumbnails use a headless Chromium (Chrome
Headless Shell), which needs system libraries:

```bash
npx playwright install-deps chromium
```

Do not put `sudo` in front of that command: with `nvm`, `sudo` cannot find
`npx`, and the command already asks for permissions when it needs them. The
first render downloads Chrome Headless Shell (about 100 MB). Without these
libraries, editing works but renders and thumbnails fail.

Start the editor:

```bash
NODE_OPTIONS=--max-old-space-size=6144 npm run dev
```

Open **http://localhost:5199**. Use `localhost`, not the WSL IP: browsers only
enable WebCodecs, Web Crypto and the clipboard in a secure context. Stop the
server with Ctrl+C.

Optional shell shortcut:

```bash
echo 'alias corteo="cd ~/corteo && NODE_OPTIONS=--max-old-space-size=6144 npm run dev"' >> ~/.bashrc
source ~/.bashrc
```

## Connect a bot over MCP

corteo exposes a Streamable HTTP MCP endpoint:

```text
http://127.0.0.1:5199/api/external-mcp/mcp
```

Every request needs a Bearer token. The installer generates one and stores it
in `~/corteo/secrets.env`; a manual install finds the automatically minted
token in the profile directory:

```text
~/.openchatcut/dev-profiles/<id>/mcp-token
```

The profile id is printed at startup as `[OpenChatCut] isolated profile <id>`.
A ready-to-paste client entry looks like this:

```json
{
  "mcpServers": {
    "corteo": {
      "type": "http",
      "url": "http://127.0.0.1:5199/api/external-mcp/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}
```

The dev server must be running. MCP timeline edits go through an offline edit
session when no editor has the project open; they apply atomically and leave an
undoable version. When a browser does have the project open, the edit follows
the live editor's validated commands. Cross-machine access is not part of this
release.

### The `occ` command line

`occ` is the headless path. It works against the local project library with no
browser and no MCP session, and it uses the same edit-session contract:

```bash
npm run build:cli

node cli-dist/occ.mjs project list
node cli-dist/occ.mjs project new "Peru"
node cli-dist/occ.mjs timeline items
node cli-dist/occ.mjs render --out ~/peru.mp4
node cli-dist/occ.mjs tools call set_aspect_ratio --args '{"ratio":"9:16"}' --apply
```

Without a project reference, `occ` uses the first project in the library; pass
`--project <id-or-name>` when there are several.

Timeline-changing calls (`occ edit`, `occ item`, `occ tools call`) write only
with `--apply`. A write is committed atomically, checks the project revision
and snapshots a pre-edit version, so it can be undone from the app's version
history. The installer creates a wrapper at `~/corteo/bin/occ` that points
`occ` at the same profile as the running app.
From a checkout, either set `OPENCHATCUT_DEV_PROFILE_ID` to the id printed at
startup or pass `--data-dir ~/.openchatcut/dev-profiles/<id>`.

## Your data

`npm run dev` keeps each checkout's projects, imported media, settings and MCP
token under its own profile:

```text
~/.openchatcut/dev-profiles/<id>/
```

Back up that directory to back up everything. The MCP token is written with
mode `0600`. Projects and media stay on your machine; the only traffic that
leaves it is what you configure — a model provider, a media service, or a
generation API. Unconfigured services stay off and do not affect local editing.

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Editing core | Immutable timeline state, command layer, proposal-based application |
| Agent | Vercel AI SDK, Agent Skills, MCP SDK, local and hosted model providers |
| Preview and visuals | Remotion Player, WebGL and GLSL |
| Server | Shared Vite / Electron plugins and a server-side keystore |
| Persistence | Local project store under `~/.openchatcut`, IndexedDB cache, optional R2 |
| Desktop | Electron |
| Export | Remotion, FFmpeg, FCPXML, SRT |

| Directory | Responsibility |
|---|---|
| `src/editor/` | Timeline state and commands, independent of UI and models |
| `src/agent/` | Agent assembly, tools, skills, progress and settings |
| `src/captions/` | Caption models, styles, controls and preview |
| `src/gl/` | WebGL effects, transitions and shader runtime |
| `src/persist/` | Project, chat, version and media persistence |
| `server/` | Generation, transcription, media, export, MCP and storage services |
| `desktop/` | Electron main process and embedded services |
| `remotion/` | Headless rendering and export pipeline |
| `cli/` | The `occ` command line |

## Credits and license

- corteo is a fork of [OpenChatCut](https://github.com/0xsline/OpenChatCut), created by OpenChatCut Contributors. OpenChatCut builds on [Remotion](https://www.remotion.dev/), the [Model Context Protocol](https://modelcontextprotocol.io/), the [Vercel AI SDK](https://ai-sdk.dev/) and the skills of [ChatCut-Inc/agent-plugin](https://github.com/ChatCut-Inc/agent-plugin); see [`src/agent/skills/NOTICE.md`](src/agent/skills/NOTICE.md).
- [`README_ZH.md`](README_ZH.md) is OpenChatCut's original Chinese README.

OpenChatCut is released under the [GNU Affero General Public License v3.0 or
later](LICENSE), and this fork is too. In short:

- You may use, study, change and share corteo.
- If you share it, with or without changes, or let other people use a modified
  version over a network, you must offer them the source under the same license.
- It comes with no warranty.

Third-party components keep their own licenses (see `package-lock.json` and
[`assets/fonts/LICENSES.md`](assets/fonts/LICENSES.md)). Remotion, the render
engine, has [its own license](https://www.remotion.dev/license): free for
individuals and small companies, including commercial use; larger companies
need a company license.

## For developers

The rules, commands and work loop are in [`AGENTS.md`](AGENTS.md). Before
calling anything done, run:

```bash
npx tsc -b
npm run lint
npm test
npm run build
```

The suite takes several minutes; on a machine without a GPU, prefix it with
`CC_RENDER_GL=swangle`. The installer can check the Chromium libraries the
export tests need.

## En español

La versión anterior de este README, en español, está en
[`README.es.md`](README.es.md).
