#!/bin/bash
# Swaps the current JS into an existing EAS APK and installs it, to test JS-only changes in ~2 minutes
# instead of a new EAS build. Signed with a throwaway key, so it replaces the installed app
# (app data on the emulator is lost) and can NOT be given to the user.
# usage: repack-js.sh BASE.apk WORKDIR
set -e
SDK=${ANDROID_HOME:-$HOME/Android/Sdk}; BT=$(ls -d $SDK/build-tools/* | tail -1); A=$SDK/platform-tools/adb
BASE=$(realpath "$1"); WORK=$(realpath -m "$2"); APP=$(git rev-parse --show-toplevel)
mkdir -p "$WORK/assets"
(cd "$APP" && npx expo export --platform android --output-dir "$WORK/export" >/dev/null)
cp "$WORK"/export/_expo/static/js/android/entry-*.hbc "$WORK/assets/index.android.bundle"
cd "$WORK" && rm -f app.apk aligned.apk signed.apk && cp "$BASE" app.apk
# Only swap the bundle; never delete META-INF (it holds ServiceLoader configs the app needs).
zip -q -0 app.apk assets/index.android.bundle
"$BT/zipalign" -f -p 4 app.apk aligned.apk
[ -f debug.keystore ] || keytool -genkeypair -keystore debug.keystore -storepass android -keypass android \
  -alias test -keyalg RSA -validity 3650 -dname "CN=test" >/dev/null 2>&1
"$BT/apksigner" sign --ks debug.keystore --ks-pass pass:android --ks-key-alias test --out signed.apk aligned.apk
$A install -r signed.apk >/dev/null 2>&1 || { $A uninstall com.tung.chitieu >/dev/null; $A install signed.apk; }
echo "installed repacked APK"
