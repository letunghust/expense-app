#!/bin/bash
# Boots the headless "chitieu" emulator if it isn't running, waits for boot, and loads test images.
# usage: emulator.sh [IMAGE_DIR]   (default ~/Pictures/anh-chuyen-khoan)
SDK=${ANDROID_HOME:-$HOME/Android/Sdk}; A=$SDK/platform-tools/adb
if ! $A devices | grep -q emulator; then
  nohup $SDK/emulator/emulator -avd chitieu -no-window -no-audio -no-boot-anim \
    -gpu swiftshader_indirect -memory 3072 -no-snapshot-save >/dev/null 2>&1 &
fi
$A wait-for-device
until [ "$($A shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; do sleep 3; done
IMAGES=${1:-$HOME/Pictures/anh-chuyen-khoan}
if [ -d "$IMAGES" ]; then
  for f in "$IMAGES"/*; do $A push "$f" /sdcard/Pictures/ >/dev/null; done
  $A shell 'for f in /sdcard/Pictures/*; do am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d "file://$f" >/dev/null; done'
fi
echo "emulator ready"
