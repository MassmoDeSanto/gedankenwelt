/**
 * Reihenfolge eines Imports (PHASE-4.md, Abschnitte 5 und 6):
 *   1. Sicherung des bisherigen Stands als ZIP
 *   2. erst danach schreiben
 * Schlägt die Sicherung fehl, wird nichts importiert.
 *
 * Die Funktion kennt weder Datenbank noch Browser. Speichern und Schreiben bekommt sie von
 * außen gereicht – dadurch lässt sich die Reihenfolge testen.
 */
import type { Datenbestand, ImportEintrag, Liste, Notiz } from '../../modell/typen';
import type { Umgebung } from '../absatz';
import { zuDateien } from '../markdown';
import { packe } from '../zip';
import { baueImport, type ImportAuftrag, type ImportErgebnis } from './plan';

export interface ImportAnschluss {
  /** Legt die ZIP-Sicherung ab. Darf fehlschlagen – dann bricht der Import ab. */
  sichere: (zip: Uint8Array) => Promise<void>;
  /** Schreibt das Ergebnis gebündelt: alle Listen, alle Notizen und den Eintrag im Verlauf. */
  schreibe: (listen: Liste[], notizen: Notiz[], eintrag: ImportEintrag) => void;
}

export async function fuehreImportAus(
  auftraege: ImportAuftrag[],
  bestand: Datenbestand,
  umg: Umgebung,
  einstellungen: { tagesgedanke: boolean },
  anschluss: ImportAnschluss,
): Promise<ImportErgebnis> {
  const ergebnis = baueImport(auftraege, bestand.listen, umg, einstellungen);
  if (ergebnis.notizen.length === 0) throw new Error('In den gewählten Dateien wurde nichts zum Importieren gefunden.');
  await anschluss.sichere(packe(zuDateien(bestand)));
  anschluss.schreibe(ergebnis.listen, ergebnis.notizen, ergebnis.eintrag);
  return ergebnis;
}

/**
 * Warnung vor dem Import, wenn Google Drive nicht verbunden ist (PHASE-4.md, Abschnitt 5).
 * `null` = keine Warnung nötig.
 */
export function warnungOhneDrive(verbunden: boolean): string | null {
  if (verbunden) return null;
  return 'Du bist nicht mit Google verbunden. Die importierten Notizen liegen dann nur auf diesem Gerät, und das iPhone kann den Speicher von Web-Apps leeren. Erst verbinden?';
}
