import { describe, expect, it } from 'vitest';
import { leseTags } from '../tags';
import { bereinigeName, bereinigeText } from './bereinigen';
import { fingerabdruck } from './fingerabdruck';
import { leseDatum, leseKopf } from './kopf';
import { AUFGABEN_MARKER, AUFZAEHLUNGSZEICHEN, leseAufgabe, lesePunkt } from './marker';
import { trenneTitel, zerlege, type ZerlegeOptionen } from './zerlegen';

const STANDARD: ZerlegeOptionen = { trennmodus: 'automatisch', punkteEinzeln: true, ueberschriftenAlsListen: true };

/** Texte aller Notizen, über alle Abschnitte hinweg */
function texte(rumpf: string, optionen: Partial<ZerlegeOptionen> = {}): string[] {
  return zerlege(bereinigeText(rumpf), { ...STANDARD, ...optionen }).abschnitte.flatMap((a) => a.notizen.map((n) => n.text));
}

describe('Bereinigen', () => {
  it('vereinheitlicht Zeilenenden von Windows und altem Mac', () => {
    expect(bereinigeText('eins\r\nzwei\rdrei')).toBe('eins\nzwei\ndrei');
  });

  it('macht aus dem weichen Umbruch von Apple (U+2028) eine neue Zeile', () => {
    expect(bereinigeText('eins\u2028zwei')).toBe('eins\nzwei');
  });

  it('entfernt unsichtbare Zeichen und Leerzeichen am Zeilenende', () => {
    expect(bereinigeText('\uFEFFHal\u200Blo\u00A0Welt   \nzwei\u00AD')).toBe('Hallo Welt\nzwei');
  });

  it('lässt Emoji aus mehreren Teilen ganz', () => {
    expect(bereinigeText('Familie 👨‍👩‍👧 hier')).toBe('Familie 👨‍👩‍👧 hier');
  });

  it('macht Tabulatoren am Zeilenanfang zu Einrückung', () => {
    expect(bereinigeText('\t- Unterpunkt')).toBe('    - Unterpunkt');
  });

  it('fügt zerlegte Umlaute zusammen (so schreibt Apple Dateinamen)', () => {
    expect(bereinigeName('Bu\u0308cher  und\u00A0mehr ')).toBe('Bücher und mehr');
  });
});

describe('Kopf der Kurzbefehl-Datei', () => {
  const VOLL = [
    '---',
    'quelle: apple-notizen',
    'titel: Reise-App Ideen',
    'ordner: Projekte/Reise-App',
    'erstellt: 2024-03-12T21:04:00+01:00',
    'geaendert: 2026-10-02T08:15:00+02:00',
    '---',
    'Erste Zeile',
  ].join('\n');

  it('liest einen vollständigen Kopf', () => {
    const { kopf, rumpf } = leseKopf(VOLL);
    expect(kopf).toEqual({
      vorhanden: true,
      titel: 'Reise-App Ideen',
      ordner: ['Projekte', 'Reise-App'],
      erstellt: '2024-03-12T20:04:00Z',
      geaendert: '2026-10-02T06:15:00Z',
      hinweise: [],
    });
    expect(rumpf).toBe('Erste Zeile');
  });

  it('kommt mit einem unvollständigen Kopf zurecht', () => {
    const { kopf, rumpf } = leseKopf('---\ntitel: Nur ein Titel\n---\nText');
    expect(kopf.vorhanden).toBe(true);
    expect(kopf.titel).toBe('Nur ein Titel');
    expect(kopf.ordner).toEqual([]);
    expect(kopf.erstellt).toBeNull();
    expect(rumpf).toBe('Text');
  });

  it('erkennt einen Kopf ohne abschließende Linie', () => {
    const { kopf, rumpf } = leseKopf('---\ntitel: Offen\nerstellt: 2025-01-02T10:00:00Z\nHier beginnt der Text\nzweite Zeile');
    expect(kopf.titel).toBe('Offen');
    expect(kopf.erstellt).toBe('2025-01-02T10:00:00Z');
    expect(kopf.hinweise).toContain('Kopf nicht mit „---“ abgeschlossen');
    expect(rumpf).toBe('Hier beginnt der Text\nzweite Zeile');
  });

  it('hält eine Trennlinie am Textanfang nicht für einen Kopf', () => {
    const text = '---\nEinfach nur Text\n---\nmehr';
    const { kopf, rumpf } = leseKopf(text);
    expect(kopf.vorhanden).toBe(false);
    expect(rumpf).toBe(text);
  });

  it('meldet einen fehlenden Kopf', () => {
    expect(leseKopf('Nur Text').kopf.vorhanden).toBe(false);
  });

  it('behält Doppelpunkte im Titel', () => {
    expect(leseKopf('---\ntitel: Plan: Teil 2\n---\n').kopf.titel).toBe('Plan: Teil 2');
  });

  it('meldet ein unlesbares Datum, statt zu raten', () => {
    const { kopf } = leseKopf('---\ntitel: X\nerstellt: irgendwann im März\n---\n');
    expect(kopf.erstellt).toBeNull();
    expect(kopf.hinweise).toEqual(['Datum „irgendwann im März“ nicht lesbar']);
  });

  it('rechnet Zeitzonen in Weltzeit um', () => {
    expect(leseDatum('2024-03-12T21:04:00+01:00')).toBe('2024-03-12T20:04:00Z');
    expect(leseDatum('2026-07-01T00:30:00+0200')).toBe('2026-06-30T22:30:00Z');
    expect(leseDatum('2026-07-01T08:00:00Z')).toBe('2026-07-01T08:00:00Z');
    expect(leseDatum('2026-01-01T03:00:00-05:00')).toBe('2026-01-01T08:00:00Z');
  });

  it('liest Daten ohne Zeitzone als Ortszeit, auch in deutscher Schreibweise', () => {
    const erwartet = new Date(2024, 2, 12, 21, 4, 0).toISOString().slice(0, 19) + 'Z';
    expect(leseDatum('2024-03-12T21:04')).toBe(erwartet);
    expect(leseDatum('2024-03-12 21:04:00')).toBe(erwartet);
    expect(leseDatum('12.03.2024, 21:04')).toBe(erwartet);
    expect(leseDatum('12.03.2024 um 21:04')).toBe(erwartet);
    expect(leseDatum('2024-03-12')).toBe(new Date(2024, 2, 12, 12).toISOString().slice(0, 19) + 'Z');
  });
});

describe('Marker-Tabelle', () => {
  it('erkennt jeden Marker der Tabelle – allein und hinter einem Aufzählungszeichen', () => {
    for (const marker of AUFGABEN_MARKER) {
      expect(leseAufgabe(`${marker.zeichen} Milch kaufen`), marker.zeichen).toMatchObject({
        zustand: marker.zustand,
        text: 'Milch kaufen',
      });
      for (const zeichen of ['-', '*']) {
        expect(leseAufgabe(`${zeichen} ${marker.zeichen} Milch kaufen`), `${zeichen} ${marker.zeichen}`).toMatchObject({
          zustand: marker.zustand,
          text: 'Milch kaufen',
        });
      }
    }
  });

  it('macht aus jedem Marker der Tabelle eine Aufgabe', () => {
    for (const marker of AUFGABEN_MARKER) {
      const { abschnitte } = zerlege(`${marker.zeichen} Milch kaufen\n${marker.zeichen} Brot`, STANDARD);
      expect(abschnitte[0].notizen, marker.zeichen).toEqual([
        { text: 'Milch kaufen', aufgabe: marker.zustand },
        { text: 'Brot', aufgabe: marker.zustand },
      ]);
    }
  });

  it('erkennt jedes Aufzählungszeichen der Tabelle und nummerierte Punkte', () => {
    for (const zeichen of AUFZAEHLUNGSZEICHEN) {
      expect(lesePunkt(`${zeichen} Idee`), zeichen).toEqual({ text: 'Idee', nummer: null });
    }
    expect(lesePunkt('1. Erstens')).toEqual({ text: 'Erstens', nummer: '1.' });
    expect(lesePunkt('12) Zwölftens')).toEqual({ text: 'Zwölftens', nummer: '12)' });
  });

  it('hält gewöhnlichen Text nicht für eine Liste', () => {
    expect(lesePunkt('2024 war ein gutes Jahr')).toBeNull();
    expect(lesePunkt('-ohne Leerzeichen')).toBeNull();
    expect(leseAufgabe('[Link](https://example.org) am Anfang')).toBeNull();
    expect(leseAufgabe('[ ]')).toBeNull();
  });

  it('erkennt maskierte Klammern, wie Markdown-Exporte sie schreiben', () => {
    const { abschnitte } = zerlege('- \\[ \\] offen\n- \\[x\\] fertig', STANDARD);
    expect(abschnitte[0].notizen).toEqual([
      { text: 'offen', aufgabe: 'offen' },
      { text: 'fertig', aufgabe: 'erledigt' },
    ]);
  });

  it('liest einen Kreis unter einem Aufzählungspunkt als Unterpunkt, nicht als Aufgabe', () => {
    const { abschnitte } = zerlege('• Obst\n    ◦ Äpfel\n    ◦ Birnen\n◦ Allein stehend', STANDARD);
    expect(abschnitte[0].notizen).toEqual([
      { text: 'Obst\n- Äpfel\n- Birnen', aufgabe: null },
      { text: 'Allein stehend', aufgabe: 'offen' },
    ]);
  });
});

describe('Trennmodus', () => {
  const MIT = 'Erster Gedanke.\n\nZweiter Gedanke.\n\n\n\nDritter Gedanke.';
  const OHNE = 'Erster Gedanke.\nZweiter Gedanke.\nDritter Gedanke.\nVierter Gedanke.';

  it('Automatik: Text mit Leerzeilen folgt der Regel der App', () => {
    const z = zerlege(MIT, STANDARD);
    expect(z.modus).toBe('leerzeilen');
    expect(z.abschnitte[0].notizen.map((n) => n.text)).toEqual(['Erster Gedanke.', 'Zweiter Gedanke.', 'Dritter Gedanke.']);
  });

  it('Automatik: Text ohne Leerzeilen wird Zeile für Zeile zerlegt', () => {
    const z = zerlege(OHNE, STANDARD);
    expect(z.modus).toBe('zeilen');
    expect(z.abschnitte[0].notizen).toHaveLength(4);
  });

  it('Automatik bei gemischtem Text: Es zählt, wo die meisten Zeilen stehen', () => {
    // Fünf von sechs Zeilen stehen direkt untereinander → jede Zeile eine Notiz
    const eher_zeilen = 'a1\na2\na3\n\nb1\nb2\n\nc1';
    expect(zerlege(eher_zeilen, STANDARD).modus).toBe('zeilen');
    expect(texte(eher_zeilen)).toEqual(['a1', 'a2', 'a3', 'b1', 'b2', 'c1']);

    // Zwei von sechs Zeilen stehen direkt untereinander → Leerzeile trennt, der Block bleibt zusammen
    const eher_absaetze = 'a\n\nb\n\nc1\nc2\n\nd\n\ne';
    expect(zerlege(eher_absaetze, STANDARD).modus).toBe('leerzeilen');
    expect(texte(eher_absaetze)).toEqual(['a', 'b', 'c1\nc2', 'd', 'e']);
  });

  it('Automatik zählt Aufzählungen und Überschriften nicht mit', () => {
    expect(zerlege('# Titel\n- a\n- b\n- c\n\nEin Absatz.\n\nNoch einer.', STANDARD).modus).toBe('leerzeilen');
  });

  it('„Nach Leerzeilen“ hält Zeilen ohne Leerzeile zusammen', () => {
    expect(texte(OHNE, { trennmodus: 'leerzeilen' })).toEqual([OHNE]);
  });

  it('„Jede Zeile eine Notiz“ trennt auch Text mit Leerzeilen zeilenweise', () => {
    expect(texte('a1\na2\n\nb', { trennmodus: 'zeilen' })).toEqual(['a1', 'a2', 'b']);
  });

  it('erzeugt nie leere Notizen und nie Leerzeilen in einer Notiz', () => {
    const alle = texte('\n\n  \nText\n\n\n   \n\nmehr\n', { trennmodus: 'leerzeilen' });
    expect(alle).toEqual(['Text', 'mehr']);
    expect(alle.every((t) => !/\n\s*\n/.test(t))).toBe(true);
  });
});

describe('Aufzählungen', () => {
  const LISTE = 'Einleitung:\n- Erstens\n    - Detail A\n        - Detail A1\n    - Detail B\n- Zweitens\n* Drittens\n1. Viertens';

  it('macht jeden Punkt zu einer Notiz, Unterpunkte bleiben beim Elternpunkt', () => {
    expect(texte(LISTE)).toEqual([
      'Einleitung:',
      'Erstens\n- Detail A\n  - Detail A1\n- Detail B',
      'Zweitens',
      'Drittens',
      'Viertens',
    ]);
  });

  it('lässt die Aufzählung auf Wunsch zusammen', () => {
    expect(texte(LISTE, { punkteEinzeln: false, trennmodus: 'leerzeilen' })).toEqual([
      'Einleitung:\n- Erstens\n  - Detail A\n    - Detail A1\n  - Detail B\n- Zweitens\n- Drittens\n1. Viertens',
    ]);
    expect(texte(LISTE, { punkteEinzeln: false, trennmodus: 'zeilen' })).toEqual([
      'Einleitung:',
      '- Erstens\n  - Detail A\n    - Detail A1\n  - Detail B\n- Zweitens\n- Drittens\n1. Viertens',
    ]);
  });

  it('Checklisten werden immer einzelne Aufgaben, auch wenn Aufzählungen zusammenbleiben', () => {
    const { abschnitte } = zerlege('- [ ] eins\n- [x] zwei\n    - Hinweis dazu', { ...STANDARD, punkteEinzeln: false });
    expect(abschnitte[0].notizen).toEqual([
      { text: 'eins', aufgabe: 'offen' },
      { text: 'zwei\n- Hinweis dazu', aufgabe: 'erledigt' },
    ]);
  });

  it('macht eingerückte Checklisten-Einträge zu eigenen Aufgaben', () => {
    const { abschnitte } = zerlege('- [ ] Schuhe\n    - [ ] Einlagen', STANDARD);
    expect(abschnitte[0].notizen).toEqual([
      { text: 'Schuhe', aufgabe: 'offen' },
      { text: 'Einlagen', aufgabe: 'offen' },
    ]);
  });
});

describe('Überschriften', () => {
  const TEXT = 'Vorab.\n\n## Eins\n\nUnter eins.\n\n### Tiefer\n\nGanz unten.\n\n## Zwei\n\nUnter zwei.\n\n## Eins\n\nNoch mal eins.';

  it('werden Unterlisten, verschachtelt nach ihrer Ebene', () => {
    const { abschnitte } = zerlege(TEXT, STANDARD);
    expect(abschnitte.map((a) => [a.pfad.join(' › '), a.notizen.map((n) => n.text)])).toEqual([
      ['', ['Vorab.']],
      ['Eins', ['Unter eins.', 'Noch mal eins.']],
      ['Eins › Tiefer', ['Ganz unten.']],
      ['Zwei', ['Unter zwei.']],
    ]);
  });

  it('bleiben auf Wunsch als fett geschriebene Notiz stehen', () => {
    const { abschnitte } = zerlege(TEXT, { ...STANDARD, ueberschriftenAlsListen: false });
    expect(abschnitte).toHaveLength(1);
    expect(abschnitte[0].notizen.map((n) => n.text)).toEqual([
      'Vorab.',
      '**Eins**',
      'Unter eins.',
      '**Tiefer**',
      'Ganz unten.',
      '**Zwei**',
      'Unter zwei.',
      '**Eins**',
      'Noch mal eins.',
    ]);
  });

  it('entfernt Auszeichnungen aus dem Listennamen', () => {
    expect(zerlege('## **Wichtig** und [Link](https://example.org)\n\nText', STANDARD).abschnitte[1].pfad).toEqual([
      'Wichtig und Link',
    ]);
  });

  it('hält ein Tag am Zeilenanfang nicht für eine Überschrift', () => {
    const { abschnitte } = zerlege('#reise planen', STANDARD);
    expect(abschnitte).toHaveLength(1);
    expect(leseTags(abschnitte[0].notizen[0].text)).toEqual(['reise']);
  });
});

describe('Titel', () => {
  it('nimmt die erste Überschrift als Titel und entfernt sie', () => {
    expect(trenneTitel('# Reise nach Lissabon\n\nText', null, 'Reise nach Lissabon')).toEqual({
      titel: 'Reise nach Lissabon',
      rumpf: '\nText',
    });
  });

  it('zieht die Überschrift dem gekürzten Dateinamen vor', () => {
    const lang = 'Ein ziemlich langer Titel, den Apple im Dateinamen irgendwo in der Mitte abschneidet';
    expect(trenneTitel(`# ${lang}\nText`, null, lang.slice(0, 40)).titel).toBe(lang);
  });

  it('entfernt den Titel, wenn er im Text noch einmal als erste Zeile steht', () => {
    expect(trenneTitel('Wocheneinkauf\nHaferflocken', 'Wocheneinkauf', 'datei')).toEqual({
      titel: 'Wocheneinkauf',
      rumpf: 'Haferflocken',
    });
  });

  it('lässt die erste Zeile stehen, wenn sie nicht der Titel ist', () => {
    expect(trenneTitel('Etwas anderes\nText', 'Wocheneinkauf', 'datei').rumpf).toBe('Etwas anderes\nText');
  });

  it('nimmt ohne Kopf und ohne Überschrift den Dateinamen', () => {
    expect(trenneTitel('Text', null, 'Ohne Kopf')).toEqual({ titel: 'Ohne Kopf', rumpf: 'Text' });
  });
});

describe('Formatierung, Links, Tabellen, Anhänge', () => {
  it('behält fett, kursiv, Code und Links', () => {
    expect(texte('Das ist **fett**, *kursiv*, `Code` und ein [Link](https://example.org/a_b).')).toEqual([
      'Das ist **fett**, *kursiv*, `Code` und ein [Link](https://example.org/a_b).',
    ]);
  });

  it('schreibt Unterstrich-Auszeichnungen in die Schreibweise der App um', () => {
    expect(texte('__fett__ und _kursiv_, aber datei_name_alt bleibt')).toEqual(['**fett** und *kursiv*, aber datei_name_alt bleibt']);
  });

  it('löst maskierte Zeichen auf', () => {
    expect(texte('Kapitel 3\\. und 2 \\* 3 \\#keintag\\_x')).toEqual(['Kapitel 3. und 2 * 3 #keintag_x']);
  });

  it('lässt eine Tabelle als eine Notiz zusammen – in jedem Trennmodus', () => {
    const tabelle = '| Ziel | Dauer |\n|---|---|\n| Sintra | 40 min |';
    for (const trennmodus of ['leerzeilen', 'zeilen'] as const) {
      expect(texte(`Davor\n${tabelle}\nDanach`, { trennmodus })).toEqual(['Davor', tabelle, 'Danach']);
    }
  });

  it('entfernt Bildverweise und zählt sie', () => {
    const z = zerlege('Text davor\n\n![Foto](Attachments/IMG_1.jpeg)\n\nMit ![Bild](a (1).png) mittendrin\n<img src="x.png">', STANDARD);
    expect(z.anhaenge).toBe(3);
    expect(z.abschnitte[0].notizen.map((n) => n.text)).toEqual(['Text davor', 'Mit mittendrin']);
  });

  it('zählt Verweise auf mitgelieferte Dateien und den Platzhalter aus reinem Text', () => {
    const z = zerlege('[Vertrag.pdf](Attachments/Vertrag.pdf)\n\nSiehe [Skizze](Attachments/Skizze.png) dazu\n\n\uFFFC\n\nEnde', STANDARD);
    expect(z.anhaenge).toBe(3);
    expect(z.abschnitte[0].notizen.map((n) => n.text)).toEqual(['Siehe Skizze dazu', 'Ende']);
  });

  it('lässt Web-Links und Sprungmarken in Ruhe', () => {
    const z = zerlege('[Seite](https://example.org) und [Post](mailto:a@example.org) und [oben](#anfang)', STANDARD);
    expect(z.anhaenge).toBe(0);
    expect(z.abschnitte[0].notizen[0].text).toBe('[Seite](https://example.org) und [Post](mailto:a@example.org) und [oben](#anfang)');
  });

  it('erkennt Tags', () => {
    expect(leseTags(texte('Budget pro Tag: 80 € #reise #Budget')[0])).toEqual(['reise', 'budget']);
  });

  it('behandelt Windows-Zeilenenden wie normale', () => {
    expect(texte('eins\r\n\r\nzwei\r\n- drei\r\n')).toEqual(['eins', 'zwei', 'drei']);
  });

  it('übersteht Sonderzeichen', () => {
    expect(texte('Café – „Zitat“ … 20 °C · 5 € 🚀\n\nÄÖÜ ß')).toEqual(['Café – „Zitat“ … 20 °C · 5 € 🚀', 'ÄÖÜ ß']);
  });

  it('hält einen Code-Block zusammen', () => {
    expect(texte('Davor\n\n```\nzeile 1\n\nzeile 2\n```\n\nDanach')).toEqual(['Davor', '```\nzeile 1\nzeile 2\n```', 'Danach']);
  });
});

describe('Fingerabdruck', () => {
  it('ist für gleichen Text gleich und für anderen Text anders', () => {
    expect(fingerabdruck('Hallo Welt')).toBe(fingerabdruck('Hallo Welt'));
    expect(fingerabdruck('Hallo Welt')).not.toBe(fingerabdruck('Hallo Welt!'));
    expect(fingerabdruck('ab')).not.toBe(fingerabdruck('ba'));
  });
});

describe('Leistung', () => {
  it('zerlegt eine Notiz mit 1.000 Zeilen ohne spürbare Verzögerung', () => {
    const zeilen: string[] = [];
    for (let i = 0; i < 1000; i++) {
      if (i % 100 === 0) zeilen.push(`## Abschnitt ${i / 100 + 1}`);
      else if (i % 7 === 0) zeilen.push(`- [ ] Aufgabe ${i} mit **Auszeichnung** und [Link](https://example.org/${i})`);
      else if (i % 5 === 0) zeilen.push(`- Punkt ${i} #tag${i % 13}`);
      else zeilen.push(`Zeile ${i}: ein Gedanke mit etwas mehr Text, damit die Zeile eine übliche Länge hat.`);
    }
    const text = bereinigeText(zeilen.join('\n'));

    zerlege(text, STANDARD); // einmal zum Warmlaufen
    const start = performance.now();
    const z = zerlege(text, STANDARD);
    const dauer = performance.now() - start;

    expect(z.abschnitte).toHaveLength(11);
    expect(z.abschnitte.reduce((n, a) => n + a.notizen.length, 0)).toBe(990);
    expect(dauer).toBeLessThan(100);
  });
});
