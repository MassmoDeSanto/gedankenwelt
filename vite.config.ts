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
      registerType: 'autoUpdate',
      includeAssets: ['symbol.svg'],
      manifest: {
        name: 'Gedankenwelt',
        short_name: 'Gedankenwelt',
        description: 'Persönliche Notizen, Aufgaben und Gedanken',
        lang: 'de',
        display: 'standalone',
        start_url: '.',
        background_color: '#0f1117',
        theme_color: '#0f1117',
        icons: [{ src: 'symbol.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
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
