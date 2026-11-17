/**
 * Inhalts-Fingerabdruck einer Exportdatei (PHASE-4.md, Abschnitt 6, „Keine Dubletten“).
 *
 * Aus dem bereinigten Text wird eine kurze Kennung berechnet. Derselbe Text ergibt immer dieselbe
 * Kennung, egal wie die Datei heißt. Das ist keine Verschlüsselung und kein Schutz gegen Absicht –
 * es soll nur auffallen, wenn dieselbe Datei ein zweites Mal gewählt wird. Die Länge des Textes
 * steckt mit drin, was Verwechslungen noch unwahrscheinlicher macht.
 *
 * Verfahren: „cyrb53“, eine verbreitete, schnelle Streufunktion mit 53 Bit.
 */
export function fingerabdruck(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const zeichen = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ zeichen, 2654435761);
    h2 = Math.imul(h2 ^ zeichen, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const zahl = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return `${zahl.toString(36)}-${text.length.toString(36)}`;
}
