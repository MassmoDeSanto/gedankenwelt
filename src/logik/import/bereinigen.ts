/**
 * Bereinigt den Text einer Exportdatei, bevor er zerlegt wird (PHASE-4.md, Abschnitt 4):
 * Zeilenenden, überflüssige Leerzeichen und unsichtbare Sonderzeichen.
 */

/** Unsichtbare Zeichen ohne Bedeutung für den Text: Breitenlos-Leerzeichen, Wortverbinder, BOM, weiches Trennzeichen. */
const UNSICHTBAR = /[\u200B\u2060\uFEFF\u00AD]/g;
/** Sonder-Leerzeichen (geschützt, schmal, Ziffernbreite …) werden zu normalen Leerzeichen. */
const SONDER_LEERZEICHEN = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
/** Steuerzeichen außer Zeilenumbruch und Tabulator */
// eslint-disable-next-line no-control-regex
const STEUERZEICHEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Vereinheitlicht einen Namen oder Titel: zusammengesetzte Umlaute (wie Apple sie in Dateinamen
 * schreibt) werden zu einem Zeichen, mehrfache Leerzeichen zu einem.
 */
export function bereinigeName(name: string): string {
  return name
    .normalize('NFC')
    .replace(UNSICHTBAR, '')
    .replace(SONDER_LEERZEICHEN, ' ')
    .replace(STEUERZEICHEN, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Für Vergleiche („gleicher Titel“, „gleichnamige Liste“): bereinigt und klein geschrieben. */
export function vergleichsName(name: string): string {
  return bereinigeName(name).toLowerCase();
}

export function bereinigeText(text: string): string {
  return (
    text
      .normalize('NFC')
      // Zeilenenden von Windows (\r\n), altem Mac (\r) und die Unicode-Zeilentrenner
      .replace(/\r\n?|[\u2028\u2029\u0085\u000B\u000C]/g, '\n')
      .replace(UNSICHTBAR, '')
      .replace(SONDER_LEERZEICHEN, ' ')
      .replace(STEUERZEICHEN, '')
      .split('\n')
      .map((zeile) =>
        zeile
          // Tabulatoren am Zeilenanfang sind Einrückung: je Tabulator eine Stufe (vier Leerzeichen)
          .replace(/^[ \t]+/, (einzug) => einzug.replace(/\t/g, '    '))
          .replace(/\t/g, ' ')
          // Leerzeichen am Zeilenende (in Markdown: „harter Umbruch“) und den Umbruch-Schrägstrich entfernen
          .replace(/[ ]+$/, '')
          .replace(/(?<=\S)\\$/, ''),
      )
      .join('\n')
  );
}
