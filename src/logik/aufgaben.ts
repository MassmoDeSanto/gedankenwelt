/** Auswertung der Aufgaben für die To-do-Box und die Sammelansicht. */
import type { Notiz, Prioritaet, Stand } from '../modell/typen';
import { faelligDatum, tageZwischen } from './zeit';

/** Reihenfolge beim Weitertippen: keine → hoch → mittel → niedrig → keine. */
export function naechstePrioritaet(p: Prioritaet | null): Prioritaet | null {
  return p === null ? 'hoch' : p === 'hoch' ? 'mittel' : p === 'mittel' ? 'niedrig' : null;
}

/** Weitertippen beim Stand: offen ↔ in Arbeit. */
export function naechsterStand(s: Stand): Stand {
  return s === 'offen' ? 'in_arbeit' : 'offen';
}

/** Rang für die Sortierung: hoch zuerst, ohne Priorität zuletzt. */
const PRIO_RANG = { hoch: 0, mittel: 1, niedrig: 2 } as const;
function prioRang(n: Notiz): number {
  const p = n.aufgabe!.prioritaet;
  return p ? PRIO_RANG[p] : 3;
}

/**
 * Offene Aufgaben: zuerst nach Priorität (hoch, mittel, niedrig, keine), dann die mit Fälligkeit
 * (früheste zuerst), dann die ohne Datum (neueste zuerst). Die Sammelansicht übernimmt diese
 * Reihenfolge innerhalb ihrer Gruppen.
 */
export function offeneAufgaben(notizen: Iterable<Notiz>): Notiz[] {
  const offen: Notiz[] = [];
  for (const n of notizen) if (!n.geloescht && n.aufgabe && !n.aufgabe.erledigt) offen.push(n);
  return offen.sort((a, b) => {
    const prio = prioRang(a) - prioRang(b);
    if (prio !== 0) return prio;
    const fa = a.aufgabe!.faellig;
    const fb = b.aufgabe!.faellig;
    if (fa && fb) return fa < fb ? -1 : fa > fb ? 1 : 0;
    if (fa) return -1;
    if (fb) return 1;
    return a.erstellt < b.erstellt ? 1 : a.erstellt > b.erstellt ? -1 : 0;
  });
}

export interface AufgabenGruppen {
  ueberfaellig: Notiz[];
  heute: Notiz[];
  demnaechst: Notiz[];
  ohneDatum: Notiz[];
}

/** Teilt offene Aufgaben in die vier Gruppen der Sammelansicht. `heute` ist ein Ortsdatum. */
export function gruppiereAufgaben(offen: Notiz[], heute: string): AufgabenGruppen {
  const gruppen: AufgabenGruppen = { ueberfaellig: [], heute: [], demnaechst: [], ohneDatum: [] };
  for (const n of offen) {
    const faellig = n.aufgabe?.faellig;
    if (!faellig) gruppen.ohneDatum.push(n);
    else if (faelligDatum(faellig) < heute) gruppen.ueberfaellig.push(n);
    else if (faelligDatum(faellig) === heute) gruppen.heute.push(n);
    else gruppen.demnaechst.push(n);
  }
  return gruppen;
}

/** Kurztext für die To-do-Box, z. B. „2 heute, 5 offen“. */
export function aufgabenZusammenfassung(gruppen: AufgabenGruppen): string {
  const offen =
    gruppen.ueberfaellig.length + gruppen.heute.length + gruppen.demnaechst.length + gruppen.ohneDatum.length;
  if (offen === 0) return 'nichts offen';
  const teile: string[] = [];
  if (gruppen.ueberfaellig.length > 0) teile.push(`${gruppen.ueberfaellig.length} überfällig`);
  if (gruppen.heute.length > 0) teile.push(`${gruppen.heute.length} heute`);
  teile.push(`${offen} offen`);
  return teile.join(', ');
}

// ───────── Darstellung „Planer“: Kalenderblatt, Farbstufe und Abstand ─────────

/**
 * Farbstufe einer Fälligkeit, je näher, desto wärmer: überfällig (rot), heute (orange),
 * bald = in 1–2 Tagen (gelb), woche = in 3–7 Tagen (türkis), später (grau), ohne Datum.
 */
export type Dringlichkeitsstufe = 'ueberfaellig' | 'heute' | 'bald' | 'woche' | 'spaeter' | 'ohne';

export function dringlichkeitsstufe(faellig: string | null, heute: string): Dringlichkeitsstufe {
  if (!faellig) return 'ohne';
  const tage = tageZwischen(heute, faelligDatum(faellig));
  if (tage < 0) return 'ueberfaellig';
  if (tage === 0) return 'heute';
  if (tage <= 2) return 'bald';
  if (tage <= 7) return 'woche';
  return 'spaeter';
}

/** Abstand zum Fälligkeitstag in Worten: „seit 2 Tagen“, „heute“, „morgen“, „in 4 Tagen“ … */
export function abstandText(faellig: string, heute: string): string {
  const tage = tageZwischen(heute, faelligDatum(faellig));
  if (tage === 0) return 'heute';
  if (tage === 1) return 'morgen';
  if (tage === 2) return 'übermorgen';
  if (tage === -1) return 'seit gestern';
  return tage < 0 ? `seit ${-tage} Tagen` : `in ${tage} Tagen`;
}

const KURZ_WOCHENTAGE = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA'];
const KURZ_MONATE = ['JAN', 'FEB', 'MÄR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEZ'];

/**
 * Beschriftung des kleinen Kalenderblatts: oben der Wochentag, bei mehr als 7 Tagen Abstand
 * (vor oder zurück) stattdessen der Monat, damit „9“ nicht mehrdeutig ist; unten die Tageszahl.
 */
export function kalenderblatt(faellig: string, heute: string): { oben: string; zahl: number } {
  const datum = faelligDatum(faellig);
  const [j, m, t] = datum.split('-').map(Number);
  const nah = Math.abs(tageZwischen(heute, datum)) <= 7;
  const oben = nah ? KURZ_WOCHENTAGE[new Date(Date.UTC(j, m - 1, t)).getUTCDay()] : KURZ_MONATE[m - 1];
  return { oben, zahl: t };
}

// ───────── Sammelansicht „Alle Aufgaben“: Filter-Chips und Monatsgruppen ─────────

/** Filter der Chips oben in der Sammelansicht. */
export type AufgabenFilter = 'alle' | 'ueberfaellig' | 'heute' | 'arbeit' | 'hoch';

export const AUFGABEN_FILTER: AufgabenFilter[] = ['alle', 'ueberfaellig', 'heute', 'arbeit', 'hoch'];

export function passtZuFilter(notiz: Notiz, filter: AufgabenFilter, heute: string): boolean {
  const a = notiz.aufgabe;
  if (!a) return false;
  if (filter === 'ueberfaellig') return dringlichkeitsstufe(a.faellig, heute) === 'ueberfaellig';
  if (filter === 'heute') return dringlichkeitsstufe(a.faellig, heute) === 'heute';
  if (filter === 'arbeit') return a.stand === 'in_arbeit';
  if (filter === 'hoch') return a.prioritaet === 'hoch';
  return true;
}

const MONATSNAMEN = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export interface Monatsgruppe {
  /** „November“, in anderen Jahren „Januar 2027“; für Aufgaben ohne Datum „Ohne Datum“ */
  titel: string;
  ohneDatum: boolean;
  aufgaben: Notiz[];
}

/**
 * Teilt offene Aufgaben wie in einem Taschenkalender nach Monaten auf: innerhalb des Monats nach
 * Fälligkeit (gleicher Zeitpunkt: wichtigere zuerst), Aufgaben ohne Datum als letzte Gruppe in der
 * Reihenfolge, in der sie hereinkommen (offeneAufgaben: Priorität, dann neueste).
 */
export function gruppiereNachMonat(offen: Notiz[], heute: string): Monatsgruppe[] {
  const mitDatum = offen.filter((n) => n.aufgabe?.faellig);
  const ohne = offen.filter((n) => !n.aufgabe?.faellig);
  mitDatum.sort((a, b) => {
    const fa = a.aufgabe!.faellig!;
    const fb = b.aufgabe!.faellig!;
    if (fa !== fb) return fa < fb ? -1 : 1;
    return prioRang(a) - prioRang(b);
  });
  const gruppen: Monatsgruppe[] = [];
  for (const n of mitDatum) {
    const datum = faelligDatum(n.aufgabe!.faellig!);
    const name = MONATSNAMEN[Number(datum.slice(5, 7)) - 1];
    const titel = datum.slice(0, 4) === heute.slice(0, 4) ? name : `${name} ${datum.slice(0, 4)}`;
    const letzte = gruppen[gruppen.length - 1];
    if (letzte?.titel === titel) letzte.aufgaben.push(n);
    else gruppen.push({ titel, ohneDatum: false, aufgaben: [n] });
  }
  if (ohne.length > 0) gruppen.push({ titel: 'Ohne Datum', ohneDatum: true, aufgaben: ohne });
  return gruppen;
}
