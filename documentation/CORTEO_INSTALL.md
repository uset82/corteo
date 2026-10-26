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

Full option list: `install.sh --help`. Useful flags: `--no-start`,
`--with-desktop`, `--skip-system-deps`, `--dry-run`, `--uninstall` and
`--uninstall --purge`.

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
CORTEO_URL=http://127.0.0.1:5199
CORTEO_LOCAL_URL=http://127.0.0.1:5199
CORTEO_MCP_URL=http://127.0.0.1:5199/api/external-mcp/mcp
CORTEO_MCP_TOKEN=<43-character token>
CORTEO_OCC=/home/you/corteo/bin/occ
CORTEO_APP_DIR=/home/you/corteo/app
CORTEO_DATA_DIR=/home/you/.openchatcut/dev-profiles/<uuid>
CORTEO_GUIDE=/home/you/corteo/app/documentation/CORTEO_INSTALL.md
CORTEO_LOG=/home/you/corteo/logs/corteo.log
CORTEO_MANAGER=systemd
CORTEO_MIGRATED_FROM=/home/you/claudia
CORTEO_LEGACY_SERVICE=stopped
```

`CORTEO_MIGRATED_FROM` is the path the install came from, or `none`. It is the
only line that tells you the old tree moved; `CORTEO_APP_DIR` is already the new
one. `CORTEO_LEGACY_SERVICE` is `stopped`, or `none` when there was no old
service to stop.

The same values are written to `~/corteo/corteo.env` with mode `0600`. The
token is also in `~/corteo/secrets.env`; that file is what the service reads.

If the run fails, stderr ends with:

```text
CORTEO_STATUS=failed
CORTEO_FAILED_STAGE=<stage>
```

and the exit code is non-zero. Do not report success unless
`CORTEO_STATUS=ok` is present.

## Connect over MCP

Use this JSON in the client's MCP configuration, replacing `<token>` with
`CORTEO_MCP_TOKEN`:

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
