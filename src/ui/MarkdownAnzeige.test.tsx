/**
 * Sicherheit der Anzeige (PHASE-6.md, Abschnitt 2): Text aus Notizen und Importen darf kein
 * HTML und kein Skript einschleusen. Geprüft wird das fertige HTML, das React erzeugt.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { istSichereAdresse, leseInline } from '../logik/markdownLight';
import { MarkdownAnzeige } from './MarkdownAnzeige';

const html = (text: string, terme?: string[]) => renderToStaticMarkup(<MarkdownAnzeige text={text} terme={terme} />);

/** Bösartige Beispieltexte, wie sie in einer Notiz, einer Drive-Datei oder einem Import stehen könnten */
const BOESARTIG = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '<a href="javascript:alert(1)">klick</a>',
  '<iframe src="https://example.org"></iframe>',
  '"><script>alert(1)</script>',
  '**<b onmouseover=alert(1)>fett</b>**',
  '`<script>alert(1)</script>`',
  '- <style>body{display:none}</style>',
  '#tag<script>alert(1)</script>',
];

describe('Markdown-Anzeige: kein eingeschleustes HTML', () => {
  it.each(BOESARTIG)('zeigt %s nur als Text', (text) => {
    const ergebnis = html(text);
    // Echte Elemente (nicht maskierter Text): nur die, die die App selbst erzeugt …
    const elemente = [...ergebnis.matchAll(/<([a-z][a-z0-9]*)\b[^>]*>/gi)];
    const erlaubt = ['div', 'span', 'strong', 'em', 'code', 'mark', 'a'];
    expect(elemente.every((m) => erlaubt.includes(m[1].toLowerCase())), ergebnis).toBe(true);
    // … ohne Ereignis-Attribute wie onerror= und nur mit Web-Links
    for (const [element] of elemente) {
      expect(element, ergebnis).not.toMatch(/\son[a-z]+=/i);
      const href = /href="([^"]*)"/.exec(element)?.[1];
      if (href !== undefined) expect(href).toMatch(/^https?:\/\//);
    }
    // Der Text selbst bleibt sichtbar (als maskierte Zeichen), es geht nichts verloren.
    expect(ergebnis).toContain('&lt;');
  });

  it('auch Suchtreffer-Markierungen schleusen nichts ein', () => {
    const ergebnis = html('<script>alert(1)</script> Reise', ['script', 'reise']);
    expect(ergebnis).not.toMatch(/<script/i);
    expect(ergebnis).toContain('<mark');
  });
});

describe('Links', () => {
  it('nur Webseiten und E-Mail werden anklickbar – mit neuem Tab und rel="noopener noreferrer"', () => {
    const ergebnis = html('[Seite](https://example.org/a?b=1) und mailto [Mail](mailto:a@example.org)');
    expect(ergebnis).toContain('href="https://example.org/a?b=1"');
    expect(ergebnis).toContain('href="mailto:a@example.org"');
    expect(ergebnis.match(/target="_blank"/g)).toHaveLength(2);
    expect(ergebnis.match(/rel="noopener noreferrer"/g)).toHaveLength(2);
  });

  it.each([
    '[klick](javascript:alert(1))',
    '[klick](JavaScript:alert(1))',
    '[klick](  javascript:alert(1))',
    '[klick](data:text/html,<script>alert(1)</script>)',
    '[klick](vbscript:msgbox(1))',
    '[klick](file:///etc/passwd)',
    'javascript:alert(1)',
  ])('%s wird kein Link', (text) => {
    const ergebnis = html(text);
    expect(ergebnis).not.toContain('<a');
    expect(ergebnis).not.toMatch(/href=/);
  });

  it('Anführungszeichen in einer Adresse können das Attribut nicht verlassen', () => {
    const ergebnis = html('[x](https://example.org/"onmouseover="alert(1))');
    expect(ergebnis).not.toMatch(/\sonmouseover=/i);
    expect(ergebnis).toContain('&quot;');
  });

  it('istSichereAdresse lässt nur http, https und mailto zu', () => {
    expect(istSichereAdresse('https://example.org')).toBe(true);
    expect(istSichereAdresse('http://example.org')).toBe(true);
    expect(istSichereAdresse('mailto:a@example.org')).toBe(true);
    expect(istSichereAdresse('javascript:alert(1)')).toBe(false);
    expect(istSichereAdresse('data:text/html,x')).toBe(false);
    expect(istSichereAdresse('kein link')).toBe(false);
    expect(leseInline('[a](https://x.de)')).toEqual([{ art: 'link', text: 'a', url: 'https://x.de' }]);
  });
});
