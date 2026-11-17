/**
 * Import aus Apple Notizen: Anschluss der Import-Logik (src/logik/import/) an den Speicher.
 *
 * Geschrieben wird über dieselben Funktionen wie jede andere Änderung. Dadurch läuft der Import
 * offline und landet anschließend von selbst in der Warteschlange für Google Drive.
 */
import { fuehreImportAus } from '../logik/import/ablauf';
import { planeRueckgaengig, type ImportAuftrag, type RueckgaengigPlan } from '../logik/import/plan';
import { jetztStempel, lokalesDatum } from '../logik/zeit';
import type { ImportEintrag } from '../modell/typen';
import { neueId } from '../modell/ulid';
import { db } from './db';
import { alsBestand, leseZustand, sichereImporte, sichereListen, sichereNotizen } from './speicher';

/** Stand der App unmittelbar vor dem letzten Import, als ZIP. */
export interface ImportSicherung {
  /** Zeitpunkt in Millisekunden */
  zeit: number;
  zip: Uint8Array;
}

const SICHERUNG = 'import-sicherung';

/**
 * Führt den Import aus: erst die Sicherung, dann Listen, Notizen und der Eintrag im Verlauf.
 * Wirft einen Fehler, wenn die Sicherung nicht gespeichert werden konnte – dann ist nichts importiert.
 */
export async function importiere(auftraege: ImportAuftrag[], tagesgedanke: boolean): Promise<ImportEintrag> {
  const umg = { jetzt: jetztStempel(), neueId: () => neueId() };
  const ergebnis = await fuehreImportAus(auftraege, alsBestand(), umg, { tagesgedanke }, {
    sichere: async (zip) => {
      const sicherung: ImportSicherung = { zeit: Date.now(), zip };
      await db.abgleich.put({ schluessel: SICHERUNG, wert: sicherung });
    },
    // Gebündelt: je ein Schreibvorgang für alle Listen und für alle Notizen.
    schreibe: (listen, notizen, eintrag) => {
      sichereListen(listen);
      sichereNotizen(notizen);
      sichereImporte([...leseZustand().importe, eintrag]);
    },
  });
  return ergebnis.eintrag;
}

/** Was „Rückgängig“ für diesen Import bewirken würde (ohne es schon zu tun). */
export function pruefeRueckgaengig(importId: string): RueckgaengigPlan | null {
  const z = leseZustand();
  const eintrag = z.importe.find((i) => i.id === importId);
  if (!eintrag || eintrag.rueckgaengig) return null;
  return planeRueckgaengig(eintrag, z.listen.values(), z.notizen.values(), jetztStempel());
}

/** Legt alles aus diesem Import in den Papierkorb und vermerkt es im Verlauf. */
export function macheRueckgaengig(importId: string): void {
  const plan = pruefeRueckgaengig(importId);
  if (!plan) return;
  const jetzt = jetztStempel();
  sichereListen(plan.listen);
  sichereNotizen(plan.notizen);
  sichereImporte(leseZustand().importe.map((i) => (i.id === importId ? { ...i, rueckgaengig: jetzt } : i)));
}

export async function leseImportSicherung(): Promise<ImportSicherung | null> {
  return ((await db.abgleich.get(SICHERUNG))?.wert as ImportSicherung | undefined) ?? null;
}

export function importSicherungsName(sicherung: ImportSicherung): string {
  return `gedankenwelt-sicherung-vor-import-${lokalesDatum(new Date(sicherung.zeit))}.zip`;
}
