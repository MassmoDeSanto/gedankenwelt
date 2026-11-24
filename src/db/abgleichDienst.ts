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
import { abgleiche, type CacheEintrag, type Geraet, type GesicherteDatei } from '../logik/abgleich/runde';
import { FormatZuNeu } from '../logik/format';
import { gleicheKalenderAb, mitTerminId, schreibErinnerungTermin } from '../logik/kalender/abgleich';
import {
  KALENDER_NAME,
  KalenderFehlt,
  KeineKalenderBerechtigung,
  type Kalender,
  type TerminDaten,
} from '../logik/kalender/kalender';
import type { SimulierterKalender, SimulierterTermin } from '../logik/kalender/simulierterKalender';
import { zuDateien } from '../logik/markdown';
import { jetztStempel, lokalJetzt, lokalesDatum, verschiebeDatum } from '../logik/zeit';
import { packe } from '../logik/zip';
import { STANDARD_EINSTELLUNGEN, eingangsListe, type Datenbestand } from '../modell/typen';
import { APP_ADRESSE, DRIVE_SCOPE, KALENDER_SCOPE, ZEITZONE } from '../konfig';
import {
  abmelden,
  anmeldeZustand,
  gueltigesToken,
  hatBerechtigung,
  starteWeiterleitung,
  stillesErneuernMoeglich,
  verwirfToken,
} from './anmeldung';
import { findeBeispieldaten } from './beispieldaten';
import { db } from './db';
import { GoogleDrive } from './googleDrive';
import { GoogleKalender } from './googleKalender';
import {
  alsBestand,
  entferneEndgueltig,
  ersetzeAlles,
  leseZustand,
  setzeAbgleichHaken,
  sichereEinstellungen,
  sichereNotizen,
  sichereVorErsetzen,
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
  /** Wenn bei den Erinnerungen etwas nicht stimmt: Erklärung dazu, sonst null */
  kalenderHinweis: string | null;
  /** Wenn in Drive beschädigte Dateien gesichert und ersetzt wurden: Erklärung dazu, bis „Verstanden“ */
  driveHinweis: string | null;
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

let status: AbgleichStatus = {
  zustand: 'aus',
  meldung: MELDUNGEN.aus,
  letzterAbgleich: null,
  offen: 0,
  kalenderHinweis: null,
  driveHinweis: null,
};
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

// ───────────────────────── Kalender für die Erinnerungen ─────────────────────────

let kalender: Kalender = new GoogleKalender(gueltigesToken, verwirfToken, { zeitzone: ZEITZONE });
let simulierter: SimulierterKalender | null = null;

/**
 * Nur für die Entwicklung (`npm run dev`): tauscht den Google Kalender gegen einen simulierten.
 * In der veröffentlichten App wird diese Funktion nie aufgerufen.
 */
export function nutzeTestKalender(ersatz: SimulierterKalender): void {
  kalender = ersatz;
  simulierter = ersatz;
}

export function istKalenderSimuliert(): boolean {
  return simulierter !== null;
}

/** Was im simulierten Kalender steht – für die Entwickler-Ansicht in den Einstellungen. */
export function simulierteTermine(): SimulierterTermin[] | null {
  const id = leseZustand().einstellungen.kalender_id;
  return simulierter && id ? simulierter.alle(id) : null;
}

/** Sind die Erinnerungen eingeschaltet? (Die Einstellung wandert über Drive auf alle Geräte.) */
export function erinnerungenAktiv(): boolean {
  const e = leseZustand().einstellungen;
  return e.erinnerungen === true && !!e.kalender_id;
}

/** Lassen sich Erinnerungen auf diesem Gerät überhaupt nutzen? In der veröffentlichten App nur mit Google. */
export function erinnerungenVerfuegbar(): boolean {
  return istKalenderSimuliert() || istVerbunden();
}

/** Darf dieses Gerät gerade auf den Kalender zugreifen? */
function kalenderNutzbar(): boolean {
  return istKalenderSimuliert() || (istVerbunden() && hatBerechtigung(KALENDER_SCOPE));
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
  // Vorgemerkt wird nur, wenn es etwas abzugleichen gibt: Drive verbunden oder Erinnerungen aktiv.
  if (!istVerbunden() && !erinnerungenAktiv()) return;
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

/**
 * Richtet den Kalender nach den Aufgaben aus und trägt die Termin-IDs in die Notizen ein.
 * Gibt es den Kalender nicht mehr (z. B. im Google Kalender von Hand gelöscht), wird er neu angelegt.
 */
async function kalenderRunde(verwaisteAufraeumen = false): Promise<void> {
  for (let versuch = 1; ; versuch++) {
    const z = leseZustand();
    const kalenderId = z.einstellungen.kalender_id;
    if (!z.einstellungen.erinnerungen || !kalenderId) return;
    try {
      const ergebnis = await gleicheKalenderAb(kalender, kalenderId, [...z.notizen.values()], z.listen, {
        jetztLokal: lokalJetzt(),
        appAdresse: APP_ADRESSE,
        verwaisteAufraeumen,
        schreibErinnerung: z.schreiberinnerung?.an ? schreibErinnerungTermin(z.schreiberinnerung.uhrzeit, APP_ADRESSE) : null,
      });
      // Termin-IDs übernehmen – auf dem aktuellen Stand der Notiz, falls inzwischen getippt wurde.
      const geaendert = [...ergebnis.ids].flatMap(([id, terminId]) => {
        const notiz = leseZustand().notizen.get(id);
        return notiz?.aufgabe && notiz.aufgabe.kalender_event_id !== terminId ? [mitTerminId(notiz, terminId)] : [];
      });
      sichereNotizen(geaendert);
      return;
    } catch (fehler) {
      if (!(fehler instanceof KalenderFehlt) || versuch > 1) throw fehler;
      const neu = await kalender.erstelleKalender(KALENDER_NAME);
      sichereEinstellungen({ ...leseZustand().einstellungen, kalender_id: neu, geaendert: jetztStempel() });
    }
  }
}

export async function gleicheAb(anlass: Anlass = 'hand', kalenderAufraeumen = false): Promise<void> {
  if (!bereit) return;
  const mitDrive = istVerbunden();
  const mitKalender = erinnerungenAktiv() && kalenderNutzbar();
  if (!mitDrive && !mitKalender) return;
  if (laeuft) {
    nochmal = true;
    return;
  }
  // Ohne Drive (nur in der Entwicklung mit simuliertem Kalender) bleibt das Wolken-Symbol aus.
  const zeige: typeof setze = (...a) => (mitDrive ? setze(...a) : setze(status.zustand, status.meldung, a[2]));

  if (!navigator.onLine) {
    zeige('offline');
    return;
  }
  const brauchtGoogle = (mitDrive && !testbetrieb) || (mitKalender && !istKalenderSimuliert());
  if (brauchtGoogle && !gueltigesToken()) {
    await erneuereAnmeldung(anlass);
    return;
  }

  laeuft = true;
  zeige('laeuft');
  const start = Date.now();
  try {
    const drive_ = mitDrive ? await abgleiche(drive, geraet, () => jetztStempel()) : null;
    if (drive_?.gesichert.length) merkeDriveHinweis(driveHinweisText(drive_.gesichert));

    // Kalender: nur, wenn sich etwas getan haben kann (nicht bei jedem Takt ohne Änderung).
    let kalenderFertig = true;
    if (mitKalender && (anlass !== 'takt' || offeneIds.size > 0 || (drive_?.heruntergeladen ?? 0) > 0)) {
      kalenderFertig = await versucheKalender(kalenderAufraeumen);
    }

    // Aus der Warteschlange streichen, was vor dieser Runde eingetragen wurde – aber nur,
    // wenn auch der Kalender nachgezogen ist. Sonst wird es beim nächsten Mal nachgeholt.
    if (kalenderFertig) await db.warteschlange.where('stand').below(start).delete();
    offeneIds = new Set((await db.warteschlange.toArray()).map((e) => e.id));
    zeige(offeneIds.size > 0 ? 'ausstehend' : 'abgeglichen', undefined, {
      letzterAbgleich: Date.now(),
      offen: offeneIds.size,
    });
    db.abgleich.put({ schluessel: 'letzterAbgleich', wert: Date.now() }).catch(meldeFehler);
    // Die eingetragenen Termin-IDs sind neue Änderungen und müssen noch nach Drive.
    if (kalenderFertig && offeneIds.size > 0) nochmal = true;
  } catch (fehler) {
    if (fehler instanceof KeineVerbindung) zeige('offline');
    else if (fehler instanceof NichtAngemeldet) await erneuereAnmeldung(anlass);
    else if (fehler instanceof FormatZuNeu) zeige('fehler', `${fehler.message} Deine Daten auf diesem Gerät sind sicher.`);
    else if (fehler instanceof VersionsKonflikt) {
      zeige('ausstehend', 'Google Drive wurde gleichzeitig von einem anderen Gerät geändert. Der Abgleich wird gleich wiederholt.');
      nochmal = true;
    } else {
      console.error('Abgleich fehlgeschlagen:', fehler);
      const text = fehler instanceof Error ? fehler.message : 'Unbekannter Fehler.';
      zeige('fehler', `Der Abgleich hat nicht geklappt: ${text} Deine Daten auf diesem Gerät sind sicher; es wird später erneut versucht.`);
    }
  } finally {
    laeuft = false;
    if (nochmal) {
      nochmal = false;
      plane(NACH_AENDERUNG_MS);
    }
  }
}

/**
 * Kalender-Abgleich als Teil einer Runde. Ein Problem mit dem Kalender soll den Drive-Abgleich
 * nicht als gescheitert dastehen lassen: Es wird als Hinweis bei den Erinnerungen gezeigt.
 * Rückgabe: Ist der Kalender auf dem Stand der Aufgaben?
 */
async function versucheKalender(verwaisteAufraeumen: boolean): Promise<boolean> {
  try {
    await kalenderRunde(verwaisteAufraeumen);
    if (status.kalenderHinweis) setze(status.zustand, status.meldung, { kalenderHinweis: null });
    return true;
  } catch (fehler) {
    // Kein Netz oder abgelaufene Anmeldung betreffen die ganze Runde: nach oben weitergeben.
    if (fehler instanceof KeineVerbindung || fehler instanceof NichtAngemeldet) throw fehler;
    console.error('Kalender-Abgleich fehlgeschlagen:', fehler);
    const text = fehler instanceof Error ? fehler.message : 'Unbekannter Fehler.';
    setze(status.zustand, status.meldung, { kalenderHinweis: text });
    // Fehlt nur die Berechtigung auf diesem Gerät, bleibt die Warteschlange nicht ewig stehen.
    return fehler instanceof KeineKalenderBerechtigung;
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
      driveHinweis: (wert('driveHinweis') as string | undefined) ?? null,
    });
  }

  // Kommt die Seite gerade von Google zurück, weil „Erinnerungen aktivieren“ die Kalender-Berechtigung
  // angefragt hat? Dann dort weitermachen.
  if (liesMerker(VORHABEN_ERINNERUNGEN)) {
    setzeMerker(VORHABEN_ERINNERUNGEN, false);
    if (hatBerechtigung(KALENDER_SCOPE)) await aktiviereErinnerungen();
    else setze(status.zustand, status.meldung, { kalenderHinweis: 'Die Kalender-Berechtigung wurde nicht erteilt. Die Erinnerungen bleiben aus.' });
  }

  void gleicheAb('start');
}

// ───────────────────────── Hinweis auf beschädigte Dateien ─────────────────────────

function driveHinweisText(gesichert: GesicherteDatei[]): string {
  const teile = gesichert.map((g) => `„${g.pfad}“: ${g.grund} Kopie: „${g.kopie}“.`);
  return (
    `In Google Drive ${gesichert.length === 1 ? 'war eine Datei' : `waren ${gesichert.length} Dateien`} beschädigt. ${teile.join(' ')} ` +
    'Die App hat vorher eine Kopie im Drive-Ordner „Gedankenwelt“ angelegt und die Datei dann mit deinem Stand neu geschrieben. ' +
    'Es ist nichts gelöscht worden. Hattest du die Datei von Hand bearbeitet, findest du deine Änderung in der Kopie.'
  );
}

/** Merkt sich den Hinweis (auch über einen Neustart hinweg), bis er mit „Verstanden“ weggeklickt wird. */
function merkeDriveHinweis(text: string): void {
  const bisher = status.driveHinweis;
  const neu = bisher ? `${bisher}\n\n${text}` : text;
  setze(status.zustand, status.meldung, { driveHinweis: neu });
  db.abgleich.put({ schluessel: 'driveHinweis', wert: neu }).catch(meldeFehler);
}

export function verwerfeDriveHinweis(): void {
  setze(status.zustand, status.meldung, { driveHinweis: null });
  db.abgleich.delete('driveHinweis').catch(meldeFehler);
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
  // Ohne Internet bliebe die App bis zum nächsten Abgleich leer – dann lieber gar nicht erst anfangen.
  if (!navigator.onLine) {
    setze('offline', 'Ohne Internet kann nicht neu aus Drive geladen werden. Auf diesem Gerät wurde nichts verändert.');
    return;
  }
  try {
    await sichereVorErsetzen('vor „Neu aus Drive laden“');
  } catch (fehler) {
    setze('fehler', `Vor dem Neuladen konnte keine Sicherung angelegt werden, darum wurde nichts verändert. ${fehlertext(fehler)}`);
    return;
  }
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

// ───────────────────────── Erinnerungen ein- und ausschalten ─────────────────────────

const VORHABEN_ERINNERUNGEN = 'gedankenwelt.erinnerungen.vorhaben';

function liesMerker(schluessel: string): boolean {
  try {
    return localStorage.getItem(schluessel) === '1';
  } catch {
    return false;
  }
}

function setzeMerker(schluessel: string, an: boolean): void {
  try {
    if (an) localStorage.setItem(schluessel, '1');
    else localStorage.removeItem(schluessel);
  } catch {
    // ohne localStorage geht es eben ohne Merker
  }
}

function fehlertext(fehler: unknown): string {
  return fehler instanceof Error ? fehler.message : 'Unbekannter Fehler.';
}

/** Findet den Kalender „Gedankenwelt“ über die gemerkte ID wieder oder legt ihn neu an. */
async function sichereKalender(): Promise<{ id: string; neu: boolean }> {
  const bekannt = leseZustand().einstellungen.kalender_id;
  if (bekannt && (await kalender.kalenderVorhanden(bekannt))) return { id: bekannt, neu: false };
  const id = await kalender.erstelleKalender(KALENDER_NAME);
  sichereEinstellungen({ ...leseZustand().einstellungen, kalender_id: id, geaendert: jetztStempel() });
  return { id, neu: true };
}

/**
 * „Erinnerungen aktivieren“: fragt – erst jetzt – die Kalender-Berechtigung an, legt den Kalender
 * „Gedankenwelt“ an und trägt alle offenen Aufgaben mit Uhrzeit nach.
 * Rückgabe: null bei Erfolg (oder wenn die Seite zu Google springt), sonst eine Fehlermeldung.
 */
export async function aktiviereErinnerungen(): Promise<string | null> {
  if (!erinnerungenVerfuegbar()) return 'Erinnerungen sind verfügbar, sobald Google verbunden ist.';
  if (!istKalenderSimuliert() && !hatBerechtigung(KALENDER_SCOPE)) {
    // Schrittweise Berechtigung: Drive bleibt, der Kalender kommt dazu. Die Seite springt zu Google
    // und macht nach der Rückkehr hier weiter (siehe starteAbgleichDienst).
    setzeMerker(VORHABEN_ERINNERUNGEN, true);
    starteWeiterleitung(false, [DRIVE_SCOPE, KALENDER_SCOPE]);
    return null;
  }
  try {
    const { id } = await sichereKalender();
    sichereEinstellungen({ ...leseZustand().einstellungen, erinnerungen: true, kalender_id: id, geaendert: jetztStempel() });
    setze(status.zustand, status.meldung, { kalenderHinweis: null });
    await gleicheAb('hand');
    return null;
  } catch (fehler) {
    return `Die Erinnerungen ließen sich nicht aktivieren: ${fehlertext(fehler)}`;
  }
}

/**
 * Schaltet die Erinnerungen aus. Auf Wunsch wird der Kalender „Gedankenwelt“ samt Terminen gelöscht;
 * sonst bleibt er mit den bisherigen Terminen stehen und wird nur nicht mehr gepflegt.
 */
export async function deaktiviereErinnerungen(kalenderLoeschen: boolean): Promise<string | null> {
  const e = leseZustand().einstellungen;
  try {
    if (kalenderLoeschen && e.kalender_id) await kalender.loescheKalender(e.kalender_id);
  } catch (fehler) {
    return `Der Kalender ließ sich nicht löschen: ${fehlertext(fehler)}`;
  }
  if (kalenderLoeschen) {
    // Die Termine gibt es nicht mehr: ihre IDs aus den Notizen nehmen.
    const mitTermin = [...leseZustand().notizen.values()].filter((n) => n.aufgabe?.kalender_event_id);
    sichereNotizen(mitTermin.map((n) => mitTerminId(n, null)));
  }
  sichereEinstellungen({
    ...e,
    erinnerungen: false,
    // „undefined“ statt null: Der Eintrag verschwindet dann ganz aus der Meta-Datei.
    kalender_id: kalenderLoeschen ? undefined : e.kalender_id,
    geaendert: jetztStempel(),
  });
  setze(status.zustand, status.meldung, { kalenderHinweis: null });
  void gleicheAb('hand');
  return null;
}

/** „Erinnerungen neu aufbauen“: gleicht alle offenen Aufgaben mit dem Kalender ab und räumt verwaiste Termine auf. */
export async function baueErinnerungenNeuAuf(): Promise<string> {
  if (!erinnerungenAktiv()) return 'Die Erinnerungen sind nicht aktiviert.';
  if (!kalenderNutzbar()) return 'Auf diesem Gerät fehlt die Kalender-Berechtigung. Aktiviere die Erinnerungen hier erneut.';
  try {
    await sichereKalender();
    await kalenderRunde(true);
    setze(status.zustand, status.meldung, { kalenderHinweis: null });
    void gleicheAb('hand');
    const offen = [...leseZustand().notizen.values()].filter((n) => n.aufgabe?.kalender_event_id && !n.geloescht).length;
    return `Fertig. Im Kalender ${offen === 1 ? 'steht 1 Termin' : `stehen ${offen} Termine`} für deine offenen Aufgaben mit Uhrzeit.`;
  } catch (fehler) {
    return `Das hat nicht geklappt: ${fehlertext(fehler)}`;
  }
}

/**
 * Kalender-Selbsttest (Einstellungen → Diagnose): legt den Kalender an (falls nötig), erstellt
 * einen Testtermin, ändert ihn, prüft ihn und löscht ihn wieder. Jeder Schritt wird gemeldet.
 */
export async function kalenderSelbsttest(melde: (zeile: string) => void): Promise<boolean> {
  let schritt = 'Vorbereitung';
  try {
    if (!istKalenderSimuliert()) {
      if (!istVerbunden()) {
        melde('Nicht möglich: Google ist auf diesem Gerät noch nicht verbunden.');
        return false;
      }
      if (!hatBerechtigung(KALENDER_SCOPE)) {
        melde('Nicht möglich: Die Kalender-Berechtigung fehlt noch. Tippe zuerst auf „Erinnerungen aktivieren“.');
        return false;
      }
    } else {
      melde('Hinweis: Dieser Test läuft gegen den simulierten Kalender, nicht gegen Google.');
    }

    schritt = 'Kalender finden oder anlegen';
    const { id, neu } = await sichereKalender();
    melde(neu ? '1. Der Kalender „Gedankenwelt“ wurde neu angelegt.' : '1. Der Kalender „Gedankenwelt“ wurde gefunden.');

    const morgen = verschiebeDatum(lokalesDatum(), 1);
    const daten: TerminDaten = {
      notiz_id: 'selbsttest',
      titel: 'Gedankenwelt – Selbsttest',
      beginn: `${morgen}T12:00`,
      erinnerung: 15,
      beschreibung: 'Dieser Termin gehört zum Kalender-Selbsttest der App und wird gleich wieder gelöscht.',
    };

    schritt = 'Testtermin anlegen';
    const termin = await kalender.erstelleTermin(id, daten);
    melde('2. Ein Testtermin für morgen 12:00 wurde angelegt.');

    schritt = 'Testtermin ändern';
    await kalender.aendereTermin(id, termin.id, { ...daten, beginn: `${morgen}T12:30`, erinnerung: 30 });
    melde('3. Der Testtermin wurde auf 12:30 verschoben, die Erinnerung auf 30 Minuten vorher gestellt.');

    schritt = 'Testtermin wiederfinden';
    const gefunden = (await kalender.termine(id)).find((t) => t.id === termin.id);
    if (!gefunden) throw new Error('Der Testtermin wurde im Kalender nicht wiedergefunden.');
    if (gefunden.beginn !== `${morgen}T12:30` || gefunden.erinnerung !== 30) {
      throw new Error(`Der Kalender zeigt ${gefunden.beginn} mit Erinnerung ${gefunden.erinnerung} statt ${morgen}T12:30 mit 30.`);
    }
    melde('4. Der Testtermin wurde im Kalender wiedergefunden. Uhrzeit und Erinnerung stimmen.');

    schritt = 'Testtermin löschen';
    await kalender.loescheTermin(id, termin.id);
    melde('5. Der Testtermin wurde wieder gelöscht.');

    melde('Alles in Ordnung: Die App kann den Kalender anlegen und Termine erstellen, ändern und löschen.');
    return true;
  } catch (fehler) {
    melde(`Fehlgeschlagen beim Schritt „${schritt}“: ${fehlertext(fehler)}`);
    return false;
  }
}
