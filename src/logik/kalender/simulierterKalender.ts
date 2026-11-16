/**
 * Ein Kalender zum Testen und für die lokale Entwicklung: lebt im Arbeitsspeicher, braucht
 * kein Google-Konto. Er kann „offline“ sein oder mitten in der Arbeit abbrechen, damit sich
 * prüfen lässt, ob danach sauber weitergemacht wird.
 *
 * In der veröffentlichten App ist er nicht enthalten.
 */
import { KeineVerbindung } from '../abgleich/drive';
import { KalenderFehlt, TerminFehlt, type Kalender, type Termin, type TerminDaten } from './kalender';

/** Ein Eintrag im simulierten Kalender. Von Hand eingetragene Termine haben keine Notiz-ID. */
export interface SimulierterTermin extends Omit<Termin, 'notiz_id'> {
  notiz_id: string | null;
}

export interface SimulierterStand {
  zaehler: number;
  kalender: { id: string; name: string; termine: SimulierterTermin[] }[];
}

export class SimulierterKalender implements Kalender {
  private stand: SimulierterStand;

  /** Liefert true, wenn „kein Netz“ simuliert werden soll (z. B. navigator.onLine im Browser). */
  istOffline: () => boolean = () => false;
  /** Nach so vielen weiteren Schreibvorgängen bricht die Verbindung ab. null = nie. */
  abbruchNach: number | null = null;
  /** Zählt Schreibvorgänge (anlegen, ändern, löschen). */
  schreibvorgaenge = 0;

  /**
   * @param start    gespeicherter Stand (in der Entwicklung aus dem localStorage)
   * @param speichere wird nach jeder Änderung aufgerufen, um den Stand aufzuheben
   */
  constructor(
    start?: SimulierterStand | null,
    private speichere: (stand: SimulierterStand) => void = () => {},
  ) {
    this.stand = start ?? { zaehler: 0, kalender: [] };
  }

  private lesend(): void {
    if (this.istOffline()) throw new KeineVerbindung();
  }

  private schreibend(): void {
    this.lesend();
    if (this.abbruchNach !== null) {
      if (this.abbruchNach <= 0) throw new KeineVerbindung();
      this.abbruchNach--;
    }
    this.schreibvorgaenge++;
  }

  private hole(kalenderId: string) {
    const kalender = this.stand.kalender.find((k) => k.id === kalenderId);
    if (!kalender) throw new KalenderFehlt();
    return kalender;
  }

  private neueId(art: string): string {
    return `${art}-${String(++this.stand.zaehler).padStart(4, '0')}`;
  }

  private sichere(): void {
    this.speichere(structuredClone(this.stand));
  }

  // ── Schnittstelle „Kalender“ ──

  async kalenderVorhanden(kalenderId: string): Promise<boolean> {
    this.lesend();
    return this.stand.kalender.some((k) => k.id === kalenderId);
  }

  async erstelleKalender(name: string): Promise<string> {
    this.schreibend();
    const id = this.neueId('kalender');
    this.stand.kalender.push({ id, name, termine: [] });
    this.sichere();
    return id;
  }

  async loescheKalender(kalenderId: string): Promise<void> {
    this.schreibend();
    this.hole(kalenderId);
    this.stand.kalender = this.stand.kalender.filter((k) => k.id !== kalenderId);
    this.sichere();
  }

  async termine(kalenderId: string): Promise<Termin[]> {
    this.lesend();
    return this.hole(kalenderId)
      .termine.filter((t): t is Termin => t.notiz_id !== null)
      .map((t) => ({ ...t }));
  }

  async erstelleTermin(kalenderId: string, daten: TerminDaten): Promise<Termin> {
    this.schreibend();
    const termin: Termin = { ...daten, id: this.neueId('termin') };
    this.hole(kalenderId).termine.push(termin);
    this.sichere();
    return { ...termin };
  }

  async aendereTermin(kalenderId: string, id: string, daten: TerminDaten): Promise<Termin> {
    this.schreibend();
    const kalender = this.hole(kalenderId);
    const stelle = kalender.termine.findIndex((t) => t.id === id);
    if (stelle < 0) throw new TerminFehlt();
    const termin: Termin = { ...daten, id };
    kalender.termine[stelle] = termin;
    this.sichere();
    return { ...termin };
  }

  async loescheTermin(kalenderId: string, id: string): Promise<void> {
    this.schreibend();
    const kalender = this.hole(kalenderId);
    if (!kalender.termine.some((t) => t.id === id)) throw new TerminFehlt();
    kalender.termine = kalender.termine.filter((t) => t.id !== id);
    this.sichere();
  }

  // ── Helfer für Tests und die Entwickler-Ansicht ──

  /** Alles, was im Kalender steht – auch von Hand eingetragene Termine –, nach Beginn sortiert. */
  alle(kalenderId: string): SimulierterTermin[] {
    const kalender = this.stand.kalender.find((k) => k.id === kalenderId);
    return [...(kalender?.termine ?? [])].sort((a, b) => (a.beginn < b.beginn ? -1 : a.beginn > b.beginn ? 1 : 0));
  }

  kalenderNamen(): string[] {
    return this.stand.kalender.map((k) => k.name);
  }

  /** Jemand trägt direkt im Kalender einen eigenen Termin ein. */
  trageVonHandEin(kalenderId: string, titel: string, beginn: string): string {
    const id = this.neueId('termin');
    this.hole(kalenderId).termine.push({ id, notiz_id: null, titel, beginn, erinnerung: 10, beschreibung: '' });
    this.sichere();
    return id;
  }

  /** Jemand ändert einen Termin direkt im Kalender. */
  aendereVonHand(kalenderId: string, id: string, teil: Partial<TerminDaten>): void {
    const termin = this.hole(kalenderId).termine.find((t) => t.id === id);
    if (termin) Object.assign(termin, teil);
    this.sichere();
  }

  /** Jemand löscht einen Termin direkt im Kalender. */
  loescheVonHand(kalenderId: string, id: string): void {
    const kalender = this.hole(kalenderId);
    kalender.termine = kalender.termine.filter((t) => t.id !== id);
    this.sichere();
  }
}
