import { describe, expect, it } from 'vitest';
import { alsKlartext, leseInline, leseMarkdownLight } from './markdownLight';

describe('Markdown light: Auszeichnungen in der Zeile', () => {
  it('fett, kursiv und Code', () => {
    expect(leseInline('Das ist **fett**, *kursiv* und `Code`.')).toEqual([
      { art: 'text', text: 'Das ist ' },
      { art: 'fett', kinder: [{ art: 'text', text: 'fett' }] },
      { art: 'text', text: ', ' },
      { art: 'kursiv', kinder: [{ art: 'text', text: 'kursiv' }] },
      { art: 'text', text: ' und ' },
      { art: 'code', text: 'Code' },
      { art: 'text', text: '.' },
    ]);
  });

  it('kursiv innerhalb von fett', () => {
    expect(leseInline('**sehr *wichtig* hier**')).toEqual([
      {
        art: 'fett',
        kinder: [
          { art: 'text', text: 'sehr ' },
          { art: 'kursiv', kinder: [{ art: 'text', text: 'wichtig' }] },
          { art: 'text', text: ' hier' },
        ],
      },
    ]);
  });

  it('zwei fette Stellen in einer Zeile', () => {
    expect(alsKlartext(leseInline('**a** und **b**'))).toBe('a und b');
    expect(leseInline('**a** und **b**').filter((t) => t.art === 'fett')).toHaveLength(2);
  });

  it('nicht geschlossene oder alleinstehende Sternchen bleiben Text', () => {
    expect(leseInline('**offen')).toEqual([{ art: 'text', text: '**offen' }]);
    expect(leseInline('2 * 3 * 4')).toEqual([{ art: 'text', text: '2 * 3 * 4' }]);
    expect(leseInline('5 Sterne: *****')).toEqual([{ art: 'text', text: '5 Sterne: *****' }]);
  });

  it('in Code wird nichts weiter ausgezeichnet', () => {
    expect(leseInline('`**kein** #tag`')).toEqual([{ art: 'code', text: '**kein** #tag' }]);
  });

  it('Links mit Text und nackte Adressen', () => {
    expect(leseInline('Siehe [Doku](https://example.org/a?b=1) oder https://example.org/x.')).toEqual([
      { art: 'text', text: 'Siehe ' },
      { art: 'link', text: 'Doku', url: 'https://example.org/a?b=1' },
      { art: 'text', text: ' oder ' },
      { art: 'link', text: 'https://example.org/x', url: 'https://example.org/x' },
      { art: 'text', text: '.' },
    ]);
  });

  it('nur sichere Adressen werden zu Links', () => {
    expect(leseInline('[Klick](javascript:alert(1))').some((t) => t.art === 'link')).toBe(false);
    expect(leseInline('[Mail](mailto:a@example.org)')).toEqual([
      { art: 'link', text: 'Mail', url: 'mailto:a@example.org' },
    ]);
  });

  it('Tags werden erkannt, auch in fettem Text; „#“ mitten im Wort nicht', () => {
    expect(leseInline('Gut #idee')).toEqual([
      { art: 'text', text: 'Gut ' },
      { art: 'tag', text: '#idee' },
    ]);
    expect(leseInline('**#wichtig**')).toEqual([{ art: 'fett', kinder: [{ art: 'tag', text: '#wichtig' }] }]);
    expect(leseInline('C#sharp')).toEqual([{ art: 'text', text: 'C#sharp' }]);
  });
});

describe('Markdown light: Zeilen', () => {
  it('Aufzählungen mit „-“, auch eingerückt', () => {
    const zeilen = leseMarkdownLight('Einkauf:\n- Brot\n- **Milch**\n  - fettarm\nEnde');
    expect(zeilen.map((z) => [z.art, z.einzug, alsKlartext(z.inhalt)])).toEqual([
      ['text', 0, 'Einkauf:'],
      ['punkt', 0, 'Brot'],
      ['punkt', 0, 'Milch'],
      ['punkt', 1, 'fettarm'],
      ['text', 0, 'Ende'],
    ]);
  });

  it('ein Bindestrich ohne Leerzeichen oder ohne Text ist kein Aufzählungspunkt', () => {
    expect(leseMarkdownLight('-kein Punkt')[0].art).toBe('text');
    expect(leseMarkdownLight('- ')[0].art).toBe('text');
    expect(leseMarkdownLight('Reise-App - Idee')[0].art).toBe('text');
  });

  it('leere Zeilen bleiben als leere Zeilen erhalten', () => {
    expect(leseMarkdownLight('a\n\nb').map((z) => z.inhalt.length)).toEqual([1, 0, 1]);
  });
});
