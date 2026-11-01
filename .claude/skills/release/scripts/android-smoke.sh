#!/bin/bash
# Installs an APK on the running emulator over the current app (like the user's update), scans every
# test screenshot and checks the keyboard. Prints one line per check.
# usage: android-smoke.sh APK [IMAGE_DIR]     (start the emulator first, see the test-android skill)
APK=$1; IMAGES=${2:-$HOME/Pictures/anh-chuyen-khoan}
A=${ANDROID_HOME:-$HOME/Android/Sdk}/platform-tools/adb
UI=$(git rev-parse --show-toplevel)/.claude/skills/test-android/scripts/ui.sh
$A devices | grep -q emulator || { echo "no emulator running"; exit 2; }
fail=0

$A install -r "$APK" >/dev/null 2>&1 || { $A uninstall com.tung.chitieu >/dev/null; $A install "$APK" >/dev/null 2>&1; } \
  && echo "install ✓" || { echo "install ✗"; exit 1; }
for f in "$IMAGES"/*; do $A push "$f" /sdcard/Pictures/ >/dev/null 2>&1; done
$A shell 'for f in /sdcard/Pictures/*; do am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d "file://$f" >/dev/null; done'
$A logcat -c
$A shell am force-stop com.tung.chitieu
$A shell monkey -p com.tung.chitieu -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 10

# Works in any app language: the scan button is the first accessibility label above the "+" button.
scan_label=$($UI dump | grep -oE 'content-desc="[^"]+"' | sed -n 's/content-desc="\(.*\)"/\1/p' | grep -vE "^,|^$" | grep -B1 -m1 -E "Thêm giao dịch|Add transaction|거래 추가|添加交易|取引を追加" | head -1)
home() { for _ in 1 2 3; do $UI dump | grep -q "content-desc=\"$scan_label\"" && return; $UI back; sleep 2; done; }

count=$(ls "$IMAGES" | wc -l); [ "$count" -gt 6 ] && count=6
positions=("180 1584" "540 1584" "900 1584" "180 1944" "540 1944" "900 1944")
for i in $(seq 0 $((count - 1))); do
  result=""
  for attempt in 1 2; do # a tap before the photo picker is ready is lost: retry once
    home
    $UI tapText "$scan_label" >/dev/null; sleep 9
    $UI tap ${positions[$i]}; sleep 10
    result=$($UI dump | grep -oE 'text="[^"]+"' | sed 's/text="\(.*\)"/\1/' | grep -E '^[0-9][0-9.,]*[0-9]$|20[0-9][0-9]|·|^(Chuyển khoản cho|Transfer to) ' | head -3 | paste -sd'|')
    [ -n "$result" ] && break
  done
  if grep -qE '^[0-9][0-9.,]*[0-9]\|' <<<"$result"; then echo "scan $((i + 1)) ✓ $result"; else echo "scan $((i + 1)) ✗ ${result:-nothing filled}"; fail=1; fi
done

# Keyboard: open the add form, close the number pad, tap the note field near the bottom; it must end up
# above the keyboard (keyboard top is ~1500px on this 2400px screen).
home
add_label=$($UI dump | grep -oE 'content-desc="(Thêm giao dịch|Add transaction|거래 추가|添加交易|取引を追加)"' | head -1 | sed 's/content-desc="\(.*\)"/\1/')
$UI tapText "$add_label" >/dev/null; sleep 4; $UI back; sleep 2
note=$($UI dump | grep -oE 'text="(Ghi chú \(không bắt buộc\)|Note \(optional\)|메모 \(선택\)|备注（可选）|メモ（任意）)"' | head -1 | sed 's/text="\(.*\)"/\1/')
$UI tapText "$note" >/dev/null; sleep 4
# The focused field's bottom edge (text matching would trip over the "(…)" in the placeholder).
bottom=$($A shell "uiautomator dump /sdcard/ui.xml >/dev/null; cat /sdcard/ui.xml" | grep -oE '<node [^>]*focused="true"[^>]*>' | grep -oE 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' | grep -oE '[0-9]+\]"$' | tr -d ']"')
if [ -n "$bottom" ] && [ "$bottom" -lt 1500 ]; then echo "keyboard ✓ note field bottom at ${bottom}px"; else echo "keyboard ✗ note field bottom at ${bottom:-?}px"; fail=1; fi
$UI back; sleep 1; $UI back

errors=$($A logcat -d | grep -E "ReactNativeJS|AndroidRuntime: FATAL" | grep -vE 'Running "main"' | grep -E " [WEF] " | head -5)
if [ -z "$errors" ]; then echo "logcat ✓"; else echo "logcat ✗"; echo "$errors"; fail=1; fi
exit $fail
