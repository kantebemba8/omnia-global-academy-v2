import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const nativeBuild = mode === 'native';

  return {
    plugins: [
      react(),
      ...(!nativeBuild
        ? [
            VitePWA({
              registerType: 'autoUpdate',
              devOptions: {
                enabled: false,
              },
              workbox: {
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true,
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
                // Une SPA React doit toujours restituer son shell principal lors
                // d'une navigation. L'ancienne valeur /offline.html interceptait
                // aussi les navigations en ligne et enfermait parfois l'utilisateur
                // sur la page « hors connexion ».
                navigateFallback: '/index.html',
                runtimeCaching: [
                  {
                    urlPattern: ({ request }) => request.destination === 'image',
                    handler: 'CacheFirst',
                    options: {
                      cacheName: 'omnia-images',
                      expiration: {
                        maxEntries: 80,
                        maxAgeSeconds: 604800,
                      },
                    },
                  },
                  {
                    urlPattern: ({ request }) =>
                      request.destination === 'font' ||
                      request.destination === 'style' ||
                      request.destination === 'script',
                    handler: 'StaleWhileRevalidate',
                    options: {
                      cacheName: 'omnia-static-assets',
                      expiration: {
                        maxEntries: 80,
                        maxAgeSeconds: 604800,
                      },
                    },
                  },
                ],
              },
              manifest: {
                id: '/',
                name: 'Omnia Global Academy',
                short_name: 'Omnia Academy',
                description:
                  "Plateforme de formation, de certification et d'employabilité conçue pour l'Afrique et ouverte au monde.",
                lang: 'fr',
                dir: 'ltr',
                scope: '/',
                theme_color: '#002050',
                background_color: '#FFFFFF',
                display: 'standalone',
                display_override: ['standalone', 'minimal-ui'],
                orientation: 'any',
                categories: ['education', 'productivity'],
                prefer_related_applications: false,
                start_url: '/',
                shortcuts: [
                  {
                    name: 'Explorer les formations',
                    short_name: 'Formations',
                    description: 'Consulter les formations publiées sur Omnia.',
                    url: '/catalogue',
                  },
                  {
                    name: 'Omnia Live',
                    short_name: 'Live',
                    description: 'Découvrir les événements et sessions en direct.',
                    url: '/omnia-live',
                  },
                  {
                    name: 'Omnia Talent',
                    short_name: 'Talent',
                    description: 'Accéder aux profils et opportunités professionnelles.',
                    url: '/talent',
                  },
                ],
                icons: [
                  {
                    src: '/icons/omnia-192.png',
                    sizes: '192x192',
                    type: 'image/png',
                  },
                  {
                    src: '/icons/omnia-512.png',
                    sizes: '512x512',
                    type: 'image/png',
                  },
                ],
              },
            }),
          ]
        : []),
    ],
    define: {
      __OMNIA_NATIVE_BUILD__: JSON.stringify(nativeBuild),
    },
    optimizeDeps: {
      include: ['react-router-dom'],
      exclude: ['lucide-react'],
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('jsqr')) return 'document-tools';
            if (id.includes('recharts')) return 'charts';
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('@sentry')) return 'monitoring';
            if (id.includes('@capacitor') || id.includes('capacitor-secure-storage')) return 'native-bridge';
            return undefined;
          },
        },
      },
    },
  };
});
