---
name: test-android
description: Test a Chi Tiêu Android build (EAS APK or JS-only change) on the local headless emulator before giving the user a download link — install, scan the transfer screenshots, read results and logcat. Use whenever an APK is built, before sending a link, or when the user reports a bug that only happens on the phone.
---

# Test an Android build on the emulator

A green EAS build does not mean the app works: release builds run R8 minification and
Hermes, and both have broken features that passed every Jest test and the web preview.
**Never send the user an APK link before it has passed this check.**

Setup that already exists on this machine (create it again only if missing):
- Android SDK at `~/Android/Sdk` (cmdline-tools, platform-tools, emulator, build-tools 35).
- AVD `chitieu` (Android 35, google_apis, x86_64, pixel_6). KVM works without sudo.
- Real transfer screenshots in `~/Pictures/anh-chuyen-khoan/`. They contain real names and
  account numbers: never copy them into the repo or tests.

Scripts are in `.claude/skills/test-android/scripts/` (call them by full path; screenshots and
APKs go to the scratchpad, not the repo).

## Steps

1. **Emulator**: start it as a *background* command (the tool kills child processes when a
   foreground command ends, so `emulator.sh`'s own nohup start dies with it):
   `~/Android/Sdk/emulator/emulator -avd chitieu -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -memory 3072 -no-snapshot-save`
   with run_in_background, then `scripts/emulator.sh` waits for boot and loads the screenshots.
2. **Install**:
   - EAS build: download the `.apk` from the build's artifact URL, then `adb install -r FILE.apk`.
   - JS-only change (no native/module/app.json plugin changes): `scripts/repack-js.sh BASE.apk WORKDIR`
     puts the current JS into the latest EAS APK in ~2 minutes. Its signature differs, so it is
     for testing only; the user still needs a real EAS build to update over their app.
3. **Scan**: `adb logcat -c`, launch with
   `adb shell monkey -p com.tung.chitieu -c android.intent.category.LAUNCHER 1`, wait ~8 s, then
   `scripts/ui.sh tapText "Quét ảnh chuyển khoản"`, wait ~8 s (the photo picker loads slowly; a tap before it is ready is silently lost), tap a
   thumbnail. Picker grid on the 1080×2400 screen: columns x = 180 / 540 / 900, rows y = 1584 / 1944.
4. **Check**: wait ~10 s, then `scripts/ui.sh dump` (amount, date and note appear as text) or
   `scripts/ui.sh shot FILE.png` and look at it. Then `adb logcat -d | grep ReactNativeJS`:
   any `W`/`E` line such as "Text recognition failed" is a failure even if the screen looks fine.
   `scripts/ui.sh back` returns to the main screen for the next image.
5. Scan every screenshot. Expected: an amount, the transfer date, and a note
   ("message · recipient" or "Chuyển khoản cho …"). Only then send the link.

## Keyboard checks

The emulator has a real on-screen keyboard. Forms autofocus the amount field, so: open the form,
`scripts/ui.sh back` to close the keyboard, then tap the note field near the bottom and screenshot.
The field and the save button must sit above the keyboard.

## Lessons from past failures

- **R8 renames classes found by name at runtime.** ML Kit matched manifest meta-data against
  `ComponentRegistrar`'s class name; R8 renamed it, `getClient()` read a null and threw
  `NullPointerException: Attempt to read from field 'x y.a'`. Fixed with keep rules in
  `modules/chitieu-text-recognition/android/proguard-rules.pro`. To diagnose such errors: unzip
  `classes*.dex` from the APK, `build-tools/35.0.0/dexdump -d` the class named in the stack, and
  see which obfuscated call returns null.
- **Hermes is not V8.** `String.prototype.matchAll` results had no `.groups` for named capture
  groups. Use numbered groups with an `exec` loop in code that runs on the phone.
- **Errors need their cause.** Native code should put the underlying exception in the message
  (the app shows it under "Xem chữ app đọc được"), or the user can only report "it failed".
- When repacking an APK, swap only `assets/index.android.bundle`. Deleting `META-INF/*` removed
  ServiceLoader files and broke the image picker with `ExceptionInInitializerError`.
