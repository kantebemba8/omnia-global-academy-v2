/// <reference types="@capacitor/keyboard" />
/// <reference types="@capacitor/status-bar" />
/// <reference types="@capacitor/splash-screen" />
/// <reference types="@capacitor/push-notifications" />

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.omniaglobalacademy.app',
  appName: 'Omnia Global Academy',
  webDir: 'dist',
  backgroundColor: '#FFFFFF',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'banner', 'list'],
    },
    SystemBars: {
      insetsHandling: 'css',
      style: 'DARK',
      hidden: false,
      animation: 'NONE',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#FFFFFF',
    },
    SplashScreen: {
      launchAutoHide: false,
      launchShowDuration: 1500,
      backgroundColor: '#FFFFFF',
      showSpinner: false,
      androidScaleType: 'CENTER_INSIDE',
    },
  },
};

export default config;
