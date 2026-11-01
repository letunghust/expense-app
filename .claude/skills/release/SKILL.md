---
name: release
description: Ship a new version of Chi Tiêu — checks, version bump, commit/push, web deploy, EAS Android build, emulator smoke test, then the download link. Use when the user asks to build, release, "gửi link", or after finishing a change they will want on their phone.
---

# Release Chi Tiêu

Every script prints a short summary (✓/✗ per check). Don't re-run their steps by hand with full logs.
Scripts: `.claude/skills/release/scripts/` (run from the repo root).

1. **Checks**: `.claude/skills/release/scripts/check.sh` — must print tsc ✓, lint ✓, jest ✓.
2. **Version**: bump `"version"` in `app.json` (patch for fixes, minor for features).
   EAS sets the Android versionCode itself (`appVersionSource: remote`).
3. **Commit and push**: `git -c user.name="tung" -c user.email="tunglehoctot@gmail.com" commit`,
   message ends with the Co-Authored-By line; `git push origin master`.
4. **Web** (iPhone users): `scripts/deploy-web.sh 2>&1 | grep -E "Uploaded|Version ID"`, then
   `.claude/skills/release/scripts/web-smoke.sh https://chi-tieu.levantung-work.workers.dev <scratchpad>/pw`.
   Every line must be ok. Changes that only touch native code can skip this step.
5. **Android build** (run in the background, ~10–20 min): `.claude/skills/release/scripts/eas-build.sh` → `FINISHED <version> <url>`.
   Skip when nothing in the app changed (e.g. only docs or skills).
6. **Emulator**: start it in the background if `adb devices` shows none (command in the
   test-android skill), wait with `.claude/skills/test-android/scripts/emulator.sh`, download the APK
   to the scratchpad, then `.claude/skills/release/scripts/android-smoke.sh <apk>`. It installs over the existing app (the
   user's upgrade path), scans every test screenshot, checks the note field stays above the keyboard,
   and scans logcat. All lines must be ✓.
   Look at screenshots only when something fails or the change is visual.
7. **Report** in Vietnamese: the version, the APK link, the web link if deployed, and what was tested.
   Only ever send the newest link that passed step 6.

If a step fails, fix the cause and go back to step 1; don't send a link "to try". For failures that
only happen in release builds (R8, Hermes), see the lessons in the test-android skill.
