/**
 * Tagebuch (KONZEPT.md, Abschnitt 13): Regeln ohne Oberfläche und ohne Datenbank.
 */
import { TAGEBUCH_ID, type Bewertung, type Notiz, type Tagebuchtag } from '../modell/typen';
import { pfadText, type ListenKarte } from './listen';
import { festeId } from '../modell/ulid';
import { verschiebeDatum } from './zeit';

/** Ab dieser Uhrzeit beginnt ein neuer Tagebuchtag. Wer um 1 Uhr nachts schreibt, schreibt noch am Vortag. */
export const TAGESWECHSEL = '04:00';

/** Zu welchem Tagebuchtag gehört dieser Zeitpunkt? `lokal` ist Ortszeit "2026-11-16T01:30". */
export function tagebuchTagVon(lokal: string, wechsel: string = TAGESWECHSEL): string {
  const datum = lokal.slice(0, 10);
  const uhrzeit = lokal.slice(11, 16);
  return uhrzeit && uhrzeit < wechsel ? verschiebeDatum(datum, -1) : datum;
}

/** "2026-11" aus "2026-11-16" */
export function monatVon(datum: string): string {
  return datum.slice(0, 7);
}

/** Ordner des Tagebuchs in Drive. Der Unterstrich schützt ihn vor älteren App-Versionen, die ihn sonst als Listen deuten würden. */
export const TAGEBUCH_ORDNER = '_Tagebuch';

/** Pfad der Monatsdatei, z. B. "_Tagebuch/2026/2026-11.md" */
export function monatsPfad(monat: string): string {
  return `${TAGEBUCH_ORDNER}/${monat.slice(0, 4)}/${monat}.md`;
}

/** Monat aus einem Pfad wie "_Tagebuch/2026/2026-11.md", sonst null. */
export function monatAusPfad(pfad: string): string | null {
  const treffer = /^_Tagebuch\/(\d{4})\/(\d{4}-\d{2})\.md$/.exec(pfad);
  return treffer && treffer[2].startsWith(treffer[1]) ? treffer[2] : null;
}

export const BEWERTUNG_WORTE: Record<Bewertung, string> = {
  1: 'schlecht',
  2: 'durchwachsen',
  3: 'okay',
  4: 'gut',
  5: 'sehr gut',
};

export function istBewertung(wert: unknown): wert is Bewertung {
  return wert === 1 || wert === 2 || wert === 3 || wert === 4 || wert === 5;
}

/** Aktive Notizen eines Tages in ihrer Reihenfolge. */
export function notizenDesTages(notizen: Iterable<Notiz>, datum: string): Notiz[] {
  const reihe: Notiz[] = [];
  for (const n of notizen) if (n.tagebuch_tag === datum && !n.geloescht) reihe.push(n);
  return reihe.sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1));
}

/** Der Tagebuchtag zu einem Datum (nicht gelöscht), falls es einen gibt. */
export function tagZuDatum(tage: Iterable<Tagebuchtag>, datum: string): Tagebuchtag | undefined {
  for (const t of tage) if (t.datum === datum && !t.geloescht) return t;
  return undefined;
}

/** Hat ein Tagebuchtag etwas, das gespeichert werden muss? Ein ganz leerer Tag braucht keinen Eintrag. */
export function tagHatInhalt(tag: Tagebuchtag): boolean {
  return tag.titel.trim() !== '' || tag.bewertung !== null || tag.impuls !== null || tag.gewohnheiten.length > 0;
}

/**
 * ID des Tagebuchtags zu einem Datum. Sie entsteht fest aus dem Datum: Legen zwei Geräte
 * unabhängig voneinander denselben Tag an, ist es trotzdem derselbe Eintrag.
 */
export function tagebuchtagId(datum: string): string {
  return festeId(`tagebuchtag|${datum}`);
}

const MONATE_LANG = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];
const WOCHENTAGE_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/** Teile des großen Datums auf der Tagesseite: „22“, „Sonntag“, „November 2026“. */
export function datumsTeile(datum: string): { tageszahl: string; wochentag: string; monat: string } {
  const [j, m, t] = datum.split('-').map(Number);
  const wochentag = new Date(Date.UTC(j, m - 1, t)).getUTCDay();
  return { tageszahl: String(t), wochentag: WOCHENTAGE_LANG[wochentag], monat: `${MONATE_LANG[m - 1]} ${j}` };
}

/** „22. Nov 2026“ – für Herkunftspfade in der Suche. */
export function tagKurz(datum: string): string {
  const [j, m, t] = datum.split('-').map(Number);
  return `${t}. ${MONATE_KURZ[m - 1]} ${j}`;
}

/**
 * Herkunft einer Notiz als Text: „Reise-App › Monetarisierung“, im Tagebuch
 * „Tagebuch › 22. Nov 2026 · Überschrift“.
 */
export function herkunftText(notiz: Notiz, listen: ListenKarte, tage: Iterable<Tagebuchtag>): string {
  if (notiz.liste_id !== TAGEBUCH_ID || !notiz.tagebuch_tag) return pfadText(notiz.liste_id, listen);
  const titel = tagZuDatum(tage, notiz.tagebuch_tag)?.titel;
  return `Tagebuch › ${tagKurz(notiz.tagebuch_tag)}${titel ? ` · ${titel}` : ''}`;
}
