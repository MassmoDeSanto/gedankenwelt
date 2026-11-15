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

/** Wiederholung einer Aufgabe (wird erst in Phase 3 benutzt). */
export type Wiederholung =
  | { art: 'taeglich' }
  | { art: 'woechentlich'; wochentag: number } // 1 = Montag … 7 = Sonntag
  | { art: 'monatlich'; tag: number }; // 1 = „jeden Monatsersten“

export interface Aufgabe {
  erledigt: boolean;
  erledigt_am: Zeitstempel | null;
  faellig: Faelligkeit | null;
  wiederholung: Wiederholung | null;
  kalender_event_id: string | null;
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
  };
}

export function eingangsListe(jetzt: Zeitstempel): Liste {
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
