/** Einstiegspunkt: lädt Schriften und Gestaltung, holt die Daten und startet die Oberfläche. */
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/literata';
import './ui/stil.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { nutzeTestDrive, nutzeTestKalender, starteAbgleichDienst } from './db/abgleichDienst';
import { verarbeiteRueckkehr } from './db/anmeldung';
import { ladeAlles } from './db/speicher';
import { GOOGLE_CLIENT_ID } from './konfig';
import { App } from './ui/App';

// Kommt die Seite gerade von der Google-Anmeldung zurück? Dann die Antwort auswerten,
// bevor die App startet (sie steht hinter dem „#“ der Adresse und wird sofort entfernt).
verarbeiteRueckkehr();

// Nur in der Entwicklung: Mit localStorage „gedankenwelt.testdrive = 1“ läuft der Abgleich gegen ein
// simuliertes Drive im Arbeitsspeicher – zum Ausprobieren ohne Google-Konto.
if (import.meta.env.DEV && localStorage.getItem('gedankenwelt.testdrive') === '1') {
  const { SimuliertesDrive } = await import('./logik/abgleich/simuliertesDrive');
  const testDrive = new SimuliertesDrive();
  nutzeTestDrive(testDrive);
  // Für Tests im Browser (z. B. eine Datei „von Hand“ beschädigen): window.gedankenweltTestDrive
  (window as unknown as { gedankenweltTestDrive: unknown }).gedankenweltTestDrive = testDrive;
}

// Nur in der Entwicklung (`npm run dev`): Solange keine Google-Client-ID eingetragen ist, laufen die
// Erinnerungen gegen einen simulierten Kalender. Er merkt sich seine Termine im localStorage und
// ist „offline“, wenn der Browser es ist. In der veröffentlichten App ist er nicht enthalten.
if (import.meta.env.DEV && (!GOOGLE_CLIENT_ID || localStorage.getItem('gedankenwelt.testkalender') === '1')) {
  const { SimulierterKalender } = await import('./logik/kalender/simulierterKalender');
  const SPEICHER = 'gedankenwelt.simulierterKalender';
  const gemerkt = JSON.parse(localStorage.getItem(SPEICHER) ?? 'null');
  const simuliert = new SimulierterKalender(gemerkt, (stand) => localStorage.setItem(SPEICHER, JSON.stringify(stand)));
  simuliert.istOffline = () => !navigator.onLine;
  nutzeTestKalender(simuliert);
}

// Offline-Betrieb und Updates: Der „Service Worker“ speichert die App-Dateien im Browser zwischen
// (nur in der gebauten Version aktiv). Gibt es eine neue Version, wird sie still übernommen,
// sobald die App in den Hintergrund geht – nie mitten im Schreiben.
let updateWartet = false;
const uebernimmUpdate = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateWartet = true;
  },
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && updateWartet) void uebernimmUpdate(true);
});

// Den Browser bitten, die Daten nicht von sich aus zu löschen (wichtig am iPhone).
void navigator.storage?.persist?.();

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

ladeAlles()
  .then(starteAbgleichDienst)
  .catch((fehler) => {
    console.error(fehler);
    document.getElementById('app')!.textContent =
      'Die Daten konnten nicht geladen werden. Bitte die Seite neu laden. Hilft das nicht: Ist im Browser das Speichern von Website-Daten erlaubt?';
  });
