/**
 * Die Schnittstelle zu Google Drive – nur das, was der Abgleich braucht.
 *
 * Es gibt zwei Umsetzungen: das echte Google Drive (src/db/googleDrive.ts) und
 * ein simuliertes Drive im Arbeitsspeicher für die Tests (simuliertesDrive.ts).
 */
import type { Zeitstempel } from '../../modell/typen';

/** Eine Datei oder ein Ordner in Drive. */
export interface DriveEintrag {
  /** ID in Drive (hat nichts mit den IDs der Notizen zu tun) */
  id: string;
  name: string;
  /** ID des Ordners, in dem der Eintrag liegt */
  eltern: string;
  ordner: boolean;
  /** Ändert sich bei jeder Änderung an Inhalt, Name oder Ort. Daran erkennt die App, ob sie neu laden muss. */
  version: string;
  geaendert: Zeitstempel;
}

export interface Drive {
  /** ID des Ordners „Gedankenwelt“. Wird angelegt, wenn es ihn noch nicht gibt. */
  wurzel(): Promise<string>;
  /** Alle Dateien und Ordner unterhalb des Ordners (beliebig tief), ohne Papierkorb. */
  liste(wurzelId: string): Promise<DriveEintrag[]>;
  lese(id: string): Promise<string>;
  erstelleOrdner(name: string, eltern: string): Promise<DriveEintrag>;
  erstelleDatei(name: string, eltern: string, inhalt: string): Promise<DriveEintrag>;
  /**
   * Überschreibt den Inhalt – aber nur, wenn die Datei noch die erwartete Version hat.
   * Sonst hat inzwischen jemand anderes geschrieben: `VersionsKonflikt`.
   */
  schreibe(id: string, inhalt: string, erwarteteVersion: string): Promise<DriveEintrag>;
  /** Umbenennen und/oder in einen anderen Ordner verschieben. Die Datei bleibt dieselbe. */
  aendere(id: string, neu: { name?: string; eltern?: string }): Promise<DriveEintrag>;
  /** In den Papierkorb von Google Drive legen (dort 30 Tage wiederherstellbar). */
  loesche(id: string): Promise<void>;
}

/** Die Datei wurde seit dem letzten Laden von woanders geändert. Der Abgleich beginnt dann von vorn. */
export class VersionsKonflikt extends Error {
  constructor(name: string) {
    super(`„${name}“ wurde inzwischen in Drive geändert.`);
    this.name = 'VersionsKonflikt';
  }
}

/** Die Anmeldung bei Google fehlt oder ist abgelaufen. */
export class NichtAngemeldet extends Error {
  constructor() {
    super('Die Anmeldung bei Google ist abgelaufen.');
    this.name = 'NichtAngemeldet';
  }
}

/** Keine Verbindung zum Internet. */
export class KeineVerbindung extends Error {
  constructor() {
    super('Keine Verbindung zum Internet.');
    this.name = 'KeineVerbindung';
  }
}
