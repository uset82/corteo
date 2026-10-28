#!/usr/bin/env bash
# Publish the editor UI to https://corteo.uset82.workers.dev/ and prove it.
#
#   bash scripts/deploy-site.sh
#
# `npx wrangler deploy` alone is not enough to know it worked: it uploads, and
# the URL keeps serving the previous build until the edge catches up. This waits
# for the tab title to change and prints the bundle hash it is serving, so the
# answer is "the site is corteo now" or the reason it is not.
#
# Needs Cloudflare's login, which lives in the machine's own ~/.wrangler:
#   npx wrangler login
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# Node 24 and a clean PATH; the build needs the version in .nvmrc.
# shellcheck disable=SC1091
source "$ROOT/scripts/corteo-env.sh"

URL="${CORTEO_SITE:-https://corteo.uset82.workers.dev/}"
say() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy] %s\n' "$*" >&2; exit 1; }

# The config is the deployment: a proxy here publishes a worker that forwards to
# a tunnel, which is not what this URL serves.
grep -q '"main": "cloudflare/worker.js"' wrangler.jsonc \
  || die "wrangler.jsonc does not point at the static-assets worker; refusing to publish something else"
[[ -f cloudflare/build.mjs ]] || die "cloudflare/build.mjs is missing, so there is nothing to build"

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  die "the working tree has uncommitted changes; a deploy publishes exactly what is here, so commit or stash first"
fi

say "checking the Cloudflare login"
if ! npx --yes wrangler whoami >/dev/null 2>&1; then
  die "not logged in to Cloudflare. Run 'npx wrangler login' once, then this again."
fi

say "publishing $(git rev-parse --short HEAD) to $URL"
npx --yes wrangler deploy || die "wrangler deploy failed"

# The edge serves the old index.html until the new version is live, and the
# browser may hold it longer. Poll the document itself, not a cached header.
say "waiting for the URL to serve the new build (up to 3 minutes)"
deadline=$((SECONDS + 180))
title=""
while (( SECONDS < deadline )); do
  title="$(curl -fsS --max-time 20 "$URL?cb=$(date +%s)" 2>/dev/null \
    | grep -oE '<title>[^<]*</title>' | head -1 | sed -e 's/<[^>]*>//g' || true)"
  if [[ -n "$title" ]] && ! grep -qi 'claudia' <<<"$title"; then
    break
  fi
  sleep 5
done

bundle="$(curl -fsS --max-time 20 "$URL?cb=$(date +%s)" 2>/dev/null \
  | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1 || true)"

if [[ -z "$title" ]] || grep -qi 'claudia' <<<"$title"; then
  say "the deploy finished but $URL still answers '${title:-nothing}'"
  say "hard-refresh the tab; if the title stays, the upload went to another worker"
  exit 3
fi

say "done: title '${title}', bundle ${bundle:-unknown}"
say "open $URL and check the tab"
