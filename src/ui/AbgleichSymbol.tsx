/**
 * Das kleine Wolken-Symbol zeigt, wie es um den Abgleich mit Google Drive steht.
 * Antippen öffnet eine kurze Erklärung. Ist kein Abgleich eingerichtet, ist es unsichtbar.
 */
import { starteWeiterleitung } from '../db/anmeldung';
import { gleicheAb, useAbgleichStatus, type AbgleichZustand } from '../db/abgleichDienst';
import { Menue } from './Bausteine';
import { WolkeAchtung, WolkeAus, WolkeFertig, WolkeHoch } from './Symbole';

const KURZ: Record<AbgleichZustand, string> = {
  aus: 'Kein Abgleich',
  abgeglichen: 'Abgeglichen',
  ausstehend: 'Änderungen warten',
  laeuft: 'Abgleich läuft',
  offline: 'Offline',
  anmeldung: 'Neu anmelden nötig',
  fehler: 'Abgleich fehlgeschlagen',
};

function symbolFuer(zustand: AbgleichZustand) {
  if (zustand === 'abgeglichen') return <WolkeFertig />;
  if (zustand === 'offline') return <WolkeAus />;
  if (zustand === 'anmeldung' || zustand === 'fehler') return <WolkeAchtung />;
  return <WolkeHoch />;
}

/** „vor 3 Minuten“, „gerade eben“ … */
export function vorWieLange(ms: number | null): string {
  if (!ms) return 'noch nie';
  const minuten = Math.floor((Date.now() - ms) / 60_000);
  if (minuten < 1) return 'gerade eben';
  if (minuten < 60) return `vor ${minuten} Min.`;
  const stunden = Math.floor(minuten / 60);
  if (stunden < 24) return `vor ${stunden} Std.`;
  return new Date(ms).toLocaleDateString('de-DE');
}

export function AbgleichSymbol() {
  const status = useAbgleichStatus();
  if (status.zustand === 'aus') return null;

  return (
    <Menue
      knopf={symbolFuer(status.zustand)}
      beschriftung={`Google Drive: ${KURZ[status.zustand]}`}
      knopfKlasse={`symbolknopf abgleich ${status.zustand}`}
    >
      {(schliessen) => (
        <div className="abgleich-info">
          <div className="etikett">Google Drive · {KURZ[status.zustand]}</div>
          <p>{status.meldung}</p>
          {status.kalenderHinweis && <p className="bernstein">Erinnerungen: {status.kalenderHinweis}</p>}
          <p className="mono meta">
            Letzter Abgleich: {vorWieLange(status.letzterAbgleich)}
            {status.offen > 0 && ` · ${status.offen} offen`}
          </p>
          {status.zustand === 'anmeldung' ? (
            <button className="knopf haupt" onClick={() => starteWeiterleitung(false)}>
              Neu anmelden
            </button>
          ) : (
            <button
              className="knopf"
              disabled={status.zustand === 'laeuft'}
              onClick={() => {
                void gleicheAb('hand');
                schliessen();
              }}
            >
              Jetzt abgleichen
            </button>
          )}
        </div>
      )}
    </Menue>
  );
}
