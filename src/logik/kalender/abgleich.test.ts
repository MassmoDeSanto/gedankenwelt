/**
 * Tests für die Erinnerungen (PHASE-3.md, Abschnitt 6) gegen den simulierten Kalender.
 * Zwei „Geräte“ sind hier einfach zwei Notiz-Bestände, die denselben Kalender benutzen.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { neueAufgabe, type Aufgabe, type Notiz } from '../../modell/typen';
import { KeineVerbindung } from '../abgleich/drive';
import { alsKarte } from '../listen';
import { baueListe, baueNotiz } from '../test-hilfe';
import { hakeAb } from '../wiederholung';
import { gleicheKalenderAb, mitTerminId, terminFuer, titelAus } from './abgleich';
import { SimulierterKalender } from './simulierterKalender';

const JETZT = '2026-11-16T10:00';
const APP = 'https://beispiel.test/app/';

const reise = baueListe({ name: 'Reise-App' });
const geld = baueListe({ name: 'Monetarisierung', eltern_id: reise.id });
const listen = alsKarte([reise, geld]);

/** Ein Gerät: seine Notizen und der Abgleich mit dem gemeinsamen Kalender. */
class Geraet {
  notizen: Notiz[] = [];

  constructor(
    private kalender: SimulierterKalender,
    private kalenderId: string,
  ) {}

  aufgabe(text: string, teil: Partial<Aufgabe> = {}): Notiz {
    const notiz = baueNotiz({ text, liste_id: geld.id, aufgabe: { ...neueAufgabe(), ...teil } });
    this.notizen.push(notiz);
    return notiz;
  }

  aendere(id: string, teil: Partial<Notiz>, aufgabe: Partial<Aufgabe> = {}): void {
    this.notizen = this.notizen.map((n) =>
      n.id === id ? { ...n, ...teil, aufgabe: n.aufgabe ? { ...n.aufgabe, ...aufgabe } : null } : n,
    );
  }

  notiz(id: string): Notiz {
    return this.notizen.find((n) => n.id === id)!;
  }

  /** Abgleich; die gemeldeten Termin-IDs werden – wie in der App – in die Notizen übernommen. */
  async gleicheAb(jetztLokal = JETZT, verwaisteAufraeumen = false) {
    const ergebnis = await gleicheKalenderAb(this.kalender, this.kalenderId, this.notizen, listen, {
      jetztLokal,
      appAdresse: APP,
      verwaisteAufraeumen,
    });
    for (const [id, terminId] of ergebnis.ids) {
      this.notizen = this.notizen.map((n) => (n.id === id ? mitTerminId(n, terminId) : n));
    }
    return ergebnis;
  }
}

let kalender: SimulierterKalender;
let kalenderId: string;
let a: Geraet;

beforeEach(async () => {
  kalender = new SimulierterKalender();
  kalenderId = await kalender.erstelleKalender('Gedankenwelt');
  a = new Geraet(kalender, kalenderId);
});

const termine = () => kalender.alle(kalenderId);

describe('Termin zu einer Aufgabe', () => {
  it('Titel: eine Zeile, ohne Tags und Markdown-Zeichen', () => {
    expect(titelAus('**Wochenplanung** machen #planung #woche\nzweite Zeile')).toBe('Wochenplanung machen');
    expect(titelAus('- Punkt mit `Code`')).toBe('Punkt mit Code');
    expect(titelAus('#nur #tags')).toBe('Aufgabe');
    expect(titelAus('x'.repeat(300))).toHaveLength(120);
  });

  it('nur offene Aufgaben mit Uhrzeit bekommen einen Termin', () => {
    const mitUhrzeit = a.aufgabe('Wochenplanung #planung', { faellig: '2026-11-22T18:00', erinnerung: 15 });
    expect(terminFuer(mitUhrzeit, listen, APP)).toEqual({
      notiz_id: mitUhrzeit.id,
      titel: 'Wochenplanung',
      beginn: '2026-11-22T18:00',
      erinnerung: 15,
      beschreibung: `Reise-App › Monetarisierung\n${APP}#/liste/${geld.id}?n=${mitUhrzeit.id}`,
    });
    expect(terminFuer(a.aufgabe('ohne Uhrzeit', { faellig: '2026-11-22' }), listen, APP)).toBeNull();
    expect(terminFuer(a.aufgabe('ohne Datum'), listen, APP)).toBeNull();
    expect(terminFuer(a.aufgabe('erledigt', { faellig: '2026-11-22T18:00', erledigt: true }), listen, APP)).toBeNull();
    expect(terminFuer(baueNotiz({ text: 'keine Aufgabe' }), listen, APP)).toBeNull();
    const geloescht = { ...a.aufgabe('gelöscht', { faellig: '2026-11-22T18:00' }), geloescht: '2026-11-16T09:00:00Z' };
    expect(terminFuer(geloescht, listen, APP)).toBeNull();
  });
});

describe('Anlegen, Ändern, Löschen', () => {
  it('legt für eine Aufgabe mit Uhrzeit genau einen Termin an und merkt sich dessen ID', async () => {
    const n = a.aufgabe('Wochenplanung', { faellig: '2026-11-22T18:00', erinnerung: 15 });
    a.aufgabe('ohne Uhrzeit', { faellig: '2026-11-22' });

    expect(await a.gleicheAb()).toMatchObject({ angelegt: 1, geaendert: 0, geloescht: 0 });

    expect(termine()).toHaveLength(1);
    expect(termine()[0]).toMatchObject({ notiz_id: n.id, titel: 'Wochenplanung', beginn: '2026-11-22T18:00', erinnerung: 15 });
    expect(a.notiz(n.id).aufgabe?.kalender_event_id).toBe(termine()[0].id);

    // ein weiterer Abgleich ändert nichts
    expect(await a.gleicheAb()).toMatchObject({ angelegt: 0, geaendert: 0, geloescht: 0 });
    expect(kalender.schreibvorgaenge).toBe(2); // Kalender anlegen + ein Termin
  });

  it('Text, Datum, Uhrzeit oder Erinnerung ändern: derselbe Termin wird aktualisiert', async () => {
    const n = a.aufgabe('Wochenplanung', { faellig: '2026-11-22T18:00' });
    await a.gleicheAb();
    const id = termine()[0].id;

    a.aendere(n.id, { text: 'Wochenplanung mit Tee' }, { faellig: '2026-11-23T19:30', erinnerung: 60 });
    expect(await a.gleicheAb()).toMatchObject({ angelegt: 0, geaendert: 1, geloescht: 0 });

    expect(termine()).toEqual([
      expect.objectContaining({ id, titel: 'Wochenplanung mit Tee', beginn: '2026-11-23T19:30', erinnerung: 60 }),
    ]);
  });

  it.each([
    ['abhaken', { erledigt: true }, {}],
    ['Uhrzeit entfernen', { faellig: '2026-11-22' }, {}],
    ['löschen', {}, { geloescht: '2026-11-16T09:30:00Z' }],
    ['Aufgabe wird normale Notiz', null, {}],
  ])('%s: der Termin verschwindet', async (_name, aufgabe, notiz) => {
    const n = a.aufgabe('Wochenplanung', { faellig: '2026-11-22T18:00' });
    await a.gleicheAb();

    if (aufgabe === null) a.notizen = a.notizen.map((x) => ({ ...x, aufgabe: null }));
    else a.aendere(n.id, notiz, aufgabe);
    expect(await a.gleicheAb()).toMatchObject({ geloescht: 1 });

    expect(termine()).toEqual([]);
    if (aufgabe !== null) expect(a.notiz(n.id).aufgabe?.kalender_event_id).toBeNull();
  });

  it('aus dem Papierkorb wiederhergestellt: Termin kommt zurück, wenn er noch in der Zukunft liegt', async () => {
    const bald = a.aufgabe('liegt in der Zukunft', { faellig: '2026-11-22T18:00' });
    const vorbei = a.aufgabe('ist schon vorbei', { faellig: '2026-11-15T18:00' });
    a.aendere(bald.id, { geloescht: '2026-11-16T09:00:00Z' });
    a.aendere(vorbei.id, { geloescht: '2026-11-16T09:00:00Z' });
    await a.gleicheAb();
    expect(termine()).toEqual([]);

    a.aendere(bald.id, { geloescht: null });
    a.aendere(vorbei.id, { geloescht: null });
    await a.gleicheAb();

    expect(termine().map((t) => t.titel)).toEqual(['liegt in der Zukunft']);
    expect(a.notiz(vorbei.id).aufgabe?.kalender_event_id).toBeNull();
  });

  it('eine überfällige offene Aufgabe behält ihren Termin', async () => {
    const n = a.aufgabe('Wochenplanung', { faellig: '2026-11-16T18:00' });
    await a.gleicheAb('2026-11-16T10:00');
    a.aendere(n.id, { text: 'Wochenplanung (verschoben?)' });
    await a.gleicheAb('2026-11-17T10:00');
    expect(termine()).toEqual([expect.objectContaining({ titel: 'Wochenplanung (verschoben?)', beginn: '2026-11-16T18:00' })]);
  });
});

describe('Wiederkehrende Aufgaben', () => {
  it('immer nur ein Termin der nächsten Fälligkeit, der nach dem Abhaken mitwandert', async () => {
    const n = a.aufgabe('Wochenplanung', {
      faellig: '2026-11-22T18:00',
      wiederholung: { art: 'woechentlich', tage: ['SO'], intervall: 1, ab: 'faellig', ende: { art: 'nie' } },
    });
    await a.gleicheAb();
    const id = termine()[0].id;

    const abgehakt = hakeAb(a.notiz(n.id).aufgabe!, '2026-11-22T18:30', '2026-11-22T17:30:00Z').aufgabe;
    a.aendere(n.id, {}, abgehakt);
    await a.gleicheAb('2026-11-22T18:30');

    expect(termine()).toEqual([expect.objectContaining({ id, beginn: '2026-11-29T18:00' })]);
  });

  it('Sommer-/Winterzeit: der Termin um 9:00 bleibt um 9:00', async () => {
    let aufgabe: Aufgabe = {
      ...neueAufgabe(),
      faellig: '2026-10-24T09:00',
      wiederholung: { art: 'taeglich', intervall: 1, ab: 'faellig', ende: { art: 'nie' } },
    };
    const n = a.aufgabe('Morgenrunde', aufgabe);
    for (const tag of ['2026-10-24', '2026-10-25', '2026-10-26']) {
      await a.gleicheAb(`${tag}T08:00`);
      expect(termine()[0].beginn).toBe(`${tag}T09:00`);
      aufgabe = hakeAb(a.notiz(n.id).aufgabe!, `${tag}T09:30`, `${tag}T08:30:00Z`).aufgabe;
      a.aendere(n.id, {}, aufgabe);
    }
  });
});

describe('Robustheit', () => {
  it('offline: nichts geht kaputt; sobald das Netz zurück ist, wird nachgeholt – ohne Doppel-Termin', async () => {
    const n = a.aufgabe('Wochenplanung', {
      faellig: '2026-11-22T18:00',
      wiederholung: { art: 'woechentlich', tage: ['SO'], intervall: 1, ab: 'faellig', ende: { art: 'nie' } },
    });
    await a.gleicheAb();

    // offline abhaken
    kalender.istOffline = () => true;
    a.aendere(n.id, {}, hakeAb(a.notiz(n.id).aufgabe!, '2026-11-22T18:30', '2026-11-22T17:30:00Z').aufgabe);
    await expect(a.gleicheAb('2026-11-22T18:30')).rejects.toBeInstanceOf(KeineVerbindung);
    expect(termine()[0].beginn).toBe('2026-11-22T18:00');

    // Netz ist zurück
    kalender.istOffline = () => false;
    await a.gleicheAb('2026-11-22T18:31');
    expect(termine()).toHaveLength(1);
    expect(termine()[0].beginn).toBe('2026-11-29T18:00');
  });

  it('Abbruch mitten im Abgleich: nach jedem möglichen Abbruch stimmt der Kalender', async () => {
    const aufbau = async () => {
      kalender = new SimulierterKalender();
      kalenderId = await kalender.erstelleKalender('Gedankenwelt');
      a = new Geraet(kalender, kalenderId);
      const bleibt = a.aufgabe('bleibt', { faellig: '2026-11-20T08:00' });
      const wird = a.aufgabe('wird geändert', { faellig: '2026-11-21T08:00' });
      const geht = a.aufgabe('wird abgehakt', { faellig: '2026-11-22T08:00' });
      await a.gleicheAb();
      a.aendere(wird.id, { text: 'wurde geändert' });
      a.aendere(geht.id, {}, { erledigt: true });
      a.aufgabe('kommt neu dazu', { faellig: '2026-11-23T08:00' });
      return bleibt;
    };
    await aufbau();
    const vorher = kalender.schreibvorgaenge;
    await a.gleicheAb();
    const gesamt = kalender.schreibvorgaenge - vorher;
    const soll = termine().map((t) => [t.titel, t.beginn]);
    expect(gesamt).toBe(3);
    expect(soll).toEqual([
      ['bleibt', '2026-11-20T08:00'],
      ['wurde geändert', '2026-11-21T08:00'],
      ['kommt neu dazu', '2026-11-23T08:00'],
    ]);

    for (let abbruch = 0; abbruch < gesamt; abbruch++) {
      await aufbau();
      kalender.abbruchNach = abbruch;
      await expect(a.gleicheAb()).rejects.toBeInstanceOf(KeineVerbindung);
      kalender.abbruchNach = null;
      await a.gleicheAb();
      expect(termine().map((t) => [t.titel, t.beginn])).toEqual(soll);
      // jede offene Aufgabe mit Uhrzeit kennt ihren Termin
      for (const n of a.notizen) {
        const termin = termine().find((t) => t.notiz_id === n.id);
        expect(n.aufgabe?.kalender_event_id ?? null).toBe(termin?.id ?? null);
      }
    }
  });

  it('zwei Geräte nacheinander: das zweite findet den Termin und übernimmt dessen ID', async () => {
    const n = a.aufgabe('Wochenplanung', { faellig: '2026-11-22T18:00' });
    const b = new Geraet(kalender, kalenderId);
    b.notizen = [{ ...n }]; // dieselbe Notiz, über Drive angekommen – noch ohne Termin-ID

    await a.gleicheAb();
    expect(await b.gleicheAb()).toMatchObject({ angelegt: 0, geaendert: 0, geloescht: 0 });

    expect(termine()).toHaveLength(1);
    expect(b.notiz(n.id).aufgabe?.kalender_event_id).toBe(a.notiz(n.id).aufgabe?.kalender_event_id);
  });

  it('zwei Geräte gleichzeitig: aus zwei Terminen wird wieder einer, beide Geräte einigen sich auf denselben', async () => {
    const n = a.aufgabe('Wochenplanung', { faellig: '2026-11-22T18:00' });
    const b = new Geraet(kalender, kalenderId);
    b.notizen = [{ ...n }];

    // Beide haben „gleichzeitig“ nachgesehen, nichts gefunden und angelegt.
    const daten = terminFuer(n, listen, APP)!;
    const vonA = await kalender.erstelleTermin(kalenderId, daten);
    const vonB = await kalender.erstelleTermin(kalenderId, daten);
    a.aendere(n.id, {}, { kalender_event_id: vonA.id });
    b.aendere(n.id, {}, { kalender_event_id: vonB.id });
    expect(termine()).toHaveLength(2);

    // Egal, in welcher Reihenfolge sie danach abgleichen – auch B zuerst:
    await b.gleicheAb();
    await a.gleicheAb();
    await b.gleicheAb();

    expect(termine()).toHaveLength(1);
    expect(a.notiz(n.id).aufgabe?.kalender_event_id).toBe(termine()[0].id);
    expect(b.notiz(n.id).aufgabe?.kalender_event_id).toBe(termine()[0].id);
  });

  it('im Kalender geänderter Termin wird überschrieben, gelöschter neu angelegt', async () => {
    const n = a.aufgabe('Wochenplanung', { faellig: '2026-11-22T18:00' });
    await a.gleicheAb();
    const id = termine()[0].id;

    kalender.aendereVonHand(kalenderId, id, { titel: 'Von Hand umbenannt', beginn: '2026-11-25T07:00' });
    await a.gleicheAb();
    expect(termine()).toEqual([expect.objectContaining({ id, titel: 'Wochenplanung', beginn: '2026-11-22T18:00' })]);

    kalender.loescheVonHand(kalenderId, id);
    expect(await a.gleicheAb()).toMatchObject({ angelegt: 1 });
    expect(termine()).toHaveLength(1);
    expect(a.notiz(n.id).aufgabe?.kalender_event_id).toBe(termine()[0].id);
    expect(termine()[0].id).not.toBe(id);
  });

  it('verwaiste Termine: nur „neu aufbauen“ räumt sie auf; eigene Termine im Kalender bleiben', async () => {
    a.aufgabe('Wochenplanung', { faellig: '2026-11-22T18:00' });
    await a.gleicheAb();
    await kalender.erstelleTermin(kalenderId, {
      notiz_id: 'gibt-es-nicht-mehr',
      titel: 'Verwaist',
      beginn: '2026-11-24T08:00',
      erinnerung: 0,
      beschreibung: '',
    });
    kalender.trageVonHandEin(kalenderId, 'Zahnarzt (selbst eingetragen)', '2026-11-25T09:00');

    // Der normale Abgleich lässt Termine unbekannter Notizen stehen (sie könnten von einem anderen Gerät sein).
    await a.gleicheAb();
    expect(termine().map((t) => t.titel)).toEqual(['Wochenplanung', 'Verwaist', 'Zahnarzt (selbst eingetragen)']);

    expect(await a.gleicheAb(JETZT, true)).toMatchObject({ geloescht: 1 });
    expect(termine().map((t) => t.titel)).toEqual(['Wochenplanung', 'Zahnarzt (selbst eingetragen)']);
  });

  it('beim Aktivieren werden alle vorhandenen offenen Aufgaben mit Uhrzeit nachgetragen', async () => {
    a.aufgabe('Montag früh', { faellig: '2026-11-23T07:00', erinnerung: 30 });
    a.aufgabe('Wochenplanung', { faellig: '2026-11-22T18:00', erinnerung: 15 });
    a.aufgabe('ohne Uhrzeit', { faellig: '2026-11-22' });
    a.aufgabe('schon erledigt', { faellig: '2026-11-22T18:00', erledigt: true });
    a.aufgabe('längst vorbei', { faellig: '2026-11-01T18:00' });

    expect(await a.gleicheAb()).toMatchObject({ angelegt: 2 });
    expect(termine().map((t) => [t.titel, t.erinnerung])).toEqual([
      ['Wochenplanung', 15],
      ['Montag früh', 30],
    ]);
  });
});
