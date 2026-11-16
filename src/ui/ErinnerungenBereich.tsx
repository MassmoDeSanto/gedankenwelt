/**
 * Einstellungen → Erinnerungen: aktivieren, neu aufbauen, deaktivieren, Kalender-Selbsttest.
 *
 * Erinnerungen laufen über einen eigenen Kalender „Gedankenwelt“ im Google Kalender. In der
 * veröffentlichten App sind sie erst nutzbar, wenn Google verbunden ist. In der lokalen
 * Entwicklungsversion läuft stattdessen ein simulierter Kalender, dessen Termine hier zu sehen sind.
 */
import { useState } from 'react';
import {
  aktiviereErinnerungen,
  baueErinnerungenNeuAuf,
  deaktiviereErinnerungen,
  erinnerungenVerfuegbar,
  istKalenderSimuliert,
  kalenderSelbsttest,
  simulierteTermine,
  useAbgleichStatus,
} from '../db/abgleichDienst';
import { useZustand } from '../db/speicher';
import { formatNaechste } from '../logik/wiederholung';
import { lokalesDatum } from '../logik/zeit';
import { ERINNERUNGEN } from './AufgabenMenue';
import { Dialog } from './Bausteine';

function erinnerungsText(minuten: number): string {
  return ERINNERUNGEN.find((e) => e.minuten === minuten)?.text ?? `${minuten} Minuten vorher`;
}

export function ErinnerungenBereich() {
  const z = useZustand();
  const abgleich = useAbgleichStatus();
  const [arbeitet, setArbeitet] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fragtAus, setFragtAus] = useState(false);
  const [selbsttest, setSelbsttest] = useState<string[]>([]);

  const aktiv = z.einstellungen.erinnerungen === true && !!z.einstellungen.kalender_id;
  const verfuegbar = erinnerungenVerfuegbar();
  const simuliert = istKalenderSimuliert();
  const heute = lokalesDatum();
  // Mit Uhrzeit, offen, nicht gelöscht: diese Aufgaben bekommen einen Termin.
  const mitUhrzeit = [...z.notizen.values()].filter(
    (n) => !n.geloescht && n.aufgabe && !n.aufgabe.erledigt && (n.aufgabe.faellig?.length ?? 0) > 10,
  ).length;

  const tue = async (aktion: () => Promise<string | null>) => {
    setArbeitet(true);
    setMeldung(null);
    try {
      setMeldung(await aktion());
    } finally {
      setArbeitet(false);
    }
  };

  const termine = simuliert && abgleich ? simulierteTermine() : null;

  return (
    <section className="karte">
      <div className="etikett bernstein">Erinnerungen</div>

      {!aktiv && (
        <div className="einstellung">
          <span>
            Erinnerungen aktivieren
            <span className="hinweis klein">
              {verfuegbar
                ? 'Aufgaben mit Uhrzeit erscheinen als Termine in einem eigenen Kalender „Gedankenwelt“ und melden sich per Benachrichtigung. Deine übrigen Kalender bleiben unberührt.'
                : 'Verfügbar, sobald Google verbunden ist.'}
              {verfuegbar && mitUhrzeit > 0 && ` ${mitUhrzeit === 1 ? '1 Aufgabe' : `${mitUhrzeit} Aufgaben`} mit Uhrzeit ${mitUhrzeit === 1 ? 'wird' : 'werden'} dabei nachgetragen.`}
            </span>
          </span>
          <button className="knopf haupt" disabled={!verfuegbar || arbeitet} onClick={() => tue(aktiviereErinnerungen)}>
            Aktivieren
          </button>
        </div>
      )}

      {aktiv && (
        <>
          <div className="einstellung">
            <span>
              Erinnerungen sind aktiv
              <span className="hinweis klein">
                Kalender „Gedankenwelt“{simuliert && ' (simuliert, nur in der Entwicklungsversion)'} ·{' '}
                {mitUhrzeit === 1 ? '1 offene Aufgabe' : `${mitUhrzeit} offene Aufgaben`} mit Uhrzeit
              </span>
            </span>
            <button className="knopf" disabled={arbeitet} onClick={() => setFragtAus(true)}>
              Deaktivieren
            </button>
          </div>
          <div className="einstellung">
            <span>
              Erinnerungen neu aufbauen
              <span className="hinweis klein">
                Gleicht alle offenen Aufgaben mit dem Kalender ab und räumt verwaiste Termine auf.
              </span>
            </span>
            <button className="knopf" disabled={arbeitet || !verfuegbar} onClick={() => tue(baueErinnerungenNeuAuf)}>
              Neu aufbauen
            </button>
          </div>
          {!verfuegbar && (
            <p className="hinweis klein">
              Auf diesem Gerät ist Google nicht verbunden. Die Erinnerungen werden hier erst wieder gepflegt, wenn du
              es verbindest.
            </p>
          )}
        </>
      )}

      {abgleich.kalenderHinweis && <p className="meldung warnung">{abgleich.kalenderHinweis}</p>}
      {meldung && (
        <p className="meldung" role="status">
          {meldung}
        </p>
      )}

      {/* Nur in der Entwicklungsversion: ein Blick in den simulierten Kalender */}
      {termine && (
        <div className="protokoll mono">
          <div className="etikett">Simulierter Kalender „Gedankenwelt“ · {termine.length} Termine</div>
          {termine.length === 0 && <div className="meta">noch keine Termine</div>}
          {termine.map((t) => (
            <div key={t.id}>
              {formatNaechste(t.beginn, heute)} · {t.titel}{' '}
              <span className="meta">
                ({t.notiz_id ? erinnerungsText(t.erinnerung) : 'von Hand eingetragen'} · {t.id})
              </span>
            </div>
          ))}
        </div>
      )}

      {verfuegbar && (
        <details className="diagnose">
          <summary>Diagnose: Kalender-Selbsttest</summary>
          <p className="hinweis klein">
            Legt den Kalender an (falls nötig), erstellt einen Testtermin, ändert ihn, prüft ihn und löscht ihn
            wieder. Deine Aufgaben und Termine werden dabei nicht angefasst.
          </p>
          <div className="knopfreihe">
            <button
              className="knopf"
              disabled={arbeitet}
              onClick={async () => {
                setArbeitet(true);
                setSelbsttest([]);
                await kalenderSelbsttest((zeile) => setSelbsttest((bisher) => [...bisher, zeile]));
                setArbeitet(false);
              }}
            >
              Kalender-Selbsttest starten
            </button>
          </div>
          {selbsttest.length > 0 && (
            <div className="protokoll" role="status">
              {selbsttest.map((zeile, i) => (
                <div key={i}>{zeile}</div>
              ))}
            </div>
          )}
        </details>
      )}

      {fragtAus && (
        <Dialog titel="Erinnerungen deaktivieren" onSchliessen={() => setFragtAus(false)}>
          <p className="dialog-text">
            Soll der Kalender „Gedankenwelt“ samt allen Terminen darin gelöscht werden? Wenn du ihn behältst, bleiben
            die bisherigen Termine stehen und erinnern dich weiter, werden aber nicht mehr aktualisiert. Deine
            Aufgaben in der App bleiben in beiden Fällen unverändert.
          </p>
          <div className="dialog-knoepfe">
            <button className="knopf" autoFocus onClick={() => setFragtAus(false)}>
              Abbrechen
            </button>
            <button
              className="knopf"
              onClick={() => {
                setFragtAus(false);
                void tue(() => deaktiviereErinnerungen(false));
              }}
            >
              Kalender behalten
            </button>
            <button
              className="knopf gefahr"
              onClick={() => {
                setFragtAus(false);
                void tue(() => deaktiviereErinnerungen(true));
              }}
            >
              Kalender löschen
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
