import { describe, expect, it } from 'vitest';
import { ladeFehlerText, schreibFehlerText, speicherFehlerArt } from './speicherfehler';

/** Nachbildung eines Browser-Fehlers (DOMException hat nur einen Namen und eine Nachricht). */
const fehler = (name: string, inner?: unknown) => Object.assign(new Error('x'), { name, inner });

describe('Speicherfehler', () => {
  it('erkennt die Art am Namen, auch wenn Dexie den Fehler einpackt', () => {
    expect(speicherFehlerArt(fehler('QuotaExceededError'))).toBe('voll');
    expect(speicherFehlerArt(fehler('AbortError', fehler('QuotaExceededError')))).toBe('voll');
    expect(speicherFehlerArt(fehler('VersionError'))).toBe('zu-neu');
    expect(speicherFehlerArt(fehler('MissingAPIError'))).toBe('verweigert');
    expect(speicherFehlerArt(fehler('InvalidStateError'))).toBe('verweigert');
    expect(speicherFehlerArt(fehler('UnknownError'))).toBe('unbekannt');
    expect(speicherFehlerArt('irgendwas')).toBe('unbekannt');
    expect(speicherFehlerArt(null)).toBe('unbekannt');
  });

  it('sagt beim Schreiben, was los ist und dass nichts verloren ist', () => {
    const text = schreibFehlerText(fehler('QuotaExceededError'));
    expect(text).toContain('Speicher auf diesem Gerät ist voll');
    expect(text).toContain('solange dieses Fenster offen bleibt');
    expect(text).toContain('Erneut speichern');
  });

  it('erklärt beim Laden je nach Ursache, was zu tun ist', () => {
    expect(ladeFehlerText(fehler('VersionError'))).toContain('neueren Version');
    expect(ladeFehlerText(fehler('QuotaExceededError'))).toContain('voll');
    expect(ladeFehlerText(fehler('MissingAPIError'))).toContain('privaten Fenster');
    expect(ladeFehlerText(new Error('?'))).toContain('Seite neu');
  });
});
