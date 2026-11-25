/**
 * Das Menü an einer Aufgabe (PHASE-3.md, Abschnitt 3): Datum, Uhrzeit, Erinnerung,
 * Wiederholung – und der Dialog „Benutzerdefiniert…“ für alle Wiederholungsregeln.
 */
import { useState } from 'react';
import { setzeErinnerung, setzeFaellig, setzeWiederholung } from '../db/aktionen';
import { useZustand } from '../db/speicher';
import {
  SCHNELLWERTE,
  WOCHENTAGE,
  alsSchnellwert,
  ausSchnellwert,
  endeKurz,
  formatNaechste,
  naechsterTermin,
  wiederholungKurz,
  wochentagVon,
  type Schnellwert,
} from '../logik/wiederholung';
import { faelligDatum, faelligUhrzeit, lokalesDatum, verschiebeDatum } from '../logik/zeit';
import type { Notiz, Wiederholung, WiederholungsEnde, Wochentag } from '../modell/typen';
import { Dialog, Segment, klassen } from './Bausteine';

export const ERINNERUNGEN: { minuten: number; text: string }[] = [
  { minuten: 0, text: 'Zur Uhrzeit' },
  { minuten: 5, text: '5 Minuten vorher' },
  { minuten: 15, text: '15 Minuten vorher' },
  { minuten: 30, text: '30 Minuten vorher' },
  { minuten: 60, text: '1 Stunde vorher' },
  { minuten: 1440, text: '1 Tag vorher' },
];

const TAG_NAMEN: Record<Wochentag, string> = { MO: 'Mo', DI: 'Di', MI: 'Mi', DO: 'Do', FR: 'Fr', SA: 'Sa', SO: 'So' };
const TAG_LANG: Record<Wochentag, string> = {
  MO: 'Montag',
  DI: 'Dienstag',
  MI: 'Mittwoch',
  DO: 'Donnerstag',
  FR: 'Freitag',
  SA: 'Samstag',
  SO: 'Sonntag',
};
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function AufgabenMenue({ notiz }: { notiz: Notiz }) {
  const z = useZustand();
  const [eigene, setEigene] = useState(false);
  const aufgabe = notiz.aufgabe;
  if (!aufgabe) return null;

  const heute = lokalesDatum();
  const faellig = aufgabe.faellig;
  const datum = faellig ? faelligDatum(faellig) : '';
  const uhrzeit = faellig ? (faelligUhrzeit(faellig) ?? '') : '';
  const bezug = datum || heute;
  const w = aufgabe.wiederholung;
  const schnellwert = w ? alsSchnellwert(w, bezug) : null;
  const setze = (d: string, u: string) => setzeFaellig(notiz.id, d ? (u ? `${d}T${u}` : d) : null);

  return (
    <div className="aufgaben-menue">
      <div className="schnellwahl">
        <button onClick={() => setze(heute, uhrzeit)}>Heute</button>
        <button onClick={() => setze(verschiebeDatum(heute, 1), uhrzeit)}>Morgen</button>
        <button onClick={() => setze(verschiebeDatum(heute, 7), uhrzeit)}>In 1 Woche</button>
      </div>

      <label>
        Datum
        <input type="date" value={datum} onChange={(e) => setze(e.target.value, uhrzeit)} />
      </label>
      <label>
        Uhrzeit (optional)
        <input type="time" value={uhrzeit} disabled={!datum} onChange={(e) => setze(datum, e.target.value)} />
      </label>

      <label className={klassen(!uhrzeit && 'gesperrt')}>
        Erinnerung
        <select
          value={aufgabe.erinnerung}
          disabled={!uhrzeit}
          onChange={(e) => setzeErinnerung(notiz.id, Number(e.target.value))}
        >
          {ERINNERUNGEN.map((e) => (
            <option key={e.minuten} value={e.minuten}>
              {e.text}
            </option>
          ))}
          {!ERINNERUNGEN.some((e) => e.minuten === aufgabe.erinnerung) && (
            <option value={aufgabe.erinnerung}>{aufgabe.erinnerung} Minuten vorher</option>
          )}
        </select>
      </label>
      {!uhrzeit && <p className="hinweis klein">Erinnerungen gibt es nur für Aufgaben mit Uhrzeit.</p>}
      {uhrzeit && !z.einstellungen.erinnerungen && (
        <p className="hinweis klein">Erinnerungen sind noch nicht eingeschaltet.</p>
      )}

      <label>
        Wiederholung
        <select
          value={!w ? 'keine' : (schnellwert ?? 'eigene')}
          onChange={(e) => {
            const wert = e.target.value;
            if (wert === 'keine') setzeWiederholung(notiz.id, null);
            else if (wert === 'benutzerdefiniert' || wert === 'eigene') setEigene(true);
            else setzeWiederholung(notiz.id, ausSchnellwert(wert as Schnellwert, bezug));
          }}
        >
          <option value="keine">Keine</option>
          {SCHNELLWERTE.map((s) => (
            <option key={s.wert} value={s.wert}>
              {s.text}
            </option>
          ))}
          {w && !schnellwert && <option value="eigene">{wiederholungKurz(w)}</option>}
          <option value="benutzerdefiniert">Benutzerdefiniert …</option>
        </select>
      </label>
      {w && (
        <p className="hinweis klein">
          {wiederholungKurz(w)}
          {endeKurz(w.ende) && ` · ${endeKurz(w.ende)}`}
          {aufgabe.erledigt_verlauf.length > 0 && ` · ${aufgabe.erledigt_verlauf.length}× abgehakt`}
        </p>
      )}

      {w && (
        <button className="menue-zeile" onClick={() => setzeWiederholung(notiz.id, null)}>
          Wiederholung entfernen
        </button>
      )}
      {faellig && (
        <button className="menue-zeile" onClick={() => setzeFaellig(notiz.id, null)}>
          Fälligkeit entfernen
        </button>
      )}

      {eigene && (
        <WiederholungDialog
          start={w ?? ausSchnellwert('woechentlich', bezug)}
          bezug={bezug}
          onFertig={(neu) => {
            setEigene(false);
            if (neu) setzeWiederholung(notiz.id, neu);
          }}
        />
      )}
    </div>
  );
}

type Grundart = 'taeglich' | 'woechentlich' | 'monatlich' | 'jaehrlich';
const EINHEIT: Record<Grundart, [string, string]> = {
  taeglich: ['Tag', 'Tage'],
  woechentlich: ['Woche', 'Wochen'],
  monatlich: ['Monat', 'Monate'],
  jaehrlich: ['Jahr', 'Jahre'],
};

/** „Benutzerdefiniert…“: alle Regeln aus Abschnitt 2 des Auftrags. */
function WiederholungDialog({
  start,
  bezug,
  onFertig,
}: {
  start: Wiederholung;
  /** Datum der Fälligkeit (oder heute) – daraus kommen die Vorgaben und die Vorschau */
  bezug: string;
  onFertig: (wiederholung: Wiederholung | null) => void;
}) {
  const [, bezugMonat, bezugTag] = bezug.split('-').map(Number);

  const [art, setArt] = useState<Grundart>(start.art === 'monatlich-wochentag' ? 'monatlich' : start.art);
  const [intervall, setIntervall] = useState(start.intervall);
  const [ab, setAb] = useState(start.ab);
  const [tage, setTage] = useState<Wochentag[]>(start.art === 'woechentlich' ? start.tage : [wochentagVon(bezug)]);
  const [monatsart, setMonatsart] = useState<'tag' | 'wochentag'>(start.art === 'monatlich-wochentag' ? 'wochentag' : 'tag');
  const [tag, setTag] = useState(start.art === 'monatlich' || start.art === 'jaehrlich' ? start.tag : bezugTag);
  const [woche, setWoche] = useState(
    // Vorgabe aus dem Datum: der wievielte dieser Wochentage im Monat es ist (ab dem 29. der „letzte“)
    start.art === 'monatlich-wochentag' ? start.woche : bezugTag > 28 ? -1 : Math.ceil(bezugTag / 7),
  );
  const [wochentag, setWochentag] = useState<Wochentag>(start.art === 'monatlich-wochentag' ? start.wochentag : wochentagVon(bezug));
  const [monat, setMonat] = useState(start.art === 'jaehrlich' ? start.monat : bezugMonat);
  const [ende, setEnde] = useState<WiederholungsEnde>(start.ende);

  const n = Math.max(1, Math.min(999, Math.round(intervall) || 1));
  const basis = { intervall: n, ab, ende };
  const regel: Wiederholung =
    art === 'taeglich'
      ? { ...basis, art }
      : art === 'woechentlich'
        ? { ...basis, art, tage: ab === 'faellig' ? tage : [] }
        : art === 'jaehrlich'
          ? { ...basis, art, monat, tag: Math.max(1, Math.min(31, tag || 1)) }
          : monatsart === 'wochentag'
            ? { ...basis, art: 'monatlich-wochentag', woche, wochentag }
            : { ...basis, art: 'monatlich', tag: Math.max(1, Math.min(31, tag || 1)) };

  // Vorschau: die drei Termine nach dem Bezugsdatum (nur sinnvoll „nach Kalender“)
  const vorschau: string[] = [];
  if (ab === 'faellig') {
    let d = bezug;
    for (let i = 0; i < 3; i++) vorschau.push((d = naechsterTermin(regel, d)));
  }
  const gueltig = !(art === 'woechentlich' && ab === 'faellig' && tage.length === 0);

  return (
    <Dialog titel="Wiederholung" onSchliessen={() => onFertig(null)}>
      <div className="wdh-dialog">
        <Segment
          wert={art}
          onWahl={setArt}
          optionen={[
            { wert: 'taeglich', text: 'Täglich' },
            { wert: 'woechentlich', text: 'Wöchentlich' },
            { wert: 'monatlich', text: 'Monatlich' },
            { wert: 'jaehrlich', text: 'Jährlich' },
          ]}
        />

        <label className="wdh-zeile">
          Alle
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            value={intervall}
            onChange={(e) => setIntervall(Number(e.target.value))}
          />
          {EINHEIT[art][n === 1 ? 0 : 1]}
        </label>

        <div className="wdh-zeile">
          <Segment
            wert={ab}
            onWahl={setAb}
            optionen={[
              { wert: 'faellig', text: 'Nach Kalender' },
              { wert: 'erledigung', text: 'Ab Erledigung' },
            ]}
          />
        </div>
        <p className="hinweis klein">
          {ab === 'faellig'
            ? 'Die Termine folgen dem Kalender, z. B. „jeden Montag“ – egal, wann du abhakst.'
            : 'Der Abstand zählt ab dem Abhaken, z. B. „3 Tage nach dem letzten Mal“.'}
        </p>

        {ab === 'faellig' && art === 'woechentlich' && (
          <div className="chips">
            {WOCHENTAGE.map((t) => {
              const an = tage.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  className={klassen('chip', an && 'an')}
                  aria-pressed={an}
                  aria-label={TAG_LANG[t]}
                  onClick={() => setTage(an ? tage.filter((x) => x !== t) : [...tage, t])}
                >
                  {TAG_NAMEN[t]}
                </button>
              );
            })}
          </div>
        )}

        {ab === 'faellig' && art === 'monatlich' && (
          <>
            <Segment
              wert={monatsart}
              onWahl={setMonatsart}
              optionen={[
                { wert: 'tag', text: 'An einem Tag' },
                { wert: 'wochentag', text: 'An einem Wochentag' },
              ]}
            />
            {monatsart === 'tag' ? (
              <label className="wdh-zeile">
                Am
                <input type="number" inputMode="numeric" min={1} max={31} value={tag} onChange={(e) => setTag(Number(e.target.value))} />
                . des Monats
              </label>
            ) : (
              <div className="wdh-zeile">
                Am
                <select value={woche} aria-label="Welcher im Monat" onChange={(e) => setWoche(Number(e.target.value))}>
                  <option value={1}>ersten</option>
                  <option value={2}>zweiten</option>
                  <option value={3}>dritten</option>
                  <option value={4}>vierten</option>
                  <option value={-1}>letzten</option>
                </select>
                <select value={wochentag} aria-label="Wochentag" onChange={(e) => setWochentag(e.target.value as Wochentag)}>
                  {WOCHENTAGE.map((t) => (
                    <option key={t} value={t}>
                      {TAG_LANG[t]}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {monatsart === 'tag' && tag > 28 && (
              <p className="hinweis klein">Gibt es den Tag in einem Monat nicht, gilt der letzte Tag des Monats.</p>
            )}
          </>
        )}

        {ab === 'faellig' && art === 'jaehrlich' && (
          <div className="wdh-zeile">
            Am
            <input type="number" inputMode="numeric" min={1} max={31} value={tag} aria-label="Tag" onChange={(e) => setTag(Number(e.target.value))} />
            .
            <select value={monat} aria-label="Monat" onChange={(e) => setMonat(Number(e.target.value))}>
              {MONATE.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="wdh-zeile">
          <select
            value={ende.art}
            aria-label="Ende der Wiederholung"
            onChange={(e) => {
              const wahl = e.target.value;
              if (wahl === 'datum') setEnde({ art: 'datum', datum: verschiebeDatum(bezug, 90) });
              else if (wahl === 'anzahl') setEnde({ art: 'anzahl', anzahl: 10 });
              else setEnde({ art: 'nie' });
            }}
          >
            <option value="nie">Endet nie</option>
            <option value="datum">Endet am</option>
            <option value="anzahl">Endet nach</option>
          </select>
          {ende.art === 'datum' && (
            <input type="date" value={ende.datum} aria-label="Enddatum" onChange={(e) => e.target.value && setEnde({ art: 'datum', datum: e.target.value })} />
          )}
          {ende.art === 'anzahl' && (
            <>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={9999}
                value={ende.anzahl}
                aria-label="Anzahl"
                onChange={(e) => setEnde({ art: 'anzahl', anzahl: Math.max(1, Math.round(Number(e.target.value)) || 1) })}
              />
              Mal
            </>
          )}
        </div>

        {gueltig && (
          <p className="wdh-vorschau mono">
            {wiederholungKurz(regel)}
            {endeKurz(ende) && ` · ${endeKurz(ende)}`}
            {vorschau.length > 0 && (
              <>
                <br />
                Nächste Termine: {vorschau.map((d) => formatNaechste(d, lokalesDatum())).join(' · ')}
              </>
            )}
          </p>
        )}
        {!gueltig && <p className="hinweis klein">Wähle mindestens einen Wochentag.</p>}
      </div>

      <div className="dialog-knoepfe">
        <button className="knopf" onClick={() => onFertig(null)}>
          Abbrechen
        </button>
        <button className="knopf haupt" disabled={!gueltig} onClick={() => onFertig(regel)}>
          Übernehmen
        </button>
      </div>
    </Dialog>
  );
}
