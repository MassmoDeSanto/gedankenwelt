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

/** Priorität einer Aufgabe. Ohne Priorität steht `null` im Feld. */
export type Prioritaet = 'hoch' | 'mittel' | 'niedrig';

/** Stand einer offenen Aufgabe. „Erledigt“ ist kein Stand, sondern das abgehakte Kästchen. */
export type Stand = 'offen' | 'in_arbeit';

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
  /** null = keine Priorität */
  prioritaet: Prioritaet | null;
  stand: Stand;
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
  /** Nur bei importierten Notizen: zu welchem Import sie gehört (für „Rückgängig“). */
  import_id?: string;
  /**
   * Nur bei Notizen im Tagebuch: der Tag, zu dem sie gehört ("2026-11-16"). Kann vom
   * Erstelldatum abweichen (nachgetragen, oder nach Mitternacht vor dem Tageswechsel geschrieben).
   */
  tagebuch_tag?: string;
}

/** Bewertung eines Tagebuchtags: 1 schlecht, 2 durchwachsen, 3 okay, 4 gut, 5 sehr gut */
export type Bewertung = 1 | 2 | 3 | 4 | 5;

/** Was zu einem Tag im Tagebuch gehört, außer dem Text (KONZEPT.md, Abschnitt 13.1). Höchstens einer pro Datum. */
export interface Tagebuchtag {
  id: string;
  /** Ortsdatum "2026-11-16" */
  datum: string;
  /** Überschrift des Tages, leer = keine */
  titel: string;
  bewertung: Bewertung | null;
  /** Text des übernommenen Schreibimpulses (ab Etappe 3) */
  impuls: string | null;
  /** IDs der an diesem Tag abgehakten Gewohnheiten (ab Etappe 3) */
  gewohnheiten: string[];
  erstellt: Zeitstempel;
  geaendert: Zeitstempel;
  geloescht: Zeitstempel | null;
}

/** Eine Gewohnheit zum Abhaken im Tagebuch, z. B. „Sport“ (KONZEPT.md, Abschnitt 13.4). */
export interface Gewohnheit {
  id: string;
  name: string;
  /** Reihenfolge auf der Tagesseite */
  position: number;
  /** Inaktive erscheinen nicht mehr zum Abhaken; alte Häkchen bleiben erhalten. */
  aktiv: boolean;
  erstellt: Zeitstempel;
  geaendert: Zeitstempel;
  geloescht: Zeitstempel | null;
}

/** Eigene Liste der Schreibimpulse. Fehlt sie, gilt die eingebaute Liste. */
export interface Impulse {
  fragen: string[];
  geaendert: Zeitstempel;
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
  /** Nur bei Listen, die ein Import angelegt hat: zu welchem Import sie gehört. */
  import_id?: string;
}

/** Auf welchem Weg ein Import hereinkam (PHASE-4.md, Abschnitt 3). */
export type ImportWeg = 'kurzbefehl' | 'markdown' | 'text' | 'kombiniert' | 'gemischt';

/** Ein Eintrag im Import-Verlauf. Wandert über `_meta.json` auf alle Geräte. */
export interface ImportEintrag {
  /** Dieselbe ID tragen alle Listen und Notizen dieses Imports als `import_id`. */
  id: string;
  datum: Zeitstempel;
  weg: ImportWeg;
  dateien: number;
  listen: number;
  notizen: number;
  aufgaben: number;
  /** davon offen */
  offen: number;
  /** Inhalts-Fingerabdrücke der eingelesenen Dateien (gegen doppeltes Importieren) */
  fingerabdruecke: string[];
  /** null = gültig, sonst der Zeitpunkt, zu dem der Import rückgängig gemacht wurde */
  rueckgaengig: Zeitstempel | null;
}

/** Feste ID der Liste „Eingang“. Auf jedem Gerät gleich, damit der Abgleich später einfach bleibt. */
export const EINGANG_ID = '00000000000000000000000000';
export const EINGANG_NAME = 'Eingang';

/**
 * Feste ID der Liste „Tagebuch“ (KONZEPT.md, Abschnitt 13). Wie der Eingang auf jedem Gerät gleich,
 * nicht löschbar und nicht verschiebbar. Ihre Notizen stehen in Drive nicht in einer Listendatei,
 * sondern in Monatsdateien unter `_Tagebuch/`.
 */
export const TAGEBUCH_ID = '00000000000000000000000001';
export const TAGEBUCH_NAME = 'Tagebuch';

/** Listen, die die App selbst anlegt und die sich nicht löschen, verschieben oder umbenennen lassen. */
export function istSystemliste(id: string): boolean {
  return id === EINGANG_ID || id === TAGEBUCH_ID;
}

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
  /** Import-Verlauf. Fehlt, solange nie etwas importiert wurde. */
  importe?: ImportEintrag[];
  /** Überschriften und Bewertungen im Tagebuch. Fehlt, solange es keine gibt. */
  tagebuchtage?: Tagebuchtag[];
  /** Gewohnheiten im Tagebuch. Fehlt, solange es keine gibt. */
  gewohnheiten?: Gewohnheit[];
  /** Eigene Schreibimpulse. Fehlt = die eingebaute Liste. */
  impulse?: Impulse;
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
    prioritaet: null,
    stand: 'offen',
  };
}

/** Füllt bei Aufgaben aus älteren Versionen der App die später hinzugekommenen Felder auf. */
export function ergaenzeAufgabe(aufgabe: Aufgabe): Aufgabe {
  const alt = aufgabe as Partial<Aufgabe> & Aufgabe;
  if (
    typeof alt.erinnerung === 'number' &&
    Array.isArray(alt.erledigt_verlauf) &&
    alt.prioritaet !== undefined &&
    alt.stand !== undefined
  )
    return aufgabe;
  return {
    ...aufgabe,
    erinnerung: alt.erinnerung ?? 0,
    erledigt_verlauf: alt.erledigt_verlauf ?? [],
    prioritaet: alt.prioritaet ?? null,
    stand: alt.stand ?? 'offen',
  };
}

/**
 * Zeitstempel für automatisch Angelegtes. Weil er älter ist als jede echte Änderung, verdrängt
 * z. B. der leere Eingang eines neu eingerichteten Geräts nie den Eingang aus Google Drive.
 */
export const URZEIT: Zeitstempel = '1970-01-01T00:00:00Z';

export function tagebuchListe(jetzt: Zeitstempel = URZEIT): Liste {
  return {
    id: TAGEBUCH_ID,
    name: TAGEBUCH_NAME,
    eltern_id: null,
    angeheftet: false,
    // Für das Tagebuch ist der Gedanke des Tages aus (KONZEPT.md, Abschnitt 13.9).
    tagesgedanke: 'aus',
    position: -1,
    erstellt: jetzt,
    geaendert: jetzt,
    geloescht: null,
  };
}

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
