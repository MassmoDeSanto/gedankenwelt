/** Auswertung der Aufgaben für die To-do-Box und die Sammelansicht. */
import type { Notiz } from '../modell/typen';
import { faelligDatum } from './zeit';

/** Offene Aufgaben: zuerst die mit Fälligkeit (früheste zuerst), dann die ohne Datum (neueste zuerst). */
export function offeneAufgaben(notizen: Iterable<Notiz>): Notiz[] {
  const offen: Notiz[] = [];
  for (const n of notizen) if (!n.geloescht && n.aufgabe && !n.aufgabe.erledigt) offen.push(n);
  return offen.sort((a, b) => {
    const fa = a.aufgabe!.faellig;
    const fb = b.aufgabe!.faellig;
    if (fa && fb) return fa < fb ? -1 : fa > fb ? 1 : 0;
    if (fa) return -1;
    if (fb) return 1;
    return a.erstellt < b.erstellt ? 1 : a.erstellt > b.erstellt ? -1 : 0;
  });
}

export interface AufgabenGruppen {
  ueberfaellig: Notiz[];
  heute: Notiz[];
  demnaechst: Notiz[];
  ohneDatum: Notiz[];
}

/** Teilt offene Aufgaben in die vier Gruppen der Sammelansicht. `heute` ist ein Ortsdatum. */
export function gruppiereAufgaben(offen: Notiz[], heute: string): AufgabenGruppen {
  const gruppen: AufgabenGruppen = { ueberfaellig: [], heute: [], demnaechst: [], ohneDatum: [] };
  for (const n of offen) {
    const faellig = n.aufgabe?.faellig;
    if (!faellig) gruppen.ohneDatum.push(n);
    else if (faelligDatum(faellig) < heute) gruppen.ueberfaellig.push(n);
    else if (faelligDatum(faellig) === heute) gruppen.heute.push(n);
    else gruppen.demnaechst.push(n);
  }
  return gruppen;
}

/** Kurztext für die To-do-Box, z. B. „2 heute, 5 offen“. */
export function aufgabenZusammenfassung(gruppen: AufgabenGruppen): string {
  const offen =
    gruppen.ueberfaellig.length + gruppen.heute.length + gruppen.demnaechst.length + gruppen.ohneDatum.length;
  if (offen === 0) return 'nichts offen';
  const teile: string[] = [];
  if (gruppen.ueberfaellig.length > 0) teile.push(`${gruppen.ueberfaellig.length} überfällig`);
  if (gruppen.heute.length > 0) teile.push(`${gruppen.heute.length} heute`);
  teile.push(`${offen} offen`);
  return teile.join(', ');
}
