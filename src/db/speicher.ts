/**
 * Der Speicher der App.
 *
 * Alle Notizen und Listen liegen im Arbeitsspeicher (schnell zu lesen, die Suche
 * arbeitet darauf) und werden bei jeder Änderung zusätzlich in die Datenbank im
 * Browser geschrieben (bleibt nach dem Neuladen erhalten).
 *
 * Die Oberfläche „abonniert“ den Speicher und zeichnet sich bei jeder Änderung neu.
 */
import { useSyncExternalStore } from 'react';
import { abgelaufen } from '../logik/papierkorb';
import { Suchindex } from '../logik/suche';
import { jetztStempel } from '../logik/zeit';
import {
  EINGANG_ID,
  STANDARD_EINSTELLUNGEN,
  eingangsListe,
  type Datenbestand,
  type Einstellungen,
  type Liste,
  type Notiz,
  type VerlaufEintrag,
} from '../modell/typen';
import { db } from './db';

export interface Zustand {
  geladen: boolean;
  notizen: Map<string, Notiz>;
  listen: Map<string, Liste>;
  einstellungen: Einstellungen;
  verlauf: VerlaufEintrag[];
}

let zustand: Zustand = {
  geladen: false,
  notizen: new Map(),
  listen: new Map(),
  einstellungen: { ...STANDARD_EINSTELLUNGEN },
  verlauf: [],
};

export const suchindex = new Suchindex();

const hoerer = new Set<() => void>();

function abonniere(h: () => void): () => void {
  hoerer.add(h);
  return () => hoerer.delete(h);
}

export function leseZustand(): Zustand {
  return zustand;
}

/** Meldet der Oberfläche, dass sich etwas geändert hat. */
function melde(teil: Partial<Zustand> = {}): void {
  zustand = { ...zustand, ...teil };
  for (const h of hoerer) h();
}

/** Für React-Komponenten: liefert den aktuellen Zustand und zeichnet bei Änderungen neu. */
export function useZustand(): Zustand {
  return useSyncExternalStore(abonniere, leseZustand);
}

function meldeFehler(fehler: unknown): void {
  console.error('Speichern in der Browser-Datenbank ist fehlgeschlagen:', fehler);
}

// ───────────────────────── Schreiben ─────────────────────────

export function sichereNotizen(notizen: Notiz[]): void {
  if (notizen.length === 0) return;
  for (const n of notizen) {
    zustand.notizen.set(n.id, n);
    suchindex.aktualisiere(n);
  }
  db.notizen.bulkPut(notizen).catch(meldeFehler);
  melde();
}

export function sichereListen(listen: Liste[]): void {
  if (listen.length === 0) return;
  for (const l of listen) zustand.listen.set(l.id, l);
  db.listen.bulkPut(listen).catch(meldeFehler);
  melde();
}

/** Endgültig löschen (Papierkorb leeren oder 30 Tage abgelaufen). */
export function entferneEndgueltig(notizIds: string[], listenIds: string[]): void {
  if (notizIds.length === 0 && listenIds.length === 0) return;
  for (const id of notizIds) {
    zustand.notizen.delete(id);
    suchindex.entferne(id);
  }
  for (const id of listenIds) zustand.listen.delete(id);
  db.notizen.bulkDelete(notizIds).catch(meldeFehler);
  db.listen.bulkDelete(listenIds).catch(meldeFehler);
  melde();
}

export function sichereEinstellungen(einstellungen: Einstellungen): void {
  db.meta.put({ schluessel: 'einstellungen', wert: einstellungen }).catch(meldeFehler);
  melde({ einstellungen });
}

/** Der Verlauf ändert nichts Sichtbares, darum wird die Oberfläche hier nicht benachrichtigt. */
export function sichereVerlauf(verlauf: VerlaufEintrag[]): void {
  zustand.verlauf = verlauf;
  db.meta.put({ schluessel: 'tagesgedanke_verlauf', wert: verlauf }).catch(meldeFehler);
}

// ───────────────────────── Laden und Ersetzen ─────────────────────────

/** Entfernt, was länger als 30 Tage im Papierkorb liegt. */
function raeumePapierkorbAuf(): void {
  const jetzt = new Date();
  const notizIds = [...zustand.notizen.values()].filter((n) => n.geloescht && abgelaufen(n.geloescht, jetzt)).map((n) => n.id);
  const listenIds = [...zustand.listen.values()].filter((l) => l.geloescht && abgelaufen(l.geloescht, jetzt)).map((l) => l.id);
  entferneEndgueltig(notizIds, listenIds);
}

/** Beim Start: alles aus der Browser-Datenbank in den Arbeitsspeicher holen. */
export async function ladeAlles(): Promise<void> {
  const [notizen, listen, meta] = await Promise.all([db.notizen.toArray(), db.listen.toArray(), db.meta.toArray()]);
  const einstellungen = meta.find((m) => m.schluessel === 'einstellungen')?.wert as Einstellungen | undefined;
  const verlauf = meta.find((m) => m.schluessel === 'tagesgedanke_verlauf')?.wert as VerlaufEintrag[] | undefined;

  zustand = {
    geladen: true,
    notizen: new Map(notizen.map((n) => [n.id, n])),
    listen: new Map(listen.map((l) => [l.id, l])),
    einstellungen: { ...STANDARD_EINSTELLUNGEN, ...einstellungen },
    verlauf: verlauf ?? [],
  };
  suchindex.setzeAlle(notizen);

  if (!zustand.listen.has(EINGANG_ID)) sichereListen([eingangsListe(jetztStempel())]);
  raeumePapierkorbAuf();
  melde();
}

/** Der gesamte Datenbestand, z. B. für den Export. */
export function alsBestand(): Datenbestand {
  return {
    listen: [...zustand.listen.values()],
    notizen: [...zustand.notizen.values()],
    einstellungen: zustand.einstellungen,
    tagesgedanke_verlauf: zustand.verlauf,
  };
}

/** Ersetzt alles durch einen anderen Datenbestand (Import oder „Alles löschen“). */
export async function ersetzeAlles(bestand: Datenbestand): Promise<void> {
  const listen = [...bestand.listen];
  if (!listen.some((l) => l.id === EINGANG_ID)) listen.push(eingangsListe(jetztStempel()));

  await db.transaction('rw', db.notizen, db.listen, db.meta, async () => {
    await Promise.all([db.notizen.clear(), db.listen.clear(), db.meta.clear()]);
    await db.notizen.bulkPut(bestand.notizen);
    await db.listen.bulkPut(listen);
    await db.meta.bulkPut([
      { schluessel: 'einstellungen', wert: bestand.einstellungen },
      { schluessel: 'tagesgedanke_verlauf', wert: bestand.tagesgedanke_verlauf },
    ]);
  });

  zustand = {
    geladen: true,
    notizen: new Map(bestand.notizen.map((n) => [n.id, n])),
    listen: new Map(listen.map((l) => [l.id, l])),
    einstellungen: bestand.einstellungen,
    verlauf: bestand.tagesgedanke_verlauf,
  };
  suchindex.setzeAlle(bestand.notizen);
  raeumePapierkorbAuf();
  melde();
}
