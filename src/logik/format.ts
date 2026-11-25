/**
 * Formatversion der Dateien in Google Drive und Migrationen (PHASE-6.md, Abschnitt 1).
 *
 * Jede Datei, die die App in Drive schreibt, hat eine Formatversion:
 *  - `_meta.json` und `_Tagebuch/_tagebuch.json`: Feld `version`
 *  - Markdown-Dateien (Listen, Tagebuch-Monate): Feld `format:` im Dateikopf.
 *    Fehlt es, gilt Version 1 – so bleiben alle bisher geschriebenen Dateien gültig,
 *    ohne dass sie einmal neu geschrieben werden müssen.
 *
 * Ändert sich das Format, so geht man vor:
 *  1. `FORMATVERSION` um eins erhöhen und die Schreibfunktionen in `markdown.ts` anpassen.
 *  2. In der passenden Tabelle (`META_MIGRATIONEN`, `TAGEBUCH_MIGRATIONEN` oder
 *     `MARKDOWN_MIGRATIONEN`) einen Schritt von der alten auf die neue Version eintragen.
 *  3. Einen Test schreiben, der eine Datei der alten Version liest.
 *
 * Eine Datei mit *neuerer* Version, als diese App kennt, stammt von einer neueren App
 * (z. B. auf dem iPhone schon aktualisiert). Sie wird nie überschrieben: Der Abgleich hält an,
 * bis auch hier die neue Version geladen ist.
 */

/** Die Formatversion, die diese App schreibt. */
export const FORMATVERSION = 1;

/** Ein Schritt von Version n auf Version n + 1. */
export type Migration<T> = (alt: T) => T;
/** Schritte, nach der Ausgangsversion geordnet: `{ 1: v1ZuV2, 2: v2ZuV3 }` */
export type Migrationen<T> = Readonly<Record<number, Migration<T>>>;

/** Geworfen, wenn Daten neuer sind, als diese App versteht. */
export class FormatZuNeu extends Error {
  constructor(
    readonly pfad: string,
    readonly version: number,
  ) {
    super(
      `Die Datei „${pfad}“ in Google Drive wurde von einer neueren Version der App geschrieben (Format ${version}, diese App kennt ${FORMATVERSION}). ` +
        'Damit nichts beschädigt wird, gleicht diese Version nicht ab. Bitte lade die App neu (oder schließe sie ganz und öffne sie wieder), dann kommt die neue Version.',
    );
    this.name = 'FormatZuNeu';
  }
}

/**
 * Bringt Daten der Version `version` Schritt für Schritt auf `ziel`.
 * Fehlt ein Schritt in der Tabelle, ist das ein Programmierfehler und wird laut gemeldet.
 */
export function migriere<T>(daten: T, version: number, migrationen: Migrationen<T>, ziel: number = FORMATVERSION): T {
  if (version > ziel) throw new RangeError(`Format ${version} ist neuer als ${ziel}.`);
  let ergebnis = daten;
  for (let v = version; v < ziel; v++) {
    const schritt = migrationen[v];
    if (!schritt) throw new Error(`Es fehlt die Migration von Format ${v} auf ${v + 1}.`);
    ergebnis = schritt(ergebnis);
  }
  return ergebnis;
}

type JsonObjekt = Record<string, unknown>;

/** Bisher gibt es nur Format 1 – die Tabellen sind darum noch leer. */
export const META_MIGRATIONEN: Migrationen<JsonObjekt> = {};
export const TAGEBUCH_MIGRATIONEN: Migrationen<JsonObjekt> = {};
/** Markdown-Dateien werden als ganzer Text umgebaut. */
export const MARKDOWN_MIGRATIONEN: Migrationen<string> = {};

/** Ergebnis der Prüfung einer Drive-Datei vor dem Lesen. */
export type Pruefung =
  | { art: 'ok'; version: number }
  | { art: 'unlesbar'; grund: string }
  | { art: 'zu-neu'; version: number };

/** Liest eine Versionsangabe. Fehlt sie, gilt Version 1. `null` = keine gültige Zahl. */
function leseVersion(wert: unknown): number | null {
  if (wert === undefined) return 1;
  const zahl = typeof wert === 'string' && /^\d+$/.test(wert.trim()) ? Number(wert) : wert;
  return typeof zahl === 'number' && Number.isInteger(zahl) && zahl >= 1 ? zahl : null;
}

function bewerteVersion(version: number | null, wo: string): Pruefung {
  if (version === null) return { art: 'unlesbar', grund: `Die Versionsangabe (${wo}) ist keine gültige Zahl.` };
  if (version > FORMATVERSION) return { art: 'zu-neu', version };
  return { art: 'ok', version };
}

/**
 * Prüft, ob die App eine Datei aus Drive gefahrlos lesen und später überschreiben darf.
 * Markdown ist fast immer lesbar (von Hand geschriebene Absätze werden zu Notizen).
 * Unlesbar ist eine Markdown-Datei nur, wenn ihr Dateikopf angefangen, aber nie beendet wurde –
 * dann wüsste die App nicht, zu welcher Liste sie gehört.
 */
export function pruefeDatei(pfad: string, inhalt: string): Pruefung {
  if (pfad.endsWith('.json')) {
    if (inhalt.trim() === '') return { art: 'unlesbar', grund: 'Die Datei ist leer.' };
    let roh: unknown;
    try {
      roh = JSON.parse(inhalt);
    } catch {
      return { art: 'unlesbar', grund: 'Die Datei ist unvollständig oder beschädigt.' };
    }
    if (typeof roh !== 'object' || roh === null || Array.isArray(roh)) {
      return { art: 'unlesbar', grund: 'Die Datei hat nicht den erwarteten Aufbau.' };
    }
    return bewerteVersion(leseVersion((roh as JsonObjekt).version), 'Feld „version“');
  }

  const text = inhalt.replace(/\r\n?/g, '\n');
  if (!text.startsWith('---\n')) return { art: 'ok', version: 1 };
  const ende = text.indexOf('\n---', 3);
  if (ende < 0) return { art: 'unlesbar', grund: 'Der Dateikopf (zwischen den „---“-Zeilen) ist nicht abgeschlossen.' };
  const zeile = text
    .slice(4, ende)
    .split('\n')
    .find((z) => /^format\s*:/.test(z));
  const wert = zeile?.slice(zeile.indexOf(':') + 1).trim();
  return bewerteVersion(leseVersion(wert), 'Zeile „format:“ im Dateikopf');
}
