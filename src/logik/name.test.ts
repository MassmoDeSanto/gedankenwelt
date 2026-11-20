import { describe, expect, it } from 'vitest';
import { nameUndRest } from './name';

describe('Name einer Notiz', () => {
  it('einzeilige Notiz hat keinen eigenen Namen', () => {
    expect(nameUndRest('Milch kaufen')).toBeNull();
  });

  it('erste Zeile ist der Name, der Rest der Text', () => {
    expect(nameUndRest('Fahrrad-Verleih\nE-Bikes am Bahnhof vermieten\nAbholung per App')).toEqual({
      name: 'Fahrrad-Verleih',
      rest: 'E-Bikes am Bahnhof vermieten\nAbholung per App',
    });
  });

  it('Tags und Markdown im Namen bleiben erhalten', () => {
    expect(nameUndRest('**Kaffee-Abo** #idee\nBohnen von kleinen Röstereien')?.name).toBe('**Kaffee-Abo** #idee');
  });

  it('nur ein Zeilenumbruch am Ende oder leere erste Zeile: kein Name', () => {
    expect(nameUndRest('Gerade getippt\n')).toBeNull();
    expect(nameUndRest('Gerade getippt\n   ')).toBeNull();
    expect(nameUndRest('\nText ohne Namen')).toBeNull();
  });
});
