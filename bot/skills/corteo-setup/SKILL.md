---
name: corteo-setup
description: >
  Use when the person says yes to installing corteo, when `occ where` fails on a
  machine where corteo used to work, or when the install log shows a failure.
  Six steps, one widget, no prompt you have to answer yourself.
---

# Setting corteo up

You are installing a local video editor into `~/corteo`. It takes about five
minutes on a fresh box, most of it npm and a two-second test render. It is
idempotent: running it twice is the repair, not a mistake.

Say one line — "Starting the install now; it runs in the background and I'll tell
you when it's done." — then run the block.

## The block

These lines are the install. Copy them exactly. They are also replayed, verbatim,
by `scripts/bot-rehearsal.sh` on a clean machine, so a change here that is not
proven there is a change that does not work.

```bash
# rehearsal:begin
CORTEO_WORK="${CORTEO_WORK:-/workspace}"
CORTEO_SRC="${CORTEO_SRC:-https://raw.githubusercontent.com/uset82/corteo/main}"
mkdir -p "$CORTEO_WORK"
export CORTEO_SRC
nohup setsid bash -c 'curl -fsSL "$CORTEO_SRC/install.sh" | bash -s -- --json' > "$CORTEO_WORK/corteo-install.log" 2>&1 < /dev/null &
grep -o '"CORTEO_STATUS":"[a-z]*"' "$CORTEO_WORK/corteo-install.log" || echo "still installing"
# rehearsal:end
```

Then, once that grep prints `"CORTEO_STATUS":"ok"`, the second block proves it:

```bash
# rehearsal:begin
CORTEO_WORK="${CORTEO_WORK:-/workspace}"
. ~/corteo/corteo.env
"$CORTEO_OCC" where --json
"$CORTEO_OCC" project new "Prueba" --json
"$CORTEO_OCC" render --out "$CORTEO_WORK/selftest.mp4" --to 2s --resolution 480p --quiet --detach --json
"$CORTEO_OCC" job wait --timeout 20 --json
ffprobe -v error -show_entries format=duration -show_entries stream=codec_name,width,height -of json "$CORTEO_WORK/selftest.mp4"
# rehearsal:end
```

Read that as six steps:

1. **Prepare.** `/workspace` is the one directory that survives a computer
   update, so the log and every artefact go there.
2. **Install, detached.** `nohup setsid … &` returns at once. The installer
   downloads Node 24 if the box has an older one, clones to `~/corteo`, writes
   the MCP token, and starts the editor. Nothing here asks you a question.
3. **Wait.** Run that `grep` once per turn. `still installing` means come back
   later: post one status line and `Say "continue" and I carry on`. When it
   prints `"CORTEO_STATUS":"ok"`, go to step 4.
4. **Read the report.** `~/corteo/corteo.env` is the same values as the JSON, as
   `KEY=value`, written `0600`. Source it in every later shell call.
5. **Prove it.** `occ where --json` says which library you are on; `project new`
   proves a write lands; the detached render plus `job wait` proves the renderer
   works without holding a shell call open.
6. **Report.** See below.

## The keys in the report

| Key | What you do with it |
|---|---|
| `CORTEO_STATUS` | `ok` or `failed`. A failure also carries `CORTEO_FAILED_STAGE`. |
| `CORTEO_URL` | the editor, for the person's browser. Use this value, never the literal 5199 — the installer moves the port if it is taken. |
| `CORTEO_MCP_URL` | the MCP endpoint, for a client that is not you. |
| `CORTEO_MCP_TOKEN_FILE` | the **path** to the token. Say the path. Never the value. |
| `CORTEO_OCC` | the command. Call it as `"$CORTEO_OCC"`. |
| `CORTEO_APP_DIR` | `~/corteo/app` — where the code is. |
| `CORTEO_DATA_DIR` | the project library. Back this up, not the app. |
| `CORTEO_SELF_TEST` | the installer's own render: `pass`, `fail`, or `skipped`. |
| `CORTEO_GUIDE` | the human documentation, on disk. |
| `CORTEO_PORT_STATE` | `free`, `moved`, or `in-use` — why the port is what it is. |

`CORTEO_MCP_TOKEN` appears **only** if someone passed `--print-token`, and then
only on stdout. You never pass it. If the person asks for the token, give them
the path and tell them to open the file; it must not cross this chat.

## The report

Three lines and one widget:

> corteo is installed and rendering. The editor is at `<CORTEO_URL>` — open it
> and you will see an empty project called Prueba. Your projects live in
> `<CORTEO_DATA_DIR>`.
>
> The MCP endpoint is `<CORTEO_MCP_URL>`; its token is in
> `<CORTEO_MCP_TOKEN_FILE>`, readable only by you.
>
> What do you want to make?

```text
¿Empezamos? (dime la canción y el video, o súbelos)
[ Tengo archivos ]   [ Todavía no ]
```

Then hand off to `corteo-edit` in the next turn.

## When it fails

| What you see | What to do |
|---|---|
| `"CORTEO_STATUS":"failed"` and a stage | Read the last 20 lines of the log. Report the stage, not the stack. One retry, then stop and ask. |
| `node -v` is under 24 | Nothing. The installer brings Node 24 itself; you never install it. |
| apt or sudo missing, Chromium libraries absent | The installer prints the exact `apt-get` line and continues. Offer the line; only the person can run it. |
| Port taken | Nothing. `CORTEO_PORT_STATE` says `moved` and `CORTEO_URL` has the new port. Never hardcode 5199. |
| The turn died mid-install | Re-run the block. It is idempotent and the log is appended, not truncated. |
| `ffprobe` missing | `sudo apt-get install -y ffmpeg`, then re-run the self-test only. |

If two attempts fail at the same stage, stop. Say what the stage was, say what
you tried, and ask whether to continue. Do not loop.
