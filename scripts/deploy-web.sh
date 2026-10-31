#!/bin/bash
# Builds the web app and publishes it to Cloudflare Pages (project "chi-tieu").
# Needs `npx wrangler login` once on this machine.
# usage: scripts/deploy-web.sh [--preview]   (--preview: deploy to a preview URL, not production)
set -euo pipefail
cd "$(dirname "$0")/.."

npx expo export -p web
node scripts/finish-web-export.js

branch=main
[ "${1:-}" = "--preview" ] && branch=preview
npx wrangler@4 pages deploy dist --project-name chi-tieu --branch "$branch" --commit-dirty=true
