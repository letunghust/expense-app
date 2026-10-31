# The module is small; keep it intact so release minification can't break the OCR call.
-keep class com.tung.chitieu.textrecognition.** { *; }

# ML Kit finds its components through <meta-data> entries in the manifest whose
# value must equal ComponentRegistrar's class name. R8 renamed that interface,
# so no component registered and TextRecognition.getClient() hit a null.
-keepnames class com.google.firebase.components.ComponentRegistrar
-keep class * implements com.google.firebase.components.ComponentRegistrar { <init>(); }
