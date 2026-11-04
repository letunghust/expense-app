#!/bin/bash
# Starts an EAS Android APK build (profile "preview") and waits for it.
# Prints only "FINISHED <version> <apk-url>" or "ERRORED <message>". Takes ~10-20 min: run in the background.
# usage: eas-build.sh [BUILD_ID]     with an id, only waits for that build
cd "$(git rev-parse --show-toplevel)" || exit 2
id=$1
if [ -z "$id" ]; then
  for attempt in 1 2 3; do # the connection drops now and then
    output=$(npx eas-cli build -p android --profile preview --non-interactive --no-wait 2>&1)
    id=$(grep -oE "builds/[0-9a-f-]{36}" <<<"$output" | head -1 | cut -d/ -f2)
    [ -n "$id" ] && break
    sleep 30
  done
  [ -z "$id" ] && { echo "ERRORED could not start the build:"; tail -5 <<<"$output"; exit 1; }
fi
echo "started $id"
while true; do
  line=$(npx eas-cli build:view "$id" --json 2>/dev/null | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);console.log(j.status,j.appVersion??"",j.artifacts?.buildUrl??j.error?.message??"")}catch{console.log("RETRY")}})')
  case "$line" in FINISHED*|ERRORED*|CANCELED*) echo "$line"; [[ $line == FINISHED* ]]; exit $?;; esac
  sleep 60
done
