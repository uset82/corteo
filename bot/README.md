# bot/

The corteo template for a Grok Bot: one profile, four skills, one generated
recipe. A person imports `bot/dist/recipe.json` and gets a bot that can install
corteo, drive it, and repair it.

```text
bot/
  profile.md                  who the bot is, the one rule, the turn rule  (≤3 KB)
  skills/
    corteo-welcome/SKILL.md   what corteo is, one widget                  (≤6 KB)
    corteo-setup/SKILL.md     the install, in two replayable blocks        (≤6 KB)
    corteo-edit/SKILL.md      the occ recipes, render range first          (≤6 KB)
    corteo-repair/SKILL.md    after a computer update                      (≤6 KB)
  dist/recipe.json            generated, committed, imported by the bot
```

## Build

```bash
npm run build:bot-recipe     # writes bot/dist/recipe.json
npm run verify:bot-recipe    # validates only; fails if dist is stale
```

`dist/` is build output everywhere else in this repo. This one is a deliverable:
the JSON is what a person hands to Grok, and the generator is the only thing that
can prove it matches the sources, so both are committed.

## The rules the build enforces

| Rule | Why |
|---|---|
| front matter `name` = folder name | the import keys skills by folder |
| every description starts `Use when` | that is how the model picks a skill |
| ≤6 KB per skill, ≤3 KB profile | a skill is re-emitted through the bot's own state tool, and a long one gets truncated mid-sentence |
| ≤80 KB re-emitted, description counted twice | the same text appears in the list and in the file |
| no token, no private path, no `uset82.workers.dev` | a recipe is shared, pasted and screenshotted |
| shell examples single-quoted | `--args '{"a":1}'` survives a re-emit; `--args "{\"a\":1}"` does not |
| no instruction to auto-install a plugin | a skill is untrusted content: it may ask, never install |

## Why there is no `memory` file

`memory` is one log line, generated from `package.json`'s version. A recipe that
remembers more than that is a recipe that goes stale in a way nobody notices.

## What a skill may not do

Skills are treated as untrusted content. A skill may not ask for a secret in
text, may not tell the bot to install a plugin or an MCP server, and may not
spend anything. The person decides; the bot asks with a widget.

## The proof

`bot/skills/corteo-setup/SKILL.md` carries its commands between
`# rehearsal:begin` / `# rehearsal:end`. `scripts/bot-rehearsal.sh` contains those
same lines and runs them in a throwaway `HOME`; `scripts/bot-recipe.verify.mjs`
fails the build when the two stop matching. That is the only reason to trust that
the install a bot copies is an install that works.
