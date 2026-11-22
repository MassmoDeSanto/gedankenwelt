/**
 * Tagesseite des Tagebuchs (KONZEPT.md, Abschnitt 13.6): großes Datum, Überschrift, Bewertung
 * und darunter das Schreibfeld des Tages. ‹ › und Wischen wechseln den Tag, das Kalender-Symbol
 * springt zu einem beliebigen vergangenen Tag (Nachtragen).
 *
 * Das Tagebuch ist ein eigener Raum mit eigenen Farben („Papier“ hell, „Kerzenlicht“ dunkel).
 * Solange die Seite offen ist, steht darum `data-raum="tagebuch"` am <html>-Element.
 */
import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { setzeTagebuchtag } from '../db/aktionen';
import { useZustand } from '../db/speicher';
import { BEWERTUNG_WORTE, datumsTeile, tagZuDatum, tagebuchTagVon } from '../logik/tagebuch';
import { lokalJetzt, verschiebeDatum } from '../logik/zeit';
import { TAGEBUCH_ID, type Bewertung } from '../modell/typen';
import { Kopfzeile, klassen } from './Bausteine';
import { gehe } from './router';
import { Schreibbereich } from './Schreibbereich';
import { Kalender, PfeilZurueck, Winkel } from './Symbole';

const STUFEN: Bewertung[] = [1, 2, 3, 4, 5];

export function TagebuchSeite({ datum, notiz }: { datum?: string; notiz?: string }) {
  const heute = tagebuchTagVon(lokalJetzt());
  // In die Zukunft schreibt man kein Tagebuch.
  const tag = datum && datum <= heute ? datum : heute;
  const teile = datumsTeile(tag);

  const thema = useZustand().einstellungen.thema;
  useEffect(() => {
    const leiste = document.querySelector('meta[name="theme-color"]');
    document.documentElement.dataset.raum = 'tagebuch';
    leiste?.setAttribute('content', thema === 'hell' ? '#f4eee3' : '#1b1712');
    return () => {
      delete document.documentElement.dataset.raum;
      leiste?.setAttribute('content', thema === 'hell' ? '#f4f5f8' : '#0f1117');
    };
  }, [thema]);

  useEffect(() => {
    if (!notiz) window.scrollTo(0, 0);
  }, [tag, notiz]);

  const zeige = (ziel: string) => gehe({ seite: 'tagebuch', datum: ziel === heute ? undefined : ziel });
  const vorher = () => zeige(verschiebeDatum(tag, -1));
  const nachher = () => tag < heute && zeige(verschiebeDatum(tag, 1));

  const datumsfeld = useRef<HTMLInputElement>(null);

  // Wischen nach links/rechts wechselt den Tag (nicht, während Text markiert wird).
  const start = useRef<{ x: number; y: number } | null>(null);
  const beiBeruehrung = (e: TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  };
  const beiLoslassen = (e: TouchEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || window.getSelection()?.toString()) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 45) return;
    if (dx > 0) vorher();
    else nachher();
  };

  return (
    <div className="seite tagebuch" onTouchStart={beiBeruehrung} onTouchEnd={beiLoslassen}>
      <Kopfzeile
        zurueck={{ seite: 'start' }}
        titel={<span className="mono tb-nav-text">Tagebuch</span>}
        rechts={
          <span className="tb-kalender">
            <button
              className="symbolknopf"
              title="Tag wählen"
              aria-label="Tag wählen"
              onClick={() => {
                const feld = datumsfeld.current;
                if (!feld) return;
                // showPicker gibt es in Chrome und neueren Safari-Versionen; sonst reicht der Fokus.
                try {
                  feld.showPicker();
                } catch {
                  feld.focus();
                }
              }}
            >
              <Kalender />
            </button>
            <input
              ref={datumsfeld}
              type="date"
              tabIndex={-1}
              aria-hidden="true"
              value={tag}
              max={heute}
              onChange={(e) => e.target.value && zeige(e.target.value <= heute ? e.target.value : heute)}
            />
          </span>
        }
      />

      <div className="tb-datum">
        <span className="tb-tageszahl">{teile.tageszahl}</span>
        <span className="tb-datum-text mono">
          <span>{teile.wochentag}</span>
          <span>{teile.monat}</span>
        </span>
        <nav className="tb-nav" aria-label="Tag wechseln">
          {tag !== heute && (
            <button className="textknopf" onClick={() => zeige(heute)}>
              Heute
            </button>
          )}
          <button className="symbolknopf" onClick={vorher} aria-label="Vorheriger Tag" title="Vorheriger Tag">
            <PfeilZurueck />
          </button>
          <button
            className="symbolknopf"
            onClick={nachher}
            disabled={tag >= heute}
            aria-label="Nächster Tag"
            title="Nächster Tag"
          >
            <Winkel />
          </button>
        </nav>
      </div>

      <Tageskopf key={tag} datum={tag} />

      <div className="tb-text">
        <Schreibbereich
          key={tag}
          liste_id={TAGEBUCH_ID}
          tag={tag}
          hervorheben={notiz}
          platzhalterLeer={tag === heute ? 'Was war heute?' : 'Was war an diesem Tag?'}
        />
      </div>
    </div>
  );
}

/** Überschrift und Bewertung eines Tages. */
function Tageskopf({ datum }: { datum: string }) {
  const z = useZustand();
  const gespeichert = tagZuDatum(z.tagebuchtage.values(), datum);
  const gespeicherterTitel = gespeichert?.titel ?? '';
  const bewertung = gespeichert?.bewertung ?? null;

  // Die Überschrift wird beim Tippen nur lokal gehalten und kurz danach gespeichert (bereinigt).
  // So springt der Cursor nicht, wenn zwischendurch ein Abgleich hereinkommt.
  const [titel, setTitel] = useState(gespeicherterTitel);
  const [tippt, setTippt] = useState(false);
  const uhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!tippt && titel !== gespeicherterTitel) setTitel(gespeicherterTitel);

  const speichere = (wert: string) => {
    if (uhr.current) clearTimeout(uhr.current);
    uhr.current = null;
    setzeTagebuchtag(datum, { titel: wert.replace(/\s+/g, ' ').trim() });
  };
  useEffect(
    () => () => {
      if (uhr.current) clearTimeout(uhr.current);
    },
    [],
  );

  return (
    <div className="tb-kopf">
      <input
        className="tb-titel"
        placeholder="Überschrift"
        aria-label="Überschrift des Tages"
        value={titel}
        enterKeyHint="done"
        onFocus={() => setTippt(true)}
        onChange={(e) => {
          const wert = e.target.value;
          setTitel(wert);
          if (uhr.current) clearTimeout(uhr.current);
          uhr.current = setTimeout(() => speichere(wert), 600);
        }}
        onBlur={(e) => {
          speichere(e.target.value);
          setTippt(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />

      <div className="tb-bewertung" role="radiogroup" aria-label="Wie war der Tag?">
        <div className="tb-stufen" data-wert={bewertung ?? 0}>
          {STUFEN.map((stufe) => (
            <button
              key={stufe}
              role="radio"
              aria-checked={bewertung === stufe}
              aria-label={`${stufe} · ${BEWERTUNG_WORTE[stufe]}`}
              title={bewertung === stufe ? 'Nochmal tippen: Bewertung entfernen' : BEWERTUNG_WORTE[stufe]}
              className={klassen('tb-stufe', bewertung !== null && stufe <= bewertung && 'an', `stufe-${stufe}`)}
              onClick={() => setzeTagebuchtag(datum, { bewertung: bewertung === stufe ? null : stufe })}
            />
          ))}
        </div>
        <span className="mono tb-bewertung-text">
          {bewertung ? `${bewertung} · ${BEWERTUNG_WORTE[bewertung]}` : 'Wie war der Tag?'}
        </span>
      </div>
    </div>
  );
}
