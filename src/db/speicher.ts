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
import {
  EINGANG_ID,
  STANDARD_EINSTELLUNGEN,
  eingangsListe,
  ergaenzeAufgabe,
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

/**
 * Wird nach jeder Änderung durch den Nutzer aufgerufen. Der Abgleich-Dienst hängt sich
 * hier ein, um die Änderung in die Warteschlange einzutragen und bald hochzuladen.
 */
let nachAenderung: ((ids: string[]) => void) | null = null;
/** Wird aufgerufen, wenn der ganze Bestand ersetzt wurde (Import, „Alles löschen“). */
let nachErsetzen: (() => void) | null = null;

export function setzeAbgleichHaken(aenderung: ((ids: string[]) => void) | null, ersetzen: (() => void) | null): void {
  nachAenderung = aenderung;
  nachErsetzen = ersetzen;
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
  nachAenderung?.(notizen.map((n) => n.id));
  melde();
}

export function sichereListen(listen: Liste[]): void {
  if (listen.length === 0) return;
  for (const l of listen) zustand.listen.set(l.id, l);
  db.listen.bulkPut(listen).catch(meldeFehler);
  nachAenderung?.(listen.map((l) => l.id));
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
  nachAenderung?.([...notizIds, ...listenIds]);
  melde();
}

export function sichereEinstellungen(einstellungen: Einstellungen): void {
  db.meta.put({ schluessel: 'einstellungen', wert: einstellungen }).catch(meldeFehler);
  nachAenderung?.(['_einstellungen']);
  melde({ einstellungen });
}

/** Der Verlauf ändert nichts Sichtbares, darum wird die Oberfläche hier nicht benachrichtigt. */
export function sichereVerlauf(verlauf: VerlaufEintrag[]): void {
  zustand.verlauf = verlauf;
  db.meta.put({ schluessel: 'tagesgedanke_verlauf', wert: verlauf }).catch(meldeFehler);
  nachAenderung?.(['_verlauf']);
}

// ───────────────────────── Ergebnis eines Abgleichs übernehmen ─────────────────────────

function gleicheNotiz(a: Notiz, b: Notiz): boolean {
  return (
    a === b ||
    (a.geaendert === b.geaendert &&
      a.text === b.text &&
      a.liste_id === b.liste_id &&
      a.position === b.position &&
      a.geloescht === b.geloescht &&
      JSON.stringify(a.aufgabe) === JSON.stringify(b.aufgabe))
  );
}

/**
 * Übernimmt den zusammengeführten Stand aus dem Abgleich. Es wird nur geschrieben, was sich
 * wirklich unterscheidet. Diese Änderungen kommen aus Drive und wandern darum NICHT wieder
 * in die Warteschlange.
 */
export function uebernimmAbgleich(bestand: Datenbestand): void {
  const sollNotizen = new Map(bestand.notizen.map((n) => [n.id, n]));
  const sollListen = new Map(bestand.listen.map((l) => [l.id, l]));

  const neueNotizen = bestand.notizen.filter((n) => {
    const alt = zustand.notizen.get(n.id);
    return !alt || !gleicheNotiz(alt, n);
  });
  const neueListen = bestand.listen.filter((l) => {
    const alt = zustand.listen.get(l.id);
    return !alt || JSON.stringify(alt) !== JSON.stringify(l);
  });
  const wegNotizen = [...zustand.notizen.keys()].filter((id) => !sollNotizen.has(id));
  const wegListen = [...zustand.listen.keys()].filter((id) => !sollListen.has(id));

  for (const n of neueNotizen) {
    zustand.notizen.set(n.id, n);
    suchindex.aktualisiere(n);
  }
  for (const id of wegNotizen) {
    zustand.notizen.delete(id);
    suchindex.entferne(id);
  }
  for (const l of neueListen) zustand.listen.set(l.id, l);
  for (const id of wegListen) zustand.listen.delete(id);

  if (neueNotizen.length > 0) db.notizen.bulkPut(neueNotizen).catch(meldeFehler);
  if (neueListen.length > 0) db.listen.bulkPut(neueListen).catch(meldeFehler);
  if (wegNotizen.length > 0) db.notizen.bulkDelete(wegNotizen).catch(meldeFehler);
  if (wegListen.length > 0) db.listen.bulkDelete(wegListen).catch(meldeFehler);

  const einstellungenNeu = JSON.stringify(zustand.einstellungen) !== JSON.stringify(bestand.einstellungen);
  if (einstellungenNeu) db.meta.put({ schluessel: 'einstellungen', wert: bestand.einstellungen }).catch(meldeFehler);
  if (JSON.stringify(zustand.verlauf) !== JSON.stringify(bestand.tagesgedanke_verlauf)) {
    zustand.verlauf = bestand.tagesgedanke_verlauf;
    db.meta.put({ schluessel: 'tagesgedanke_verlauf', wert: bestand.tagesgedanke_verlauf }).catch(meldeFehler);
  }

  const geaendert = neueNotizen.length + neueListen.length + wegNotizen.length + wegListen.length > 0 || einstellungenNeu;
  if (geaendert) melde(einstellungenNeu ? { einstellungen: bestand.einstellungen } : {});
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
  const [gespeichert, listen, meta] = await Promise.all([db.notizen.toArray(), db.listen.toArray(), db.meta.toArray()]);
  // Aufgaben aus älteren Versionen der App bekommen die später hinzugekommenen Felder.
  const notizen = gespeichert.map((n) => (n.aufgabe ? { ...n, aufgabe: ergaenzeAufgabe(n.aufgabe) } : n));
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

  if (!zustand.listen.has(EINGANG_ID)) sichereListen([eingangsListe()]);
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
  if (!listen.some((l) => l.id === EINGANG_ID)) listen.push(eingangsListe());

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
  nachErsetzen?.();
  melde();
}
