# Installing corteo in a VM

This guide is written for an AI agent (corteo, or any agent acting for it) that
has shell access to a Linux VM. It installs the editor, starts it as a service,
and produces the MCP endpoint and token needed to edit projects.

The installer is non-interactive. It never reads from stdin, so it is safe to run
through `curl | bash`, and it is safe to run again to update.

## One command

```bash
curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/install.sh | bash
```

Requirements:

- Linux, x86_64 or arm64. Windows users should run it inside WSL 2 with Ubuntu.
- `curl`, `git`, `tar` and `sha256sum`.
- It never calls `sudo`. If it is already running as root and `apt-get` exists,
  it installs the Chromium libraries that headless exports need; otherwise it
  prints the exact command and continues.

Defaults:

| | |
|---|---|
| Install root | `~/corteo` |
| App checkout | `~/corteo/app` |
| Bind address | `127.0.0.1` |
| Port | `5199` |
| Data | `~/.openchatcut/dev-profiles/<id>/` |
| Service | `corteo.service` (systemd user), or a `nohup` process |
| Log | `~/corteo/logs/corteo.log` |

To install somewhere else:

```bash
curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/install.sh \
  | bash -s -- --dir /opt/corteo --port 5199
```

Every option is in `install.sh --help`:

| flag | what it does |
|---|---|
| `--dir <path>` | install root; default `~/corteo` |
| `--host <addr>` | bind address; default `127.0.0.1`. The MCP URL stays on `127.0.0.1` for the usual loopback values and follows the address otherwise |
| `--host-profile <name>` | bot host: `grok`, `muse` or `claude-duet`. Installs the skill where that host reads it and creates its inbox and export folder; the report carries the three paths. `CORTEO_HOST_PROFILE` sets it too |
| `--port <port>` | editor port; default `5199` |
| `--ref <branch\|tag>` | git ref to install; default `main` |
| `--no-start` | install and print the values, but do not start the editor or the brain |
| `--no-brain` | skip starting the free-model brain; `CORTEO_BRAIN=off` does the same |
| `--with-desktop` | download the Electron binary too (desktop development) |
| `--skip-system-deps` | do not try to install the Chromium libraries for rendering |
| `--clone` | always clone into `--dir`, even when run from a checkout |
| `--uninstall` | stop and remove the service; keep the app and data |
| `--purge` | with `--uninstall`: also delete the app and the profile data |
| `--dry-run` | print the plan and exit without changing anything |
| `--json` | one JSON object on stdout instead of the `CORTEO_*` lines; progress moves to stderr |
| `--print-token` | put the MCP token in the output; without it you get its path |
| `--self-test` | after installing, create a project, import a generated 2 second clip, render it at 480p and check the duration with `ffprobe`; the report carries `CORTEO_SELF_TEST=pass` in lowercase, not `PASS` |
| `-h`, `--help` | show the help |

`CORTEO_HOST_PROFILE` and `CORTEO_BRAIN` (`on` or `off`) set the same choices
from the environment before the flags are read; an explicit `--host-profile` or
`--no-brain` wins.

`--json --self-test` is the whole contract in one call: install it, prove it
renders, hand back a single object.

## Upgrading from the old name

The install used to live in `~/claudia` under `claudia.service`. Running the
installer with no `--dir` stops and disables that service, moves the whole root
to `~/corteo`, and renames the report, the pid file and the log inside it. The
checkout and `secrets.env` come along, so the MCP token is unchanged and no
client has to be reconfigured.

`~/claudia` is never deleted. If `~/corteo` already exists, the old root is left
where it is and only its service is stopped, so two installs cannot fight over
port 5199. With an explicit `--dir`, nothing is moved at all: the dry run
reports `CORTEO_LEGACY_ACTION=ignored` and the install goes where you asked.

`--dry-run` prints the decision without taking it:

| `CORTEO_LEGACY_ACTION` | meaning |
|---|---|
| `none` | no old install on this machine |
| `move` | `~/claudia` is stopped and moved to `~/corteo` |
| `kept-both` | both roots exist; only the old service is stopped |
| `ignored` | an explicit `--dir` was given; the old root is not touched |

## Expected output

The last block on stdout is machine-readable:

```text
CORTEO_STATUS=ok
CORTEO_HOST_PROFILE=none
CORTEO_SKILL_PATH=none
CORTEO_MEDIA_INBOX=none
CORTEO_EXPORT_DIR=none
CORTEO_URL=http://127.0.0.1:5199
CORTEO_LOCAL_URL=http://127.0.0.1:5199
CORTEO_MCP_URL=http://127.0.0.1:5199/api/external-mcp/mcp
CORTEO_MCP_TOKEN_FILE=/home/you/corteo/secrets.env
CORTEO_OCC=/home/you/corteo/bin/occ
CORTEO_APP_DIR=/home/you/corteo/app
CORTEO_DATA_DIR=/home/you/.openchatcut/dev-profiles/<uuid>
CORTEO_GUIDE=/home/you/corteo/app/documentation/CORTEO_INSTALL.md
CORTEO_LOG=/home/you/corteo/logs/corteo.log
CORTEO_MANAGER=systemd
CORTEO_MIGRATED_FROM=/home/you/claudia
CORTEO_LEGACY_SERVICE=stopped
CORTEO_PORT_STATE=free
CORTEO_SELF_TEST=pass
CORTEO_BRAIN=ok
CORTEO_BRAIN_STEP=none
CORTEO_BRAIN_URL=http://127.0.0.1:18890/v1
```

The host keys are `none` without `--host-profile`; with one they carry the
skill path, the inbox and the export folder that host uses.

| key | meaning |
|---|---|
| `CORTEO_STATUS` | `ok` on a successful install, `dry-run` for a plan, `failed` with `CORTEO_FAILED_STAGE` on an error |
| `CORTEO_HOST_PROFILE` | `grok`, `muse`, `claude-duet`, or `none` |
| `CORTEO_SKILL_PATH` | where the host's skill was written; `none` without a host profile |
| `CORTEO_MEDIA_INBOX` | the folder that host uses for attachments; `none` without a host profile |
| `CORTEO_EXPORT_DIR` | the folder that host attaches renders from; `none` without a host profile |
| `CORTEO_URL` | the editor on the bind address |
| `CORTEO_LOCAL_URL` | the editor on loopback |
| `CORTEO_MCP_URL` | the MCP endpoint the host connects to |
| `CORTEO_MCP_TOKEN_FILE` | the `0600` file holding `OPENCHATCUT_MCP_TOKEN`; the default output never carries the token itself |
| `CORTEO_OCC` | the `occ` wrapper |
| `CORTEO_APP_DIR` | the installed checkout |
| `CORTEO_DATA_DIR` | the active profile under `~/.openchatcut/dev-profiles/`, or `unknown` if the profile id cannot be read |
| `CORTEO_GUIDE` | this guide inside the installed app |
| `CORTEO_LOG` | the editor log |
| `CORTEO_MANAGER` | `systemd` or `nohup` |
| `CORTEO_MIGRATED_FROM` | the path the install came from, or `none`; the only line that says the old tree moved, because `CORTEO_APP_DIR` is already the new one |
| `CORTEO_LEGACY_SERVICE` | `stopped`, or `none` when there was no old service to stop |
| `CORTEO_PORT_STATE` | `free`, or `shifted` when the default port was busy and the installer moved up |
| `CORTEO_SELF_TEST` | `pass` (lowercase), `fail`, or `skipped` when `--self-test` was not asked for |
| `CORTEO_BRAIN` | `ok`, `failed`, or `skipped` when `--no-brain`, `--no-start` or `CORTEO_BRAIN=off` kept it off |
| `CORTEO_BRAIN_STEP` | `none` on success or skip; the failed boot step otherwise |
| `CORTEO_BRAIN_URL` | `http://127.0.0.1:18890/v1` when the brain started, `none` otherwise |
| `CORTEO_MCP_TOKEN` | only with `--print-token`, and never written to the report file |

The same values are written to `~/corteo/corteo.env` with mode `0600`.

The token is not in that block unless you pass `--print-token`. What you get
instead is `CORTEO_MCP_TOKEN_FILE`: a `0600` file the bot reads for itself, so
the secret never has to pass through a chat transcript or a log. That is also
the file the service reads.

The default port is a preference, so the installer walks up to the next free one
and says which it took; an explicit `--port` is a promise, so a busy one stops
the install instead.

A failed brain start does not fail the install: video still renders, and the
report says `CORTEO_BRAIN=failed` with the step in `CORTEO_BRAIN_STEP`.

If the run fails, stderr ends with:

```text
CORTEO_STATUS=failed
CORTEO_FAILED_STAGE=<stage>
```

and the exit code is non-zero. Do not report success unless
`CORTEO_STATUS=ok` is present.

## One object instead of lines

`--json` prints the same keys as a single object on stdout and sends every
progress line to stderr, so a bot can parse stdout without filtering anything:

```json
{
  "CORTEO_STATUS": "ok",
  "CORTEO_MCP_URL": "http://127.0.0.1:5199/api/external-mcp/mcp",
  "CORTEO_MCP_TOKEN_FILE": "/home/you/corteo/secrets.env",
  "CORTEO_PORT_STATE": "free",
  "CORTEO_SELF_TEST": "pass",
  "CORTEO_START": true
}
```

Booleans are real booleans — `CORTEO_START`, `CORTEO_WITH_DESKTOP`,
`CORTEO_SKIP_SYSTEM_DEPS`, `CORTEO_PURGE` — not `1` and `0`. In the plain
`KEY=VALUE` output they stay `1` and `0`, which is the format that output has
always had.

A failure is still exactly one object on stdout, with a non-zero exit code:

```json
{"CORTEO_STATUS":"failed","CORTEO_FAILED_STAGE":"installing dependencies"}
```

## What the dry run prints

`--dry-run` checks the machine and prints the plan without writing anything. It
uses `CORTEO_STATUS=dry-run` and these keys:

| key | meaning |
|---|---|
| `CORTEO_HOST_PROFILE` | the host profile that would be installed, or `none` |
| `CORTEO_OS` | `uname -s` and `uname -m` of the machine |
| `CORTEO_DIR`, `CORTEO_APP_DIR` | the install root and checkout that would be used |
| `CORTEO_NODE_SYSTEM`, `CORTEO_NODE_TARGET` | the Node found on `PATH` (`not installed` if none) and the major the installer wants |
| `CORTEO_URL`, `CORTEO_MCP_URL` | the URLs the install would use |
| `CORTEO_REF` | the git ref |
| `CORTEO_START`, `CORTEO_WITH_DESKTOP`, `CORTEO_SKIP_SYSTEM_DEPS` | the plan's booleans; `true`/`false` under `--json`, `1`/`0` in the text output |
| `CORTEO_SELF_TEST` | `planned` or `skipped` |
| `CORTEO_PORT_STATE` | `free` or `in-use`; a real install would move up from a busy default |
| `CORTEO_BRAIN` | `planned` or `skipped` |
| `CORTEO_SERVICE` | the service unit |
| `CORTEO_LOG` | the log path |
| `CORTEO_LEGACY_DIR`, `CORTEO_LEGACY_ACTION` | the old root and the migration the install would take (`none`, `move`, `kept-both` or `ignored`) |

`--uninstall --dry-run` prints its own plan: `CORTEO_STATUS=dry-run`,
`CORTEO_ACTION=uninstall`, `CORTEO_DIR`, `CORTEO_PURGE`, `CORTEO_SERVICE`,
`CORTEO_LEGACY_DIR` and `CORTEO_LEGACY_ACTION`.

## Connect over MCP

Use this JSON in the client's MCP configuration, replacing `<token>` with the
value in `CORTEO_MCP_TOKEN_FILE` (or with `CORTEO_MCP_TOKEN` if you installed
with `--print-token`):

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

The endpoint speaks Streamable HTTP. A minimal check:

```bash
TOKEN="$(grep '^OPENCHATCUT_MCP_TOKEN=' "$HOME/corteo/secrets.env" | cut -d= -f2-)"

curl -sS -o /dev/null -w '%{http_code}\n' \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"corteo-check","version":"1"}}}' \
  http://127.0.0.1:5199/api/external-mcp/mcp
```

`200` means the endpoint and token are good. `403` means the token does not
match: read it again from `~/corteo/secrets.env`, or restart the service after
changing it.

Both the agent and the editor run in the same VM, so `127.0.0.1` is correct and
no tunnel is needed. Do not expose port 5199 to the network: the MCP endpoint is
a single-user local service.

## Verify the CLI

```bash
~/corteo/bin/occ where
~/corteo/bin/occ project list
~/corteo/bin/occ project new "Install check"
~/corteo/bin/occ render "Install check" --out /tmp/install-check.mp4 --dry-run
```

`occ where` prints the active profile id, library, project index, media
directory and keystore path. `occ` uses the same profile as the running app
because the wrapper sets `OPENCHATCUT_DEV_PROFILE_ID`. Without the wrapper, pass
`--data-dir ~/.openchatcut/dev-profiles/<id>`.

Timeline-changing calls (`occ edit`, `occ item`, `occ tools call`) write only
with `--apply`:

```bash
~/corteo/bin/occ tools call set_aspect_ratio --args '{"ratio":"9:16"}' --apply
```

Every write is committed atomically, checks the project revision, and snapshots
a pre-edit version that can be undone from the app.

## Open the editor

The browser UI needs a secure context. Open `http://localhost:5199` on the VM
itself, or forward the port from your laptop:

```bash
ssh -L 5199:127.0.0.1:5199 you@vm
# then open http://localhost:5199 locally
```

A plain-HTTP connection to the VM's LAN IP will load the project list but refuse
to open the editor, because the browser disables WebCodecs and Web Crypto there.
For a permanently remote setup, put an HTTPS reverse proxy in front of the
editor.

## Service management

systemd user service:

```bash
systemctl --user status corteo.service
systemctl --user restart corteo.service
journalctl --user -u corteo.service -n 100 --no-pager
```

The installer tries to enable lingering (`loginctl enable-linger "$USER"`) so
the service survives logout. If this VM has no systemd user session, the
installer falls back to `nohup`:

```text
CORTEO_MANAGER=nohup
```

In that case:

```bash
tail -f ~/corteo/logs/corteo.log
kill "$(cat ~/corteo/corteo.pid)"
```

and start it again with the same command the unit would run. Use
`~/corteo/node/bin` when the installer downloaded its own Node; if it accepted
the system Node 24, drop the `PATH` prefix:

```bash
cd ~/corteo/app
set -a; . ~/corteo/secrets.env; set +a
PATH="$HOME/corteo/node/bin:$PATH" npm run dev -- --host 127.0.0.1 --port 5199
```

Use the last line only when the installer is not managing the process; running
it while the service is active will collide on port 5199.

## Troubleshooting

**Port already in use.** The installer stops before changing anything. Find the
process (`ss -ltnp | grep 5199`) and stop it, or install on another port:

```bash
curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/install.sh \
  | bash -s -- --port 5299
```

Remember to use the new port in the MCP URL too.

**Node is not 24.** The installer ignores a system Node that is not major 24 and
downloads a private copy into `~/corteo/node`. Nothing outside the install root
is modified. Re-run the installer if that directory is damaged.

**Renders or project thumbnails fail while loading Chromium (`libnspr4.so`,
`libnss3.so`).** The VM is missing the libraries the headless renderer needs.
The editor itself still opens. Run the command the installer printed, usually:

```bash
sudo apt-get install -y --no-install-recommends \
  libnss3 libnspr4 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
  libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libasound2t64
```

On Ubuntu 22.04 and older, drop the `t64` suffixes. Then retry the render.

**Raw GitHub URL returns 404 or is rate-limited.** The installer exists on the
`main` branch. If it is not there yet, or the raw host is rate-limiting,
clone the repository and run the script locally:

```bash
git clone https://github.com/uset82/corteo.git ~/corteo
cd ~/corteo
./install.sh --dir ~/corteo
```

The installer uses the checkout it is run from, so `CORTEO_APP_DIR` points at
that clone. Add `--clone` to download a fresh copy into `~/corteo/app` instead.

**`CORTEO_STATUS=failed`.** Read the last 40 lines printed by the installer,
then the log file or journal. Common causes are a missing `git`/`curl`, a busy
port, a network failure during `npm ci`, or a full disk. Fix the cause and run
the same command again; the installer is idempotent.

**Token missing or rotated.** The token is in `~/corteo/secrets.env`. To rotate
it, stop the service, delete that file, and re-run the installer, or set a new
value yourself:

```bash
systemctl --user stop corteo.service   # or kill the nohup pid
printf 'OPENCHATCUT_MCP_TOKEN=%s\nNODE_OPTIONS=--max-old-space-size=6144\n' \
  "$(head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=\n')" \
  > ~/corteo/secrets.env
chmod 600 ~/corteo/secrets.env
systemctl --user start corteo.service
```

Update every MCP client with the new token.

## Updating

Re-run the installer. It fetches `main`, resets `~/corteo/app` to that commit,
reinstalls dependencies, rebuilds `occ`, reuses the existing token, and restarts
the service. Local edits inside `~/corteo/app` are discarded; projects and media
are not touched.

To pin a branch or tag:

```bash
curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/install.sh \
  | bash -s -- --ref <branch-or-tag>
```

## Uninstalling

```bash
# stop the service, keep the app and the projects
curl -fsSL https://raw.githubusercontent.com/uset82/corteo/main/install.sh \
  | bash -s -- --uninstall

# or, if the script is local
./install.sh --uninstall
```

To remove the app, the private Node and the profile data as well:

```bash
./install.sh --uninstall --purge
```

The purge prints every path before deleting it. It never deletes
`~/.openchatcut` as a whole; only the profile that belongs to this install. A
checkout the installer did not clone (one it was run from) is left in place.
