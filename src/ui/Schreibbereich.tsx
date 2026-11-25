/**
 * Der Schreibbereich einer Liste (KONZEPT.md, Abschnitt 3).
 *
 * Jede Notiz ist ein eigenes Textfeld ohne sichtbaren Rahmen. Zusammen fühlen
 * sie sich wie ein durchgehender Text an:
 *  - 1× Enter: neue Zeile in derselben Notiz
 *  - 2× Enter: neue Notiz darunter (mehr Enter ändern nichts)
 *  - Rücktaste am Anfang einer Notiz: mit der Notiz darüber zusammenführen
 *  - Pfeiltasten wandern von Notiz zu Notiz
 *
 * Am Ende steht immer ein leeres Feld („Entwurf“). Sobald dort Text steht, wird
 * daraus eine echte Notiz. Der Entwurf hat seine ID schon vorher, damit das
 * Textfeld beim Umwandeln dasselbe bleibt und der Cursor nicht springt.
 */
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  erstelleNotizen,
  fuehreMitObererZusammen,
  loescheNotiz,
  notizenVon,
  ordneNotiz,
  schreibeNotiz,
  setzeAufgabe,
  setzeErledigt,
  verschiebeNotiz,
} from '../db/aktionen';
import { leseZustand, useZustand } from '../db/speicher';
import { endetMitTrennung, enthaeltTrennung } from '../logik/absatz';
import { filtereTags, istTagName, tagHaeufigkeit, type TagAnzahl } from '../logik/tags';
import { nameUndRest } from '../logik/name';
import { formatStempel, lokalesDatum } from '../logik/zeit';
import type { Notiz } from '../modell/typen';
import { neueId } from '../modell/ulid';
import { AufgabenMenue } from './AufgabenMenue';
import { ListenWahlDialog, Menue, klassen } from './Bausteine';
import { FaelligText, WiederholungsHinweis } from './FaelligAnzeige';
import { MarkdownAnzeige } from './MarkdownAnzeige';
import { PrioStandHinweis, PrioStandKnoepfe } from './PrioStand';
import { hakeAbMitMeldung } from './meldung';
import { Griff, Haken, KaestchenSymbol, Korb, OrdnerPfeil, Uhr, Winkel } from './Symbole';

interface Entwurf {
  id: string;
  /** Unter welcher Notiz der Entwurf steht. null = am Ende der Liste. */
  nachId: string | null;
}

/** Bitte an ein Textfeld, den Cursor zu übernehmen. */
interface FokusWunsch {
  id: string;
  caret: number | 'ende';
}

/** Was ein Notiz-Block dem Schreibbereich melden kann. */
interface Steuerung {
  fokussiere: (id: string, caret: number | 'ende') => void;
  hoch: (id: string) => boolean;
  runter: (id: string) => boolean;
  neuDarunter: (id: string) => void;
  mitObererZusammen: (id: string) => void;
  mitUntererZusammen: (id: string) => boolean;
  entferneLeere: (id: string, text: string | undefined) => void;
  setzeAktiv: (id: string, aktiv: boolean) => void;
  entwurfVerlassen: () => void;
  verschiebeDialog: (id: string) => void;
}

/** Beim Ziehen nur hoch und runter bewegen. */
const nurSenkrecht: Modifier = ({ transform }) => ({ ...transform, x: 0 });

export function Schreibbereich({
  liste_id,
  hervorheben,
  tag,
  platzhalterLeer = 'Schreib einfach los. Zweimal Enter beginnt eine neue Notiz.',
}: {
  liste_id: string;
  hervorheben?: string;
  /** Im Tagebuch: nur die Notizen dieses Tages. Dort gibt es kein Zuklappen (der Tag hat eine eigene Überschrift). */
  tag?: string;
  platzhalterLeer?: string;
}) {
  const z = useZustand();
  const notizen = useMemo(() => notizenVon(liste_id, tag), [z, liste_id, tag]);
  const tags = useMemo(() => tagHaeufigkeit(z.notizen.values()), [z]);

  const [entwurf, setEntwurf] = useState<Entwurf>(() => ({ id: neueId(), nachId: null }));
  const [fokus, setFokus] = useState<FokusWunsch | null>(null);
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [verschieben, setVerschieben] = useState<string | null>(null);
  const [leuchtet, setLeuchtet] = useState<string | null>(null);

  // Aus dem Entwurf ist eine echte Notiz geworden: Es braucht einen neuen leeren Entwurf am Ende.
  if (z.notizen.has(entwurf.id)) setEntwurf({ id: neueId(), nachId: null });

  // Notizen und Entwurf in der Reihenfolge, in der sie auf der Seite stehen
  const eintraege: { id: string; notiz: Notiz | null }[] = [];
  let entwurfEingesetzt = false;
  for (const notiz of notizen) {
    eintraege.push({ id: notiz.id, notiz });
    if (entwurf.nachId === notiz.id) {
      eintraege.push({ id: entwurf.id, notiz: null });
      entwurfEingesetzt = true;
    }
  }
  if (!entwurfEingesetzt) eintraege.push({ id: entwurf.id, notiz: null });

  // Sprung aus der Suche: Notiz in die Mitte holen und kurz hervorheben
  useEffect(() => {
    if (!hervorheben) return;
    setLeuchtet(hervorheben);
    document.querySelector(`[data-notiz="${hervorheben}"]`)?.scrollIntoView({ block: 'center' });
    const uhr = setTimeout(() => setLeuchtet(null), 1800);
    return () => clearTimeout(uhr);
  }, [hervorheben, liste_id]);

  const nachbar = (id: string, richtung: -1 | 1): string | undefined =>
    eintraege[eintraege.findIndex((e) => e.id === id) + richtung]?.id;

  const steuerung: Steuerung = {
    fokussiere: (id, caret) => setFokus({ id, caret }),
    hoch: (id) => {
      const ziel = nachbar(id, -1);
      if (ziel) setFokus({ id: ziel, caret: 'ende' });
      return !!ziel;
    },
    runter: (id) => {
      const ziel = nachbar(id, 1);
      if (ziel) setFokus({ id: ziel, caret: 0 });
      return !!ziel;
    },
    neuDarunter: (id) => {
      const reihe = notizenVon(liste_id, tag);
      const istLetzte = reihe[reihe.length - 1]?.id === id;
      // Ist der bisherige Entwurf gerade selbst zur Notiz geworden, braucht es eine neue ID.
      const entwurfId = leseZustand().notizen.has(entwurf.id) ? neueId() : entwurf.id;
      setEntwurf({ id: entwurfId, nachId: istLetzte ? null : id });
      setFokus({ id: entwurfId, caret: 0 });
    },
    mitObererZusammen: (id) => {
      const ergebnis = fuehreMitObererZusammen(id);
      if (ergebnis) setFokus({ id: ergebnis.obere.id, caret: ergebnis.nahtstelle });
    },
    mitUntererZusammen: (id) => {
      const reihe = notizenVon(liste_id, tag);
      const untere = reihe[reihe.findIndex((n) => n.id === id) + 1];
      const ergebnis = untere ? fuehreMitObererZusammen(untere.id) : null;
      if (ergebnis) setFokus({ id, caret: ergebnis.nahtstelle });
      return !!ergebnis;
    },
    entferneLeere: (id, text) => {
      const ziel = nachbar(id, -1) ?? nachbar(id, 1);
      loescheNotiz(id, text);
      if (ziel) setFokus({ id: ziel, caret: 'ende' });
    },
    setzeAktiv: (id, istAktiv) => setAktiv((bisher) => (istAktiv ? id : bisher === id ? null : bisher)),
    entwurfVerlassen: () => setEntwurf((e) => (e.nachId === null ? e : { ...e, nachId: null })),
    verschiebeDialog: setVerschieben,
  };

  // Ziehen startet erst nach 4 Pixeln Bewegung, damit ein Klick auf den Griff nichts verschiebt.
  const sensoren = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const beiAblegen = (ereignis: DragEndEvent) => {
    const { active, over } = ereignis;
    if (!over || active.id === over.id) return;
    const ids = notizen.map((n) => n.id);
    const von = ids.indexOf(String(active.id));
    const nach = ids.indexOf(String(over.id));
    if (von >= 0 && nach >= 0) ordneNotiz(String(active.id), arrayMove(ids, von, nach));
  };

  return (
    <div className="schreibbereich">
      <DndContext sensors={sensoren} collisionDetection={closestCenter} modifiers={[nurSenkrecht]} onDragEnd={beiAblegen}>
        <SortableContext items={eintraege.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          {eintraege.map((e) => (
            <NotizBlock
              key={e.id}
              id={e.id}
              notiz={e.notiz}
              liste_id={liste_id}
              tag={tag}
              nachId={entwurf.nachId}
              fokus={fokus?.id === e.id ? fokus : null}
              aktiv={aktiv === e.id}
              leuchtet={leuchtet === e.id}
              tags={tags}
              steuerung={steuerung}
              platzhalter={
                notizen.length === 0
                  ? platzhalterLeer
                  : e.notiz || entwurf.nachId
                    ? ''
                    : 'Neue Notiz …'
              }
            />
          ))}
        </SortableContext>
      </DndContext>

      {verschieben && (
        <ListenWahlDialog
          titel="Notiz verschieben nach …"
          gesperrt={new Set([liste_id])}
          onWahl={(ziel) => {
            if (ziel) verschiebeNotiz(verschieben, ziel);
            setVerschieben(null);
          }}
        />
      )}
    </div>
  );
}

// ───────────────────────── Ein einzelner Notiz-Block ─────────────────────────

/**
 * Am Handy: Steht der Cursor am Ende einer Notiz und rutscht sie hinter die Bildschirmtastatur,
 * wird die Seite so weit geschoben, dass man wieder sieht, was man tippt.
 */
function haltSichtbar(el: HTMLTextAreaElement): void {
  const sicht = window.visualViewport;
  if (!sicht || !window.matchMedia('(pointer: coarse)').matches) return;
  if (el.selectionStart !== el.value.length) return;
  const unten = sicht.offsetTop + sicht.height;
  const rand = el.getBoundingClientRect().bottom;
  if (rand > unten - 20) window.scrollBy({ top: rand - unten + 64 });
}

/** „#“ und der bisher getippte Tag-Anfang direkt vor dem Cursor. */
const TAG_VOR_CURSOR = /(?:^|[\s(])#([\p{L}\p{N}_-]*)$/u;
const TAG_IM_TEXT = /(^|[\s(])(#[\p{L}\p{N}_][\p{L}\p{N}_-]*)/gu;

/** Färbt Tags im Rohtext ein. */
function faerbeTags(text: string, schluessel: string): ReactNode[] {
  const teile: ReactNode[] = [];
  let ende = 0;
  for (const treffer of text.matchAll(TAG_IM_TEXT)) {
    const start = treffer.index! + treffer[1].length;
    if (start > ende) teile.push(text.slice(ende, start));
    teile.push(
      <span className="tag" key={`${schluessel}${start}`}>
        {treffer[2]}
      </span>,
    );
    ende = start + treffer[2].length;
  }
  teile.push(text.slice(ende));
  return teile;
}

/**
 * Der sichtbare Text zum (durchsichtigen) Textfeld.
 *  - Beim Bearbeiten (`roh`): der Rohtext, wie getippt, nur Tags sind eingefärbt.
 *  - Sonst: „Markdown light“ umgesetzt (fett, kursiv, Aufzählungen, Links, Code).
 * Hat die Notiz mehr als eine Zeile, erscheint die erste als Name hervorgehoben (README, Abschnitt 12).
 * Die Hervorhebung ändert die Zeichenbreite nicht, damit der Cursor beim Tippen an der richtigen Stelle bleibt.
 */
function Spiegel({ text, roh, ohneName = false }: { text: string; roh: boolean; ohneName?: boolean }) {
  const mitName = !ohneName && nameUndRest(text) !== null;
  if (!roh) {
    return (
      <div className={klassen('spiegel', mitName && 'mit-name')} aria-hidden="true">
        {text ? <MarkdownAnzeige text={text} /> : '\u200b'}
      </div>
    );
  }
  const umbruch = mitName ? text.indexOf('\n') : -1;
  // Das unsichtbare Zeichen am Ende sorgt dafür, dass auch eine leere letzte Zeile Höhe bekommt.
  return (
    <div className="spiegel" aria-hidden="true">
      {umbruch >= 0 ? (
        <>
          <span className="name-zeile">{faerbeTags(text.slice(0, umbruch), 'n')}</span>
          {faerbeTags(text.slice(umbruch), 'r')}
        </>
      ) : (
        faerbeTags(text, 'r')
      )}
      {'\u200b'}
    </div>
  );
}

interface Vorschlag {
  tag: string;
  anzahl: number;
  neu: boolean;
}

function baueVorschlaege(tags: TagAnzahl[], eingabe: string, eigeneTags: string[]): Vorschlag[] {
  const getippt = eingabe.toLowerCase();
  // Der Tag, der gerade getippt wird, zählt in dieser Notiz schon mit – das wird hier abgezogen.
  const bereinigt = tags
    .map((t) => (t.tag === getippt && eigeneTags.includes(getippt) ? { ...t, anzahl: t.anzahl - 1 } : t))
    .filter((t) => t.anzahl > 0);
  const vorschlaege: Vorschlag[] = filtereTags(bereinigt, getippt)
    .slice(0, 7)
    .map((t) => ({ ...t, neu: false }));
  if (getippt && istTagName(getippt) && !bereinigt.some((t) => t.tag === getippt)) {
    vorschlaege.push({ tag: getippt, anzahl: 0, neu: true });
  }
  return vorschlaege;
}

interface BlockProps {
  id: string;
  /** null = der Entwurf (noch keine gespeicherte Notiz) */
  notiz: Notiz | null;
  liste_id: string;
  tag?: string;
  nachId: string | null;
  fokus: FokusWunsch | null;
  aktiv: boolean;
  leuchtet: boolean;
  tags: TagAnzahl[];
  steuerung: Steuerung;
  platzhalter: string;
}

function NotizBlock({ id, notiz, liste_id, tag, nachId, fokus, aktiv, leuchtet, tags, steuerung, platzhalter }: BlockProps) {
  const sortierbar = useSortable({ id, disabled: !notiz });
  const feld = useRef<HTMLTextAreaElement>(null);

  /** Was gerade im Textfeld steht (kann am Ende ein Enter oder Leerzeichen mehr haben als die Notiz). */
  const [roh, setRoh] = useState(notiz?.text ?? '');
  const [gesehen, setGesehen] = useState(notiz?.text);
  const [caret, setCaret] = useState(0);
  const [tagZu, setTagZu] = useState(false);
  const [tagIndex, setTagIndex] = useState(0);
  const textBeiFokus = useRef<string | undefined>(undefined);
  const caretWunsch = useRef<number | null>(null);

  // ── Auf- und Zuklappen (README, Abschnitt 12) ──
  const [offen, setOffen] = useState(false);
  const [fokusGesehen, setFokusGesehen] = useState(fokus);
  // Wandert der Cursor per Pfeiltaste hierher, klappt die Notiz auf, damit das Textfeld da ist.
  if (fokus !== fokusGesehen) {
    setFokusGesehen(fokus);
    if (fokus && !offen) setOffen(true);
  }
  // Sprung aus Suche, Gedanke des Tages oder To-do-Box: aufgeklappt zeigen.
  if (leuchtet && !offen) setOffen(true);
  const teile = notiz && !tag ? nameUndRest(notiz.text) : null;
  const zu = teile !== null && !offen && !aktiv;

  // Hat sich der gespeicherte Text von außen geändert (Teilen, Zusammenführen, Aufgaben-Kästchen),
  // übernimmt das Textfeld ihn. Beim normalen Tippen sind beide gleich und nichts passiert.
  if (notiz && notiz.text !== gesehen) {
    setGesehen(notiz.text);
    if (notiz.text !== roh.trim()) setRoh(notiz.text);
  }

  useLayoutEffect(() => {
    const el = feld.current;
    if (!fokus || !el) return;
    el.focus();
    const pos = fokus.caret === 'ende' ? el.value.length : Math.min(fokus.caret, el.value.length);
    el.setSelectionRange(pos, pos);
    setCaret(pos);
  }, [fokus]);

  useLayoutEffect(() => {
    if (caretWunsch.current !== null && feld.current) {
      feld.current.setSelectionRange(caretWunsch.current, caretWunsch.current);
      caretWunsch.current = null;
    }
  });

  // ── Tag-Dropdown ──
  const token = aktiv ? TAG_VOR_CURSOR.exec(roh.slice(0, caret)) : null;
  const eingabe = token ? token[1] : '';
  if (!token && tagZu) setTagZu(false);
  const vorschlaege = token && !tagZu ? baueVorschlaege(tags, eingabe, notiz?.tags ?? []) : [];
  const tagOffen = vorschlaege.length > 0;
  const gewaehlt = Math.min(tagIndex, vorschlaege.length - 1);

  /** Übernimmt neuen Text aus dem Textfeld und wendet die Absatz-Regel an. */
  const uebernimm = (wert: string, pos: number) => {
    setCaret(pos);
    if (!wert.trim()) {
      // Enter oder Leerzeichen in einem leeren Feld erzeugen nichts.
      setRoh('');
      return;
    }
    const trennung = enthaeltTrennung(wert);
    let erste: Notiz | null;
    let weitere: Notiz[];
    if (notiz) {
      const ergebnis = schreibeNotiz(id, wert);
      erste = ergebnis?.notiz ?? null;
      weitere = ergebnis?.abgetrennt ?? [];
    } else {
      const neue = erstelleNotizen(liste_id, wert, { ersteId: id, nachId, tag });
      erste = neue[0] ?? null;
      weitere = neue.slice(1);
    }
    if (!trennung || !erste) {
      const getippt = wert.trim();
      if (erste && erste.text !== getippt) {
        // Ein getipptes „[ ] “ wurde zum Kästchen: aus dem Text entfernen, Cursor mitziehen.
        const entfernt = wert.length - wert.trimStart().length + (getippt.length - erste.text.length);
        caretWunsch.current = Math.max(0, pos - entfernt);
        setRoh(erste.text);
      } else {
        setRoh(wert);
      }
      return;
    }

    // Es gab eine Trennung: Dieses Feld behält nur den ersten Absatz.
    setRoh(erste.text);
    if (weitere.length > 0) {
      // Cursor dorthin, wo er im Text stand: so viele Zeichen vor dem Ende der letzten neuen Notiz.
      const letzte = weitere[weitere.length - 1];
      const dahinter = wert.slice(pos).trim().length;
      steuerung.fokussiere(letzte.id, Math.max(0, letzte.text.length - dahinter));
    } else if (endetMitTrennung(wert)) {
      steuerung.neuDarunter(id);
    }
  };

  const waehleTag = (tag: string) => {
    const start = caret - eingabe.length;
    const dahinter = roh.slice(caret);
    const neu = roh.slice(0, start) + tag + (dahinter.startsWith(' ') ? '' : ' ') + dahinter;
    const pos = start + tag.length + 1;
    caretWunsch.current = pos;
    setTagIndex(0);
    uebernimm(neu, pos);
  };

  /** Tag-Knopf: setzt ein „#“ an die Cursor-Stelle, das Dropdown öffnet sich dann von selbst. */
  const beiTagKnopf = () => {
    const el = feld.current;
    if (!el) return;
    const pos = document.activeElement === el ? el.selectionStart : roh.length;
    const davor = roh.slice(0, pos);
    const raute = davor.length > 0 && !/\s$/.test(davor) ? ' #' : '#';
    el.focus();
    caretWunsch.current = pos + raute.length;
    setTagZu(false);
    uebernimm(davor + raute + roh.slice(pos), pos + raute.length);
  };

  const beiTaste = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (tagOffen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const schritt = e.key === 'ArrowDown' ? 1 : -1;
        setTagIndex((gewaehlt + schritt + vorschlaege.length) % vorschlaege.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        waehleTag(vorschlaege[gewaehlt].tag);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setTagZu(true);
        return;
      }
    }

    const amAnfang = el.selectionStart === 0 && el.selectionEnd === 0;
    const amEnde = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;

    if (e.key === 'Backspace' && amAnfang) {
      if (!notiz) {
        if (steuerung.hoch(id)) e.preventDefault();
      } else if (!el.value.trim()) {
        e.preventDefault();
        steuerung.entferneLeere(id, textBeiFokus.current);
      } else {
        e.preventDefault();
        steuerung.mitObererZusammen(id);
      }
    } else if (e.key === 'Delete' && amEnde && notiz && el.value.trim()) {
      if (steuerung.mitUntererZusammen(id)) e.preventDefault();
    } else if (e.key === 'ArrowUp' && amAnfang) {
      if (steuerung.hoch(id)) e.preventDefault();
    } else if (e.key === 'ArrowDown' && amEnde) {
      if (steuerung.runter(id)) e.preventDefault();
    } else if (e.key === 'Escape') {
      el.blur();
    }
  };

  const beiVerlassen = (wert: string) => {
    steuerung.setzeAktiv(id, false);
    const aktuell = leseZustand().notizen.get(id);
    if (!aktuell) {
      setRoh('');
      steuerung.entwurfVerlassen();
    } else if (!aktuell.geloescht) {
      // Leer getippte Notiz: in den Papierkorb – mit dem Text, den sie vor dem Leeren hatte.
      if (!wert.trim()) loescheNotiz(id, textBeiFokus.current);
      else setRoh(aktuell.text);
    }
  };

  const aufgabe = notiz?.aufgabe ?? null;
  const heute = lokalesDatum();
  const faellig = aufgabe?.faellig ?? null;
  // Knöpfe an der Notiz behalten den Cursor im Textfeld. Wichtig für Safari: Dort wird ein angetippter
  // Knopf nicht selbst aktiv. Ohne das verlöre das Textfeld den Cursor, die Knöpfe (am Handy nur bei
  // aktiver Notiz sichtbar) verschwänden und der Tipp ginge ins Leere.
  const halteFokus = (e: { preventDefault: () => void }) => e.preventDefault();

  return (
    <div
      ref={sortierbar.setNodeRef}
      style={{ transform: CSS.Translate.toString(sortierbar.transform), transition: sortierbar.transition }}
      className={klassen(
        'notiz',
        aktiv && 'aktiv',
        !notiz && 'entwurf',
        aufgabe?.erledigt && 'erledigt',
        leuchtet && 'leuchtet',
        sortierbar.isDragging && 'zieht',
      )}
      data-notiz={id}
    >
      {notiz && (
        <button
          className="griff"
          ref={sortierbar.setActivatorNodeRef}
          {...sortierbar.attributes}
          {...sortierbar.listeners}
          tabIndex={-1}
          aria-label="Notiz umsortieren"
          title="Ziehen zum Umsortieren"
        >
          <Griff />
        </button>
      )}

      {teile && (
        <button
          className={klassen('klapp', !zu && 'offen')}
          aria-expanded={!zu}
          aria-label={zu ? 'Aufklappen' : 'Zuklappen'}
          title={zu ? 'Aufklappen' : 'Zuklappen'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (zu) setOffen(true);
            else {
              setOffen(false);
              feld.current?.blur();
            }
          }}
        >
          <Winkel />
        </button>
      )}

      {aufgabe && (
        <button
          className={klassen('kaestchen', aufgabe.erledigt && 'an')}
          role="checkbox"
          aria-checked={aufgabe.erledigt}
          aria-label={aufgabe.erledigt ? 'Als offen markieren' : 'Abhaken'}
          onClick={() => (aufgabe.erledigt ? setzeErledigt(id, false) : hakeAbMitMeldung(id))}
        >
          {aufgabe.erledigt && <Haken />}
        </button>
      )}

      {zu && notiz && teile ? (
        <button className="notiz-kopf" aria-expanded={false} onClick={() => setOffen(true)}>
          <span className="notiz-name">
            <MarkdownAnzeige text={teile.name} einzeilig ohneLinks />
          </span>
          <span className="mono meta notiz-kopf-info">
            {aufgabe && !aufgabe.erledigt && <PrioStandHinweis aufgabe={aufgabe} />}
            {aufgabe?.faellig && <FaelligText aufgabe={aufgabe} heute={heute} />}
            <span>{formatStempel(notiz.erstellt, heute)}</span>
          </span>
        </button>
      ) : (
        <div className="notiz-inhalt">
          <div className="textfeld">
            <Spiegel text={roh} roh={aktiv} ohneName={!!tag} />
            <textarea
              ref={feld}
              rows={1}
              value={roh}
              placeholder={platzhalter}
              aria-label={notiz ? 'Notiz' : 'Neue Notiz'}
              onChange={(e) => {
                const el = e.target;
                uebernimm(el.value, el.selectionStart);
                requestAnimationFrame(() => haltSichtbar(el));
              }}
              onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
              onKeyDown={beiTaste}
              onFocus={(e) => {
                textBeiFokus.current = notiz?.text;
                steuerung.setzeAktiv(id, true);
                // warten, bis die Tastatur ausgefahren ist
                const el = e.currentTarget;
                setTimeout(() => haltSichtbar(el), 350);
              }}
              onBlur={(e) => beiVerlassen(e.target.value)}
            />
            {tagOffen && (
              <div className="tag-auswahl" role="listbox" aria-label="Tags">
                {vorschlaege.map((v, i) => (
                  <button
                    key={v.tag}
                    role="option"
                    aria-selected={i === gewaehlt}
                    className={klassen(i === gewaehlt && 'gewaehlt')}
                    onMouseDown={halteFokus}
                    onClick={() => waehleTag(v.tag)}
                  >
                    <span>#{v.tag}</span>
                    <span className="anzahl">{v.neu ? 'neu anlegen' : v.anzahl}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {notiz && (
            <div className="notiz-meta">
              <span>{formatStempel(notiz.erstellt, heute)}</span>
              {aufgabe && (
                <Menue
                  knopf={
                    faellig ? (
                      <>
                        <FaelligText aufgabe={aufgabe} heute={heute} />
                        <WiederholungsHinweis aufgabe={aufgabe} />
                      </>
                    ) : (
                      <>
                        <Uhr /> Termin
                      </>
                    )
                  }
                  beschriftung="Fälligkeit, Erinnerung und Wiederholung"
                  knopfKlasse={klassen('faellig', !faellig && 'leer')}
                  links
                >
                  {() => <AufgabenMenue notiz={notiz} />}
                </Menue>
              )}
              {aufgabe && <PrioStandKnoepfe id={id} aufgabe={aufgabe} />}
              <span className="notiz-aktionen">
                <button title="Tag einfügen" aria-label="Tag einfügen" onMouseDown={halteFokus} onClick={beiTagKnopf}>
                  #
                </button>
                <button
                  title={aufgabe ? 'Keine Aufgabe mehr' : 'Zur Aufgabe machen'}
                  aria-label={aufgabe ? 'Keine Aufgabe mehr' : 'Zur Aufgabe machen'}
                  className={klassen(aufgabe && 'an')}
                  onMouseDown={halteFokus}
                  onClick={() => setzeAufgabe(id, !aufgabe)}
                >
                  <KaestchenSymbol />
                </button>
                <button
                  title="Verschieben nach …"
                  aria-label="Verschieben nach …"
                  onMouseDown={halteFokus}
                  onClick={() => steuerung.verschiebeDialog(id)}
                >
                  <OrdnerPfeil />
                </button>
                <button
                  title="In den Papierkorb"
                  aria-label="In den Papierkorb"
                  onMouseDown={halteFokus}
                  onClick={() => loescheNotiz(id)}
                >
                  <Korb />
                </button>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
