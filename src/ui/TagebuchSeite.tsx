/**
 * Tagesseite des Tagebuchs (KONZEPT.md, Abschnitt 13.6): großes Datum, Überschrift, Bewertung
 * und darunter das Schreibfeld des Tages. ‹ › und Wischen wechseln den Tag, das Kalender-Symbol
 * springt zu einem beliebigen vergangenen Tag (Nachtragen).
 *
 * Das Tagebuch ist ein eigener Raum mit eigenen Farben („Papier“ hell, „Kerzenlicht“ dunkel).
 * Solange die Seite offen ist, steht darum `data-raum="tagebuch"` am <html>-Element.
 */
import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { schalteGewohnheit, setzeTagebuchtag } from '../db/aktionen';
import { STANDARD_IMPULSE, impulsFuer } from '../logik/impulse';
import { useZustand } from '../db/speicher';
import {
  BEWERTUNG_WORTE,
  datumsTeile,
  herkunftText,
  kartenLink,
  monatVon,
  notizenDesTages,
  tagKurz,
  tagZuDatum,
  tagebuchTagVon,
  tagebuchTagVonStempel,
  tagesspur,
  vorEinemJahr,
} from '../logik/tagebuch';
import { lokalJetzt, verschiebeDatum } from '../logik/zeit';
import { TAGEBUCH_ID, type Bewertung } from '../modell/typen';
import { Kopfzeile, klassen } from './Bausteine';
import { MarkdownAnzeige } from './MarkdownAnzeige';
import { adresse, gehe } from './router';
import { Schreibbereich } from './Schreibbereich';
import { Haken, Kalender, Kreuz, Ortsmarke, PfeilZurueck, Wiederholen, Winkel } from './Symbole';

const STUFEN: Bewertung[] = [1, 2, 3, 4, 5];

/** Schaltet auf die Tagebuch-Farben um, solange die Seite offen ist (auch die Farbe der Browser-Leiste). */
export function useTagebuchRaum(): void {
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
}

export function TagebuchSeite({ datum, notiz }: { datum?: string; notiz?: string }) {
  const heute = tagebuchTagVon(lokalJetzt());
  // In die Zukunft schreibt man kein Tagebuch.
  const tag = datum && datum <= heute ? datum : heute;
  const teile = datumsTeile(tag);

  useTagebuchRaum();

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
        titel={
          <a className="mono tb-nav-text" href={adresse({ seite: 'tagebuchmonat', monat: monatVon(tag) })}>
            Tagebuch · Monat
          </a>
        }
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
        <a
          className="tb-datum-text mono"
          href={adresse({ seite: 'tagebuchmonat', monat: monatVon(tag) })}
          title="Monatsansicht"
        >
          <span>{teile.wochentag}</span>
          <span>{teile.monat}</span>
        </a>
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
      <Schreibimpuls key={`impuls-${tag}`} datum={tag} />

      <div className="tb-text">
        <Schreibbereich
          key={tag}
          liste_id={TAGEBUCH_ID}
          tag={tag}
          hervorheben={notiz}
          platzhalterLeer={tag === heute ? 'Was war heute?' : 'Was war an diesem Tag?'}
        />
      </div>

      <Spur key={`spur-${tag}`} datum={tag} />
      <VorEinemJahr datum={tag} />
    </div>
  );
}

/** Was an diesem Tag sonst geschah: erledigte Aufgaben und neue Gedanken (KONZEPT.md, Abschnitt 13.2). */
function Spur({ datum }: { datum: string }) {
  const z = useZustand();
  const spur = useMemo(() => tagesspur(z.notizen.values(), datum), [z.notizen, z, datum]);
  const [offen, setOffen] = useState(false);
  if (spur.erledigt.length === 0 && spur.neu.length === 0) return null;

  const teile = [];
  if (spur.erledigt.length > 0) teile.push(`✓ ${spur.erledigt.length} erledigt`);
  if (spur.neu.length > 0) teile.push(`◆ ${spur.neu.length} ${spur.neu.length === 1 ? 'neuer Gedanke' : 'neue Gedanken'}`);
  const eintrag = (n: (typeof spur.neu)[number], zeit: string) => (
    <a key={n.id} className="tb-spur-eintrag" href={adresse({ seite: 'liste', id: n.liste_id, notiz: n.id })}>
      <span className="tb-spur-text">
        <MarkdownAnzeige text={n.text} einzeilig ohneLinks />
      </span>
      <span className="mono meta">
        {herkunftText(n, z.listen, z.tagebuchtage.values())} · {zeit}
      </span>
    </a>
  );

  return (
    <section className="tb-spur">
      <button className="tb-spur-kopf mono" aria-expanded={offen} onClick={() => setOffen(!offen)}>
        <Winkel />
        {teile.join(' · ')}
      </button>
      {offen && (
        <div className="tb-spur-liste">
          {spur.erledigt.length > 0 && <div className="etikett">Erledigt</div>}
          {spur.erledigt.map((n) => {
            // Der Zeitpunkt des Abhakens an diesem Tag (bei wiederkehrenden Aufgaben aus dem Verlauf)
            const zeitpunkte = [...(n.aufgabe?.erledigt_verlauf ?? []), n.aufgabe?.erledigt_am ?? ''];
            const am = zeitpunkte.find((z) => z && tagebuchTagVonStempel(z) === datum);
            return eintrag(n, am ? uhrzeit(am) : '');
          })}
          {spur.neu.length > 0 && <div className="etikett">Neue Gedanken</div>}
          {spur.neu.map((n) => eintrag(n, uhrzeit(n.erstellt)))}
        </div>
      )}
    </section>
  );
}

/** Uhrzeit eines Zeitstempels in Ortszeit, z. B. „14:05“ */
function uhrzeit(stempel: string): string {
  return lokalJetzt(new Date(stempel)).slice(11, 16);
}

/** Derselbe Tag vor einem Jahr, falls es dort etwas gibt. */
function VorEinemJahr({ datum }: { datum: string }) {
  const z = useZustand();
  const damals = useMemo(() => vorEinemJahr(datum, z.notizen.values(), z.tagebuchtage.values()), [z, datum]);
  if (!damals) return null;
  return (
    <a className="tb-damals" href={adresse({ seite: 'tagebuch', datum: damals.datum })}>
      <span className="etikett">
        Vor einem Jahr · {tagKurz(damals.datum)}
        {damals.ort ? ` · ${damals.ort}` : ''}
      </span>
      {damals.titel && <span className="tb-damals-titel">{damals.titel}</span>}
      {damals.text && (
        <span className="tb-damals-text">
          <MarkdownAnzeige text={damals.text} einzeilig ohneLinks />
        </span>
      )}
      {damals.bewertung && <span className="mono meta">{BEWERTUNG_WORTE[damals.bewertung]}</span>}
    </a>
  );
}

/** Ist das ein iPhone oder iPad? Dann öffnet der Karten-Link Apple Karten. */
function istApple(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Ein einzeiliges Feld, das beim Tippen nur lokal gehalten und kurz danach (bereinigt) gespeichert wird.
 * So springt der Cursor nicht, wenn zwischendurch ein Abgleich hereinkommt.
 */
function GepuffertesFeld({
  gespeichert,
  speichere,
  className,
  placeholder,
  beschriftung,
}: {
  gespeichert: string;
  speichere: (wert: string) => void;
  className: string;
  placeholder: string;
  beschriftung: string;
}) {
  const [wert, setWert] = useState(gespeichert);
  const [tippt, setTippt] = useState(false);
  const uhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!tippt && wert !== gespeichert) setWert(gespeichert);

  const sichere = (text: string) => {
    if (uhr.current) clearTimeout(uhr.current);
    uhr.current = null;
    speichere(text.replace(/\s+/g, ' ').trim());
  };
  useEffect(
    () => () => {
      if (uhr.current) clearTimeout(uhr.current);
    },
    [],
  );

  return (
    <input
      className={className}
      placeholder={placeholder}
      aria-label={beschriftung}
      value={wert}
      enterKeyHint="done"
      onFocus={() => setTippt(true)}
      onChange={(e) => {
        const text = e.target.value;
        setWert(text);
        if (uhr.current) clearTimeout(uhr.current);
        uhr.current = setTimeout(() => sichere(text), 600);
      }}
      onBlur={(e) => {
        sichere(e.target.value);
        setTippt(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}

/** Überschrift, Ort, Bewertung und Gewohnheiten eines Tages. */
function Tageskopf({ datum }: { datum: string }) {
  const z = useZustand();
  const gespeichert = tagZuDatum(z.tagebuchtage.values(), datum);
  const bewertung = gespeichert?.bewertung ?? null;
  const ort = gespeichert?.ort ?? '';

  return (
    <div className="tb-kopf">
      <GepuffertesFeld
        className="tb-titel"
        placeholder="Überschrift"
        beschriftung="Überschrift des Tages"
        gespeichert={gespeichert?.titel ?? ''}
        speichere={(titel) => setzeTagebuchtag(datum, { titel })}
      />

      <div className="tb-ort">
        <Ortsmarke />
        <GepuffertesFeld
          className="tb-ort-feld"
          placeholder="Ort"
          beschriftung="Ort des Tages"
          gespeichert={ort}
          speichere={(wert) => setzeTagebuchtag(datum, { ort: wert })}
        />
        {ort && (
          <a
            className="textknopf tb-ort-karte"
            href={kartenLink(ort, istApple())}
            target="_blank"
            rel="noopener noreferrer"
            title="In der Karten-App öffnen"
          >
            Karte
          </a>
        )}
      </div>

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

      <Gewohnheiten datum={datum} abgehakt={gespeichert?.gewohnheiten ?? []} />
    </div>
  );
}

/** Gewohnheiten zum Abhaken (KONZEPT.md, Abschnitt 13.4). Inaktive erscheinen nur, wenn sie an diesem Tag abgehakt sind. */
function Gewohnheiten({ datum, abgehakt }: { datum: string; abgehakt: string[] }) {
  const z = useZustand();
  const alle = [...z.gewohnheiten.values()]
    .filter((g) => !g.geloescht && (g.aktiv || abgehakt.includes(g.id)))
    .sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1));
  if (alle.length === 0) {
    return z.gewohnheiten.size === 0 ? (
      <a className="textknopf tb-gewohnheiten-einrichten" href={adresse({ seite: 'einstellungen' })}>
        + Gewohnheiten einrichten
      </a>
    ) : null;
  }
  return (
    <div className="tb-gewohnheiten" role="group" aria-label="Gewohnheiten">
      {alle.map((g) => {
        const an = abgehakt.includes(g.id);
        return (
          <button
            key={g.id}
            className={klassen('tb-gewohnheit', an && 'an')}
            aria-pressed={an}
            onClick={() => schalteGewohnheit(datum, g.id)}
          >
            <span className="tb-gewohnheit-haken">{an && <Haken />}</span>
            {g.name}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Schreibimpuls (KONZEPT.md, Abschnitt 13.3): Solange der Tag leer ist, steht eine Frage über dem
 * Schreibfeld. Antippen übernimmt sie als Kopfzeile des Tages, ↻ zeigt eine andere, ignorieren geht auch.
 */
function Schreibimpuls({ datum }: { datum: string }) {
  const z = useZustand();
  const [weiter, setWeiter] = useState(0);
  const tag = tagZuDatum(z.tagebuchtage.values(), datum);
  const leer = notizenDesTages(z.notizen.values(), datum).length === 0;

  if (tag?.impuls) {
    return (
      <div className="tb-impuls uebernommen">
        <span className="tb-impuls-text">{tag.impuls}</span>
        <button
          className="symbolknopf klein"
          onClick={() => setzeTagebuchtag(datum, { impuls: null })}
          aria-label="Frage entfernen"
          title="Frage entfernen"
        >
          <Kreuz />
        </button>
      </div>
    );
  }
  if (!leer) return null;

  const frage = impulsFuer(datum, z.impulse?.fragen ?? STANDARD_IMPULSE, weiter);
  if (!frage) return null;
  return (
    <div className="tb-impuls">
      <button
        className="tb-impuls-text tb-impuls-frage"
        onClick={() => setzeTagebuchtag(datum, { impuls: frage })}
        title="Als Kopfzeile übernehmen"
      >
        {frage}
      </button>
      <button
        className="symbolknopf klein"
        onClick={() => setWeiter(weiter + 1)}
        aria-label="Andere Frage"
        title="Andere Frage"
      >
        <Wiederholen />
      </button>
    </div>
  );
}
