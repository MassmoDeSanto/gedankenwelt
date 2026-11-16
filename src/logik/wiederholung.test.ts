import { describe, expect, it } from 'vitest';
import { neueAufgabe, type Aufgabe, type Wiederholung } from '../modell/typen';
import {
  alsSchnellwert,
  ausSchnellwert,
  endeKurz,
  ersterTermin,
  formatNaechste,
  hakeAb,
  leseRegel,
  naechsteFaelligkeit,
  naechsterTermin,
  schreibeRegel,
  wiederholungKurz,
  wochentagVon,
} from './wiederholung';

const basis = { intervall: 1, ab: 'faellig', ende: { art: 'nie' } } as const;
const regel = (teil: Record<string, unknown>) => ({ ...basis, ...teil }) as Wiederholung;

/** Die nächsten `anzahl` Termine ab `start`. */
function folge(w: Wiederholung, start: string, anzahl: number): string[] {
  const termine: string[] = [];
  let d = start;
  for (let i = 0; i < anzahl; i++) termine.push((d = naechsterTermin(w, d)));
  return termine;
}

describe('Regeln: nächster Termin', () => {
  it('täglich und alle n Tage', () => {
    expect(folge(regel({ art: 'taeglich' }), '2026-11-29', 3)).toEqual(['2026-11-30', '2026-12-01', '2026-12-02']);
    expect(folge(regel({ art: 'taeglich', intervall: 3 }), '2026-12-28', 2)).toEqual(['2026-12-31', '2027-01-03']);
  });

  it('wöchentlich an einem Wochentag', () => {
    // 2026-11-16 ist ein Montag
    expect(wochentagVon('2026-11-16')).toBe('MO');
    expect(folge(regel({ art: 'woechentlich', tage: ['MO'] }), '2026-11-16', 2)).toEqual(['2026-11-23', '2026-11-30']);
    // von einem Mittwoch aus auf den nächsten Montag
    expect(naechsterTermin(regel({ art: 'woechentlich', tage: ['MO'] }), '2026-11-18')).toBe('2026-11-23');
  });

  it('wöchentlich an mehreren Wochentagen (Mo und Do)', () => {
    expect(folge(regel({ art: 'woechentlich', tage: ['MO', 'DO'] }), '2026-11-16', 4)).toEqual([
      '2026-11-19',
      '2026-11-23',
      '2026-11-26',
      '2026-11-30',
    ]);
  });

  it('alle 2 Wochen an Mo und Do: der Rhythmus bleibt erhalten', () => {
    expect(folge(regel({ art: 'woechentlich', tage: ['MO', 'DO'], intervall: 2 }), '2026-11-16', 4)).toEqual([
      '2026-11-19',
      '2026-11-30',
      '2026-12-03',
      '2026-12-14',
    ]);
  });

  it('werktags überspringt das Wochenende', () => {
    const werktags = regel({ art: 'woechentlich', tage: ['MO', 'DI', 'MI', 'DO', 'FR'] });
    // 2026-11-20 ist ein Freitag
    expect(folge(werktags, '2026-11-20', 2)).toEqual(['2026-11-23', '2026-11-24']);
  });

  it('monatlich am 15.', () => {
    expect(folge(regel({ art: 'monatlich', tag: 15 }), '2026-11-15', 3)).toEqual(['2026-12-15', '2027-01-15', '2027-02-15']);
    // liegt die Fälligkeit vor dem 15., kommt erst der 15. desselben Monats
    expect(naechsterTermin(regel({ art: 'monatlich', tag: 15 }), '2026-11-10')).toBe('2026-11-15');
  });

  it('monatlich am 31.: in kurzen Monaten gilt der letzte Tag', () => {
    expect(folge(regel({ art: 'monatlich', tag: 31 }), '2027-01-31', 4)).toEqual([
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
      '2027-05-31',
    ]);
    // Schaltjahr 2028: der Februar hat 29 Tage
    expect(naechsterTermin(regel({ art: 'monatlich', tag: 31 }), '2028-01-31')).toBe('2028-02-29');
  });

  it('jeden Monatsersten und alle 3 Monate', () => {
    expect(folge(regel({ art: 'monatlich', tag: 1 }), '2026-11-16', 2)).toEqual(['2026-12-01', '2027-01-01']);
    expect(folge(regel({ art: 'monatlich', tag: 1, intervall: 3 }), '2026-11-01', 2)).toEqual(['2027-02-01', '2027-05-01']);
  });

  it('monatlich am ersten Montag und am letzten Freitag', () => {
    expect(folge(regel({ art: 'monatlich-wochentag', woche: 1, wochentag: 'MO' }), '2026-11-02', 3)).toEqual([
      '2026-12-07',
      '2027-01-04',
      '2027-02-01',
    ]);
    expect(folge(regel({ art: 'monatlich-wochentag', woche: -1, wochentag: 'FR' }), '2026-11-01', 3)).toEqual([
      '2026-11-27',
      '2026-12-25',
      '2027-01-29',
    ]);
    // dritter Donnerstag
    expect(naechsterTermin(regel({ art: 'monatlich-wochentag', woche: 3, wochentag: 'DO' }), '2026-11-01')).toBe('2026-11-19');
  });

  it('jährlich an einem Datum', () => {
    expect(folge(regel({ art: 'jaehrlich', monat: 3, tag: 15 }), '2026-03-15', 2)).toEqual(['2027-03-15', '2028-03-15']);
    expect(naechsterTermin(regel({ art: 'jaehrlich', monat: 3, tag: 15 }), '2026-01-10')).toBe('2026-03-15');
  });

  it('jährlich am 29. Februar: außerhalb von Schaltjahren am 28.', () => {
    expect(folge(regel({ art: 'jaehrlich', monat: 2, tag: 29 }), '2024-02-29', 4)).toEqual([
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ]);
  });

  it('erster Termin am oder nach einem Datum', () => {
    expect(ersterTermin(regel({ art: 'woechentlich', tage: ['SO'] }), '2026-11-16')).toBe('2026-11-22');
    expect(ersterTermin(regel({ art: 'woechentlich', tage: ['MO'] }), '2026-11-16')).toBe('2026-11-16');
    expect(ersterTermin(regel({ art: 'monatlich', tag: 1 }), '2026-11-16')).toBe('2026-12-01');
    expect(ersterTermin(regel({ art: 'taeglich', intervall: 5 }), '2026-11-16')).toBe('2026-11-16');
  });
});

describe('Nächste Fälligkeit nach dem Abhaken', () => {
  const jedenMontag = regel({ art: 'woechentlich', tage: ['MO'] });

  it('ab Fälligkeit: heute fällig und heute abgehakt → nächste Woche', () => {
    expect(naechsteFaelligkeit(jedenMontag, '2026-11-16', '2026-11-16T10:00')).toBe('2026-11-23');
  });

  it('verpasste Termine werden übersprungen, nicht nachgeholt', () => {
    // seit drei Wochen überfällig, abgehakt an einem Mittwoch
    expect(naechsteFaelligkeit(jedenMontag, '2026-10-26', '2026-11-18T10:00')).toBe('2026-11-23');
    // täglich, seit einem Monat liegen geblieben
    expect(naechsteFaelligkeit(regel({ art: 'taeglich' }), '2026-10-01', '2026-11-18T10:00')).toBe('2026-11-19');
    // alle 2 Wochen: der Zwei-Wochen-Rhythmus bleibt beim Überspringen erhalten
    const alleZwei = regel({ art: 'woechentlich', tage: ['MO'], intervall: 2 });
    expect(naechsteFaelligkeit(alleZwei, '2026-10-05', '2026-11-18T10:00')).toBe('2026-11-30');
  });

  it('vorzeitig abgehakt: der Termin nach der eigentlichen Fälligkeit', () => {
    expect(naechsteFaelligkeit(jedenMontag, '2026-11-23', '2026-11-20T10:00')).toBe('2026-11-30');
  });

  it('die Uhrzeit bleibt erhalten und zählt mit', () => {
    // heute 18:00 fällig, um 10:00 abgehakt → nächste Woche 18:00
    expect(naechsteFaelligkeit(jedenMontag, '2026-11-16T18:00', '2026-11-16T10:00')).toBe('2026-11-23T18:00');
    // täglich 9:00, heute um 8:00 abgehakt (Termin von gestern war offen) → heute 9:00 liegt noch in der Zukunft
    expect(naechsteFaelligkeit(regel({ art: 'taeglich' }), '2026-11-15T09:00', '2026-11-16T08:00')).toBe('2026-11-16T09:00');
    // … um 10:00 abgehakt → morgen 9:00
    expect(naechsteFaelligkeit(regel({ art: 'taeglich' }), '2026-11-15T09:00', '2026-11-16T10:00')).toBe('2026-11-17T09:00');
  });

  it('ab Erledigung: der Abstand zählt ab dem Abhaken', () => {
    const dreiTage = regel({ art: 'taeglich', intervall: 3, ab: 'erledigung' });
    // war am 10. fällig, erst am 18. erledigt → 21., nicht 13./16./19.
    expect(naechsteFaelligkeit(dreiTage, '2026-11-10', '2026-11-18T10:00')).toBe('2026-11-21');
    // dieselbe Regel „ab Fälligkeit“ bleibt im alten Raster: 10., 13., 16., 19.
    expect(naechsteFaelligkeit({ ...dreiTage, ab: 'faellig' }, '2026-11-10', '2026-11-18T10:00')).toBe('2026-11-19');

    expect(naechsteFaelligkeit(regel({ art: 'woechentlich', tage: [], intervall: 2, ab: 'erledigung' }), '2026-11-10', '2026-11-18T10:00')).toBe('2026-12-02');
    expect(naechsteFaelligkeit(regel({ art: 'monatlich', tag: 1, ab: 'erledigung' }), '2026-11-10', '2027-01-31T10:00')).toBe('2027-02-28');
    expect(naechsteFaelligkeit(regel({ art: 'jaehrlich', monat: 1, tag: 1, ab: 'erledigung' }), null, '2028-02-29T10:00')).toBe('2029-02-28');
  });

  it('Sommer-/Winterzeit: 9:00 bleibt 9:00', () => {
    const taeglich = regel({ art: 'taeglich' });
    // Ende der Sommerzeit in der Nacht zum 25. Oktober 2026
    expect(naechsteFaelligkeit(taeglich, '2026-10-24T09:00', '2026-10-24T09:30')).toBe('2026-10-25T09:00');
    expect(naechsteFaelligkeit(taeglich, '2026-10-25T09:00', '2026-10-25T09:30')).toBe('2026-10-26T09:00');
    // Beginn der Sommerzeit in der Nacht zum 28. März 2027
    expect(naechsteFaelligkeit(taeglich, '2027-03-27T09:00', '2027-03-27T09:30')).toBe('2027-03-28T09:00');
    const sonntags = regel({ art: 'woechentlich', tage: ['SO'] });
    expect(naechsteFaelligkeit(sonntags, '2027-03-21T09:00', '2027-03-21T12:00')).toBe('2027-03-28T09:00');
  });
});

describe('Abhaken', () => {
  const aufgabe = (teil: Partial<Aufgabe>): Aufgabe => ({ ...neueAufgabe(), ...teil });
  const STEMPEL = '2026-11-16T09:00:00Z';

  it('ohne Wiederholung: einfach erledigt', () => {
    const { aufgabe: danach, naechste } = hakeAb(aufgabe({ faellig: '2026-11-16' }), '2026-11-16T10:00', STEMPEL);
    expect(naechste).toBeNull();
    expect(danach).toMatchObject({ erledigt: true, erledigt_am: STEMPEL, erledigt_verlauf: [] });
  });

  it('mit Wiederholung: bleibt offen, springt weiter, Zeitpunkt kommt in den Verlauf', () => {
    const vorher = aufgabe({ faellig: '2026-11-16T18:00', wiederholung: regel({ art: 'woechentlich', tage: ['MO'] }) });
    const { aufgabe: danach, naechste } = hakeAb(vorher, '2026-11-16T18:30', STEMPEL);
    expect(naechste).toBe('2026-11-23T18:00');
    expect(danach).toMatchObject({
      erledigt: false,
      erledigt_am: null,
      faellig: '2026-11-23T18:00',
      erledigt_verlauf: [STEMPEL],
    });
    // „Rückgängig“ setzt einfach die Aufgabe von vorher wieder ein – sie ist unverändert geblieben
    expect(vorher).toEqual(aufgabe({ faellig: '2026-11-16T18:00', wiederholung: regel({ art: 'woechentlich', tage: ['MO'] }) }));
  });

  it('der Verlauf behält nur die neuesten Einträge', () => {
    let a = aufgabe({ faellig: '2026-01-01', wiederholung: regel({ art: 'taeglich' }) });
    for (let tag = 1; tag <= 20; tag++) {
      a = hakeAb(a, `2026-01-${String(tag).padStart(2, '0')}T08:00`, `2026-01-${String(tag).padStart(2, '0')}T07:00:00Z`).aufgabe;
    }
    expect(a.erledigt_verlauf).toHaveLength(12);
    expect(a.erledigt_verlauf[11]).toBe('2026-01-20T07:00:00Z');
    expect(a.faellig).toBe('2026-01-21');
  });

  it('endet am Datum: danach wird die Aufgabe normal erledigt', () => {
    const w = regel({ art: 'woechentlich', tage: ['MO'], ende: { art: 'datum', datum: '2026-11-30' } });
    const erste = hakeAb(aufgabe({ faellig: '2026-11-16', wiederholung: w }), '2026-11-16T10:00', STEMPEL);
    expect(erste.naechste).toBe('2026-11-23');
    const zweite = hakeAb(erste.aufgabe, '2026-11-23T10:00', STEMPEL);
    expect(zweite.naechste).toBe('2026-11-30'); // das Enddatum selbst zählt noch
    const dritte = hakeAb(zweite.aufgabe, '2026-11-30T10:00', STEMPEL);
    expect(dritte.naechste).toBeNull();
    expect(dritte.aufgabe.erledigt).toBe(true);
    expect(dritte.aufgabe.erledigt_verlauf).toHaveLength(3);
  });

  it('endet nach n Mal: insgesamt n Fälligkeiten', () => {
    const w = regel({ art: 'taeglich', ende: { art: 'anzahl', anzahl: 3 } });
    const erste = hakeAb(aufgabe({ faellig: '2026-11-16', wiederholung: w }), '2026-11-16T10:00', STEMPEL);
    expect(erste.aufgabe.wiederholung?.ende).toEqual({ art: 'anzahl', anzahl: 2 });
    expect(erste.aufgabe.erledigt).toBe(false);
    const zweite = hakeAb(erste.aufgabe, '2026-11-17T10:00', STEMPEL);
    expect(zweite.aufgabe.wiederholung?.ende).toEqual({ art: 'anzahl', anzahl: 1 });
    const dritte = hakeAb(zweite.aufgabe, '2026-11-18T10:00', STEMPEL);
    expect(dritte.aufgabe.erledigt).toBe(true);
    expect(dritte.naechste).toBeNull();
  });
});

describe('Schnellwerte und Kurztext', () => {
  it('Schnellwerte nehmen Wochentag, Tag und Monat vom Bezugsdatum', () => {
    // 2026-11-22 ist ein Sonntag
    expect(ausSchnellwert('woechentlich', '2026-11-22')).toMatchObject({ art: 'woechentlich', tage: ['SO'] });
    expect(ausSchnellwert('monatlich', '2026-11-22')).toMatchObject({ art: 'monatlich', tag: 22 });
    expect(ausSchnellwert('monatsersten', '2026-11-22')).toMatchObject({ art: 'monatlich', tag: 1 });
    expect(ausSchnellwert('jaehrlich', '2026-11-22')).toMatchObject({ art: 'jaehrlich', monat: 11, tag: 22 });
    expect(alsSchnellwert(ausSchnellwert('werktags', '2026-11-22'), '2026-11-22')).toBe('werktags');
    expect(alsSchnellwert(regel({ art: 'taeglich', intervall: 3 }), '2026-11-22')).toBeNull();
  });

  it('Kurztext an der Aufgabe', () => {
    expect(wiederholungKurz(regel({ art: 'taeglich' }))).toBe('täglich');
    expect(wiederholungKurz(regel({ art: 'taeglich', intervall: 3 }))).toBe('alle 3 Tage');
    expect(wiederholungKurz(regel({ art: 'woechentlich', tage: ['SO'] }))).toBe('jeden So');
    expect(wiederholungKurz(regel({ art: 'woechentlich', tage: ['DO', 'MO'] }))).toBe('Mo, Do');
    expect(wiederholungKurz(regel({ art: 'woechentlich', tage: ['MO', 'DI', 'MI', 'DO', 'FR'] }))).toBe('werktags');
    expect(wiederholungKurz(regel({ art: 'woechentlich', tage: ['MO'], intervall: 2 }))).toBe('alle 2 Wochen: Mo');
    expect(wiederholungKurz(regel({ art: 'monatlich', tag: 1 }))).toBe('1. im Monat');
    expect(wiederholungKurz(regel({ art: 'monatlich-wochentag', woche: -1, wochentag: 'FR' }))).toBe('letzter Fr im Monat');
    expect(wiederholungKurz(regel({ art: 'jaehrlich', monat: 3, tag: 15 }))).toBe('jährlich 15. Mär');
    expect(wiederholungKurz(regel({ art: 'taeglich', intervall: 3, ab: 'erledigung' }))).toBe('3 Tage nach Erledigung');
    expect(endeKurz({ art: 'anzahl', anzahl: 3 })).toBe('noch 3 Mal');
    expect(endeKurz({ art: 'datum', datum: '2027-01-31' })).toBe('bis 31. Jan 2027');
    expect(endeKurz({ art: 'nie' })).toBe('');
  });

  it('Rückmeldung nach dem Abhaken', () => {
    expect(formatNaechste('2026-11-23', '2026-11-16')).toBe('Mo, 23. Nov');
    expect(formatNaechste('2027-01-04T18:00', '2026-11-16')).toBe('Mo, 4. Jan 2027 18:00');
  });
});

describe('Format im Metadaten-Kommentar', () => {
  const beispiele: [Wiederholung, string][] = [
    [regel({ art: 'taeglich' }), 'taeglich;ab=faellig'],
    [regel({ art: 'taeglich', intervall: 3, ab: 'erledigung' }), 'taeglich;alle=3;ab=erledigung'],
    [regel({ art: 'woechentlich', tage: ['MO', 'DO'] }), 'woechentlich;tage=MO,DO;ab=faellig'],
    [regel({ art: 'woechentlich', tage: [], intervall: 2 }), 'woechentlich;alle=2;ab=faellig'],
    [regel({ art: 'monatlich', tag: 15 }), 'monatlich;tag=15;ab=faellig'],
    [regel({ art: 'monatlich-wochentag', woche: 1, wochentag: 'MO' }), 'monatlich;am=1.MO;ab=faellig'],
    [regel({ art: 'monatlich-wochentag', woche: -1, wochentag: 'FR' }), 'monatlich;am=letzter.FR;ab=faellig'],
    [regel({ art: 'jaehrlich', monat: 3, tag: 15 }), 'jaehrlich;datum=03-15;ab=faellig'],
    [regel({ art: 'taeglich', ende: { art: 'datum', datum: '2027-01-31' } }), 'taeglich;ab=faellig;ende=2027-01-31'],
    [regel({ art: 'monatlich', tag: 1, ende: { art: 'anzahl', anzahl: 3 } }), 'monatlich;tag=1;ab=faellig;noch=3'],
  ];

  it.each(beispiele)('schreibt und liest %o', (w, text) => {
    expect(schreibeRegel(w)).toBe(text);
    expect(leseRegel(text)).toEqual(w);
    expect(text).not.toMatch(/\s/);
  });

  it('die Wochentage stehen immer in Wochenreihenfolge', () => {
    expect(schreibeRegel(regel({ art: 'woechentlich', tage: ['DO', 'MO'] }))).toBe('woechentlich;tage=MO,DO;ab=faellig');
  });

  it('keine Regel und Unlesbares', () => {
    expect(schreibeRegel(null)).toBe('keine');
    expect(leseRegel('keine')).toBeNull();
    expect(leseRegel(undefined)).toBeNull();
    expect(leseRegel('irgendwas;x=1')).toBeNull();
    expect(leseRegel('monatlich;tag=99')).toBeNull();
    expect(leseRegel('jaehrlich;datum=13-40')).toBeNull();
  });
});
