import { describe, expect, it } from 'vitest';
import { STANDARD_IMPULSE, fragenAusText, impulsFuer } from './impulse';
import { verschiebeDatum } from './zeit';

describe('Schreibimpulse', () => {
  it('es gibt rund 60 eingebaute Fragen, keine doppelt', () => {
    expect(STANDARD_IMPULSE.length).toBeGreaterThanOrEqual(55);
    expect(new Set(STANDARD_IMPULSE).size).toBe(STANDARD_IMPULSE.length);
  });

  it('dieselbe Frage für denselben Tag – auf jedem Gerät', () => {
    expect(impulsFuer('2026-11-22', STANDARD_IMPULSE)).toBe(impulsFuer('2026-11-22', [...STANDARD_IMPULSE]));
  });

  it('innerhalb einer Runde keine Frage doppelt, über die Tage verteilt alle', () => {
    const n = STANDARD_IMPULSE.length;
    // Beginn einer Runde suchen: Tage seit 2000-01-01, die durch n teilbar sind
    let start = '2026-01-01';
    while (Math.floor((Date.parse(start) - Date.parse('2000-01-01')) / 86_400_000) % n !== 0) start = verschiebeDatum(start, 1);
    const fragen = Array.from({ length: n }, (_, i) => impulsFuer(verschiebeDatum(start, i), STANDARD_IMPULSE));
    expect(new Set(fragen).size).toBe(n);
  });

  it('„andere Frage“ zeigt eine andere, ohne eigene Fragen gibt es keine', () => {
    const erste = impulsFuer('2026-11-22', STANDARD_IMPULSE);
    expect(impulsFuer('2026-11-22', STANDARD_IMPULSE, 1)).not.toBe(erste);
    expect(impulsFuer('2026-11-22', [])).toBeNull();
    expect(impulsFuer('2026-11-22', ['Nur eine?'], 3)).toBe('Nur eine?');
  });

  it('Fragen aus dem Textfeld: eine pro Zeile, bereinigt', () => {
    expect(fragenAusText('  Wie war es?  \n\nWas nun?\nWie   war es?\n')).toEqual(['Wie war es?', 'Was nun?']);
  });
});
