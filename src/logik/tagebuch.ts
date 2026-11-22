/**
 * Tagebuch (KONZEPT.md, Abschnitt 13): Regeln ohne Oberfläche und ohne Datenbank.
 */
import { TAGEBUCH_ID, type Bewertung, type Notiz, type Tagebuchtag } from '../modell/typen';
import { pfadText, type ListenKarte } from './listen';
import { festeId } from '../modell/ulid';
import { lokalJetzt, verschiebeDatum } from './zeit';

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

/** Gewohnheiten und eigene Schreibimpulse. Bewusst nicht in _meta.json: Ältere App-Versionen würden sie dort beim Zurückschreiben verwerfen. */
export const TAGEBUCH_DATEI = '_Tagebuch/_tagebuch.json';

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

// ───────────────────────── Tagesspur (KONZEPT.md, Abschnitt 13.2) ─────────────────────────

/** Zu welchem Tagebuchtag gehört ein Zeitstempel (UTC)? Rechnet in Ortszeit und mit dem Tageswechsel. */
export function tagebuchTagVonStempel(stempel: string, wechsel: string = TAGESWECHSEL): string {
  return tagebuchTagVon(lokalJetzt(new Date(stempel)), wechsel);
}

export interface Tagesspur {
  /** An diesem Tag abgehakte Aufgaben (auch einzelne Male wiederkehrender Aufgaben) */
  erledigt: Notiz[];
  /** An diesem Tag neu angelegte Notizen außerhalb des Tagebuchs, älteste zuerst */
  neu: Notiz[];
}

/**
 * Was an einem Tag sonst noch geschah. Wird jedes Mal neu berechnet, nie gespeichert.
 * Gelöschte Notizen fehlen; bloß bearbeitete (nicht neue) Notizen zählen nicht.
 */
export function tagesspur(notizen: Iterable<Notiz>, datum: string, wechsel: string = TAGESWECHSEL): Tagesspur {
  const erledigt: Notiz[] = [];
  const neu: Notiz[] = [];
  for (const n of notizen) {
    if (n.geloescht) continue;
    const a = n.aufgabe;
    if (a) {
      const zeitpunkte = new Set(a.erledigt_verlauf);
      if (a.erledigt && a.erledigt_am) zeitpunkte.add(a.erledigt_am);
      if ([...zeitpunkte].some((z) => tagebuchTagVonStempel(z, wechsel) === datum)) erledigt.push(n);
    }
    if (n.liste_id !== TAGEBUCH_ID && tagebuchTagVonStempel(n.erstellt, wechsel) === datum) neu.push(n);
  }
  neu.sort((a, b) => (a.erstellt < b.erstellt ? -1 : a.erstellt > b.erstellt ? 1 : 0));
  return { erledigt, neu };
}

// ───────────────────────── Monatsansicht (KONZEPT.md, Abschnitt 13.6) ─────────────────────────

export interface Monatstag {
  datum: string;
  bewertung: Bewertung | null;
  /** Gibt es an diesem Tag Text, eine Überschrift oder eine Bewertung? */
  geschrieben: boolean;
}

export interface Monatsuebersicht {
  tage: Monatstag[];
  /** Durchschnitt der Bewertungen, eine Nachkommastelle; null ohne Bewertung */
  durchschnitt: number | null;
  /** Höchste Bewertung des Monats (bei Gleichstand der jüngste Tag) */
  besterTag: { datum: string; titel: string; bewertung: Bewertung } | null;
  geschrieben: number;
  erledigt: number;
  neueGedanken: number;
  /** Häufigste Tags der Tagebuch-Einträge, höchstens fünf */
  tags: { tag: string; anzahl: number }[];
  /** An wie vielen Tagen des Monats jede Gewohnheit abgehakt wurde (ID → Anzahl) */
  gewohnheiten: Map<string, number>;
}

/** Anzahl Tage eines Monats "2026-02" */
export function tageImMonat(monat: string): number {
  const [j, m] = monat.split('-').map(Number);
  return new Date(Date.UTC(j, m, 0)).getUTCDate();
}

/** Wochentag des Ersten, 0 = Montag … 6 = Sonntag (für das Kalenderraster) */
export function ersterWochentag(monat: string): number {
  const [j, m] = monat.split('-').map(Number);
  return (new Date(Date.UTC(j, m - 1, 1)).getUTCDay() + 6) % 7;
}

/** Vorheriger bzw. nächster Monat */
export function verschiebeMonat(monat: string, schritte: number): string {
  const [j, m] = monat.split('-').map(Number);
  const d = new Date(Date.UTC(j, m - 1 + schritte, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monatsName(monat: string): string {
  const [j, m] = monat.split('-').map(Number);
  return `${MONATE_LANG[m - 1]} ${j}`;
}

export function monatsuebersicht(
  monat: string,
  notizen: Iterable<Notiz>,
  tagebuchtage: Iterable<Tagebuchtag>,
  wechsel: string = TAGESWECHSEL,
): Monatsuebersicht {
  const imMonat = (datum: string) => datum.startsWith(monat + '-');
  const tageMitText = new Set<string>();
  const tagZaehler = new Map<string, number>();
  let erledigt = 0;
  let neueGedanken = 0;

  for (const n of notizen) {
    if (n.geloescht) continue;
    if (n.liste_id === TAGEBUCH_ID && n.tagebuch_tag && imMonat(n.tagebuch_tag)) {
      tageMitText.add(n.tagebuch_tag);
      for (const t of n.tags) tagZaehler.set(t, (tagZaehler.get(t) ?? 0) + 1);
    }
    if (n.liste_id !== TAGEBUCH_ID && imMonat(tagebuchTagVonStempel(n.erstellt, wechsel))) neueGedanken++;
    const a = n.aufgabe;
    if (a) {
      // Jedes Abhaken zählt einmal, auch mehrere Male derselben wiederkehrenden Aufgabe.
      const zeitpunkte = new Set(a.erledigt_verlauf);
      if (a.erledigt && a.erledigt_am) zeitpunkte.add(a.erledigt_am);
      for (const z of zeitpunkte) if (imMonat(tagebuchTagVonStempel(z, wechsel))) erledigt++;
    }
  }

  const jeDatum = new Map<string, Tagebuchtag>();
  for (const t of tagebuchtage) if (!t.geloescht && imMonat(t.datum)) jeDatum.set(t.datum, t);
  const gewohnheiten = new Map<string, number>();
  for (const t of jeDatum.values()) for (const id of new Set(t.gewohnheiten)) gewohnheiten.set(id, (gewohnheiten.get(id) ?? 0) + 1);

  const tage: Monatstag[] = [];
  for (let tag = 1; tag <= tageImMonat(monat); tag++) {
    const datum = `${monat}-${String(tag).padStart(2, '0')}`;
    const t = jeDatum.get(datum);
    tage.push({
      datum,
      bewertung: t?.bewertung ?? null,
      geschrieben: tageMitText.has(datum) || (t ? tagHatInhalt(t) : false),
    });
  }

  const bewertet = [...jeDatum.values()].filter((t) => t.bewertung !== null);
  const durchschnitt = bewertet.length
    ? Math.round((bewertet.reduce((s, t) => s + t.bewertung!, 0) / bewertet.length) * 10) / 10
    : null;
  const bester = bewertet.sort((a, b) => b.bewertung! - a.bewertung! || (a.datum < b.datum ? 1 : -1))[0];

  return {
    tage,
    durchschnitt,
    besterTag: bester ? { datum: bester.datum, titel: bester.titel, bewertung: bester.bewertung! } : null,
    geschrieben: tage.filter((t) => t.geschrieben).length,
    erledigt,
    neueGedanken,
    tags: [...tagZaehler]
      .map(([tag, anzahl]) => ({ tag, anzahl }))
      .sort((a, b) => b.anzahl - a.anzahl || a.tag.localeCompare(b.tag, 'de'))
      .slice(0, 5),
    gewohnheiten,
  };
}

// ───────────────────────── Vor einem Jahr ─────────────────────────

/** Derselbe Tag ein Jahr früher; aus dem 29. Februar wird der 28. */
export function vorEinemJahrDatum(datum: string): string {
  const [j, m, t] = datum.split('-').map(Number);
  const tag = m === 2 && t === 29 ? 28 : t;
  return `${j - 1}-${String(m).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;
}

/** Was vor einem Jahr im Tagebuch stand, oder null. */
export function vorEinemJahr(
  datum: string,
  notizen: Iterable<Notiz>,
  tagebuchtage: Iterable<Tagebuchtag>,
): { datum: string; titel: string; bewertung: Bewertung | null; text: string } | null {
  const damals = vorEinemJahrDatum(datum);
  const tag = tagZuDatum(tagebuchtage, damals);
  const absaetze = notizenDesTages(notizen, damals);
  if (absaetze.length === 0 && !(tag && tagHatInhalt(tag))) return null;
  return { datum: damals, titel: tag?.titel ?? '', bewertung: tag?.bewertung ?? null, text: absaetze[0]?.text ?? '' };
}
