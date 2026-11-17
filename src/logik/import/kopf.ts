/**
 * Kopf einer Kurzbefehl-Datei (PHASE-4.md, Abschnitt 3, Weg A):
 *
 *   ---
 *   quelle: apple-notizen
 *   titel: Reise-App Ideen
 *   ordner: Projekte/Reise-App
 *   erstellt: 2024-03-12T21:04:00+01:00
 *   geaendert: 2026-10-02T08:15:00+02:00
 *   ---
 *   <Text der Notiz>
 *
 * Der Kopf darf unvollständig sein (einzelne Zeilen fehlen, die abschließende „---“-Zeile fehlt)
 * oder ganz fehlen. Unbekannte Zeilen werden überlesen.
 */
import type { Zeitstempel } from '../../modell/typen';
import { bereinigeName } from './bereinigen';

export interface Kopf {
  /** Wurde überhaupt ein Kopf gefunden? */
  vorhanden: boolean;
  titel: string | null;
  /** Ordnerpfad in Apple Notizen, von außen nach innen */
  ordner: string[];
  erstellt: Zeitstempel | null;
  geaendert: Zeitstempel | null;
  /** Was am Kopf auffiel (für die Vorschau) */
  hinweise: string[];
}

/** Bekannte Schlüssel, auch in englischer Schreibweise und mit Umlaut. */
const SCHLUESSEL: Record<string, 'quelle' | 'titel' | 'ordner' | 'erstellt' | 'geaendert'> = {
  quelle: 'quelle',
  source: 'quelle',
  titel: 'titel',
  title: 'titel',
  name: 'titel',
  ordner: 'ordner',
  folder: 'ordner',
  erstellt: 'erstellt',
  created: 'erstellt',
  geaendert: 'geaendert',
  geändert: 'geaendert',
  modified: 'geaendert',
  updated: 'geaendert',
};

function stempel(d: Date): Zeitstempel | null {
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19) + 'Z';
}

/**
 * Liest ein Datum in den Schreibweisen, die ein Kurzbefehl liefern kann:
 *  - ISO mit Zeitzone: 2024-03-12T21:04:00+01:00 oder …Z (empfohlen)
 *  - ISO ohne Zeitzone: 2024-03-12T21:04 oder 2024-03-12 21:04:00 (gilt als Ortszeit)
 *  - nur Datum: 2024-03-12 (12:00 Ortszeit)
 *  - deutsch: 12.03.2024, 21:04 oder 12.03.2024 um 21:04 (Ortszeit)
 */
export function leseDatum(wert: string): Zeitstempel | null {
  const text = wert.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:[.,]\d+)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/i.exec(text);
  if (m) {
    const [, j, mo, t, h, mi, s, zone] = m;
    if (zone) {
      const versatz = zone.toUpperCase() === 'Z' ? 'Z' : `${zone.slice(0, 3)}:${zone.slice(-2)}`;
      return stempel(new Date(`${j}-${mo}-${t}T${h}:${mi}:${s ?? '00'}${versatz}`));
    }
    return stempel(new Date(+j, +mo - 1, +t, h ? +h : 12, mi ? +mi : 0, s ? +s : 0));
  }
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})(?:,?\s*(?:um\s*)?(\d{1,2})[:.](\d{2})(?::(\d{2}))?)?(?:\s*Uhr)?$/i.exec(text);
  if (m) {
    const [, t, mo, j, h, mi, s] = m;
    const jahr = j.length === 2 ? 2000 + +j : +j;
    return stempel(new Date(jahr, +mo - 1, +t, h ? +h : 12, mi ? +mi : 0, s ? +s : 0));
  }
  return null;
}

/** Trennt den Kopf vom Text. Ohne Kopf kommt der Text unverändert zurück. */
export function leseKopf(text: string): { kopf: Kopf; rumpf: string } {
  const kopf: Kopf = { vorhanden: false, titel: null, ordner: [], erstellt: null, geaendert: null, hinweise: [] };
  const zeilen = text.split('\n');
  let i = 0;
  while (i < zeilen.length && zeilen[i].trim() === '') i++;
  if (zeilen[i]?.trim() !== '---') return { kopf, rumpf: text };

  let gefunden = 0;
  let abgeschlossen = false;
  let j = i + 1;
  for (; j < zeilen.length; j++) {
    const zeile = zeilen[j].trim();
    if (zeile === '---') {
      abgeschlossen = true;
      j++;
      break;
    }
    const trenner = zeile.indexOf(':');
    const feld = trenner > 0 ? SCHLUESSEL[zeile.slice(0, trenner).trim().toLowerCase()] : undefined;
    // Die erste Zeile, die kein bekanntes Feld ist, beendet einen Kopf ohne Abschluss-Zeile.
    if (!feld) break;
    gefunden++;
    const wert = zeile.slice(trenner + 1).trim();
    if (!wert) continue;
    if (feld === 'titel') kopf.titel = bereinigeName(wert) || null;
    else if (feld === 'ordner') {
      kopf.ordner = wert
        .split(/[/›>]/)
        .map(bereinigeName)
        .filter((teil) => teil.length > 0);
    } else if (feld === 'erstellt' || feld === 'geaendert') {
      const datum = leseDatum(wert);
      if (datum) kopf[feld] = datum;
      else kopf.hinweise.push(`Datum „${wert}“ nicht lesbar`);
    }
  }

  // Eine „---“-Zeile ohne ein einziges bekanntes Feld ist kein Kopf, sondern eine Trennlinie im Text.
  if (gefunden === 0) return { kopf, rumpf: text };

  kopf.vorhanden = true;
  if (!abgeschlossen) kopf.hinweise.push('Kopf nicht mit „---“ abgeschlossen');
  // Liegt die Änderung vor der Erstellung, stimmt etwas nicht: dann zählt nur das Erstelldatum.
  if (kopf.erstellt && kopf.geaendert && kopf.geaendert < kopf.erstellt) kopf.geaendert = kopf.erstellt;
  return { kopf, rumpf: zeilen.slice(j).join('\n') };
}
