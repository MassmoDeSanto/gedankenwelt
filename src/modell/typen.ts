/**
 * Datenmodell der App (siehe KONZEPT.md, Abschnitt 2).
 *
 * Felder für spätere Phasen (wiederholung, kalender_event_id, verweise)
 * sind schon vorhanden, bleiben in Phase 1 aber leer.
 */

/** Zeitpunkt in Weltzeit (UTC), sekundengenau, z. B. "2026-11-15T09:12:33Z". */
export type Zeitstempel = string;

/**
 * Fälligkeit einer Aufgabe in Ortszeit:
 * nur Datum "2026-11-20" oder Datum mit Uhrzeit "2026-11-20T18:00".
 */
export type Faelligkeit = string;

export type Wochentag = 'MO' | 'DI' | 'MI' | 'DO' | 'FR' | 'SA' | 'SO';

/** Wann eine Wiederholung aufhört. Bei „anzahl“ steht, wie oft die Aufgabe noch fällig wird. */
export type WiederholungsEnde =
  | { art: 'nie' }
  | { art: 'datum'; datum: string }
  | { art: 'anzahl'; anzahl: number };

/**
 * Wiederholung einer Aufgabe (PHASE-3.md, Abschnitt 2). Die Rechenregeln dazu stehen in
 * src/logik/wiederholung.ts.
 */
export type Wiederholung = {
  /** alle n Tage / Wochen / Monate / Jahre (mindestens 1) */
  intervall: number;
  /**
   * „faellig“: Die nächste Fälligkeit folgt dem Kalender („jeden Montag“).
   * „erledigung“: Sie zählt ab dem Abhaken („3 Tage nach dem letzten Mal“).
   */
  ab: 'faellig' | 'erledigung';
  ende: WiederholungsEnde;
} & (
  | { art: 'taeglich' }
  /** an diesen Wochentagen; leer = am Wochentag der Fälligkeit */
  | { art: 'woechentlich'; tage: Wochentag[] }
  /** am `tag`. des Monats; gibt es ihn nicht (31. im Februar), gilt der letzte Tag des Monats */
  | { art: 'monatlich'; tag: number }
  /** am `woche`. Wochentag des Monats: 1–4, oder −1 für den letzten (z. B. letzter Freitag) */
  | { art: 'monatlich-wochentag'; woche: number; wochentag: Wochentag }
  | { art: 'jaehrlich'; monat: number; tag: number }
);

export interface Aufgabe {
  erledigt: boolean;
  erledigt_am: Zeitstempel | null;
  faellig: Faelligkeit | null;
  wiederholung: Wiederholung | null;
  /** ID des zugehörigen Termins im Google Kalender (nur bei Aufgaben mit Uhrzeit) */
  kalender_event_id: string | null;
  /** Erinnerung so viele Minuten vor der Fälligkeit (0 = zur Uhrzeit). Wirkt nur mit Uhrzeit. */
  erinnerung: number;
  /** Wann eine wiederkehrende Aufgabe abgehakt wurde (die neuesten Zeitpunkte) */
  erledigt_verlauf: Zeitstempel[];
}

/** Die kleinste Einheit: ein Textblock. */
export interface Notiz {
  id: string;
  /** Inhalt ohne Aufgaben-Kästchen. Enthält nie eine Leerzeile. */
  text: string;
  liste_id: string;
  /** Reihenfolge in der Liste. Kommazahlen sind erlaubt (Einfügen zwischen zwei Notizen). */
  position: number;
  /** Tags ohne „#“, klein geschrieben. Werden immer aus dem Text abgeleitet. */
  tags: string[];
  erstellt: Zeitstempel;
  geaendert: Zeitstempel;
  aufgabe: Aufgabe | null;
  /** null = aktiv, sonst Zeitpunkt des Löschens (Papierkorb). */
  geloescht: Zeitstempel | null;
  /** Für später: IDs verlinkter Notizen. */
  verweise: string[];
}

export type TagesgedankeSchalter = 'an' | 'aus' | 'erben';

export interface Liste {
  id: string;
  name: string;
  eltern_id: string | null;
  angeheftet: boolean;
  tagesgedanke: TagesgedankeSchalter;
  position: number;
  erstellt: Zeitstempel;
  geaendert: Zeitstempel;
  geloescht: Zeitstempel | null;
}

/** Feste ID der Liste „Eingang“. Auf jedem Gerät gleich, damit der Abgleich später einfach bleibt. */
export const EINGANG_ID = '00000000000000000000000000';
export const EINGANG_NAME = 'Eingang';

export interface Einstellungen {
  thema: 'dunkel' | 'hell';
  /** Wann die Einstellungen zuletzt geändert wurden (für den Abgleich: die neuere Fassung gewinnt). */
  geaendert?: Zeitstempel;
  /** Sind die Erinnerungen über den Google Kalender eingeschaltet? */
  erinnerungen?: boolean;
  /** ID des Kalenders „Gedankenwelt“ im Google Kalender */
  kalender_id?: string | null;
}

/** Welche Notiz an welchem Kalendertag „Gedanke des Tages“ war. */
export interface VerlaufEintrag {
  /** Ortsdatum "2026-11-15" */
  datum: string;
  notiz_id: string;
}

/** Alles, was die App speichert. Lässt sich vollständig in Markdown-Dateien umwandeln und zurück. */
export interface Datenbestand {
  listen: Liste[];
  notizen: Notiz[];
  einstellungen: Einstellungen;
  tagesgedanke_verlauf: VerlaufEintrag[];
}

export const STANDARD_EINSTELLUNGEN: Einstellungen = { thema: 'dunkel' };

export function neueAufgabe(erledigt = false, erledigt_am: Zeitstempel | null = null): Aufgabe {
  return {
    erledigt,
    erledigt_am: erledigt ? erledigt_am : null,
    faellig: null,
    wiederholung: null,
    kalender_event_id: null,
    erinnerung: 0,
    erledigt_verlauf: [],
  };
}

/** Füllt bei Aufgaben aus älteren Versionen der App die später hinzugekommenen Felder auf. */
export function ergaenzeAufgabe(aufgabe: Aufgabe): Aufgabe {
  const alt = aufgabe as Partial<Aufgabe> & Aufgabe;
  if (typeof alt.erinnerung === 'number' && Array.isArray(alt.erledigt_verlauf)) return aufgabe;
  return { ...aufgabe, erinnerung: alt.erinnerung ?? 0, erledigt_verlauf: alt.erledigt_verlauf ?? [] };
}

/**
 * Zeitstempel für automatisch Angelegtes. Weil er älter ist als jede echte Änderung, verdrängt
 * z. B. der leere Eingang eines neu eingerichteten Geräts nie den Eingang aus Google Drive.
 */
export const URZEIT: Zeitstempel = '1970-01-01T00:00:00Z';

export function eingangsListe(jetzt: Zeitstempel = URZEIT): Liste {
  return {
    id: EINGANG_ID,
    name: EINGANG_NAME,
    eltern_id: null,
    angeheftet: false,
    tagesgedanke: 'erben',
    position: 0,
    erstellt: jetzt,
    geaendert: jetzt,
    geloescht: null,
  };
}
