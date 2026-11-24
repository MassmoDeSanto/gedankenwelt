import { describe, expect, it } from 'vitest';
import { FORMATVERSION, FormatZuNeu, migriere, pruefeDatei, type Migrationen } from './format';
import { ausDateien, zuDateien } from './markdown';
import { baueListe, baueNotiz, testUmgebung } from './test-hilfe';
import { eingangsListe, tagebuchListe, STANDARD_EINSTELLUNGEN } from '../modell/typen';

describe('Migrationen', () => {
  // Eine erfundene Version 2 von _meta.json: Das Feld „tagesgedanke_verlauf“ heißt dort „verlauf“,
  // und die Einstellungen bekommen ein neues Feld „sprache“.
  type Meta = Record<string, unknown>;
  const zuV2: Migrationen<Meta> = {
    1: ({ tagesgedanke_verlauf, ...rest }) => ({
      ...rest,
      version: 2,
      verlauf: tagesgedanke_verlauf ?? [],
      einstellungen: { ...(rest.einstellungen as object), sprache: 'de' },
    }),
  };

  it('bringt eine Datei von Version 1 auf eine fiktive Version 2', () => {
    const v1 = {
      version: 1,
      einstellungen: { thema: 'hell' },
      tagesgedanke_verlauf: [{ datum: '2026-11-20', notiz_id: 'N1' }],
      listen: [],
    };
    const v2 = migriere<Meta>(v1, 1, zuV2, 2);
    expect(v2).toEqual({
      version: 2,
      einstellungen: { thema: 'hell', sprache: 'de' },
      verlauf: [{ datum: '2026-11-20', notiz_id: 'N1' }],
      listen: [],
    });
    // Das Original bleibt unverändert.
    expect(v1.tagesgedanke_verlauf).toHaveLength(1);
  });

  it('lässt Daten in der Zielversion unverändert', () => {
    const daten = { version: 2, a: 1 };
    expect(migriere<Meta>(daten, 2, zuV2, 2)).toBe(daten);
  });

  it('wendet mehrere Schritte nacheinander an', () => {
    const schritte: Migrationen<string> = { 1: (t) => t + ' →2', 2: (t) => t + ' →3' };
    expect(migriere('v1', 1, schritte, 3)).toBe('v1 →2 →3');
    expect(migriere('v2', 2, schritte, 3)).toBe('v2 →3');
  });

  it('meldet einen fehlenden Schritt und eine zu neue Version laut', () => {
    expect(() => migriere('x', 1, {}, 2)).toThrow(/fehlt die Migration von Format 1 auf 2/);
    expect(() => migriere('x', 3, {}, 2)).toThrow(RangeError);
  });
});

describe('pruefeDatei', () => {
  it('nimmt die Dateien des aktuellen Formats an', () => {
    const umg = testUmgebung();
    const dateien = zuDateien({
      listen: [eingangsListe(umg.jetzt), tagebuchListe()],
      notizen: [baueNotiz({ text: 'Hallo' })],
      einstellungen: { ...STANDARD_EINSTELLUNGEN },
      tagesgedanke_verlauf: [],
    });
    for (const [pfad, inhalt] of dateien) expect(pruefeDatei(pfad, inhalt), pfad).toEqual({ art: 'ok', version: FORMATVERSION });
  });

  it('erkennt beschädigtes JSON', () => {
    expect(pruefeDatei('_meta.json', '{"version": 1, "einstellungen": {')).toMatchObject({ art: 'unlesbar' });
    expect(pruefeDatei('_meta.json', '')).toMatchObject({ art: 'unlesbar' });
    expect(pruefeDatei('_meta.json', '[1, 2]')).toMatchObject({ art: 'unlesbar' });
    expect(pruefeDatei('_meta.json', 'null')).toMatchObject({ art: 'unlesbar' });
    expect(pruefeDatei('_meta.json', '{"version": "zwei"}')).toMatchObject({ art: 'unlesbar' });
  });

  it('erkennt Dateien einer neueren App-Version', () => {
    expect(pruefeDatei('_meta.json', '{"version": 2}')).toEqual({ art: 'zu-neu', version: 2 });
    expect(pruefeDatei('_Tagebuch/_tagebuch.json', '{"version": 7}')).toEqual({ art: 'zu-neu', version: 7 });
    expect(pruefeDatei('Eingang.md', '---\nid: X\nformat: 2\n---\n\nText')).toEqual({ art: 'zu-neu', version: 2 });
  });

  it('Markdown ohne Versionsangabe gilt als Format 1, auch ganz ohne Dateikopf', () => {
    expect(pruefeDatei('Von Hand.md', 'Nur ein Gedanke.')).toEqual({ art: 'ok', version: 1 });
    expect(pruefeDatei('Liste.md', '---\r\nid: X\r\n---\r\n')).toEqual({ art: 'ok', version: 1 });
  });

  it('erkennt einen angefangenen, nie beendeten Dateikopf', () => {
    expect(pruefeDatei('Liste.md', '---\nid: 01LISTE\nname: Rei')).toMatchObject({ art: 'unlesbar' });
  });
});

describe('Lesen mit Formatversion', () => {
  it('lehnt Dateien einer neueren App-Version ab, statt sie falsch zu lesen', () => {
    const umg = testUmgebung();
    const liste = baueListe({ name: 'Reise' });
    const dateien = zuDateien({
      listen: [eingangsListe(umg.jetzt), liste, tagebuchListe()],
      notizen: [],
      einstellungen: { ...STANDARD_EINSTELLUNGEN },
      tagesgedanke_verlauf: [],
    });
    const meta = new Map(dateien).set('_meta.json', JSON.stringify({ version: FORMATVERSION + 1 }));
    expect(() => ausDateien(meta, umg)).toThrow(FormatZuNeu);
    const liste2 = new Map(dateien).set('Reise.md', `---\nid: ${liste.id}\nformat: ${FORMATVERSION + 1}\n---\n`);
    expect(() => ausDateien(liste2, umg)).toThrow(/neueren Version der App/);
  });
});
