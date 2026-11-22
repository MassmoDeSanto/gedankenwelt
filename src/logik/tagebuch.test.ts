import { describe, expect, it } from 'vitest';
import { monatAusPfad, monatsPfad, tagebuchTagVon } from './tagebuch';

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
