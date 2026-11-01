#!/bin/bash
# Starts an EAS Android APK build (profile "preview") and waits for it.
# Prints only "FINISHED <version> <apk-url>" or "ERRORED <message>". Takes ~10-20 min: run in the background.
cd "$(git rev-parse --show-toplevel)" || exit 2
id=$(npx eas-cli build -p android --profile preview --non-interactive --no-wait 2>&1 | grep -oE "builds/[0-9a-f-]{36}" | head -1 | cut -d/ -f2)
[ -z "$id" ] && { echo "ERRORED could not start the build"; exit 1; }
echo "started $id"
while true; do
  line=$(npx eas-cli build:view "$id" --json 2>/dev/null | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);console.log(j.status,j.appVersion??"",j.artifacts?.buildUrl??j.error?.message??"")}catch{console.log("RETRY")}})')
  case "$line" in FINISHED*|ERRORED*|CANCELED*) echo "$line"; [[ $line == FINISHED* ]]; exit $?;; esac
  sleep 60
done
