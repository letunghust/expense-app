#!/bin/bash
# Drive the emulator: ui.sh shot FILE.png | dump | tap X Y | tapText "TEXT" | back
A=${ANDROID_HOME:-$HOME/Android/Sdk}/platform-tools/adb
DIR=$(dirname "$0")
case $1 in
  shot) $A exec-out screencap -p > "$2" && echo "$2" ;;
  dump) $A shell "uiautomator dump /sdcard/ui.xml >/dev/null; cat /sdcard/ui.xml" | grep -oE '(text|content-desc)="[^"]+"' ;;
  tap) $A shell input tap "$2" "$3" ;;
  back) $A shell input keyevent BACK ;;
  tapText)
    xy=$($A shell "uiautomator dump /sdcard/ui.xml >/dev/null; cat /sdcard/ui.xml" | python3 "$DIR/find.py" "$2")
    [ -z "$xy" ] && { echo "not found: $2" >&2; exit 1; }
    $A shell input tap $xy && echo "tapped $xy" ;;
  tapPhoto) # the Nth photo (from 1) in the system photo picker; its layout changes, so never use fixed coordinates
    xy=$($A shell "uiautomator dump /sdcard/ui.xml >/dev/null; cat /sdcard/ui.xml" | python3 "$DIR/find.py" --photo "$2")
    [ -z "$xy" ] && { echo "no photo $2" >&2; exit 1; }
    $A shell input tap $xy && echo "tapped $xy" ;;
  *) echo "usage: ui.sh shot FILE | dump | tap X Y | tapText TEXT | tapPhoto N | back" >&2; exit 2 ;;
esac
