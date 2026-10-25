#!/usr/bin/env bash
# Publish from Carlos's PC. Fetches GitHub main and the Cursor branch, merges
# both into the current branch, runs npm test when Node is 24, then pushes
# HEAD to github main and origin cursor/video-editor-mvp-d191. No force.
# Untracked files are left untouched.
set -euo pipefail

say() { printf '[corteo] %s\n' "$*"; }
die() { printf '[corteo] %s\n' "$*" >&2; exit 1; }

root="$(git rev-parse --show-toplevel 2>/dev/null)" || die "not inside the corteo checkout"
cd "$root"

if ! git diff --quiet || ! git diff --cached --quiet; then
  die "tracked files are modified. Commit or stash them first. This script does not touch untracked files and will not publish a dirty tree."
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
[[ "$branch" != "HEAD" ]] || die "detached HEAD. Check out the local branch first."

say "fetching origin and github"
git fetch origin
git fetch github

merge_one() {
  local ref="$1"
  if git merge-base --is-ancestor "$ref" HEAD; then
    say "$ref is already in HEAD"
    return 0
  fi
  say "merging $ref"
  if ! git merge --no-edit "$ref"; then
    printf '[corteo] merge stopped on conflicts with %s.\n' "$ref" >&2
    printf 'Fix only the conflicted files, then:\n' >&2
    printf '  git add <those paths>\n' >&2
    printf '  git commit\n' >&2
    printf '  bash scripts/sync-publish.sh\n' >&2
    printf 'Do not git add -A. Do not force-push. Leave untracked files alone.\n' >&2
    exit 1
  fi
}

merge_one github/main
merge_one origin/cursor/video-editor-mvp-d191

if ! command -v node >/dev/null 2>&1; then
  die "node is not on PATH. Nothing was pushed."
fi
major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [[ "$major" -lt 24 || "$major" -ge 25 ]]; then
  die "node is $(node -v). Tests need Node 24. Nothing was pushed. Run: nvm use 24"
fi

say "npm test"
if ! CC_RENDER_GL="${CC_RENDER_GL:-swangle}" npm test; then
  die "npm test failed. Nothing was pushed."
fi

say "pushing github HEAD:main"
git push github HEAD:main
say "pushing origin HEAD:cursor/video-editor-mvp-d191"
git push origin HEAD:cursor/video-editor-mvp-d191
say "published $(git rev-parse --short HEAD)"
