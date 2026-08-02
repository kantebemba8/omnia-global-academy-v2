# Omnia Global Academy — release hardening
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-renamesourcefileattribute SourceFile

# Capacitor bridge and plugins are reached from annotations / JavaScript.
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
}

# Omnia native billing bridge is registered manually in MainActivity.
-keep class com.omniaglobalacademy.app.billing.** { *; }

# Google Play Billing public model objects are passed through the native bridge.
-keep class com.android.billingclient.api.** { *; }
-dontwarn com.android.billingclient.api.**

# Preserve useful line numbers for production crash diagnostics without exposing source paths.
-keepattributes SourceFile,LineNumberTable
