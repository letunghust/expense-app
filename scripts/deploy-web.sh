#!/bin/bash
# Builds the web app and publishes it to Cloudflare (Workers Static Assets, config in wrangler.jsonc).
# Needs `npx wrangler login` once on this machine.
set -euo pipefail
cd "$(dirname "$0")/.."

# public/ is published as is: a test photo or screenshot left there must not go online.
if ls public | grep -iE '\.(jpe?g|png|heic|webp)$'; then
  echo "Move these images out of public/ first." >&2
  exit 1
fi

npx expo export -p web
node scripts/finish-web-export.js
npx wrangler@4 deploy
