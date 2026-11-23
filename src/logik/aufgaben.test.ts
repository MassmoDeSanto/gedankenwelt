import { describe, expect, it } from 'vitest';
import { neueAufgabe, type Aufgabe } from '../modell/typen';
import {
  abstandText,
  dringlichkeitsstufe,
  gruppiereAufgaben,
  kalenderblatt,
  naechsterStand,
  naechstePrioritaet,
  offeneAufgaben,
} from './aufgaben';
import { baueNotiz } from './test-hilfe';

function aufgabe(text: string, teil: Partial<Aufgabe>, erstellt = '2026-11-01T12:00:00Z') {
  return baueNotiz({ text, erstellt, aufgabe: { ...neueAufgabe(), ...teil } });
}

describe('Sortierung offener Aufgaben', () => {
  it('erst Priorität, dann Fälligkeit, dann ohne Datum (neueste zuerst)', () => {
    const notizen = [
      aufgabe('ohne alles alt', {}, '2026-11-01T12:00:00Z'),
      aufgabe('ohne alles neu', {}, '2026-11-05T12:00:00Z'),
      aufgabe('niedrig bald', { prioritaet: 'niedrig', faellig: '2026-11-21' }),
      aufgabe('keine Prio, früh fällig', { faellig: '2026-11-18' }),
      aufgabe('hoch ohne Datum', { prioritaet: 'hoch' }),
      aufgabe('hoch spät', { prioritaet: 'hoch', faellig: '2026-12-01' }),
      aufgabe('mittel', { prioritaet: 'mittel', faellig: '2026-11-25' }),
      aufgabe('hoch früh', { prioritaet: 'hoch', faellig: '2026-11-22T09:00' }),
    ];
    expect(offeneAufgaben(notizen).map((n) => n.text)).toEqual([
      'hoch früh',
      'hoch spät',
      'hoch ohne Datum',
      'mittel',
      'niedrig bald',
      'keine Prio, früh fällig',
      'ohne alles neu',
      'ohne alles alt',
    ]);
  });

  it('Stand ändert die Reihenfolge nicht, Erledigte fehlen', () => {
    const notizen = [
      aufgabe('in Arbeit', { stand: 'in_arbeit', faellig: '2026-11-25' }),
      aufgabe('offen', { faellig: '2026-11-21' }),
      aufgabe('erledigt', { erledigt: true, prioritaet: 'hoch' }),
    ];
    expect(offeneAufgaben(notizen).map((n) => n.text)).toEqual(['offen', 'in Arbeit']);
  });

  it('Sammelansicht: Gruppen bleiben, innerhalb erst Priorität', () => {
    const notizen = [
      aufgabe('heute keine', { faellig: '2026-11-20' }),
      aufgabe('heute hoch', { prioritaet: 'hoch', faellig: '2026-11-20T18:00' }),
      aufgabe('überfällig niedrig', { prioritaet: 'niedrig', faellig: '2026-11-10' }),
      aufgabe('überfällig hoch', { prioritaet: 'hoch', faellig: '2026-11-15' }),
      aufgabe('später hoch', { prioritaet: 'hoch', faellig: '2026-12-24' }),
    ];
    const gruppen = gruppiereAufgaben(offeneAufgaben(notizen), '2026-11-20');
    expect(gruppen.ueberfaellig.map((n) => n.text)).toEqual(['überfällig hoch', 'überfällig niedrig']);
    expect(gruppen.heute.map((n) => n.text)).toEqual(['heute hoch', 'heute keine']);
    expect(gruppen.demnaechst.map((n) => n.text)).toEqual(['später hoch']);
  });
});

describe('Weitertippen', () => {
  it('Priorität: keine → hoch → mittel → niedrig → keine', () => {
    expect(naechstePrioritaet(null)).toBe('hoch');
    expect(naechstePrioritaet('hoch')).toBe('mittel');
    expect(naechstePrioritaet('mittel')).toBe('niedrig');
    expect(naechstePrioritaet('niedrig')).toBe(null);
  });

  it('Stand: offen ↔ in Arbeit', () => {
    expect(naechsterStand('offen')).toBe('in_arbeit');
    expect(naechsterStand('in_arbeit')).toBe('offen');
  });
});

describe('Darstellung „Planer“', () => {
  const heute = '2026-11-23'; // ein Montag

  it('Farbstufe wird wärmer, je näher die Fälligkeit rückt', () => {
    expect(dringlichkeitsstufe(null, heute)).toBe('ohne');
    expect(dringlichkeitsstufe('2026-11-21', heute)).toBe('ueberfaellig');
    expect(dringlichkeitsstufe('2026-11-23T18:00', heute)).toBe('heute');
    expect(dringlichkeitsstufe('2026-11-24', heute)).toBe('bald');
    expect(dringlichkeitsstufe('2026-11-25', heute)).toBe('bald');
    expect(dringlichkeitsstufe('2026-11-26', heute)).toBe('woche');
    expect(dringlichkeitsstufe('2026-11-30', heute)).toBe('woche');
    expect(dringlichkeitsstufe('2026-12-01', heute)).toBe('spaeter');
  });

  it('Abstand in Worten, auch über Monats- und Jahresgrenzen', () => {
    expect(abstandText('2026-11-23', heute)).toBe('heute');
    expect(abstandText('2026-11-24T09:00', heute)).toBe('morgen');
    expect(abstandText('2026-11-25', heute)).toBe('übermorgen');
    expect(abstandText('2026-11-22', heute)).toBe('seit gestern');
    expect(abstandText('2026-11-21', heute)).toBe('seit 2 Tagen');
    expect(abstandText('2026-12-09', heute)).toBe('in 16 Tagen');
    expect(abstandText('2027-01-01', '2026-12-31')).toBe('morgen');
  });

  it('Kalenderblatt: Wochentag in der Nähe, sonst Monat', () => {
    expect(kalenderblatt('2026-11-21', heute)).toEqual({ oben: 'SA', zahl: 21 });
    expect(kalenderblatt('2026-11-30T18:00', heute)).toEqual({ oben: 'MO', zahl: 30 });
    expect(kalenderblatt('2026-12-09', heute)).toEqual({ oben: 'DEZ', zahl: 9 });
    expect(kalenderblatt('2026-10-02', heute)).toEqual({ oben: 'OKT', zahl: 2 });
  });
});
