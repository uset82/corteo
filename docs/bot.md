# The corteo bot

A Grok Bot that installs corteo on its own machine, drives it with `occ`, and
repairs it after a computer update. The person talks; the bot types.

This page is for the person who owns the bot. The bot itself reads
`bot/profile.md` and the four skills, which are built into
`bot/dist/recipe.json`.

## Import it

1. Open Grok, create a Bot, and choose the template import.
2. Paste `bot/dist/recipe.json` — the whole file, or its path if the import takes
   one.
3. The bot should list **four** skills: `corteo-welcome`, `corteo-setup`,
   `corteo-edit`, `corteo-repair`. If it lists fewer, the file was truncated on
   the way in; re-import rather than editing the JSON by hand.

No key, no plugin, no MCP server, no Claude plan. The bot needs a Grok
subscription for Imagine if you want it to make stills, and nothing else.

## What it will ask

One question, once:

```text
¿Lo instalo? (unos 5 minutos)
[ Sí, instálalo ]   [ Todavía no ]
```

Then it starts the install detached, posts one status line, and tells you when
the editor is up. It will not paste a wall of shell output at you, and it should
never show you a token — the token is a file path, and the file is readable only
by you.

If you say no, it stops. It does not sell.

## The three doors

| Door | Who it is for |
|---|---|
| `curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/install.sh \| bash` | you, in a terminal |
| the bot template | you, in chat |
| the MCP endpoint | another agent with an MCP client |

All three end at the same artefact: the editor on `127.0.0.1`, a project library,
and a render.

## Updating after a release

The bot's skills are a snapshot of the repository on the day the recipe was
built. To move to a newer corteo:

```bash
npm run build:bot-recipe
```

then re-import `bot/dist/recipe.json` into the bot. On the machine itself, run
the installer again — it is idempotent, it updates the checkout, and it leaves
the project library alone:

```bash
curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/install.sh | bash
```

Do not `git pull` inside `~/corteo/app` and do not hand-edit the recipe: both
put the machine and the bot on different versions, and the next failure will be
one nobody can reproduce.

## When the bot says the install failed

The bot reports a **stage**, not a stack trace. Those stages come from
`install.sh` and each one has one fix:

| Stage | What to do |
|---|---|
| `checking the system` | `apt-get` or `sudo` is missing. The installer prints the exact line; run it yourself if you can. |
| `installing node` | the box cannot reach the Node distribution. Check the network, then re-run. |
| `cloning` | `~/corteo` exists and is not a git checkout. Move it aside and re-run. |
| `installing dependencies` | usually a full disk. `df -h ~`. |
| `building` | the log has the real error; send it, do not retry blindly. |
| `starting` | the port is taken or the service cannot start. The installer reports the port it used in `CORTEO_PORT_STATE`. |
| `self-test` | the render failed. Usually ffmpeg: `sudo apt-get install -y ffmpeg`. |

Two failures at the same stage means stop and read the log. The bot is told not
to loop, and neither should you.

After a repair, ask the bot to run its self-test: a detached two-second render
and the ffprobe line that proves it. A repair without a render is a guess.

## What survives a computer update

`~` is wiped, `/workspace` is not. So the app, the CLI, the token and the project
library are all gone after an update, and every render in `/workspace` is still
there. The one habit that saves the work: ask the bot to export the project to
`/workspace` before a long pause.

```bash
occ project show --doc --out /workspace/my-project.ccproj.json --json
```

## Proving the template still works

The skill that installs corteo is also a script that runs:

```bash
bash scripts/bot-rehearsal.sh
```

It replays the skill's own commands in a throwaway `HOME` on a clean Linux box,
prints a wall time per step, and ends with `BOT_REHEARSAL=PASS` and the render's
ffprobe facts. `npm run verify:bot-recipe` fails when the skill and the rehearsal
stop matching, so the text a bot copies is the text that was executed.
