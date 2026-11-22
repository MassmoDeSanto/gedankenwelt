import { describe, expect, it } from 'vitest';
import { TAGEBUCH_ID, neueAufgabe, type Aufgabe, type Tagebuchtag } from '../modell/typen';
import {
  ersterWochentag,
  kartenLink,
  monatAusPfad,
  monatsPfad,
  monatsuebersicht,
  tageImMonat,
  tagebuchTagVon,
  tagesspur,
  verschiebeMonat,
  vorEinemJahr,
  vorEinemJahrDatum,
} from './tagebuch';
import { baueNotiz } from './test-hilfe';

describe('Tagebuch: Tageszuordnung', () => {
  it('tagsüber gehört ein Eintrag zum selben Tag', () => {
    expect(tagebuchTagVon('2026-11-16T10:30')).toBe('2026-11-16');
    expect(tagebuchTagVon('2026-11-16T23:59')).toBe('2026-11-16');
  });

  it('vor dem Tageswechsel um 4 Uhr gehört ein Eintrag zum Vortag', () => {
    expect(tagebuchTagVon('2026-11-17T01:00')).toBe('2026-11-16');
    expect(tagebuchTagVon('2026-11-17T03:59')).toBe('2026-11-16');
    expect(tagebuchTagVon('2026-11-17T04:00')).toBe('2026-11-17');
  });

  it('über Monats- und Jahresgrenzen', () => {
    expect(tagebuchTagVon('2026-12-01T02:00')).toBe('2026-11-30');
    expect(tagebuchTagVon('2027-01-01T00:30')).toBe('2026-12-31');
    expect(tagebuchTagVon('2028-03-01T03:00')).toBe('2028-02-29');
  });

  it('eigene Uhrzeit für den Tageswechsel', () => {
    expect(tagebuchTagVon('2026-11-17T05:00', '06:00')).toBe('2026-11-16');
    expect(tagebuchTagVon('2026-11-17T00:30', '00:00')).toBe('2026-11-17');
  });
});

describe('Tagebuch: Pfade der Monatsdateien', () => {
  it('hin und zurück', () => {
    expect(monatsPfad('2026-11')).toBe('_Tagebuch/2026/2026-11.md');
    expect(monatAusPfad('_Tagebuch/2026/2026-11.md')).toBe('2026-11');
  });

  it('fremde Pfade sind keine Monatsdateien', () => {
    expect(monatAusPfad('_Tagebuch/2026/notizen.md')).toBeNull();
    expect(monatAusPfad('_Tagebuch/2025/2026-11.md')).toBeNull();
    expect(monatAusPfad('Tagebuch/2026/2026-11.md')).toBeNull();
  });
});

// Zeitpunkte um 12 Uhr Weltzeit: In jeder Zeitzone Europas derselbe Tag, also unabhängig vom Rechner.
const mittag = (datum: string) => `${datum}T12:00:00Z`;

function aufgabe(teil: Partial<Aufgabe>): Aufgabe {
  return { ...neueAufgabe(), ...teil };
}

describe('Tagebuch: Tagesspur', () => {
  it('erledigte Aufgaben, einzelne Male wiederkehrender Aufgaben und neue Gedanken des Tages', () => {
    const erledigt = baueNotiz({ text: 'Steuer abgeben', aufgabe: aufgabe({ erledigt: true, erledigt_am: mittag('2026-11-20') }) });
    const wiederkehrend = baueNotiz({
      text: 'Zählerstand',
      aufgabe: aufgabe({ wiederholung: null, erledigt_verlauf: [mittag('2026-11-13'), mittag('2026-11-20')] }),
    });
    const neu = baueNotiz({ text: 'Neue Idee', erstellt: mittag('2026-11-20') });
    const alt = baueNotiz({ text: 'Alte Idee, heute bearbeitet', erstellt: mittag('2026-11-01'), geaendert: mittag('2026-11-20') });
    const geloescht = baueNotiz({ text: 'Weg', erstellt: mittag('2026-11-20'), geloescht: mittag('2026-11-20') });
    const imTagebuch = baueNotiz({ text: 'Tagebuch zählt nicht als neuer Gedanke', liste_id: TAGEBUCH_ID, erstellt: mittag('2026-11-20') });

    const spur = tagesspur([erledigt, wiederkehrend, neu, alt, geloescht, imTagebuch], '2026-11-20');
    expect(spur.erledigt.map((n) => n.text)).toEqual(['Steuer abgeben', 'Zählerstand']);
    expect(spur.neu.map((n) => n.text)).toEqual(['Neue Idee']);
  });

  it('beendete Wiederholung zählt nur einmal, auch wenn der Zeitpunkt in Verlauf und erledigt_am steht', () => {
    const n = baueNotiz({
      text: 'Kurs',
      erstellt: mittag('2026-10-01'),
      aufgabe: aufgabe({ erledigt: true, erledigt_am: mittag('2026-11-20'), erledigt_verlauf: [mittag('2026-11-20')] }),
    });
    expect(monatsuebersicht('2026-11', [n], []).erledigt).toBe(1);
    expect(tagesspur([n], '2026-11-20').erledigt).toHaveLength(1);
  });
});

describe('Tagebuch: Monatsübersicht', () => {
  const tag = (datum: string, teil: Partial<Tagebuchtag>): Tagebuchtag => ({
    id: datum,
    datum,
    titel: '',
    bewertung: null,
    impuls: null,
    gewohnheiten: [],
    erstellt: mittag(datum),
    geaendert: mittag(datum),
    geloescht: null,
    ...teil,
  });

  it('Raster, Durchschnitt, bester Tag, Zahlen und Tags', () => {
    const notizen = [
      baueNotiz({ text: 'Text #arbeit', liste_id: TAGEBUCH_ID, tagebuch_tag: '2026-11-02' }),
      baueNotiz({ text: 'Mehr #arbeit #sport', liste_id: TAGEBUCH_ID, tagebuch_tag: '2026-11-05' }),
      baueNotiz({ text: 'Oktober', liste_id: TAGEBUCH_ID, tagebuch_tag: '2026-10-31' }),
      baueNotiz({ text: 'Neuer Gedanke', erstellt: mittag('2026-11-07') }),
      baueNotiz({ text: 'Erledigt', erstellt: mittag('2026-10-07'), aufgabe: aufgabe({ erledigt: true, erledigt_am: mittag('2026-11-08') }) }),
    ];
    const tage = [
      tag('2026-11-02', { bewertung: 4 }),
      tag('2026-11-05', { bewertung: 5, titel: 'Großartig' }),
      tag('2026-11-09', { bewertung: 2 }),
      tag('2026-11-12', { titel: 'Nur Überschrift' }),
      tag('2026-10-30', { bewertung: 5 }),
    ];
    const m = monatsuebersicht('2026-11', notizen, tage);

    expect(m.tage).toHaveLength(30);
    expect(m.tage.filter((t) => t.geschrieben).map((t) => t.datum)).toEqual(['2026-11-02', '2026-11-05', '2026-11-09', '2026-11-12']);
    expect(m.tage[4]).toEqual({ datum: '2026-11-05', bewertung: 5, geschrieben: true });
    expect(m.durchschnitt).toBe(3.7);
    expect(m.besterTag).toEqual({ datum: '2026-11-05', titel: 'Großartig', bewertung: 5 });
    expect(m.geschrieben).toBe(4);
    expect(m.neueGedanken).toBe(1);
    expect(m.erledigt).toBe(1);
    expect(m.tags).toEqual([
      { tag: 'arbeit', anzahl: 2 },
      { tag: 'sport', anzahl: 1 },
    ]);
  });

  it('Gewohnheiten: an wie vielen Tagen abgehakt', () => {
    const m = monatsuebersicht('2026-11', [], [
      tag('2026-11-01', { gewohnheiten: ['sport', 'lesen'] }),
      tag('2026-11-02', { gewohnheiten: ['sport'] }),
      tag('2026-10-31', { gewohnheiten: ['sport'] }),
    ]);
    expect(Object.fromEntries(m.gewohnheiten)).toEqual({ sport: 2, lesen: 1 });
  });

  it('leerer Monat', () => {
    const m = monatsuebersicht('2026-02', [], []);
    expect(m.tage).toHaveLength(28);
    expect(m.durchschnitt).toBeNull();
    expect(m.besterTag).toBeNull();
  });

  it('Kalenderraster und Monatswechsel', () => {
    expect(ersterWochentag('2026-11')).toBe(6); // 1. Nov 2026 ist ein Sonntag
    expect(ersterWochentag('2026-12')).toBe(1); // 1. Dez 2026 ist ein Dienstag
    expect(tageImMonat('2028-02')).toBe(29);
    expect(verschiebeMonat('2026-01', -1)).toBe('2025-12');
    expect(verschiebeMonat('2026-12', 1)).toBe('2027-01');
  });
});

describe('Tagebuch: Ort', () => {
  it('Link zur Karten-App: Apple Karten am iPhone, sonst Google Maps', () => {
    expect(kartenLink(' Lissabon, Alfama ', true)).toBe('https://maps.apple.com/?q=Lissabon%2C%20Alfama');
    expect(kartenLink('Café Kranzler & Co', false)).toBe(
      'https://www.google.com/maps/search/?api=1&query=Caf%C3%A9%20Kranzler%20%26%20Co',
    );
  });
});

describe('Tagebuch: Vor einem Jahr', () => {
  it('derselbe Tag ein Jahr früher, mit Überschrift und erstem Absatz', () => {
    const notizen = [
      baueNotiz({ text: 'Erster Absatz', liste_id: TAGEBUCH_ID, tagebuch_tag: '2025-11-22', position: 1 }),
      baueNotiz({ text: 'Zweiter', liste_id: TAGEBUCH_ID, tagebuch_tag: '2025-11-22', position: 2 }),
    ];
    const tage: Tagebuchtag[] = [
      { id: 'x', datum: '2025-11-22', titel: 'Damals', bewertung: 3, impuls: null, gewohnheiten: [], erstellt: '', geaendert: '', geloescht: null },
    ];
    expect(vorEinemJahr('2026-11-22', notizen, tage)).toEqual({ datum: '2025-11-22', titel: 'Damals', ort: '', bewertung: 3, text: 'Erster Absatz' });
    expect(vorEinemJahr('2026-11-23', notizen, tage)).toBeNull();
  });

  it('aus dem 29. Februar wird der 28.', () => {
    expect(vorEinemJahrDatum('2028-02-29')).toBe('2027-02-28');
  });
});
