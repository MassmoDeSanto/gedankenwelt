/** Packt die Markdown-Dateien in ein ZIP und liest sie wieder aus (Export/Import in Phase 1). */
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { META_DATEI, type Dateien } from './markdown';

export const WURZEL_ORDNER = 'Gedankenwelt/';

export function packe(dateien: Dateien): Uint8Array {
  const baum: Record<string, Uint8Array> = {};
  for (const [pfad, inhalt] of dateien) baum[WURZEL_ORDNER + pfad] = strToU8(inhalt);
  return zipSync(baum, { level: 6 });
}

/**
 * Liest ein ZIP. Der oberste Ordner („Gedankenwelt/“) wird entfernt, egal wie er heißt:
 * maßgeblich ist der Ordner, in dem die Meta-Datei liegt.
 */
export function entpacke(zip: Uint8Array): Dateien {
  const roh = unzipSync(zip);
  const pfade = Object.keys(roh).filter((p) => !p.endsWith('/') && !p.startsWith('__MACOSX/'));

  let wurzel = '';
  const meta = pfade
    .filter((p) => p === META_DATEI || p.endsWith('/' + META_DATEI))
    .sort((a, b) => a.length - b.length)[0];
  if (meta !== undefined) {
    wurzel = meta.slice(0, -META_DATEI.length);
  } else if (pfade.length > 0) {
    const erster = pfade[0].split('/')[0] + '/';
    if (pfade.every((p) => p.startsWith(erster))) wurzel = erster;
  }

  const dateien: Dateien = new Map();
  for (const pfad of pfade) {
    if (pfad.startsWith(wurzel)) dateien.set(pfad.slice(wurzel.length), strFromU8(roh[pfad]));
  }
  return dateien;
}
