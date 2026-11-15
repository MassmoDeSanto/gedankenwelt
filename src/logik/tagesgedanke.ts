/**
 * Gedanke des Tages (KONZEPT.md, Abschnitt 5): eine zufällige Notiz aus Listen
 * mit aktivem Tagesgedanken. Pro Kalendertag fest; bevorzugt Notizen, die in den
 * letzten 30 Tagen nicht gezeigt wurden.
 */
import type { Notiz, VerlaufEintrag } from '../modell/typen';
import { tagesgedankeAktiv, type ListenKarte } from './listen';
import { verschiebeDatum } from './zeit';

const SCHONFRIST_TAGE = 30;
const VERLAUF_MAX = 400;

/** Notizen, die überhaupt als Gedanke des Tages in Frage kommen. Aufgaben sind ausgenommen. */
export function kandidaten(notizen: Iterable<Notiz>, listen: ListenKarte): Notiz[] {
  const aktiv = new Map<string, boolean>();
  const ergebnis: Notiz[] = [];
  for (const notiz of notizen) {
    if (notiz.geloescht || notiz.aufgabe) continue;
    let an = aktiv.get(notiz.liste_id);
    if (an === undefined) {
      an = tagesgedankeAktiv(notiz.liste_id, listen);
      aktiv.set(notiz.liste_id, an);
    }
    if (an) ergebnis.push(notiz);
  }
  return ergebnis.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Macht aus einem Text eine Zahl – immer dieselbe für denselben Text (FNV-1a). */
function streuwert(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Tagesgedanke {
  notiz: Notiz | null;
  /** Der (eventuell ergänzte) Verlauf. Gleiches Objekt wie die Eingabe, wenn sich nichts geändert hat. */
  verlauf: VerlaufEintrag[];
}

/**
 * Wählt den Gedanken für den Kalendertag `datum` ("2026-11-15").
 * Steht für den Tag schon eine Notiz im Verlauf und gibt es sie noch, bleibt es dabei.
 */
export function waehleTagesgedanke(
  notizen: Iterable<Notiz>,
  listen: ListenKarte,
  verlauf: VerlaufEintrag[],
  datum: string,
): Tagesgedanke {
  const alle = kandidaten(notizen, listen);
  if (alle.length === 0) return { notiz: null, verlauf };

  const heute = verlauf.find((e) => e.datum === datum);
  const schonGewaehlt = heute && alle.find((n) => n.id === heute.notiz_id);
  if (schonGewaehlt) return { notiz: schonGewaehlt, verlauf };

  // Wann wurde jede Notiz zuletzt gezeigt?
  const zuletzt = new Map<string, string>();
  for (const e of verlauf) {
    if (e.datum >= datum) continue;
    if ((zuletzt.get(e.notiz_id) ?? '') < e.datum) zuletzt.set(e.notiz_id, e.datum);
  }

  const grenze = verschiebeDatum(datum, -SCHONFRIST_TAGE);
  let auswahl = alle.filter((n) => (zuletzt.get(n.id) ?? '') < grenze);
  if (auswahl.length === 0) {
    // Alle waren kürzlich dran: die nehmen, deren Auftritt am längsten zurückliegt.
    const aeltestes = alle.reduce((min, n) => (zuletzt.get(n.id)! < min ? zuletzt.get(n.id)! : min), '9999');
    auswahl = alle.filter((n) => zuletzt.get(n.id) === aeltestes);
  }

  const notiz = auswahl[streuwert(datum) % auswahl.length];
  const neuerVerlauf = [...verlauf.filter((e) => e.datum !== datum), { datum, notiz_id: notiz.id }]
    .sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0))
    .slice(-VERLAUF_MAX);
  return { notiz, verlauf: neuerVerlauf };
}
