#!/bin/bash
# Builds the web app and publishes it to Cloudflare (Workers Static Assets, config in wrangler.jsonc).
# Needs `npx wrangler login` once on this machine.
set -euo pipefail
cd "$(dirname "$0")/.."

npx expo export -p web
node scripts/finish-web-export.js
npx wrangler@4 deploy
