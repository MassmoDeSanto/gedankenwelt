/**
 * „Markdown light“ für die Anzeige: **fett**, *kursiv*, `Code`, Links und
 * Aufzählungen mit „-“. Der gespeicherte Text bleibt immer reiner Markdown-Text;
 * hier wird er nur in Bausteine zerlegt, die die Oberfläche hübsch darstellt.
 */

export type Inline =
  | { art: 'text'; text: string }
  | { art: 'fett'; kinder: Inline[] }
  | { art: 'kursiv'; kinder: Inline[] }
  | { art: 'code'; text: string }
  | { art: 'link'; text: string; url: string }
  | { art: 'tag'; text: string };

export interface Zeile {
  /** 'punkt' = Aufzählungspunkt (Zeile beginnt mit „- “) */
  art: 'text' | 'punkt';
  /** Einrückungsstufe eines Aufzählungspunkts (0 = ganz links) */
  einzug: number;
  inhalt: Inline[];
}

const MUSTER = new RegExp(
  [
    '(`[^`\\n]+`)', // 1: `Code`
    '(\\*\\*(?![*\\s])([^\\n]+?)(?<![*\\s])\\*\\*(?!\\*))', // 2, 3: **fett**
    '(\\*(?![*\\s])([^\\n*]+?)(?<=\\S)\\*(?!\\*))', // 4, 5: *kursiv*
    '(\\[([^\\]\\n]+)\\]\\(((?:https?:\\/\\/|mailto:)[^\\s)]+)\\))', // 6, 7, 8: [Text](Adresse)
    '(https?:\\/\\/[^\\s<>]*[^\\s<>.,;:!?)\\]\'"])', // 9: nackte Adresse
    '((?<=^|[\\s(])#[\\p{L}\\p{N}_][\\p{L}\\p{N}_-]*)', // 10: #tag
  ].join('|'),
  'gu',
);

/**
 * Nur Adressen, die beim Anklicken nichts in der App ausführen können: Webseiten und E-Mail.
 * `javascript:`, `data:`, `file:` usw. bleiben normaler Text (PHASE-6.md, Abschnitt 2).
 * Das Muster oben lässt ohnehin nur diese zu – die Prüfung hier ist die zweite Sicherung.
 */
export function istSichereAdresse(url: string): boolean {
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/** Zerlegt eine Textzeile in normale und ausgezeichnete Stücke. Nicht geschlossene Zeichen bleiben Text. */
export function leseInline(text: string): Inline[] {
  const teile: Inline[] = [];
  let ende = 0;
  for (const m of text.matchAll(MUSTER)) {
    const start = m.index!;
    if (start > ende) teile.push({ art: 'text', text: text.slice(ende, start) });
    if (m[1]) teile.push({ art: 'code', text: m[1].slice(1, -1) });
    else if (m[2]) teile.push({ art: 'fett', kinder: leseInline(m[3]) });
    else if (m[4]) teile.push({ art: 'kursiv', kinder: leseInline(m[5]) });
    else if (m[6]) teile.push(istSichereAdresse(m[8]) ? { art: 'link', text: m[7], url: m[8] } : { art: 'text', text: m[0] });
    else if (m[9]) teile.push(istSichereAdresse(m[9]) ? { art: 'link', text: m[9], url: m[9] } : { art: 'text', text: m[0] });
    else teile.push({ art: 'tag', text: m[10] });
    ende = start + m[0].length;
  }
  if (ende < text.length) teile.push({ art: 'text', text: text.slice(ende) });
  return teile;
}

const PUNKT = /^(\s*)- +(\S.*)$/;

/** Zerlegt einen Notiztext in Zeilen samt Auszeichnungen. */
export function leseMarkdownLight(text: string): Zeile[] {
  return text.split('\n').map((zeile) => {
    const punkt = PUNKT.exec(zeile);
    if (punkt) return { art: 'punkt', einzug: Math.floor(punkt[1].length / 2), inhalt: leseInline(punkt[2]) };
    return { art: 'text', einzug: 0, inhalt: leseInline(zeile) };
  });
}

/** Der sichtbare Text ohne Auszeichnungszeichen (z. B. für Vergleiche in Tests). */
export function alsKlartext(inhalt: Inline[]): string {
  return inhalt
    .map((teil) => ('kinder' in teil ? alsKlartext(teil.kinder) : teil.text))
    .join('');
}
