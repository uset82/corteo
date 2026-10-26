# Plan: Claudia polish (P-CL-13 to P-CL-17)

Approved by Carlos on 2026-10-25, after Claudia reinstalled GitHub main `302be8c` from zero with only `skills/corteo/SKILL.md`. The installer passed (`CORTEO_SELF_TEST=PASS`, system Chrome, 51s). `claudia:local`, an 8s 1080p video, a 9:16 short, the MCP handshake, and `claudia-acceptance.sh` all passed. Five leftovers remain.

GitHub `main` moves while this branch is open. Before any push: `git fetch https://github.com/uset82/corteo.git main` and merge it (no force, no rebase of pushed history). The GitHub tip must stay an ancestor of this branch.

## Tasks

| ID | What breaks today | Fix |
|----|-------------------|-----|
| P-CL-13 | `scripts/claudia-acceptance.sh` dies with `port 5199 is already in use` when the user's `claudia:local` is up, and it writes into that profile's library. | The script picks `CORTEO_PORT` or the first free port from 5299, and a temp `CORTEO_STORE_DIR`. `claudia:local`, the CLI, and the MCP URL honor `CORTEO_PORT` and `CORTEO_STORE_DIR` (`OPENCHATCUT_DATA_DIR` when the store var is set and the data dir is not). The skill says the acceptance test can run while the editor is on. |
| P-CL-14 | A 16:9 clip in a 1080x1920 project sits in the middle on the checkerboard. | Video and image items take `fit: "cover" \| "contain" \| "fill"` (cover fills and crops, centered; contain letterboxes; fill stretches) and `background: {type: "blur" \| "color", color?}`. Blur reuses the V1 background fill. Color paints the bars. CLI: `item fit`. `edit_item` accepts the same fields. A non-alpha render paints empty pixels black, not the preview checkerboard. The 9:16 recipe uses cover, with a contain + blur variant, and `transform.x` when the crop should move. |
| P-CL-15 | The music-video recipe is too long for a zero-context bot, and a clip can run past the song after a split. | The skill leads with `Receta rápida (5 comandos)`, then the full `Video musical` recipe. `item trim <id> --to <frame\|time>` sets the end. `render --to-audio` stops at the last audio clip (an explicit `--to` wins). |
| P-CL-16 | `claudia:local` warns on `import "./shorts"` with no extension, and Vite's native loader lists other extensionless imports. | `src/i18n/dict/en/index.ts` imports `./shorts.ts`. Startup sets `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` so the remaining extensionless graph stays quiet. |
| P-CL-17 | The installer leaves `.claudia-self-test/` and `claudia-self-test.mp4` in the repo. | Self-test files go to `mktemp -d`. Success deletes them. Failure keeps them and prints the path. `.gitignore` names both. |

## Out of scope

Carlos's stashed music WIP. No API keys, no tokens in git, no `npm audit fix --force`. `skills/corteo/SKILL.md` stays generic and in its current language mix. AGPL attribution stays.
