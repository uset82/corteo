---
name: corteo-repair
description: >
  Use when corteo stopped working — after a computer update, after a long pause,
  or when a command that used to work now fails with a missing file or a missing
  command.
---

# Repairing

Most corteo failures are one of three things: the machine was updated and wiped
`~`, the editor process died, or the person's projects are gone. Each has a
different fix and only the first one needs an install.

Start by finding out which it is. Do not reinstall before you know.

## Triage, in one call

```bash
. ~/corteo/corteo.env
"$CORTEO_OCC" where --json
```

If the first line fails with `No such file or directory`, stop reading the table:
that is the diagnosis, and it is the first row.

| What you see | Diagnosis | Go to |
|---|---|---|
| `command not found`, or `~/corteo/corteo.env` missing | the machine was wiped | **Reinstall** |
| a JSON object with `rootDir` and `projectStoreIndex` | the install is alive | **Alive** |
| the command exists and hangs, or `ECONNREFUSED` on the editor URL | the process died | **Restart** |

## Reinstall

A computer update wipes `~` and keeps `/workspace`. That means `~/corteo` is
gone, and so is every project that only existed in `~/.openchatcut`.

The repair is `corteo-setup`'s first block, unchanged — same detached install,
same log, same `CORTEO_STATUS` poll. Run that, not a hand-written clone: it is
the version that is rehearsed on a clean machine, and `git pull` into a directory
that no longer exists is not a repair.

Tell the person what survived before you tell them what is missing: the renders
in `/workspace` are still there; the projects in `~` are not, unless they were
exported.

## Alive but broken

```bash
"$CORTEO_OCC" project list --json
"$CORTEO_OCC" timeline items --json
"$CORTEO_OCC" render --out /workspace/corteo-repair.mp4 --to 2s --resolution 480p --quiet --detach --json
"$CORTEO_OCC" job wait --timeout 20 --json
```

`project list` failing means the library is unreadable — that is a `CORTEO_DATA_DIR`
problem, not a code problem. Say which directory `where` reported and ask before
touching it. Never move or delete a library to "fix" it.

`render` failing while everything else works is almost always ffmpeg:

```bash
ffmpeg -version
```

Missing means `sudo apt-get install -y ffmpeg`, and only the person can run that.
A render killed for memory is not broken — re-run it with
`OPENCHATCUT_RENDER_CONCURRENCY=1`.

## Restart

The editor is a dev server on `CORTEO_URL`. If the page will not load but `occ`
answers, the process is down, not the install.

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' "$CORTEO_URL"
```

`000` or `Connection refused` means restart it:

```bash
cd ~/corteo/app
nohup setsid npm run corteo:local > /workspace/corteo-editor.log 2>&1 < /dev/null &
```

Then `tail -n 5 /workspace/corteo-editor.log` and give it twenty seconds. `occ`
does not need the editor — imports, edits and renders all work without it — so
never block an edit on the server coming back.

## What is lost, and what is not

| Lost with `~` | Survives in `/workspace` |
|---|---|
| the app, the CLI, the MCP token | renders and exports |
| the project library | any `.ccproj.json` you exported |
| the install log | your own working files |

Say this table out loud, in the person's language, before they ask. Then offer
the one habit that prevents it: export the project to `/workspace` before a long
pause, with `project show --doc --out`.

## After a repair

Run the self-test from `corteo-setup` — the detached two-second render — and show
the ffprobe line. A repair without a render is a guess.
