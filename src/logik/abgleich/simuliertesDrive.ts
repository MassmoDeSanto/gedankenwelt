/**
 * Ein Google Drive zum Testen: lebt nur im Arbeitsspeicher, braucht kein Konto
 * und kein Netz. Es kann auf Wunsch mitten im Schreiben „abbrechen“, damit die
 * Tests prüfen können, ob der Abgleich danach sauber weitermacht.
 */
import type { Zeitstempel } from '../../modell/typen';
import { KeineVerbindung, VersionsKonflikt, type Drive, type DriveEintrag } from './drive';

interface Knoten extends DriveEintrag {
  inhalt: string;
}

export class SimuliertesDrive implements Drive {
  private knoten = new Map<string, Knoten>();
  private zaehler = 0;
  private wurzelId: string | null = null;

  /** Uhrzeit, die das Drive für Änderungen einträgt (Tests stellen sie selbst). */
  uhr: Zeitstempel = '2026-11-15T12:00:00Z';
  /** Nach so vielen weiteren Schreibvorgängen bricht die Verbindung ab. null = nie. */
  abbruchNach: number | null = null;
  /** Wird vor jedem Schreibvorgang aufgerufen – für Tests, die „währenddessen“ etwas ändern wollen. */
  vorSchreiben: (() => void) | null = null;
  /** Zählt Schreibvorgänge (anlegen, schreiben, umbenennen, verschieben, löschen). */
  schreibvorgaenge = 0;

  private neu(name: string, eltern: string, ordner: boolean, inhalt: string): Knoten {
    const knoten: Knoten = {
      id: `drive-${++this.zaehler}`,
      name,
      eltern,
      ordner,
      version: '1',
      geaendert: this.uhr,
      inhalt,
    };
    this.knoten.set(knoten.id, knoten);
    return knoten;
  }

  private schreibend(): void {
    const haken = this.vorSchreiben;
    if (haken) {
      this.vorSchreiben = null; // nur einmal, sonst ruft sich der Haken selbst wieder auf
      haken();
    }
    if (this.abbruchNach !== null) {
      if (this.abbruchNach <= 0) throw new KeineVerbindung();
      this.abbruchNach--;
    }
    this.schreibvorgaenge++;
  }

  private hole(id: string): Knoten {
    const knoten = this.knoten.get(id);
    if (!knoten) throw new Error(`Drive: Eintrag ${id} gibt es nicht.`);
    return knoten;
  }

  private geaendert(knoten: Knoten): DriveEintrag {
    knoten.version = String(Number(knoten.version) + 1);
    knoten.geaendert = this.uhr;
    return this.ohneInhalt(knoten);
  }

  private ohneInhalt(k: Knoten): DriveEintrag {
    return { id: k.id, name: k.name, eltern: k.eltern, ordner: k.ordner, version: k.version, geaendert: k.geaendert };
  }

  // ── Schnittstelle „Drive“ ──

  async wurzel(): Promise<string> {
    if (!this.wurzelId) this.wurzelId = this.neu('Gedankenwelt', 'mein-drive', true, '').id;
    return this.wurzelId;
  }

  async liste(wurzelId: string): Promise<DriveEintrag[]> {
    const darunter = (k: Knoten): boolean => {
      let aktuell: Knoten | undefined = k;
      while (aktuell) {
        if (aktuell.eltern === wurzelId) return true;
        aktuell = this.knoten.get(aktuell.eltern);
      }
      return false;
    };
    return [...this.knoten.values()].filter(darunter).map((k) => this.ohneInhalt(k));
  }

  async lese(id: string): Promise<string> {
    return this.hole(id).inhalt;
  }

  async erstelleOrdner(name: string, eltern: string): Promise<DriveEintrag> {
    this.schreibend();
    return this.ohneInhalt(this.neu(name, eltern, true, ''));
  }

  async erstelleDatei(name: string, eltern: string, inhalt: string): Promise<DriveEintrag> {
    this.schreibend();
    return this.ohneInhalt(this.neu(name, eltern, false, inhalt));
  }

  async schreibe(id: string, inhalt: string, erwarteteVersion: string): Promise<DriveEintrag> {
    this.schreibend();
    const knoten = this.hole(id);
    if (knoten.version !== erwarteteVersion) throw new VersionsKonflikt(knoten.name);
    knoten.inhalt = inhalt;
    return this.geaendert(knoten);
  }

  async aendere(id: string, neu: { name?: string; eltern?: string }): Promise<DriveEintrag> {
    this.schreibend();
    const knoten = this.hole(id);
    if (neu.name !== undefined) knoten.name = neu.name;
    if (neu.eltern !== undefined) knoten.eltern = neu.eltern;
    return this.geaendert(knoten);
  }

  async loesche(id: string): Promise<void> {
    this.schreibend();
    // samt allem, was darin liegt
    const weg = new Set([id]);
    let gewachsen = true;
    while (gewachsen) {
      gewachsen = false;
      for (const k of this.knoten.values()) {
        if (weg.has(k.eltern) && !weg.has(k.id)) {
          weg.add(k.id);
          gewachsen = true;
        }
      }
    }
    for (const eintrag of weg) this.knoten.delete(eintrag);
  }

  // ── Helfer nur für Tests ──

  private pfadVon(k: Knoten): string {
    const teile = [k.name];
    let eltern = this.knoten.get(k.eltern);
    while (eltern && eltern.id !== this.wurzelId) {
      teile.unshift(eltern.name);
      eltern = this.knoten.get(eltern.eltern);
    }
    return teile.join('/');
  }

  /** Alle Dateien als Pfad → Inhalt (so, wie man sie im Ordner „Gedankenwelt“ sähe). */
  dateien(): Map<string, string> {
    const ergebnis = new Map<string, string>();
    for (const k of this.knoten.values()) if (!k.ordner) ergebnis.set(this.pfadVon(k), k.inhalt);
    return ergebnis;
  }

  pfade(): string[] {
    return [...this.knoten.values()]
      .filter((k) => !k.ordner)
      .map((k) => this.pfadVon(k))
      .sort();
  }

  ordner(): string[] {
    return [...this.knoten.values()]
      .filter((k) => k.ordner && k.id !== this.wurzelId)
      .map((k) => this.pfadVon(k))
      .sort();
  }

  private finde(pfad: string): Knoten {
    const knoten = [...this.knoten.values()].find((k) => !k.ordner && this.pfadVon(k) === pfad);
    if (!knoten) throw new Error(`Drive: Datei ${pfad} gibt es nicht.`);
    return knoten;
  }

  /** ID der Datei in Drive – bleibt gleich, solange die Datei nur umbenannt oder verschoben wird. */
  driveId(pfad: string): string {
    return this.finde(pfad).id;
  }

  /** Jemand bearbeitet die Datei direkt in Google Drive. */
  bearbeiteVonHand(pfad: string, aendern: (inhalt: string) => string): void {
    const knoten = this.finde(pfad);
    knoten.inhalt = aendern(knoten.inhalt);
    this.geaendert(knoten);
  }

  /** Jemand löscht die Datei direkt in Google Drive. */
  loescheVonHand(pfad: string): void {
    this.knoten.delete(this.finde(pfad).id);
  }
}
