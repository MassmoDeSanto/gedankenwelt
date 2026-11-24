import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Content-Security-Policy (PHASE-6.md, Abschnitt 2): Der Browser lädt und startet nur, was hier
 * erlaubt ist. Selbst wenn es jemand schaffte, Text als HTML einzuschleusen, liefe kein fremdes Skript
 * und keine Daten gingen an fremde Server. GitHub Pages erlaubt keine eigenen HTTP-Kopfzeilen,
 * darum steht sie als <meta> in der Seite (dort wirkungslos: frame-ancestors, report-uri).
 * Nur in der gebauten Version – der Entwicklungsserver braucht eingebettete Skripte.
 */
const CSP = [
  "default-src 'self'",
  // Google Identity Services (Anmeldung per Pop-up, Weg A in src/db/anmeldung.ts)
  "script-src 'self' https://accounts.google.com/gsi/client",
  // eingebettete Stile: Googles Anmeldebibliothek setzt welche
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  // data: = kleine Schriftteile, die Vite direkt in die CSS-Datei schreibt
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  // Drive- und Kalender-Schnittstelle, Anmeldung
  "connect-src 'self' https://www.googleapis.com https://accounts.google.com/gsi/",
  'frame-src https://accounts.google.com/gsi/',
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function sicherheitsRegeln(): Plugin {
  return {
    name: 'gedankenwelt-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
      // Beim Klick auf einen Link erfährt die Zielseite nicht, von wo man kam.
      { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
    ],
  };
}

// Vite ist das Werkzeug, das die App im Entwicklungsmodus startet und für die
// Veröffentlichung zu wenigen kleinen Dateien zusammenbaut.
export default defineConfig({
  // Relative Pfade, damit die App später auch in einem Unterordner läuft (GitHub Pages).
  base: './',
  plugins: [
    react(),
    sicherheitsRegeln(),
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
        background_color: '#1c1b19',
        theme_color: '#1c1b19',
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
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
