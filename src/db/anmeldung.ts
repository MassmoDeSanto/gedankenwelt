/**
 * Anmeldung bei Google – komplett im Browser, ohne eigenen Server.
 *
 * Google gibt einer reinen Browser-App nur einen kurzlebigen Zugangsschlüssel
 * („Access Token“, etwa 1 Stunde gültig) und nichts zum stillen Verlängern.
 * Darum gibt es zwei Wege, einen neuen Schlüssel zu holen:
 *
 *  Weg B (Standard): Weiterleitung. Die App springt kurz zu Google und zurück.
 *    Mit `still` zeigt Google dabei nichts an – das klappt, solange man im Browser
 *    bzw. in der installierten App noch bei Google angemeldet ist.
 *  Weg A (Rückfall): Pop-up über Googles eigene Bibliothek (Google Identity Services).
 *
 * Der Schlüssel und die E-Mail-Adresse des Kontos liegen nur auf diesem Gerät
 * (localStorage) und nie im Repository.
 */
import { useSyncExternalStore } from 'react';
import { DRIVE_SCOPE, GOOGLE_CLIENT_ID } from '../konfig';

const SCHLUESSEL = 'gedankenwelt.anmeldung';
const KONTO = 'gedankenwelt.konto';
const VORGANG = 'gedankenwelt.anmeldevorgang';
const STILL_GESCHEITERT = 'gedankenwelt.stillGescheitert';
const LETZTER_STILLER_VERSUCH = 'gedankenwelt.letzterStillerVersuch';

const GOOGLE_ANMELDUNG = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_BIBLIOTHEK = 'https://accounts.google.com/gsi/client';

interface Anmeldung {
  token: string;
  /** Zeitpunkt in Millisekunden, ab dem der Schlüssel nicht mehr gilt */
  laeuftAb: number;
  /** Berechtigungen, die Google für diesen Schlüssel erteilt hat (durch Leerzeichen getrennt) */
  scopes?: string;
}

interface Vorgang {
  /** Zufallswert, an dem die App erkennt, dass die Antwort zu ihrer eigenen Anfrage gehört */
  kennung: string;
  still: boolean;
  /** Wo in der App man vor der Weiterleitung war */
  route: string;
  zeit: number;
}

function lies<T>(schluessel: string): T | null {
  try {
    const wert = localStorage.getItem(schluessel);
    return wert ? (JSON.parse(wert) as T) : null;
  } catch {
    return null;
  }
}

function merke(schluessel: string, wert: unknown): void {
  try {
    if (wert === null) localStorage.removeItem(schluessel);
    else localStorage.setItem(schluessel, JSON.stringify(wert));
  } catch {
    // Speicher gesperrt: Die Anmeldung gilt dann nur, bis die Seite neu geladen wird.
  }
}

// ───────────────────────── Zustand, den die Oberfläche beobachten kann ─────────────────────────

const hoerer = new Set<() => void>();
let stand = 0;

function melde(): void {
  stand++;
  for (const h of hoerer) h();
}

/** Für React: zeichnet neu, sobald sich an der Anmeldung etwas ändert. */
export function useAnmeldung(): AnmeldeZustand {
  useSyncExternalStore(
    (h) => {
      hoerer.add(h);
      return () => hoerer.delete(h);
    },
    () => stand,
  );
  return anmeldeZustand();
}

export type AnmeldeStatus =
  /** In src/konfig.ts steht noch keine Client-ID. */
  | 'nicht-eingerichtet'
  /** Noch nie mit Google verbunden. */
  | 'nicht-verbunden'
  | 'angemeldet'
  /** Schlüssel abgelaufen, kann aber vermutlich still erneuert werden. */
  | 'abgelaufen'
  /** Stilles Erneuern hat nicht geklappt: Der Nutzer muss einmal tippen. */
  | 'anmeldung-noetig';

export interface AnmeldeZustand {
  status: AnmeldeStatus;
  konto: string | null;
  /** Bis wann der aktuelle Schlüssel gilt (Millisekunden), oder null */
  gueltigBis: number | null;
}

export function anmeldeZustand(): AnmeldeZustand {
  const konto = lies<string>(KONTO);
  const anmeldung = lies<Anmeldung>(SCHLUESSEL);
  let status: AnmeldeStatus;
  if (!GOOGLE_CLIENT_ID) status = 'nicht-eingerichtet';
  else if (anmeldung && anmeldung.laeuftAb > Date.now()) status = 'angemeldet';
  else if (!konto && !anmeldung) status = 'nicht-verbunden';
  else if (lies<number>(STILL_GESCHEITERT)) status = 'anmeldung-noetig';
  else status = 'abgelaufen';
  return { status, konto, gueltigBis: anmeldung?.laeuftAb ?? null };
}

/** Der Zugangsschlüssel, falls er noch mindestens eine Minute gilt. */
export function gueltigesToken(): string | null {
  const anmeldung = lies<Anmeldung>(SCHLUESSEL);
  return anmeldung && anmeldung.laeuftAb - 60_000 > Date.now() ? anmeldung.token : null;
}

/** Umfasst der aktuelle Zugang diese Berechtigung? (Auch nach Ablauf: Sie bleibt beim Erneuern erhalten.) */
export function hatBerechtigung(scope: string): boolean {
  return (lies<Anmeldung>(SCHLUESSEL)?.scopes ?? '').split(' ').includes(scope);
}

function uebernimmToken(token: string, sekunden: number, scopes: string | null): void {
  merke(SCHLUESSEL, { token, laeuftAb: Date.now() + sekunden * 1000, scopes: scopes ?? '' } satisfies Anmeldung);
  merke(STILL_GESCHEITERT, null);
  melde();
  void ladeKonto(token);
}

/** Fragt Drive, welches Konto verbunden ist – als Hinweis fürs nächste stille Erneuern. */
async function ladeKonto(token: string): Promise<void> {
  try {
    const antwort = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!antwort.ok) return;
    const daten = (await antwort.json()) as { user?: { emailAddress?: string } };
    if (daten.user?.emailAddress) {
      merke(KONTO, daten.user.emailAddress);
      melde();
    }
  } catch {
    // ohne Netz bleibt der Hinweis eben leer
  }
}

/** Was beim Erneuern wieder angefragt wird: Drive und alles, was schon erteilt wurde (z. B. Kalender). */
function erteilteBerechtigungen(): string[] {
  const erteilt = (lies<Anmeldung>(SCHLUESSEL)?.scopes ?? '').split(' ').filter((s) => s.startsWith('https://'));
  return [...new Set([DRIVE_SCOPE, ...erteilt])];
}

/** Der Schlüssel wurde von Google abgelehnt (z. B. Zugriff entzogen): wegwerfen. */
export function verwirfToken(): void {
  // Die Liste der Berechtigungen bleibt stehen, damit das Erneuern sie wieder anfragt.
  const bisher = lies<Anmeldung>(SCHLUESSEL);
  merke(SCHLUESSEL, bisher ? { token: '', laeuftAb: 0, scopes: bisher.scopes } : null);
  melde();
}

export function abmelden(): void {
  for (const s of [SCHLUESSEL, KONTO, VORGANG, STILL_GESCHEITERT, LETZTER_STILLER_VERSUCH]) merke(s, null);
  melde();
}

// ───────────────────────── Protokoll für die Testseite ─────────────────────────

const PROTOKOLL = 'gedankenwelt.anmeldeprotokoll';

export interface ProtokollEintrag {
  zeit: number;
  text: string;
}

/** Hält fest, was bei der Anmeldung passiert ist – übersteht auch die Weiterleitung zu Google. */
export function protokolliere(text: string): void {
  merke(PROTOKOLL, [...leseProtokoll(), { zeit: Date.now(), text }].slice(-14));
  melde();
}

export function leseProtokoll(): ProtokollEintrag[] {
  return lies<ProtokollEintrag[]>(PROTOKOLL) ?? [];
}

export function leereProtokoll(): void {
  merke(PROTOKOLL, null);
  melde();
}

// ───────────────────────── Weg B: Weiterleitung ─────────────────────────

/** Die Adresse der App ohne den Teil hinter „#“. Genau diese muss in der Google Cloud eingetragen sein. */
export function weiterleitungsAdresse(): string {
  return window.location.origin + window.location.pathname;
}

/**
 * Springt zu Google und kommt mit einem neuen Schlüssel zurück.
 * `still`: Google zeigt nichts an und antwortet sofort – oder meldet, dass eine Eingabe nötig wäre.
 * `scopes`: Berechtigungen. Spätere Phasen (Kalender) fragen hier einfach mehr an;
 * bereits erteilte bleiben dank „include_granted_scopes“ erhalten.
 */
export function starteWeiterleitung(still: boolean, scopes: string[] = erteilteBerechtigungen()): void {
  if (!GOOGLE_CLIENT_ID) return;
  protokolliere(still ? 'Stilles Erneuern gestartet (Weiterleitung) …' : 'Anmeldung gestartet (Weiterleitung) …');
  const kennung = crypto.randomUUID();
  merke(VORGANG, { kennung, still, route: window.location.hash, zeit: Date.now() } satisfies Vorgang);
  if (still) merke(LETZTER_STILLER_VERSUCH, Date.now());

  const parameter = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: weiterleitungsAdresse(),
    response_type: 'token',
    scope: scopes.join(' '),
    include_granted_scopes: 'true',
    state: kennung,
  });
  const konto = lies<string>(KONTO);
  if (konto) parameter.set('login_hint', konto);
  if (still) parameter.set('prompt', 'none');

  window.location.assign(`${GOOGLE_ANMELDUNG}?${parameter}`);
}

/** Darf jetzt still erneuert werden? Höchstens alle 5 Minuten und nur, wenn es zuletzt nicht gescheitert ist. */
export function stillesErneuernMoeglich(): boolean {
  if (!GOOGLE_CLIENT_ID || !navigator.onLine) return false;
  if (!lies<string>(KONTO) || lies<number>(STILL_GESCHEITERT)) return false;
  return Date.now() - (lies<number>(LETZTER_STILLER_VERSUCH) ?? 0) > 5 * 60_000;
}

export interface Rueckkehr {
  erfolg: boolean;
  still: boolean;
  /** Verständliche Meldung für die Testseite */
  meldung: string;
}

const FEHLERTEXTE: Record<string, string> = {
  interaction_required: 'Google braucht eine Eingabe von dir (stilles Erneuern nicht möglich).',
  login_required: 'Du bist in diesem Browser nicht mehr bei Google angemeldet.',
  consent_required: 'Google braucht noch einmal deine Zustimmung.',
  access_denied: 'Der Zugriff wurde abgelehnt.',
  account_selection_required: 'Google möchte, dass du ein Konto auswählst.',
};

/**
 * Beim Start der App aufrufen: Kommt die Seite gerade von Google zurück, steht die
 * Antwort hinter dem „#“ der Adresse. Sie wird ausgewertet und sofort aus der Adresse
 * entfernt, damit der Schlüssel nicht im Verlauf des Browsers stehen bleibt.
 */
export function verarbeiteRueckkehr(): Rueckkehr | null {
  const ergebnis = werteRueckkehrAus();
  if (ergebnis) protokolliere(ergebnis.meldung);
  return ergebnis;
}

function werteRueckkehrAus(): Rueckkehr | null {
  const roh = window.location.hash.slice(1);
  if (roh.startsWith('/') || !roh.includes('state=')) return null;
  const antwort = new URLSearchParams(roh);
  const vorgang = lies<Vorgang>(VORGANG);
  merke(VORGANG, null);

  // Adresse sofort säubern und dorthin zurück, wo man vorher war.
  const route = vorgang?.route?.startsWith('#/') ? vorgang.route : '#/';
  window.history.replaceState(null, '', window.location.pathname + window.location.search + route);

  if (!vorgang || antwort.get('state') !== vorgang.kennung) {
    return { erfolg: false, still: false, meldung: 'Die Antwort von Google passte zu keiner Anfrage dieser App und wurde verworfen.' };
  }

  const token = antwort.get('access_token');
  if (token) {
    uebernimmToken(token, Number(antwort.get('expires_in')) || 3600, antwort.get('scope'));
    return { erfolg: true, still: vorgang.still, meldung: vorgang.still ? 'Still erneuert – ohne Eingabe.' : 'Angemeldet.' };
  }

  const fehler = antwort.get('error') ?? 'unbekannt';
  if (vorgang.still) {
    merke(STILL_GESCHEITERT, Date.now());
    melde();
  }
  return { erfolg: false, still: vorgang.still, meldung: FEHLERTEXTE[fehler] ?? `Google meldet: ${fehler}` };
}

// ───────────────────────── Weg A: Pop-up (Google Identity Services) ─────────────────────────

interface TokenAntwort {
  access_token?: string;
  scope?: string;
  expires_in?: string | number;
  error?: string;
}

interface GoogleBibliothek {
  accounts: {
    oauth2: {
      initTokenClient(optionen: {
        client_id: string;
        scope: string;
        prompt?: string;
        login_hint?: string;
        include_granted_scopes?: boolean;
        callback: (antwort: TokenAntwort) => void;
        error_callback?: (fehler: { type: string; message?: string }) => void;
      }): { requestAccessToken(): void };
    };
  };
}

let bibliothek: Promise<GoogleBibliothek> | null = null;

/** Lädt Googles Anmelde-Bibliothek erst, wenn sie gebraucht wird (sie funktioniert nur mit Netz). */
function ladeBibliothek(): Promise<GoogleBibliothek> {
  bibliothek ??= new Promise((fertig, fehler) => {
    const skript = document.createElement('script');
    skript.src = GOOGLE_BIBLIOTHEK;
    skript.async = true;
    skript.onload = () => fertig((window as unknown as { google: GoogleBibliothek }).google);
    skript.onerror = () => {
      bibliothek = null;
      fehler(new Error('Googles Anmelde-Bibliothek konnte nicht geladen werden (kein Netz?).'));
    };
    document.head.append(skript);
  });
  return bibliothek;
}

/**
 * Meldet per Pop-up an. Muss direkt aus einem Klick oder Tipp heraus aufgerufen werden,
 * sonst blockiert der Browser das Fenster.
 */
export async function anmeldenPerPopup(scopes: string[] = erteilteBerechtigungen()): Promise<string> {
  if (!GOOGLE_CLIENT_ID) throw new Error('Es ist noch keine Client-ID eingetragen.');
  const google = await ladeBibliothek();
  return new Promise((fertig, fehler) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: scopes.join(' '),
      prompt: '',
      login_hint: lies<string>(KONTO) ?? undefined,
      include_granted_scopes: true,
      callback: (antwort) => {
        if (antwort.access_token) {
          uebernimmToken(antwort.access_token, Number(antwort.expires_in) || 3600, antwort.scope ?? null);
          fertig('Per Pop-up angemeldet.');
        } else {
          fehler(new Error(FEHLERTEXTE[antwort.error ?? ''] ?? `Google meldet: ${antwort.error ?? 'unbekannt'}`));
        }
      },
      error_callback: (f) =>
        fehler(
          new Error(
            f.type === 'popup_failed_to_open'
              ? 'Das Pop-up wurde blockiert oder ließ sich nicht öffnen.'
              : f.type === 'popup_closed'
                ? 'Das Pop-up wurde geschlossen, bevor die Anmeldung fertig war.'
                : `Pop-up-Fehler: ${f.type}`,
          ),
        ),
    });
    client.requestAccessToken();
  });
}
