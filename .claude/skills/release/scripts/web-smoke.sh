#!/bin/bash
# End-to-end check of the web build (scan, save, offline) in Chrome with an iPhone viewport.
# usage: web-smoke.sh URL WORKDIR [IMAGE]    WORKDIR: a scratch dir, Playwright is installed there once.
URL=$1; WORK=${2:?workdir}; IMAGE=${3:-$(ls -d "$HOME"/Pictures/anh-chuyen-khoan/* 2>/dev/null | tail -1)}
SCRIPTS=$(git rev-parse --show-toplevel)/.claude/skills/test-web/scripts
mkdir -p "$WORK" && cd "$WORK" || exit 2
if [ ! -d node_modules/playwright ]; then
  npm init -y >/dev/null && npm i playwright@1.56.1 >/dev/null 2>&1 || { echo "could not install playwright"; exit 2; }
fi
cp "$SCRIPTS"/*.mjs .
node pwa-test.mjs "$URL" chromium "$WORK" "$IMAGE" 2>&1 | grep -vE "Parameter not found|^logs:|^\s*$"
exit "${PIPESTATUS[0]}"
