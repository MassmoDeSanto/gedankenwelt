/**
 * Die Schnittstelle zum Kalender – nur das, was die Erinnerungen brauchen.
 *
 * Es gibt zwei Umsetzungen: den echten Google Kalender (src/db/googleKalender.ts) und einen
 * simulierten Kalender für Entwicklung und Tests (simulierterKalender.ts).
 *
 * Die App verwaltet ausschließlich ihren eigenen Kalender „Gedankenwelt“ und darin nur
 * Termine, die sie selbst angelegt hat (erkennbar an der Notiz-ID in einer privaten Eigenschaft).
 */

/** Was ein Termin enthält. Zeiten sind Ortszeit (Europe/Berlin), z. B. "2026-11-22T18:00". */
export interface TerminDaten {
  /** ID der Notiz, zu der der Termin gehört */
  notiz_id: string;
  titel: string;
  beginn: string;
  /** Benachrichtigung so viele Minuten vor Beginn (0 = zum Beginn) */
  erinnerung: number;
  beschreibung: string;
  /** Wiederholt sich täglich ab `beginn` (nur die Schreib-Erinnerung des Tagebuchs) */
  taeglich?: boolean;
}

export interface Termin extends TerminDaten {
  /** ID des Termins im Kalender */
  id: string;
}

export interface Kalender {
  /** Gibt es den Kalender mit dieser ID (noch)? */
  kalenderVorhanden(kalenderId: string): Promise<boolean>;
  /** Legt einen neuen Kalender an und gibt seine ID zurück. */
  erstelleKalender(name: string): Promise<string>;
  /** Löscht den Kalender samt allen Terminen darin. */
  loescheKalender(kalenderId: string): Promise<void>;
  /** Alle Termine, die die App angelegt hat. Von Hand eingetragene Termine tauchen hier nicht auf. */
  termine(kalenderId: string): Promise<Termin[]>;
  erstelleTermin(kalenderId: string, daten: TerminDaten): Promise<Termin>;
  aendereTermin(kalenderId: string, id: string, daten: TerminDaten): Promise<Termin>;
  loescheTermin(kalenderId: string, id: string): Promise<void>;
}

export const KALENDER_NAME = 'Gedankenwelt';
export const TERMIN_DAUER_MINUTEN = 15;

/** Den Kalender gibt es nicht (mehr) – z. B. im Google Kalender von Hand gelöscht. */
export class KalenderFehlt extends Error {
  constructor() {
    super('Der Kalender „Gedankenwelt“ wurde nicht gefunden.');
    this.name = 'KalenderFehlt';
  }
}

/** Den Termin gibt es nicht (mehr). Der Abgleich legt ihn dann neu an. */
export class TerminFehlt extends Error {
  constructor() {
    super('Der Termin wurde im Kalender nicht gefunden.');
    this.name = 'TerminFehlt';
  }
}

/** Die App darf (noch) nicht auf den Kalender zugreifen. */
export class KeineKalenderBerechtigung extends Error {
  constructor() {
    super('Die Berechtigung für den Kalender fehlt. Aktiviere die Erinnerungen in den Einstellungen erneut.');
    this.name = 'KeineKalenderBerechtigung';
  }
}

/** Ein anderer Fehler, den der Kalender gemeldet hat – mit Erklärung auf Deutsch. */
export class KalenderFehler extends Error {
  constructor(
    public status: number,
    meldung: string,
  ) {
    super(meldung);
    this.name = 'KalenderFehler';
  }
}
