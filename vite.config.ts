import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// Vite ist das Werkzeug, das die App im Entwicklungsmodus startet und für die
// Veröffentlichung zu wenigen kleinen Dateien zusammenbaut.
export default defineConfig({
  // Relative Pfade, damit die App später auch in einem Unterordner läuft (GitHub Pages).
  base: './',
  plugins: [
    react(),
    // PWA-Grundgerüst: macht die App installierbar und offlinefähig.
    VitePWA({
      // „prompt“: Eine neue Version wartet, bis die App sie selbst übernimmt (siehe src/main.tsx).
      registerType: 'prompt',
      includeAssets: ['symbol.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gedankenwelt',
        short_name: 'Gedankenwelt',
        description: 'Persönliche Notizen, Aufgaben und Gedanken',
        lang: 'de',
        display: 'standalone',
        id: '.',
        scope: '.',
        start_url: '.',
        background_color: '#0f1117',
        theme_color: '#0f1117',
        icons: [
          { src: 'symbol-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'symbol-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'symbol-maskierbar-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'symbol.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // Alles, was die App braucht, wird für den Offline-Betrieb zwischengespeichert – auch die Schriften.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
