/** Einstiegspunkt: lädt Schriften und Gestaltung, holt die Daten und startet die Oberfläche. */
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './ui/stil.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { ladeAlles } from './db/speicher';
import { App } from './ui/App';

// Offline-Betrieb: Der „Service Worker“ speichert die App-Dateien im Browser zwischen.
// Er ist nur in der gebauten Version aktiv, nicht im Entwicklungsmodus.
registerSW({ immediate: true });

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

ladeAlles().catch((fehler) => {
  console.error(fehler);
  document.getElementById('app')!.textContent =
    'Die Daten konnten nicht geladen werden. Bitte die Seite neu laden. Hilft das nicht: Ist im Browser das Speichern von Website-Daten erlaubt?';
});
