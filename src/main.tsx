/** Einstiegspunkt: lädt Schriften und Gestaltung, holt die Daten und startet die Oberfläche. */
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './ui/stil.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { verarbeiteRueckkehr } from './db/anmeldung';
import { ladeAlles } from './db/speicher';
import { App } from './ui/App';

// Kommt die Seite gerade von der Google-Anmeldung zurück? Dann die Antwort auswerten,
// bevor die App startet (sie steht hinter dem „#“ der Adresse und wird sofort entfernt).
verarbeiteRueckkehr();

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
