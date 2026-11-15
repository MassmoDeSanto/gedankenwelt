import type { Notiz } from '../modell/typen';

/** Ein Tag beginnt mit „#“ am Wortanfang und besteht aus Buchstaben, Ziffern, „_“ und „-“. */
const TAG_MUSTER = /(?:^|[\s(])#([\p{L}\p{N}_][\p{L}\p{N}_-]*)/gu;

/** Alle Tags eines Textes: ohne „#“, klein geschrieben, ohne Doppelte, in Reihenfolge des Auftretens. */
export function leseTags(text: string): string[] {
  const gefunden: string[] = [];
  for (const treffer of text.matchAll(TAG_MUSTER)) {
    const tag = treffer[1].toLowerCase();
    if (!gefunden.includes(tag)) gefunden.push(tag);
  }
  return gefunden;
}

export interface TagAnzahl {
  tag: string;
  anzahl: number;
}

/** Benutzte Tags, häufigste zuerst (bei Gleichstand alphabetisch). Gelöschte Notizen zählen nicht. */
export function tagHaeufigkeit(notizen: Iterable<Notiz>): TagAnzahl[] {
  const zaehler = new Map<string, number>();
  for (const notiz of notizen) {
    if (notiz.geloescht) continue;
    for (const tag of notiz.tags) zaehler.set(tag, (zaehler.get(tag) ?? 0) + 1);
  }
  return [...zaehler.entries()]
    .map(([tag, anzahl]) => ({ tag, anzahl }))
    .sort((a, b) => b.anzahl - a.anzahl || a.tag.localeCompare(b.tag, 'de'));
}

/**
 * Filtert die Tag-Liste für das Dropdown. Die Reihenfolge nach Häufigkeit bleibt
 * erhalten; Tags, die mit der Eingabe beginnen, stehen vor denen, die sie nur enthalten.
 */
export function filtereTags(tags: TagAnzahl[], eingabe: string): TagAnzahl[] {
  const gesucht = eingabe.toLowerCase();
  if (!gesucht) return tags;
  const beginnt = tags.filter((t) => t.tag.startsWith(gesucht));
  const enthaelt = tags.filter((t) => !t.tag.startsWith(gesucht) && t.tag.includes(gesucht));
  return [...beginnt, ...enthaelt];
}

/** Ist die Eingabe ein gültiger Tag-Name? */
export function istTagName(eingabe: string): boolean {
  return /^[\p{L}\p{N}_][\p{L}\p{N}_-]*$/u.test(eingabe);
}
