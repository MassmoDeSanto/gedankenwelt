/**
 * Kurze, dezente Rückmeldung am unteren Rand – z. B. „Nächstes Mal: Mo, 23. Nov“ mit
 * „Rückgängig“. Sie verschwindet nach einigen Sekunden von selbst.
 */
import { useSyncExternalStore } from 'react';
import { hakeAufgabeAb, nimmAbhakenZurueck } from '../db/aktionen';
import { formatNaechste } from '../logik/wiederholung';
import { lokalesDatum } from '../logik/zeit';

export interface Meldung {
  nr: number;
  text: string;
  aktion?: { text: string; tun: () => void };
}

const DAUER_MS = 6000;
let aktuelle: Meldung | null = null;
let zaehler = 0;
let uhr: ReturnType<typeof setTimeout> | null = null;
const hoerer = new Set<() => void>();

function setze(meldung: Meldung | null): void {
  aktuelle = meldung;
  for (const h of hoerer) h();
}

export function zeigeMeldung(text: string, aktion?: Meldung['aktion']): void {
  if (uhr) clearTimeout(uhr);
  setze({ nr: ++zaehler, text, aktion });
  uhr = setTimeout(() => setze(null), DAUER_MS);
}

export function schliesseMeldung(): void {
  if (uhr) clearTimeout(uhr);
  setze(null);
}

export function useMeldung(): Meldung | null {
  return useSyncExternalStore(
    (h) => {
      hoerer.add(h);
      return () => hoerer.delete(h);
    },
    () => aktuelle,
  );
}

/**
 * Hakt eine Aufgabe ab und zeigt die Rückmeldung dazu.
 * `immerMelden`: auch bei einer normalen Aufgabe melden (dort, wo sie nach dem Abhaken
 * aus der Ansicht verschwindet und man sie sonst nicht zurückholen könnte).
 */
export function hakeAbMitMeldung(id: string, immerMelden = false): void {
  const ergebnis = hakeAufgabeAb(id);
  if (!ergebnis) return;
  const rueckgaengig = { text: 'Rückgängig', tun: () => nimmAbhakenZurueck(ergebnis.vorher) };
  if (ergebnis.naechste) {
    zeigeMeldung(`Nächstes Mal: ${formatNaechste(ergebnis.naechste, lokalesDatum())}`, rueckgaengig);
  } else if (ergebnis.vorher.aufgabe?.wiederholung) {
    zeigeMeldung('Erledigt. Die Wiederholung ist damit beendet.', rueckgaengig);
  } else if (immerMelden) {
    zeigeMeldung('Erledigt.', rueckgaengig);
  }
}
