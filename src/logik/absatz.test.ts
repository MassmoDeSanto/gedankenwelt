import { describe, expect, it } from 'vitest';
import {
  bearbeiteNotiz,
  endetMitTrennung,
  enthaeltTrennung,
  erzeugeNotizen,
  fuehreZusammen,
  leseAufgabenPraefix,
  positionenZwischen,
  zerlegeText,
} from './absatz';
import { baueNotiz, testUmgebung } from './test-hilfe';

const enter = (n: number) => '\n'.repeat(n);

describe('zerlegeText', () => {
  it('1× Enter bleibt in derselben Notiz', () => {
    expect(zerlegeText('eins' + enter(1) + 'zwei')).toEqual(['eins\nzwei']);
  });

  it.each([2, 4, 10])('%i× Enter trennt in genau zwei Notizen', (n) => {
    expect(zerlegeText('eins' + enter(n) + 'zwei')).toEqual(['eins', 'zwei']);
  });

  it('Enter am Anfang und Ende erzeugt keine leeren Notizen', () => {
    expect(zerlegeText(enter(3) + 'eins' + enter(2) + 'zwei' + enter(5))).toEqual(['eins', 'zwei']);
  });

  it('leerer Text und reine Leerzeilen ergeben keine Notiz', () => {
    expect(zerlegeText('')).toEqual([]);
    expect(zerlegeText(enter(10))).toEqual([]);
    expect(zerlegeText('  \n \t \n  ')).toEqual([]);
  });

  it('Zeilen nur aus Leerzeichen zählen als leere Zeile', () => {
    expect(zerlegeText('eins\n   \nzwei')).toEqual(['eins', 'zwei']);
  });

  it('Windows-Zeilenenden werden verstanden', () => {
    expect(zerlegeText('eins\r\n\r\nzwei\r\ndrei')).toEqual(['eins', 'zwei\ndrei']);
  });

  it('mehrere Absätze mit Zeilenumbrüchen darin', () => {
    expect(zerlegeText('a\nb\n\nc\n\n\n\nd\ne')).toEqual(['a\nb', 'c', 'd\ne']);
  });
});

describe('Trennung erkennen', () => {
  it('enthaeltTrennung', () => {
    expect(enthaeltTrennung('a\nb')).toBe(false);
    expect(enthaeltTrennung('a\n\nb')).toBe(true);
    expect(enthaeltTrennung('a\n')).toBe(false);
    expect(enthaeltTrennung('a\n\n')).toBe(true);
  });

  it('endetMitTrennung', () => {
    expect(endetMitTrennung('a\n')).toBe(false);
    expect(endetMitTrennung('a\n\n')).toBe(true);
    expect(endetMitTrennung('a\n\n\n\n')).toBe(true);
    expect(endetMitTrennung('a\n\nb')).toBe(false);
  });
});

describe('Aufgaben-Kästchen', () => {
  it('erkennt offen und erledigt', () => {
    expect(leseAufgabenPraefix('[ ] Milch')).toEqual({ text: 'Milch', zustand: 'offen' });
    expect(leseAufgabenPraefix('[] Milch')).toEqual({ text: 'Milch', zustand: 'offen' });
    expect(leseAufgabenPraefix('[x] Milch')).toEqual({ text: 'Milch', zustand: 'erledigt' });
  });

  it('lässt anderen Text in Ruhe', () => {
    expect(leseAufgabenPraefix('Milch [ ] kaufen').zustand).toBeNull();
    expect(leseAufgabenPraefix('[1] Quelle').zustand).toBeNull();
    expect(leseAufgabenPraefix('[ ]').zustand).toBeNull();
  });
});

describe('positionenZwischen', () => {
  it('liegt immer zwischen den Nachbarn und ist aufsteigend', () => {
    expect(positionenZwischen(1, 2, 1)).toEqual([1.5]);
    expect(positionenZwischen(1, 2, 3)).toEqual([1.25, 1.5, 1.75]);
    expect(positionenZwischen(null, null, 2)).toEqual([1, 2]);
    expect(positionenZwischen(5, null, 2)).toEqual([6, 7]);
    expect(positionenZwischen(null, 5, 2)).toEqual([3, 4]);
  });
});

describe('erzeugeNotizen', () => {
  it('macht aus jedem Absatz eine Notiz mit Erstelldatum und Tags', () => {
    const umg = testUmgebung();
    const notizen = erzeugeNotizen('Erster #idee\n\n\n[ ] Zweiter', 'L1', null, null, umg);
    expect(notizen).toHaveLength(2);
    expect(notizen[0]).toMatchObject({ text: 'Erster #idee', tags: ['idee'], erstellt: umg.jetzt, aufgabe: null });
    expect(notizen[1].text).toBe('Zweiter');
    expect(notizen[1].aufgabe?.erledigt).toBe(false);
    expect(notizen[0].id).not.toBe(notizen[1].id);
    expect(notizen[0].position).toBeLessThan(notizen[1].position);
  });
});

describe('bearbeiteNotiz', () => {
  it('Bearbeiten behält ID und Erstelldatum, nur „geaendert“ ändert sich', () => {
    const alt = baueNotiz({ text: 'alt' });
    const { notiz, abgetrennt } = bearbeiteNotiz(alt, 'neu #tag', null, testUmgebung());
    expect(abgetrennt).toEqual([]);
    expect(notiz).toMatchObject({ id: alt.id, erstellt: alt.erstellt, text: 'neu #tag', tags: ['tag'] });
    expect(notiz!.geaendert).toBe('2026-11-15T12:00:00Z');
  });

  it('unveränderter Text ändert nichts (auch nicht mit Enter am Ende)', () => {
    const alt = baueNotiz({ text: 'gleich' });
    expect(bearbeiteNotiz(alt, 'gleich\n', null, testUmgebung()).notiz).toBe(alt);
  });

  it('Teilen: erster Teil behält die ID, zweiter bekommt neue ID und aktuelles Datum', () => {
    const umg = testUmgebung();
    const alt = baueNotiz({ text: 'eins zwei', position: 1 });
    const { notiz, abgetrennt } = bearbeiteNotiz(alt, 'eins\n\nzwei', 2, umg);
    expect(notiz).toMatchObject({ id: alt.id, erstellt: alt.erstellt, text: 'eins' });
    expect(abgetrennt).toHaveLength(1);
    expect(abgetrennt[0].text).toBe('zwei');
    expect(abgetrennt[0].id).not.toBe(alt.id);
    expect(abgetrennt[0].erstellt).toBe(umg.jetzt);
    expect(abgetrennt[0].liste_id).toBe(alt.liste_id);
    // landet zwischen der alten Notiz (1) und der bisher nächsten (2)
    expect(abgetrennt[0].position).toBeGreaterThan(1);
    expect(abgetrennt[0].position).toBeLessThan(2);
  });

  it('10× Enter mitten im Text teilt in genau zwei Notizen', () => {
    const alt = baueNotiz({ text: 'eins zwei' });
    const { abgetrennt } = bearbeiteNotiz(alt, 'eins' + enter(10) + 'zwei', null, testUmgebung());
    expect(abgetrennt.map((n) => n.text)).toEqual(['zwei']);
  });

  it('leer gewordener Text meldet „keine Notiz mehr“', () => {
    const alt = baueNotiz({ text: 'weg' });
    expect(bearbeiteNotiz(alt, ' \n\n ', null, testUmgebung())).toEqual({ notiz: null, abgetrennt: [] });
  });

  it('„[ ] “ am Anfang macht die Notiz zur Aufgabe', () => {
    const alt = baueNotiz({ text: 'Milch' });
    const { notiz } = bearbeiteNotiz(alt, '[ ] Milch', null, testUmgebung());
    expect(notiz!.text).toBe('Milch');
    expect(notiz!.aufgabe).toMatchObject({ erledigt: false, faellig: null });
  });
});

describe('fuehreZusammen', () => {
  it('obere bleibt mit ID und Datum, untere wandert in den Papierkorb', () => {
    const umg = testUmgebung();
    const obere = baueNotiz({ text: 'oben #a', erstellt: '2026-01-01T12:00:00Z' });
    const untere = baueNotiz({ text: 'unten #b', erstellt: '2026-02-02T12:00:00Z' });
    const ergebnis = fuehreZusammen(obere, untere, umg);
    expect(ergebnis.obere).toMatchObject({
      id: obere.id,
      erstellt: '2026-01-01T12:00:00Z',
      text: 'oben #a\nunten #b',
      tags: ['a', 'b'],
      geloescht: null,
    });
    expect(ergebnis.untere).toMatchObject({ id: untere.id, geloescht: umg.jetzt, text: 'unten #b' });
  });
});
