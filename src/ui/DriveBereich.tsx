/**
 * Einstellungen → Google Drive.
 *
 * Im Moment vor allem eine Testseite für die Anmeldung: Hier lässt sich am Laptop
 * und am iPhone ausprobieren, welcher Weg zuverlässig funktioniert, bevor der
 * Abgleich darauf aufbaut. Jeder Versuch wird mit Uhrzeit protokolliert.
 */
import { useState } from 'react';
import {
  abmelden,
  anmeldenPerPopup,
  gueltigesToken,
  leereProtokoll,
  leseProtokoll,
  protokolliere,
  starteWeiterleitung,
  useAnmeldung,
  weiterleitungsAdresse,
  type AnmeldeStatus,
} from '../db/anmeldung';

const STATUSTEXT: Record<AnmeldeStatus, string> = {
  'nicht-eingerichtet': 'Noch nicht eingerichtet',
  'nicht-verbunden': 'Nicht verbunden',
  angemeldet: 'Angemeldet',
  abgelaufen: 'Zugang abgelaufen – wird beim nächsten Mal still erneuert',
  'anmeldung-noetig': 'Neu anmelden nötig',
};

function uhrzeit(ms: number): string {
  return new Date(ms).toLocaleTimeString('de-DE');
}

/** Läuft die App als installierte App (ohne Browserleiste)? */
function istInstalliert(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function pruefeDrive(): Promise<string> {
  const token = gueltigesToken();
  if (!token) return 'Kein gültiger Zugang – bitte zuerst anmelden.';
  try {
    const antwort = await fetch(
      'https://www.googleapis.com/drive/v3/files?pageSize=100&fields=files(id)&q=trashed%3Dfalse',
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!antwort.ok) return `Drive antwortet mit Fehler ${antwort.status}.`;
    const daten = (await antwort.json()) as { files?: unknown[] };
    return `Drive-Zugriff klappt. Die App sieht ${daten.files?.length ?? 0} eigene Dateien.`;
  } catch {
    return 'Drive ist nicht erreichbar (kein Netz?).';
  }
}

export function DriveBereich() {
  const anmeldung = useAnmeldung();
  const [arbeitet, setArbeitet] = useState(false);
  const protokoll = leseProtokoll();
  const eingerichtet = anmeldung.status !== 'nicht-eingerichtet';

  const mitProtokoll = async (aktion: () => Promise<string>) => {
    setArbeitet(true);
    try {
      protokolliere(await aktion());
    } catch (fehler) {
      protokolliere(fehler instanceof Error ? fehler.message : 'Unbekannter Fehler.');
    } finally {
      setArbeitet(false);
    }
  };

  return (
    <section className="karte">
      <div className="etikett">Google Drive</div>

      <div className="einstellung">
        <span>
          {STATUSTEXT[anmeldung.status]}
          <span className="hinweis klein">
            {anmeldung.konto ?? 'kein Konto verbunden'}
            {anmeldung.gueltigBis && ` · Zugang ${anmeldung.gueltigBis > Date.now() ? 'gültig bis' : 'abgelaufen seit'} ${uhrzeit(anmeldung.gueltigBis)}`}
          </span>
        </span>
        {eingerichtet && (
          <button className="knopf haupt" onClick={() => starteWeiterleitung(false)}>
            {anmeldung.konto ? 'Neu anmelden' : 'Mit Google verbinden'}
          </button>
        )}
      </div>

      {!eingerichtet && (
        <p className="hinweis klein">
          Es ist noch keine Google-Client-ID eingetragen. Wie du sie bekommst, steht in der README im Abschnitt „Google
          Cloud einrichten“.
        </p>
      )}

      {eingerichtet && (
        <>
          <div className="etikett abstand">Anmeldung testen</div>
          <div className="knopfreihe">
            <button className="knopf" disabled={!anmeldung.konto} onClick={() => starteWeiterleitung(true)}>
              Still erneuern
            </button>
            <button className="knopf" disabled={arbeitet} onClick={() => mitProtokoll(() => anmeldenPerPopup())}>
              Per Pop-up anmelden
            </button>
            <button className="knopf" disabled={arbeitet} onClick={() => mitProtokoll(pruefeDrive)}>
              Drive-Zugriff prüfen
            </button>
            <button
              className="knopf gefahr"
              onClick={() => {
                abmelden();
                protokolliere('Abgemeldet. Die Verbindung auf diesem Gerät ist entfernt.');
              }}
            >
              Abmelden
            </button>
          </div>
          <p className="hinweis klein">
            Läuft als installierte App: {istInstalliert() ? 'ja' : 'nein'} · Adresse für die Google Cloud:{' '}
            <span className="mono">{weiterleitungsAdresse()}</span>
          </p>

          {protokoll.length > 0 && (
            <div className="protokoll mono">
              {protokoll.map((eintrag, i) => (
                <div key={i}>
                  <span className="meta">{uhrzeit(eintrag.zeit)}</span> {eintrag.text}
                </div>
              ))}
              <button className="textknopf" onClick={leereProtokoll}>
                Protokoll leeren
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
