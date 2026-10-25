# Plan 5: corteo on a fresh Claudia box

Approved by Carlos on 2026-10-25. Claudia installed GitHub main `aeeff43` the way a new bot would, and made an 8 second 1080p video (2 clips, a cut, a title, a song, render about 26 seconds, PASS). It only worked after manual fixes. This plan removes those fixes.

The bar: a Claudia or Grok Bot with no prior context, on a fresh Linux box, runs the curl one-liner, follows only `skills/corteo/SKILL.md`, and makes a music video.

Reference box: Debian, Node 20 preinstalled and left as the default `node`, ffmpeg 7.1, Google Chrome at the system path, no GPU, 8 vCPU / 15 GB. Every shell exports `NPM_CONFIG_PREFIX` (on her box, `/home/box/.local`).

## Tasks

| ID | What breaks today | Fix |
|----|-------------------|-----|
| P-CL-1 | First run: nvm aborts with `nvm is not compatible with the "NPM_CONFIG_PREFIX" environment variable`, and the self-test FAILs. | In `scripts/claudia-install.sh`, `unset NPM_CONFIG_PREFIX npm_config_prefix` before sourcing `nvm.sh`. Do not edit the user's rc beyond what nvm itself adds. |
| P-CL-2 | Every new shell puts the variable back and `node` is still 20, so `npm run claudia:local` crashes with `ERR_UNKNOWN_BUILTIN_MODULE`. | `scripts/corteo-env.sh` (sourceable): unset the prefix vars, source nvm, `nvm use` from `.nvmrc`, cd to the repo. Wrapper `scripts/corteo` and `bin/corteo` so `~/corteo/scripts/corteo <args>` works from any shell. `claudia:local` uses the same env. If Node stays below 24, print that, do not crash on a missing builtin. |
| P-CL-3 | `if ! self_test` turns off `set -e` inside the function, so a failed step can look like a pass. | Run the self-test in a subshell with `set -e`, and print which step failed. Keep `CORTEO_SELF_TEST=PASS` and `CORTEO_SELF_TEST=FAIL`. |
| P-CL-4 | The installer says it skips the browser download. The first render still downloads Remotion's ~99 MB headless shell. | Point Remotion at system Chrome with `CC_BROWSER_EXECUTABLE` when that binary runs. If there is no system Chrome, download the shell during install and say so. No surprise download at render time. |
| P-CL-5 | Placing audio with no track fails: `no audio track for placement — create one with edit_track first`. | Auto-create an audio track when audio is added with no `trackId`. Document `edit_track` create. `json` may be a string or an object (an object used to fail with `/json must be string`). |
| P-CL-6 | Text with no `trackId` lands on the clip track at the end (frame 571) and ignores `fromFrame`. | Always keep `fromFrame`. Auto-create or reuse an overlay video track above the clips for text and titles. Document `fontSize`, `color`, `fontWeight`, `align`, `position` (`top` / `center` / `bottom`), and `durationInFrames`. |
| P-CL-7 | `split` / `split_item` does not return the new item id. | JSON includes `newItemId` and `newItemIds`. |
| P-CL-8 | MCP at `127.0.0.1:5199/api/external-mcp/mcp` returns 403 `invalid request origin` without `Authorization: Bearer <token>`. The skill never says how a headless bot gets the token. | `corteo mcp token` prints the path. `corteo mcp token --show` prints the token only on stdout. The skill has a curl handshake. Localhost only. Never commit a token. |
| P-CL-9 | Default text item name is `文字`. Default timeline name is `序列 1`. | Spanish defaults: `Texto`, `Secuencia 1`, and the other names that show up in CLI JSON (`Color`, `copia`, the beat-tool notes). i18n keys stay Chinese. |
| P-CL-10 | `Failed to load url /@fs/src/main.tsx` on every `claudia:local` start. | Vite warmup uses `src/main.tsx`, a path the dev server can load. |
| P-CL-11 | The skill is missing the wrapper, the full verb list, and tested recipes. | Rewrite `skills/corteo/SKILL.md`. Every command in it is copy-paste tested. |
| P-CL-12 | Nothing scripts the fresh-box path. | `scripts/claudia-acceptance.sh`: fresh clone, `NPM_CONFIG_PREFIX` set, Node 20 as `node`, installer, `claudia:local` in the background, then only skill commands. 2 clips, a tone, a title at `fromFrame` 30 on an overlay, a cut. Render 6 seconds at 1080p. ffprobe: duration ±0.1s, 1920x1080, an audio stream. One MCP call with the token. Stop the server. Print `ACCEPTANCE=PASS` or `ACCEPTANCE=FAIL`. |

## Out of scope

Carlos's stashed music WIP. The optional Cloudflare tunnel and the public Worker. Paid providers (they stay off). No API keys and no tokens in git.
