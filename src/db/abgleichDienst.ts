/**
 * Der Abgleich-Dienst verbindet die App mit Google Drive (PHASE-2.md, Abschnitt 3).
 *
 *  - Jede Änderung wird sofort lokal gespeichert und zusätzlich in eine Warteschlange
 *    in der Browser-Datenbank eingetragen. Die übersteht Neuladen und Neustart.
 *  - Abgeglichen wird: beim Öffnen, wenn die App wieder sichtbar wird, wenn das Netz
 *    zurückkommt, wenige Sekunden nach einer Änderung und regelmäßig, solange die App offen ist.
 *  - Es gibt keine Rückfragen. Ein kleines Symbol zeigt den Zustand.
 *
 * Die eigentlichen Regeln (wer gewinnt, was wird wohin geschrieben) stehen in
 * src/logik/abgleich/ und sind dort mit einem simulierten Drive getestet.
 */
import { useSyncExternalStore } from 'react';
import { KeineVerbindung, NichtAngemeldet, VersionsKonflikt, type Drive } from '../logik/abgleich/drive';
import { abgleiche, type CacheEintrag, type Geraet } from '../logik/abgleich/runde';
import { zuDateien } from '../logik/markdown';
import { jetztStempel, lokalesDatum } from '../logik/zeit';
import { packe } from '../logik/zip';
import { STANDARD_EINSTELLUNGEN, eingangsListe, type Datenbestand } from '../modell/typen';
import {
  abmelden,
  anmeldeZustand,
  gueltigesToken,
  starteWeiterleitung,
  stillesErneuernMoeglich,
  verwirfToken,
} from './anmeldung';
import { findeBeispieldaten } from './beispieldaten';
import { db } from './db';
import { GoogleDrive } from './googleDrive';
import {
  alsBestand,
  entferneEndgueltig,
  ersetzeAlles,
  leseZustand,
  setzeAbgleichHaken,
  uebernimmAbgleich,
} from './speicher';

const VERBUNDEN = 'gedankenwelt.drive.verbunden';
const NACH_AENDERUNG_MS = 4_000;
const TAKT_MS = 120_000;
const RUHE_MS = 30_000;

// ───────────────────────── Zustand für das Status-Symbol ─────────────────────────

export type AbgleichZustand =
  /** Kein Abgleich eingerichtet: Daten liegen nur auf diesem Gerät. */
  | 'aus'
  | 'abgeglichen'
  /** Es gibt Änderungen, die beim nächsten Abgleich hochgeladen werden. */
  | 'ausstehend'
  | 'laeuft'
  | 'offline'
  /** Der Nutzer muss einmal auf „Neu anmelden“ tippen. */
  | 'anmeldung'
  | 'fehler';

export interface AbgleichStatus {
  zustand: AbgleichZustand;
  /** Verständliche Erklärung für das Antippen des Symbols */
  meldung: string;
  /** Zeitpunkt des letzten erfolgreichen Abgleichs (Millisekunden) */
  letzterAbgleich: number | null;
  /** Wie viele Notizen und Listen noch nicht hochgeladen sind */
  offen: number;
}

const MELDUNGEN: Record<Exclude<AbgleichZustand, 'fehler'>, string> = {
  aus: 'Der Abgleich mit Google Drive ist nicht eingerichtet. Deine Daten liegen nur auf diesem Gerät.',
  abgeglichen: 'Alles ist mit Google Drive abgeglichen.',
  ausstehend: 'Es gibt Änderungen, die beim nächsten Abgleich hochgeladen werden.',
  laeuft: 'Der Abgleich läuft gerade.',
  offline: 'Keine Verbindung. Du kannst normal weiterarbeiten; abgeglichen wird, sobald das Netz zurück ist.',
  anmeldung:
    'Die Anmeldung bei Google ist abgelaufen. Tippe auf „Neu anmelden“. Bis dahin bleibt alles auf diesem Gerät gespeichert, es geht nichts verloren.',
};

let status: AbgleichStatus = { zustand: 'aus', meldung: MELDUNGEN.aus, letzterAbgleich: null, offen: 0 };
const hoerer = new Set<() => void>();

function setze(zustand: AbgleichZustand, meldung?: string, teil: Partial<AbgleichStatus> = {}): void {
  status = { ...status, ...teil, zustand, meldung: meldung ?? MELDUNGEN[zustand as keyof typeof MELDUNGEN] ?? '' };
  for (const h of hoerer) h();
}

export function useAbgleichStatus(): AbgleichStatus {
  return useSyncExternalStore(
    (h) => {
      hoerer.add(h);
      return () => hoerer.delete(h);
    },
    () => status,
  );
}

// ───────────────────────── Verbindung ─────────────────────────

export function istVerbunden(): boolean {
  try {
    return localStorage.getItem(VERBUNDEN) === '1';
  } catch {
    return false;
  }
}

function merkeVerbunden(verbunden: boolean): void {
  try {
    if (verbunden) localStorage.setItem(VERBUNDEN, '1');
    else localStorage.removeItem(VERBUNDEN);
  } catch {
    // ohne localStorage bleibt der Abgleich aus
  }
}

let drive: Drive = new GoogleDrive(gueltigesToken, verwirfToken);
let testbetrieb = false;

/**
 * Nur für die Entwicklung: tauscht Google Drive gegen ein simuliertes Drive im Arbeitsspeicher.
 * So lässt sich der ganze Ablauf im Browser ausprobieren, ohne Google-Konto.
 */
export function nutzeTestDrive(ersatz: Drive): void {
  drive = ersatz;
  testbetrieb = true;
}

export function istTestbetrieb(): boolean {
  return testbetrieb;
}

// ───────────────────────── Was sich der Abgleich merkt ─────────────────────────

let basis: Datenbestand | null = null;
let cache = new Map<string, CacheEintrag>();
let offeneIds = new Set<string>();
let bereit = false;

function meldeFehler(fehler: unknown): void {
  console.error('Abgleich-Daten konnten nicht gespeichert werden:', fehler);
}

const geraet: Geraet = {
  leseLokal: alsBestand,
  schreibeLokal: uebernimmAbgleich,
  leseBasis: () => basis,
  schreibeBasis: async (bestand) => {
    basis = bestand;
    await db.abgleich.put({ schluessel: 'basis', wert: bestand });
  },
  leseCache: () => cache,
  schreibeCache: async (neu) => {
    cache = neu;
    await db.abgleich.put({ schluessel: 'cache', wert: [...neu.values()] });
  },
};

async function vergissAbgleichDaten(): Promise<void> {
  basis = null;
  cache = new Map();
  offeneIds = new Set();
  await Promise.all([db.abgleich.bulkDelete(['basis', 'cache']), db.warteschlange.clear()]);
}

// ───────────────────────── Warteschlange ─────────────────────────

let geplant: ReturnType<typeof setTimeout> | null = null;
let letzteEingabe = 0;

function plane(ms: number, anlass: Anlass = 'aenderung'): void {
  if (geplant) clearTimeout(geplant);
  geplant = setTimeout(() => {
    geplant = null;
    void gleicheAb(anlass);
  }, ms);
}

/** Wird vom Speicher nach jeder Änderung durch den Nutzer aufgerufen. */
function trageEin(ids: string[]): void {
  if (!istVerbunden()) return;
  const stand = Date.now();
  for (const id of ids) offeneIds.add(id);
  db.warteschlange.bulkPut(ids.map((id) => ({ id, stand }))).catch(meldeFehler);
  if (status.zustand === 'abgeglichen' || status.zustand === 'ausstehend') {
    setze('ausstehend', undefined, { offen: offeneIds.size });
  } else {
    setze(status.zustand, status.meldung, { offen: offeneIds.size });
  }
  plane(NACH_AENDERUNG_MS);
}

// ───────────────────────── Eine Abgleich-Runde ─────────────────────────

type Anlass = 'start' | 'sichtbar' | 'online' | 'aenderung' | 'takt' | 'hand';

let laeuft = false;
let nochmal = false;

/** Ist Google gerade wirklich erreichbar? (Der Browser meldet „online“ auch in einem WLAN ohne Internet.) */
async function googleErreichbar(): Promise<boolean> {
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), 4000);
  try {
    // Die Antwort ist „nicht angemeldet“ – das genügt als Beweis, dass Google erreichbar ist.
    await fetch('https://www.googleapis.com/drive/v3/about?fields=kind', { signal: abbruch.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(uhr);
  }
}

/**
 * Kein gültiger Zugang: still erneuern, falls das gerade nicht stört.
 * Die Seite springt dafür kurz zu Google und zurück – das soll nicht mitten im Tippen passieren.
 */
async function erneuereAnmeldung(anlass: Anlass): Promise<void> {
  const anmeldung = anmeldeZustand();
  if (anmeldung.status === 'anmeldung-noetig' || !anmeldung.konto) {
    setze('anmeldung');
    return;
  }
  const ungestoert =
    anlass === 'start' || anlass === 'sichtbar' || anlass === 'hand' || Date.now() - letzteEingabe > RUHE_MS;
  if (!ungestoert || !stillesErneuernMoeglich()) {
    setze('ausstehend', 'Der Zugang zu Google wird bei nächster Gelegenheit erneuert. Deine Änderungen sind auf diesem Gerät gespeichert.');
    return;
  }
  if (await googleErreichbar()) starteWeiterleitung(true);
  else setze('offline');
}

export async function gleicheAb(anlass: Anlass = 'hand'): Promise<void> {
  if (!bereit || !istVerbunden()) return;
  if (laeuft) {
    nochmal = true;
    return;
  }
  if (!navigator.onLine) {
    setze('offline');
    return;
  }
  if (!testbetrieb && !gueltigesToken()) {
    await erneuereAnmeldung(anlass);
    return;
  }

  laeuft = true;
  setze('laeuft');
  const start = Date.now();
  try {
    await abgleiche(drive, geraet, () => jetztStempel());
    // Aus der Warteschlange streichen, was vor dieser Runde eingetragen wurde.
    await db.warteschlange.where('stand').below(start).delete();
    offeneIds = new Set((await db.warteschlange.toArray()).map((e) => e.id));
    setze(offeneIds.size > 0 ? 'ausstehend' : 'abgeglichen', undefined, {
      letzterAbgleich: Date.now(),
      offen: offeneIds.size,
    });
    db.abgleich.put({ schluessel: 'letzterAbgleich', wert: Date.now() }).catch(meldeFehler);
    if (offeneIds.size > 0) nochmal = true;
  } catch (fehler) {
    if (fehler instanceof KeineVerbindung) setze('offline');
    else if (fehler instanceof NichtAngemeldet) await erneuereAnmeldung(anlass);
    else if (fehler instanceof VersionsKonflikt) {
      setze('ausstehend', 'Google Drive wurde gleichzeitig von einem anderen Gerät geändert. Der Abgleich wird gleich wiederholt.');
      nochmal = true;
    } else {
      console.error('Abgleich fehlgeschlagen:', fehler);
      const text = fehler instanceof Error ? fehler.message : 'Unbekannter Fehler.';
      setze('fehler', `Der Abgleich hat nicht geklappt: ${text} Deine Daten auf diesem Gerät sind sicher; es wird später erneut versucht.`);
    }
  } finally {
    laeuft = false;
    if (nochmal) {
      nochmal = false;
      plane(NACH_AENDERUNG_MS);
    }
  }
}

// ───────────────────────── Starten ─────────────────────────

/** Einmal beim Start der App aufrufen (nachdem die lokalen Daten geladen sind). */
export async function starteAbgleichDienst(): Promise<void> {
  const [gemerkt, warteschlange] = await Promise.all([db.abgleich.toArray(), db.warteschlange.toArray()]);
  const wert = (schluessel: string) => gemerkt.find((e) => e.schluessel === schluessel)?.wert;
  basis = (wert('basis') as Datenbestand | undefined) ?? null;
  cache = new Map(((wert('cache') as CacheEintrag[] | undefined) ?? []).map((e) => [e.id, e]));
  offeneIds = new Set(warteschlange.map((e) => e.id));
  bereit = true;

  setzeAbgleichHaken(trageEin, () => {
    // Der ganze Bestand wurde ersetzt (z. B. Import): Der alte gemeinsame Stand gilt nicht mehr.
    // Ohne ihn wird beim nächsten Abgleich nur vereinigt und nichts als „gelöscht“ gedeutet.
    basis = null;
    db.abgleich.delete('basis').catch(meldeFehler);
    if (istVerbunden()) plane(NACH_AENDERUNG_MS);
  });

  window.addEventListener('keydown', () => (letzteEingabe = Date.now()), { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void gleicheAb('sichtbar');
  });
  window.addEventListener('online', () => void gleicheAb('online'));
  window.addEventListener('offline', () => {
    if (istVerbunden()) setze('offline');
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') void gleicheAb('takt');
  }, TAKT_MS);

  if (istVerbunden()) {
    setze(offeneIds.size > 0 ? 'ausstehend' : 'abgeglichen', undefined, {
      letzterAbgleich: (wert('letzterAbgleich') as number | undefined) ?? null,
      offen: offeneIds.size,
    });
    void gleicheAb('start');
  }
}

// ───────────────────────── Erstes Verbinden, Trennen, Neuaufbau ─────────────────────────

/** Wie viele Beispieldaten aus Phase 1 liegen auf diesem Gerät? */
export function zaehleBeispieldaten(): { listen: number; notizen: number } {
  const z = leseZustand();
  const gefunden = findeBeispieldaten(z.listen.values(), z.notizen.values());
  return { listen: gefunden.listenIds.length, notizen: gefunden.notizIds.length };
}

export interface Sicherung {
  zeit: number;
  zip: Uint8Array;
}

/**
 * Schaltet den Abgleich ein. Vorher wird der lokale Stand als ZIP gesichert (in der
 * Browser-Datenbank, herunterladbar in den Einstellungen).
 * Ist Drive leer, wird der lokale Stand hochgeladen; sonst wird zusammengeführt.
 */
export async function verbinde(beispieldatenLoeschen: boolean): Promise<void> {
  const sicherung: Sicherung = { zeit: Date.now(), zip: packe(zuDateien(alsBestand())) };
  await db.abgleich.put({ schluessel: 'sicherung', wert: sicherung });

  if (beispieldatenLoeschen) {
    const z = leseZustand();
    const gefunden = findeBeispieldaten(z.listen.values(), z.notizen.values());
    entferneEndgueltig(gefunden.notizIds, gefunden.listenIds);
  }

  await vergissAbgleichDaten();
  merkeVerbunden(true);
  setze('ausstehend', undefined, { offen: 0, letzterAbgleich: null });
  await gleicheAb('hand');
}

export async function leseSicherung(): Promise<Sicherung | null> {
  return ((await db.abgleich.get('sicherung'))?.wert as Sicherung | undefined) ?? null;
}

export function sicherungsName(sicherung: Sicherung): string {
  return `gedankenwelt-sicherung-vor-drive-${lokalesDatum(new Date(sicherung.zeit))}.zip`;
}

/** Trennt dieses Gerät von Drive. Die Daten bleiben auf dem Gerät und in Drive erhalten. */
export async function trenne(): Promise<void> {
  merkeVerbunden(false);
  abmelden();
  await vergissAbgleichDaten();
  setze('aus', undefined, { offen: 0, letzterAbgleich: null });
}

/**
 * „Lokale Daten neu aus Drive laden“: wirft den lokalen Speicher weg und baut ihn
 * komplett aus den Dateien in Drive neu auf.
 */
export async function ladeNeuAusDrive(): Promise<void> {
  if (!istVerbunden()) return;
  const einstellungen = leseZustand().einstellungen;
  await ersetzeAlles({
    listen: [eingangsListe()],
    notizen: [],
    einstellungen: { ...STANDARD_EINSTELLUNGEN, ...einstellungen },
    tagesgedanke_verlauf: [],
  });
  await vergissAbgleichDaten();
  setze('ausstehend', 'Die Daten werden neu aus Google Drive geladen.', { offen: 0 });
  await gleicheAb('hand');
}
