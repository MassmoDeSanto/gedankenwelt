/**
 * Der echte Google Kalender, angesprochen über Googles Web-Schnittstelle (Calendar API v3).
 *
 * Diese Datei übersetzt nur: Sie erfüllt dieselbe Schnittstelle `Kalender` wie der simulierte
 * Kalender. Die Regeln (welcher Termin zu welcher Aufgabe) stehen in src/logik/kalender/.
 *
 * Stand: gegen nachgebaute Google-Antworten getestet (googleKalender.test.ts), aber noch nie
 * gegen das echte Google gelaufen.
 */
import { KeineVerbindung, NichtAngemeldet } from '../logik/abgleich/drive';
import {
  KalenderFehler,
  KalenderFehlt,
  KeineKalenderBerechtigung,
  TERMIN_DAUER_MINUTEN,
  TerminFehlt,
  type Kalender,
  type Termin,
  type TerminDaten,
} from '../logik/kalender/kalender';

const API = 'https://www.googleapis.com/calendar/v3';
/** Name der privaten Eigenschaft am Termin, in der die Notiz-ID steht */
export const NOTIZ_EIGENSCHAFT = 'gedankenwelt_notiz';

interface GoogleTermin {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string };
  reminders?: { useDefault?: boolean; overrides?: { method: string; minutes: number }[] };
  extendedProperties?: { private?: Record<string, string> };
}

/** Rechnet in reiner Ortszeit: "2026-11-22T23:50" + 15 Minuten = "2026-11-23T00:05". */
export function plusMinuten(lokal: string, minuten: number): string {
  const [datum, uhrzeit] = lokal.split('T');
  const [j, m, t] = datum.split('-').map(Number);
  const [h, min] = uhrzeit.split(':').map(Number);
  return new Date(Date.UTC(j, m - 1, t, h, min + minuten)).toISOString().slice(0, 16);
}

/** Baut aus den Termin-Daten das, was Google erwartet. */
export function alsGoogleTermin(daten: TerminDaten, zeitzone: string) {
  return {
    summary: daten.titel,
    description: daten.beschreibung,
    // Ortszeit plus Name der Zeitzone – keine Umrechnung in Weltzeit. Google kümmert sich um
    // Sommer- und Winterzeit, und 9:00 bleibt 9:00.
    start: { dateTime: `${daten.beginn}:00`, timeZone: zeitzone },
    end: { dateTime: `${plusMinuten(daten.beginn, TERMIN_DAUER_MINUTEN)}:00`, timeZone: zeitzone },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: daten.erinnerung }] },
    // Der Termin soll im Kalender nicht als „beschäftigt“ zählen – er ist nur eine Erinnerung.
    transparency: 'transparent',
    extendedProperties: { private: { [NOTIZ_EIGENSCHAFT]: daten.notiz_id } },
  };
}

function ausGoogleTermin(g: GoogleTermin): Termin | null {
  const notiz_id = g.extendedProperties?.private?.[NOTIZ_EIGENSCHAFT];
  if (!notiz_id || g.status === 'cancelled' || !g.start?.dateTime) return null;
  return {
    id: g.id,
    notiz_id,
    titel: g.summary ?? '',
    beschreibung: g.description ?? '',
    beginn: g.start.dateTime.slice(0, 16),
    // Steht der Termin auf „Standard-Erinnerung“, passt er nicht zur App und wird beim Abgleich korrigiert.
    erinnerung: g.reminders?.useDefault ? -1 : (g.reminders?.overrides?.[0]?.minutes ?? -1),
  };
}

/** Intern: Google hat „gibt es nicht“ geantwortet. Was fehlt, weiß nur die aufrufende Stelle. */
class NichtGefunden extends Error {}

export interface GoogleKalenderOptionen {
  zeitzone: string;
  /** Zum Testen austauschbar: die Funktion, die Anfragen ins Netz schickt */
  fetch?: typeof fetch;
  /** Zum Testen austauschbar: Warten zwischen zwei Versuchen */
  warte?: (ms: number) => Promise<void>;
}

export class GoogleKalender implements Kalender {
  private fetch: typeof fetch;
  private warte: (ms: number) => Promise<void>;

  /**
   * @param holeToken liefert den aktuellen Zugangsschlüssel oder null, wenn keiner gilt
   * @param beiAbgelehnt wird aufgerufen, wenn Google den Schlüssel nicht (mehr) annimmt
   */
  constructor(
    private holeToken: () => string | null,
    private beiAbgelehnt: () => void,
    private optionen: GoogleKalenderOptionen,
  ) {
    this.fetch = optionen.fetch ?? ((...a) => fetch(...a));
    this.warte = optionen.warte ?? ((ms) => new Promise((fertig) => setTimeout(fertig, ms)));
  }

  /** Eine Anfrage an den Kalender. Vorübergehende Störungen werden bis zu dreimal versucht. */
  private async frage<T>(methode: string, pfad: string, koerper?: unknown): Promise<T> {
    for (let versuch = 1; ; versuch++) {
      const token = this.holeToken();
      if (!token) throw new NichtAngemeldet();

      let antwort: Response;
      try {
        antwort = await this.fetch(`${API}${pfad}`, {
          method: methode,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(koerper !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          body: koerper !== undefined ? JSON.stringify(koerper) : undefined,
        });
      } catch {
        throw new KeineVerbindung();
      }
      if (antwort.ok) return (antwort.status === 204 ? undefined : await antwort.json()) as T;

      const text = await antwort.text().catch(() => '');
      if (antwort.status === 401) {
        this.beiAbgelehnt();
        throw new NichtAngemeldet();
      }
      if (antwort.status === 404 || antwort.status === 410) throw new NichtGefunden();

      const gebremst = antwort.status === 429 || /rateLimitExceeded|quotaExceeded/i.test(text);
      if (antwort.status === 403 && !gebremst) throw new KeineKalenderBerechtigung();
      if (gebremst || antwort.status >= 500) {
        if (versuch < 3) {
          await this.warte(versuch * 1500);
          continue;
        }
        throw new KalenderFehler(
          antwort.status,
          gebremst
            ? 'Google Kalender bremst gerade (zu viele Anfragen). Es wird später erneut versucht.'
            : 'Google Kalender hat gerade eine Störung. Es wird später erneut versucht.',
        );
      }
      throw new KalenderFehler(antwort.status, `Google Kalender meldet einen Fehler (${antwort.status}).`);
    }
  }

  async kalenderVorhanden(kalenderId: string): Promise<boolean> {
    try {
      await this.frage('GET', `/calendars/${encodeURIComponent(kalenderId)}?fields=id`);
      return true;
    } catch (fehler) {
      if (fehler instanceof NichtGefunden) return false;
      throw fehler;
    }
  }

  async erstelleKalender(name: string): Promise<string> {
    const neu = await this.frage<{ id: string }>('POST', '/calendars?fields=id', {
      summary: name,
      description: 'Erinnerungen der App „Gedankenwelt“. Die App verwaltet diesen Kalender selbst.',
      timeZone: this.optionen.zeitzone,
    });
    return neu.id;
  }

  async loescheKalender(kalenderId: string): Promise<void> {
    try {
      await this.frage('DELETE', `/calendars/${encodeURIComponent(kalenderId)}`);
    } catch (fehler) {
      if (!(fehler instanceof NichtGefunden)) throw fehler; // schon weg ist auch gut
    }
  }

  async termine(kalenderId: string): Promise<Termin[]> {
    const termine: Termin[] = [];
    let seite: string | undefined;
    do {
      const parameter = new URLSearchParams({
        maxResults: '2500',
        singleEvents: 'false',
        showDeleted: 'false',
        // Zeiten in der Antwort in Ortszeit, damit sie zu den Fälligkeiten der App passen
        timeZone: this.optionen.zeitzone,
        fields: 'nextPageToken,items(id,status,summary,description,start,reminders,extendedProperties/private)',
      });
      if (seite) parameter.set('pageToken', seite);
      let antwort: { items?: GoogleTermin[]; nextPageToken?: string };
      try {
        antwort = await this.frage('GET', `/calendars/${encodeURIComponent(kalenderId)}/events?${parameter}`);
      } catch (fehler) {
        throw fehler instanceof NichtGefunden ? new KalenderFehlt() : fehler;
      }
      for (const g of antwort.items ?? []) {
        const termin = ausGoogleTermin(g);
        if (termin) termine.push(termin);
      }
      seite = antwort.nextPageToken;
    } while (seite);
    return termine;
  }

  async erstelleTermin(kalenderId: string, daten: TerminDaten): Promise<Termin> {
    try {
      const neu = await this.frage<GoogleTermin>(
        'POST',
        `/calendars/${encodeURIComponent(kalenderId)}/events?fields=id`,
        alsGoogleTermin(daten, this.optionen.zeitzone),
      );
      return { ...daten, id: neu.id };
    } catch (fehler) {
      throw fehler instanceof NichtGefunden ? new KalenderFehlt() : fehler;
    }
  }

  async aendereTermin(kalenderId: string, id: string, daten: TerminDaten): Promise<Termin> {
    try {
      await this.frage(
        'PATCH',
        `/calendars/${encodeURIComponent(kalenderId)}/events/${encodeURIComponent(id)}?fields=id`,
        alsGoogleTermin(daten, this.optionen.zeitzone),
      );
      return { ...daten, id };
    } catch (fehler) {
      throw fehler instanceof NichtGefunden ? new TerminFehlt() : fehler;
    }
  }

  async loescheTermin(kalenderId: string, id: string): Promise<void> {
    try {
      await this.frage('DELETE', `/calendars/${encodeURIComponent(kalenderId)}/events/${encodeURIComponent(id)}`);
    } catch (fehler) {
      throw fehler instanceof NichtGefunden ? new TerminFehlt() : fehler;
    }
  }
}
