/**
 * Ende-zu-Ende-Tests (PHASE-6.md, Abschnitt 3): Playwright steuert einen echten Browser durch die App.
 *
 * - Die Tests starten ihre eigene Entwicklungsversion auf Port 5174, damit sie ein laufendes
 *   `npm run dev` (Port 5173) nicht stören.
 * - Jeder Test beginnt mit leerem Browser (eigene Datenbank) und schaltet simuliertes Drive und
 *   simulierten Kalender an (siehe `e2e/hilfen.ts`). Echtes Google wird nie berührt.
 * - Zwei Durchläufe: Desktop mit Chromium und iPhone-Größe mit WebKit (die Engine von Safari).
 *
 * Starten: `npm run test:e2e` (beide) oder `npm run test:e2e -- --project=desktop`.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;
/** Läuft der Test bei GitHub Actions? (Dort ist die Umgebungsvariable CI gesetzt.) */
const CI = !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.CI;

export default defineConfig({
  testDir: 'e2e',
  // Tests laufen gleichzeitig in mehreren Browserfenstern; jedes hat eigene Daten.
  fullyParallel: true,
  forbidOnly: CI,
  // Bei GitHub ein zweiter Versuch, falls ein Test nur zufällig zu langsam war.
  retries: CI ? 1 : 0,
  reporter: CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 60_000,
  },
});
