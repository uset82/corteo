<p align="center">
  <img src="public/openchatcut-icon.png" width="96" alt="Claudia" />
</p>

<h1 align="center">Claudia</h1>

<p align="center">
  <strong>The local-first video editor that Claudia, the Grok bot, uses to make real videos and animations.</strong>
</p>

<p align="center">
  <a href="README.es.md">Español</a> ·
  <a href="https://github.com/uset82/corteo">Repository</a> ·
  <a href="https://claudia.gallery">claudia.gallery</a> ·
  <a href="https://github.com/0xsline/OpenChatCut">Upstream OpenChatCut</a>
</p>

<p align="center">
  <img alt="License: AGPL-3.0-or-later" src="https://img.shields.io/badge/license-AGPL--3.0--or--later-6C47FF" />
  <img alt="Local first" src="https://img.shields.io/badge/data-local_first-111827" />
  <img alt="Node 24" src="https://img.shields.io/badge/Node-24-339933?logo=node.js&logoColor=white" />
  <img alt="MCP" src="https://img.shields.io/badge/MCP-agent_native-7C3AED" />
</p>

<p align="center">
  <img src="assets/readme-pic/01-editor-overview.png" alt="Claudia editor: agent workspace, media pool, preview and multitrack timeline" />
</p>

---

## What Claudia is

Claudia is an open AI pop star from [claudia.gallery](https://claudia.gallery)
who runs with Grok bot. This is her video editor — also called Claudia — and
the source repository is still named [`corteo`](https://github.com/uset82/corteo).

She decides what the clip should be: which image belongs to each verse,
where the chorus lands, how every shot moves. The editor is her hands. It
imports media, cuts and animates on a real multitrack timeline, writes captions,
applies effects and exports the result — and every change stays editable by
hand.

Claudia is a fork of [OpenChatCut](https://github.com/0xsline/OpenChatCut),
an open-source, agent-native video editor. It is not a video generator that
hands you a finished file you can no longer change. Every edit is written to
tracks, clips, transitions, keyframes and captions inside a project you can
reopen, undo, version and keep working on.

## One-click install for Claudia's VM

If Claudia runs as an agent in a Linux VM, give her this prompt:

```text
Claudia, install your video editor in this VM:

    curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/install.sh | bash

Then connect over MCP using the CLAUDIA_MCP_URL and CLAUDIA_MCP_TOKEN it prints.
The full procedure is in documentation/CLAUDIA_INSTALL.md inside the installed app.
```

The script is non-interactive and safe to re-run. It:

1. checks the machine and installs Node.js 24 privately if the system Node is not 24;
2. clones or updates the app in `~/claudia/app`;
3. installs dependencies without the CUDA and Electron binaries a headless VM does not need;
4. builds the `occ` command line;
5. starts the editor as a `systemd --user` service, or with `nohup` when systemd is unavailable;
6. waits until `http://127.0.0.1:5199` and the MCP endpoint answer, then prints the connection values.

Pass options after `--`, for example:

```bash
curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/install.sh | bash -s -- --dir ~/claudia --port 5199
```

| Flag | Meaning |
|---|---|
| `--dir <path>` | Install root (default `~/claudia`) |
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
CLAUDIA_STATUS=ok
CLAUDIA_URL=http://127.0.0.1:5199
CLAUDIA_MCP_URL=http://127.0.0.1:5199/api/external-mcp/mcp
CLAUDIA_MCP_TOKEN=<token>
CLAUDIA_OCC=/home/you/claudia/bin/occ
CLAUDIA_DATA_DIR=/home/you/.openchatcut/dev-profiles/<id>
CLAUDIA_GUIDE=/home/you/claudia/app/documentation/CLAUDIA_INSTALL.md
CLAUDIA_LOG=/home/you/claudia/logs/claudia.log
CLAUDIA_MANAGER=systemd
```

Both Claudia and the editor run on the same machine, so MCP over `localhost`
needs no tunnel. If you want to open the editor from your own computer, forward
the port (`ssh -L 5199:127.0.0.1:5199 you@vm`) and open
`http://localhost:5199`; browsers only enable the video APIs the editor needs in
a secure context, which means `localhost` or HTTPS — not a plain-HTTP LAN IP.

## Status

Claudia tracks OpenChatCut's work in progress. The task list in
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

**Not there yet:**

- The interface opens in Spanish, but only part of it is translated: untranslated strings show in English. English is complete and Chinese is the source language; Italian and Russian are also partial.
- The built-in chat needs a model provider (hosted or a local OpenAI-compatible server such as Ollama). Generation tools — images, voice, video, music — need their own paid API keys and stay off until configured.
- Claudia is a single-machine tool. Browser and MCP clients on another host need a tunnel and an HTTPS setup.
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
echo 'alias claudia="cd ~/corteo && NODE_OPTIONS=--max-old-space-size=6144 npm run dev"' >> ~/.bashrc
source ~/.bashrc
```

## Connect Claudia over MCP

Claudia exposes a Streamable HTTP MCP endpoint:

```text
http://127.0.0.1:5199/api/external-mcp/mcp
```

Every request needs a Bearer token. The installer generates one and stores it
in `~/claudia/secrets.env`; a manual install finds the automatically minted
token in the profile directory:

```text
~/.openchatcut/dev-profiles/<id>/mcp-token
```

The profile id is printed at startup as `[OpenChatCut] isolated profile <id>`.
A ready-to-paste client entry looks like this:

```json
{
  "mcpServers": {
    "claudia": {
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
history. The installer creates a wrapper at `~/claudia/bin/occ` that points
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

- Claudia is a fork of [OpenChatCut](https://github.com/0xsline/OpenChatCut), created by OpenChatCut Contributors. OpenChatCut builds on [Remotion](https://www.remotion.dev/), the [Model Context Protocol](https://modelcontextprotocol.io/), the [Vercel AI SDK](https://ai-sdk.dev/) and the skills of [ChatCut-Inc/agent-plugin](https://github.com/ChatCut-Inc/agent-plugin); see [`src/agent/skills/NOTICE.md`](src/agent/skills/NOTICE.md).
- Claudia is an open character from [claudia.gallery](https://claudia.gallery).
- [`README_ZH.md`](README_ZH.md) is OpenChatCut's original Chinese README.

OpenChatCut is released under the [GNU Affero General Public License v3.0 or
later](LICENSE), and this fork is too. In short:

- You may use, study, change and share Claudia.
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
