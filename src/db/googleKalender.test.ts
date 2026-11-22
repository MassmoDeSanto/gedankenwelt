/**
 * Die Anbindung an den echten Google Kalender – geprüft ohne Google: Eine nachgebaute
 * „fetch“-Funktion zeichnet auf, was die App abschicken würde, und antwortet so, wie Google
 * es laut Dokumentation tut. Das prüft Aufbau der Anfragen und Umgang mit Fehlern.
 * Es ersetzt NICHT den Test gegen das echte Google.
 */
import { describe, expect, it } from 'vitest';
import { KeineVerbindung, NichtAngemeldet } from '../logik/abgleich/drive';
import { KalenderFehler, KalenderFehlt, KeineKalenderBerechtigung, TerminFehlt, type TerminDaten } from '../logik/kalender/kalender';
import { GoogleKalender, alsGoogleTermin, plusMinuten } from './googleKalender';

interface Anfrage {
  adresse: string;
  methode: string;
  kopf: Record<string, string>;
  koerper: Record<string, any> | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
}

type Antwort = { status: number; koerper?: unknown } | 'kein-netz';

/** Baut einen Kalender, dessen Netz-Anfragen aufgezeichnet und der Reihe nach beantwortet werden. */
function aufbau(antworten: Antwort[], token: string | null = 'schluessel-123') {
  const anfragen: Anfrage[] = [];
  const wartezeiten: number[] = [];
  let abgelehnt = 0;
  const nachgebautesFetch = (async (adresse: RequestInfo | URL, init?: RequestInit) => {
    anfragen.push({
      adresse: String(adresse),
      methode: init?.method ?? 'GET',
      kopf: (init?.headers ?? {}) as Record<string, string>,
      koerper: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const antwort = antworten.shift();
    if (!antwort) throw new Error('Test: mehr Anfragen als vorbereitete Antworten');
    if (antwort === 'kein-netz') throw new TypeError('Failed to fetch');
    return new Response(antwort.status === 204 ? null : JSON.stringify(antwort.koerper ?? {}), { status: antwort.status });
  }) as typeof fetch;

  const kalender = new GoogleKalender(
    () => token,
    () => void abgelehnt++,
    { zeitzone: 'Europe/Berlin', fetch: nachgebautesFetch, warte: async (ms) => void wartezeiten.push(ms) },
  );
  return { kalender, anfragen, wartezeiten, abgelehnt: () => abgelehnt };
}

const KALENDER_ID = 'abc123@group.calendar.google.com';
const BASIS = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(KALENDER_ID)}`;

const daten: TerminDaten = {
  notiz_id: '01N0T1Z00000000000000000A1',
  titel: 'Wochenplanung',
  beginn: '2026-11-22T18:00',
  erinnerung: 15,
  beschreibung: 'Reise-App › Planung\nhttps://beispiel.test/app/#/liste/L1?n=01N0T1Z00000000000000000A1',
};

const fehler = (grund: string, meldung = grund) => ({ error: { errors: [{ reason: grund }], message: meldung } });

describe('Anfragen an Google: Aufbau', () => {
  it('Kalender anlegen: Name, Zeitzone und Zugangsschlüssel', async () => {
    const { kalender, anfragen } = aufbau([{ status: 200, koerper: { id: KALENDER_ID } }]);
    expect(await kalender.erstelleKalender('Gedankenwelt')).toBe(KALENDER_ID);

    expect(anfragen).toHaveLength(1);
    expect(anfragen[0].methode).toBe('POST');
    expect(anfragen[0].adresse).toBe('https://www.googleapis.com/calendar/v3/calendars?fields=id');
    expect(anfragen[0].kopf.Authorization).toBe('Bearer schluessel-123');
    expect(anfragen[0].kopf['Content-Type']).toBe('application/json');
    expect(anfragen[0].koerper).toMatchObject({ summary: 'Gedankenwelt', timeZone: 'Europe/Berlin' });
  });

  it('Termin anlegen: Titel, Zeit mit Zeitzone, 15 Minuten Dauer, Erinnerung, private Eigenschaft', async () => {
    const { kalender, anfragen } = aufbau([{ status: 200, koerper: { id: 'termin-1' } }]);
    const termin = await kalender.erstelleTermin(KALENDER_ID, daten);

    expect(termin).toEqual({ ...daten, id: 'termin-1' });
    expect(anfragen[0].methode).toBe('POST');
    expect(anfragen[0].adresse).toBe(`${BASIS}/events?fields=id`);
    expect(anfragen[0].koerper).toEqual({
      summary: 'Wochenplanung',
      description: daten.beschreibung,
      start: { dateTime: '2026-11-22T18:00:00', timeZone: 'Europe/Berlin' },
      end: { dateTime: '2026-11-22T18:15:00', timeZone: 'Europe/Berlin' },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 15 }] },
      transparency: 'transparent',
      extendedProperties: { private: { gedankenwelt_notiz: '01N0T1Z00000000000000000A1' } },
    });
  });

  it('Zeiten gehen als Ortszeit hinaus – ohne Umrechnung, auch rund um die Zeitumstellung', () => {
    // Nacht der Umstellung auf Winterzeit (25. Okt 2026) und auf Sommerzeit (28. Mär 2027)
    for (const beginn of ['2026-10-24T09:00', '2026-10-25T09:00', '2026-10-25T02:30', '2027-03-28T09:00']) {
      const g = alsGoogleTermin({ ...daten, beginn }, 'Europe/Berlin');
      expect(g.start).toEqual({ dateTime: `${beginn}:00`, timeZone: 'Europe/Berlin' });
      expect(g.start.dateTime).not.toMatch(/Z|[+-]\d\d:\d\d$/);
    }
    // „Zur Uhrzeit“ ist eine Erinnerung mit 0 Minuten
    expect(alsGoogleTermin({ ...daten, erinnerung: 0 }, 'Europe/Berlin').reminders.overrides).toEqual([
      { method: 'popup', minutes: 0 },
    ]);
  });

  it('Schreib-Erinnerung: täglicher Serientermin hinaus und zurück', async () => {
    const g = alsGoogleTermin({ ...daten, taeglich: true }, 'Europe/Berlin');
    expect(g.recurrence).toEqual(['RRULE:FREQ=DAILY']);
    expect('recurrence' in alsGoogleTermin(daten, 'Europe/Berlin')).toBe(false);

    const { kalender } = aufbau([
      {
        status: 200,
        koerper: {
          items: [
            {
              id: 's1',
              status: 'confirmed',
              summary: 'Tagebuch schreiben',
              description: 'x',
              start: { dateTime: '2026-01-01T21:00:00+01:00' },
              reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }] },
              recurrence: ['RRULE:FREQ=DAILY'],
              extendedProperties: { private: { gedankenwelt_notiz: '_schreiberinnerung' } },
            },
          ],
        },
      },
    ]);
    expect((await kalender.termine(KALENDER_ID))[0]).toMatchObject({ notiz_id: '_schreiberinnerung', taeglich: true });
  });

  it('das Ende liegt 15 Minuten nach dem Beginn, auch über Mitternacht und Monatsende', () => {
    expect(plusMinuten('2026-11-22T18:00', 15)).toBe('2026-11-22T18:15');
    expect(plusMinuten('2026-11-22T23:50', 15)).toBe('2026-11-23T00:05');
    expect(plusMinuten('2026-12-31T23:55', 15)).toBe('2027-01-01T00:10');
    expect(plusMinuten('2028-02-28T23:59', 15)).toBe('2028-02-29T00:14');
  });

  it('Termin ändern und löschen: richtige Adresse und Methode', async () => {
    const { kalender, anfragen } = aufbau([{ status: 200, koerper: { id: 'termin-1' } }, { status: 204 }]);
    await kalender.aendereTermin(KALENDER_ID, 'termin-1', { ...daten, beginn: '2026-11-29T18:00' });
    await kalender.loescheTermin(KALENDER_ID, 'termin-1');

    expect(anfragen[0].methode).toBe('PATCH');
    expect(anfragen[0].adresse).toBe(`${BASIS}/events/termin-1?fields=id`);
    expect(anfragen[0].koerper?.start).toEqual({ dateTime: '2026-11-29T18:00:00', timeZone: 'Europe/Berlin' });
    expect(anfragen[1].methode).toBe('DELETE');
    expect(anfragen[1].adresse).toBe(`${BASIS}/events/termin-1`);
    expect(anfragen[1].koerper).toBeUndefined();
  });

  it('Termine lesen: alle Seiten, in Ortszeit, nur Termine der App', async () => {
    const eigener = (id: string, notiz: string, dateTime: string) => ({
      id,
      status: 'confirmed',
      summary: `Aufgabe ${id}`,
      description: 'Pfad',
      start: { dateTime, timeZone: 'Europe/Berlin' },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] },
      extendedProperties: { private: { gedankenwelt_notiz: notiz } },
    });
    const { kalender, anfragen } = aufbau([
      {
        status: 200,
        koerper: {
          nextPageToken: 'seite-2',
          items: [
            eigener('t1', 'N1', '2026-11-22T18:00:00+01:00'),
            { id: 't2', summary: 'Zahnarzt (von Hand eingetragen)', start: { dateTime: '2026-11-23T09:00:00+01:00' } },
            { ...eigener('t3', 'N3', '2026-11-24T09:00:00+01:00'), status: 'cancelled' },
          ],
        },
      },
      { status: 200, koerper: { items: [eigener('t4', 'N4', '2026-07-01T09:00:00+02:00')] } },
    ]);

    expect(await kalender.termine(KALENDER_ID)).toEqual([
      { id: 't1', notiz_id: 'N1', titel: 'Aufgabe t1', beschreibung: 'Pfad', beginn: '2026-11-22T18:00', erinnerung: 30 },
      { id: 't4', notiz_id: 'N4', titel: 'Aufgabe t4', beschreibung: 'Pfad', beginn: '2026-07-01T09:00', erinnerung: 30 },
    ]);

    const erste = new URL(anfragen[0].adresse);
    expect(erste.pathname).toBe(`/calendar/v3/calendars/${encodeURIComponent(KALENDER_ID)}/events`);
    expect(erste.searchParams.get('timeZone')).toBe('Europe/Berlin');
    expect(erste.searchParams.get('showDeleted')).toBe('false');
    expect(erste.searchParams.get('fields')).toContain('extendedProperties/private');
    expect(erste.searchParams.has('pageToken')).toBe(false);
    expect(new URL(anfragen[1].adresse).searchParams.get('pageToken')).toBe('seite-2');
  });

  it('prüft, ob es den Kalender noch gibt, und löscht ihn', async () => {
    const { kalender, anfragen } = aufbau([
      { status: 200, koerper: { id: KALENDER_ID } },
      { status: 404, koerper: fehler('notFound') },
      { status: 204 },
      { status: 404, koerper: fehler('notFound') },
    ]);
    expect(await kalender.kalenderVorhanden(KALENDER_ID)).toBe(true);
    expect(await kalender.kalenderVorhanden(KALENDER_ID)).toBe(false);
    await kalender.loescheKalender(KALENDER_ID);
    await kalender.loescheKalender(KALENDER_ID); // schon gelöscht: kein Fehler
    expect(anfragen[0].adresse).toBe(`${BASIS}?fields=id`);
    expect(anfragen[2].methode).toBe('DELETE');
    expect(anfragen[2].adresse).toBe(BASIS);
  });
});

describe('Antworten von Google: Fehler', () => {
  it('ohne Zugangsschlüssel geht keine Anfrage hinaus', async () => {
    const { kalender, anfragen } = aufbau([], null);
    await expect(kalender.termine(KALENDER_ID)).rejects.toBeInstanceOf(NichtAngemeldet);
    expect(anfragen).toHaveLength(0);
  });

  it('abgelaufene Anmeldung (401): Schlüssel wird verworfen, kein weiterer Versuch', async () => {
    const { kalender, anfragen, abgelehnt } = aufbau([{ status: 401, koerper: fehler('authError', 'Invalid Credentials') }]);
    await expect(kalender.erstelleTermin(KALENDER_ID, daten)).rejects.toBeInstanceOf(NichtAngemeldet);
    expect(abgelehnt()).toBe(1);
    expect(anfragen).toHaveLength(1);
  });

  it('fehlende Berechtigung (403): eigene, verständliche Meldung', async () => {
    const { kalender, anfragen } = aufbau([
      { status: 403, koerper: fehler('insufficientPermissions', 'Request had insufficient authentication scopes.') },
    ]);
    const versuch = kalender.erstelleKalender('Gedankenwelt');
    await expect(versuch).rejects.toBeInstanceOf(KeineKalenderBerechtigung);
    await expect(versuch).rejects.toThrow(/Berechtigung/);
    expect(anfragen).toHaveLength(1);
  });

  it('Termin existiert nicht mehr (404 und 410) – beim Ändern und beim Löschen', async () => {
    const { kalender } = aufbau([
      { status: 404, koerper: fehler('notFound') },
      { status: 410, koerper: fehler('deleted', 'Resource has been deleted') },
    ]);
    await expect(kalender.aendereTermin(KALENDER_ID, 'weg', daten)).rejects.toBeInstanceOf(TerminFehlt);
    await expect(kalender.loescheTermin(KALENDER_ID, 'weg')).rejects.toBeInstanceOf(TerminFehlt);
  });

  it('Kalender existiert nicht mehr (404 beim Lesen oder Anlegen von Terminen)', async () => {
    const { kalender } = aufbau([
      { status: 404, koerper: fehler('notFound') },
      { status: 404, koerper: fehler('notFound') },
    ]);
    await expect(kalender.termine(KALENDER_ID)).rejects.toBeInstanceOf(KalenderFehlt);
    await expect(kalender.erstelleTermin(KALENDER_ID, daten)).rejects.toBeInstanceOf(KalenderFehlt);
  });

  it('Ratenbegrenzung (403 rateLimitExceeded, 429): warten und erneut versuchen', async () => {
    const { kalender, anfragen, wartezeiten } = aufbau([
      { status: 403, koerper: fehler('rateLimitExceeded', 'Rate Limit Exceeded') },
      { status: 429, koerper: fehler('rateLimitExceeded') },
      { status: 200, koerper: { id: 'termin-1' } },
    ]);
    expect((await kalender.erstelleTermin(KALENDER_ID, daten)).id).toBe('termin-1');
    expect(anfragen).toHaveLength(3);
    expect(wartezeiten).toEqual([1500, 3000]);
  });

  it('Ratenbegrenzung hält an: nach drei Versuchen eine verständliche Meldung', async () => {
    const { kalender, anfragen } = aufbau([
      { status: 429, koerper: fehler('rateLimitExceeded') },
      { status: 429, koerper: fehler('rateLimitExceeded') },
      { status: 429, koerper: fehler('rateLimitExceeded') },
    ]);
    const versuch = kalender.erstelleTermin(KALENDER_ID, daten);
    await expect(versuch).rejects.toBeInstanceOf(KalenderFehler);
    await expect(versuch).rejects.toThrow(/bremst/);
    expect(anfragen).toHaveLength(3);
  });

  it('Störung bei Google (500): erneut versuchen', async () => {
    const { kalender, anfragen } = aufbau([{ status: 503 }, { status: 204 }]);
    await kalender.loescheTermin(KALENDER_ID, 'termin-1');
    expect(anfragen).toHaveLength(2);
  });

  it('kein Netz: eigener Fehler, den der Abgleich später nachholt', async () => {
    const { kalender } = aufbau(['kein-netz']);
    await expect(kalender.termine(KALENDER_ID)).rejects.toBeInstanceOf(KeineVerbindung);
  });

  it('Termin mit Googles Standard-Erinnerung gilt als abweichend und wird beim Abgleich korrigiert', async () => {
    const { kalender } = aufbau([
      {
        status: 200,
        koerper: {
          items: [
            {
              id: 't1',
              summary: 'Wochenplanung',
              start: { dateTime: '2026-11-22T18:00:00+01:00' },
              reminders: { useDefault: true },
              extendedProperties: { private: { gedankenwelt_notiz: 'N1' } },
            },
          ],
        },
      },
    ]);
    expect((await kalender.termine(KALENDER_ID))[0].erinnerung).toBe(-1);
  });
});
