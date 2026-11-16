/** Einstiegspunkt: lädt Schriften und Gestaltung, holt die Daten und startet die Oberfläche. */
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './ui/stil.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { nutzeTestDrive, starteAbgleichDienst } from './db/abgleichDienst';
import { verarbeiteRueckkehr } from './db/anmeldung';
import { ladeAlles } from './db/speicher';
import { App } from './ui/App';

// Kommt die Seite gerade von der Google-Anmeldung zurück? Dann die Antwort auswerten,
// bevor die App startet (sie steht hinter dem „#“ der Adresse und wird sofort entfernt).
verarbeiteRueckkehr();

// Nur in der Entwicklung: Mit localStorage „gedankenwelt.testdrive = 1“ läuft der Abgleich gegen ein
// simuliertes Drive im Arbeitsspeicher – zum Ausprobieren ohne Google-Konto.
if (import.meta.env.DEV && localStorage.getItem('gedankenwelt.testdrive') === '1') {
  const { SimuliertesDrive } = await import('./logik/abgleich/simuliertesDrive');
  nutzeTestDrive(new SimuliertesDrive());
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
