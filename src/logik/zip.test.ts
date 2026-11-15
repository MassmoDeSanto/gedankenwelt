import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { entpacke, packe } from './zip';

describe('ZIP', () => {
  const dateien = new Map([
    ['Eingang.md', '---\nid: 1\n---\n\nÄpfel & Öl #tag\n'],
    ['Reise-App/_liste.md', 'Inhalt'],
    ['_meta.json', '{}\n'],
  ]);

  it('packen und entpacken ergibt dieselben Dateien', () => {
    expect(entpacke(packe(dateien))).toEqual(dateien);
  });

  it('im ZIP liegt alles im Ordner „Gedankenwelt/“', () => {
    expect(Object.keys(unzipSync(packe(dateien))).sort()).toEqual([
      'Gedankenwelt/Eingang.md',
      'Gedankenwelt/Reise-App/_liste.md',
      'Gedankenwelt/_meta.json',
    ]);
  });

  it('liest auch ZIPs mit anderem oder ohne obersten Ordner', () => {
    const anders = zipSync({ 'Sicherung/_meta.json': strToU8('{}'), 'Sicherung/A.md': strToU8('a') });
    expect([...entpacke(anders).keys()].sort()).toEqual(['A.md', '_meta.json']);

    const flach = zipSync({ '_meta.json': strToU8('{}'), 'A/B.md': strToU8('b') });
    expect([...entpacke(flach).keys()].sort()).toEqual(['A/B.md', '_meta.json']);
  });
});
