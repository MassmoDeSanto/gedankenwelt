/**
 * Marker-Tabelle für den Import aus Apple Notizen (PHASE-4.md, Abschnitt 4).
 *
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │ HIER wird die Erkennung angepasst, sobald echte Exportdateien vorliegen.     │
 * │ Alle Zeichen, an denen der Import Checklisten und Aufzählungen erkennt,      │
 * │ stehen in den beiden Tabellen unten – und nur dort.                          │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * So liest der Import eine Zeile:
 *
 *   [Einrückung] [Aufzählungszeichen] [Aufgaben-Marker] Text
 *
 *   „- [ ] Milch“   → Aufzählungszeichen „-“, Marker „[ ]“  → offene Aufgabe
 *   „☑ Brot“        → kein Aufzählungszeichen, Marker „☑“   → erledigte Aufgabe
 *   „• Idee“        → nur Aufzählungszeichen                → Aufzählungspunkt
 *
 * Welche Marker Apple wirklich schreibt, ist noch nicht am Gerät geprüft. Die Tabelle
 * ist deshalb bewusst breit. Stellt sich ein Zeichen als falsch heraus (z. B. weil Apple
 * „◦“ nur für eingerückte Aufzählungspunkte benutzt), genügt es, die Zeile zu löschen
 * oder `nurOhneEinzug` zu setzen. Ein neues Zeichen ist eine neue Zeile.
 */

export interface AufgabenMarker {
  /** Das Zeichen (oder die Zeichenfolge) am Anfang der Zeile */
  zeichen: string;
  zustand: 'offen' | 'erledigt';
  /** Woher der Marker bekannt ist – nur zur Dokumentation */
  herkunft: string;
  /**
   * true = gilt nur als Aufgabe, wenn die Zeile nicht unter einem Aufzählungspunkt eingerückt ist.
   * Für Zeichen, die auch als Aufzählungszeichen der zweiten Ebene vorkommen.
   */
  nurOhneEinzug?: boolean;
}

export const AUFGABEN_MARKER: AufgabenMarker[] = [
  // ── Markdown-Schreibweise (erwartet beim „Als Markdown exportieren“) ──
  { zeichen: '[ ]', zustand: 'offen', herkunft: 'Markdown-Checkliste „- [ ]“' },
  { zeichen: '[]', zustand: 'offen', herkunft: 'Markdown-Checkliste ohne Leerzeichen' },
  { zeichen: '[x]', zustand: 'erledigt', herkunft: 'Markdown-Checkliste „- [x]“' },
  { zeichen: '[X]', zustand: 'erledigt', herkunft: 'Markdown-Checkliste „- [X]“' },

  // ── Kästchen-Zeichen ──
  { zeichen: '☐', zustand: 'offen', herkunft: 'leeres Kästchen (U+2610)' },
  { zeichen: '☑', zustand: 'erledigt', herkunft: 'Kästchen mit Haken (U+2611)' },
  { zeichen: '☒', zustand: 'erledigt', herkunft: 'Kästchen mit Kreuz (U+2612)' },
  { zeichen: '✅', zustand: 'erledigt', herkunft: 'grüner Haken (Emoji)' },

  // ── Haken ──
  { zeichen: '✓', zustand: 'erledigt', herkunft: 'Haken (U+2713), reiner Text aus Apple Notizen' },
  { zeichen: '✔', zustand: 'erledigt', herkunft: 'fetter Haken (U+2714)' },

  // ── Kreise: so sehen Checklisten in Apple Notizen aus ──
  // „◦“ und „○“ sind zugleich übliche Zeichen für Unterpunkte. Darum gelten sie nur dann als
  // Aufgabe, wenn die Zeile nicht eingerückt unter einem Aufzählungspunkt steht.
  { zeichen: '○', zustand: 'offen', herkunft: 'leerer Kreis (U+25CB)', nurOhneEinzug: true },
  { zeichen: '◦', zustand: 'offen', herkunft: 'kleiner leerer Kreis (U+25E6)', nurOhneEinzug: true },
  { zeichen: '◯', zustand: 'offen', herkunft: 'großer leerer Kreis (U+25EF)', nurOhneEinzug: true },
];

/**
 * Zeichen, mit denen ein Aufzählungspunkt beginnt. Nummerierte Punkte („1.“, „2)“) erkennt
 * der Import zusätzlich von selbst.
 */
export const AUFZAEHLUNGSZEICHEN: string[] = [
  '-', // Markdown und Strich-Liste
  '*', // Markdown
  '+', // Markdown
  '•', // Punkt-Liste in Apple Notizen (U+2022)
  '‣', // dreieckiger Punkt (U+2023)
  '▪', // kleines Quadrat (U+25AA)
  '–', // Halbgeviertstrich (U+2013)
];

// ───────────────────────── Aus den Tabellen gebaute Erkennung ─────────────────────────

function maskiere(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ZEICHEN_GRUPPE = AUFZAEHLUNGSZEICHEN.map(maskiere).join('|');
// Längere Marker zuerst, damit „[x]“ nicht als „[“ … gelesen wird.
const MARKER_GRUPPE = [...AUFGABEN_MARKER]
  .sort((a, b) => b.zeichen.length - a.zeichen.length)
  .map((m) => maskiere(m.zeichen))
  .join('|');

const AUFGABE = new RegExp(`^(?:(?:${ZEICHEN_GRUPPE})[ \\t]+)?(${MARKER_GRUPPE})[ \\t]+(\\S.*)$`, 'u');
const PUNKT = new RegExp(`^(?:${ZEICHEN_GRUPPE})[ \\t]+(\\S.*)$`, 'u');
const NUMMER = /^(\d{1,3}[.)])[ \t]+(\S.*)$/;

export interface ErkannteAufgabe {
  zustand: 'offen' | 'erledigt';
  text: string;
  marker: AufgabenMarker;
}

/** Ist die Zeile (ohne Einrückung) ein Checklisten-Eintrag? */
export function leseAufgabe(zeile: string): ErkannteAufgabe | null {
  const treffer = AUFGABE.exec(zeile);
  if (!treffer) return null;
  const marker = AUFGABEN_MARKER.find((m) => m.zeichen === treffer[1])!;
  return { zustand: marker.zustand, text: treffer[2].trim(), marker };
}

export interface ErkannterPunkt {
  text: string;
  /** „1.“ bei nummerierten Punkten, sonst null */
  nummer: string | null;
}

/** Ist die Zeile (ohne Einrückung) ein Aufzählungspunkt oder ein nummerierter Punkt? */
export function lesePunkt(zeile: string): ErkannterPunkt | null {
  const punkt = PUNKT.exec(zeile);
  if (punkt) return { text: punkt[1].trim(), nummer: null };
  const nummer = NUMMER.exec(zeile);
  if (nummer) return { text: nummer[2].trim(), nummer: nummer[1] };
  return null;
}
