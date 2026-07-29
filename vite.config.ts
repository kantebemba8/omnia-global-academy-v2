import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false,
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/offline.html',
        runtimeCaching: [
          { urlPattern: ({ request }) => request.destination === 'image', handler: 'CacheFirst', options: { cacheName: 'omnia-images', expiration: { maxEntries: 80, maxAgeSeconds: 604800 } } },
          { urlPattern: ({ request }) => request.destination === 'font' || request.destination === 'style' || request.destination === 'script', handler: 'StaleWhileRevalidate', options: { cacheName: 'omnia-static-assets', expiration: { maxEntries: 80, maxAgeSeconds: 604800 } } },
        ],
      },
      manifest: {
        name: 'Omnia Global Academy',
        short_name: 'Omnia Academy',
        theme_color: '#002050',
        background_color: '#FFFFFF',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/IMG_0349.png',
            sizes: '192x192',
            type: 'image/png',
          }
        ],
      },
    }),
  ],
  optimizeDeps: {
    include: ['react-router-dom'],
    exclude: ['lucide-react'],
  },
});
