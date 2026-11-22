import { describe, expect, it } from 'vitest';
import { EINGANG_ID, eingangsListe, tagebuchListe, type Datenbestand, type ImportEintrag, type Liste, type Notiz } from '../../modell/typen';
import { verschmelze } from '../abgleich/verschmelzen';
import { pfadText, alsKarte, tagesgedankeAktiv } from '../listen';
import { ausDateien, zuDateien } from '../markdown';
import { stelleListeWiederHer } from '../papierkorb';
import { tagHaeufigkeit } from '../tags';
import { baueListe, baueNotiz, testUmgebung } from '../test-hilfe';
import { entpacke } from '../zip';
import { fuehreImportAus, warnungOhneDrive } from './ablauf';
import {
  STANDARD_OPTIONEN,
  baueImport,
  bildeEintraege,
  istImportDatei,
  leseDatei,
  planeRueckgaengig,
  quelleAusText,
  vorschau,
  zusammenfassung,
  type Eintrag,
  type ImportAuftrag,
  type Quelle,
} from './plan';

import buchnotizenMd from './testdaten/Buchnotizen.md?raw';
import gedankenTxt from './testdaten/Gedanken ohne Leerzeilen.txt?raw';
import ohneKopfTxt from './testdaten/Ohne Kopf.txt?raw';
import lissabonMd from './testdaten/Reise nach Lissabon.md?raw';
import lissabonTxt from './testdaten/Reise nach Lissabon.txt?raw';
import einkaufTxt from './testdaten/Wocheneinkauf.txt?raw';

const JETZT = '2026-11-17T08:00:00Z';

const DATEIEN = {
  lissabonMd: { name: 'Reise nach Lissabon/Reise nach Lissabon.md', inhalt: lissabonMd },
  lissabonTxt: { name: 'Reise nach Lissabon.txt', inhalt: lissabonTxt },
  einkauf: { name: 'Wocheneinkauf.txt', inhalt: einkaufTxt },
  gedanken: { name: 'Gedanken ohne Leerzeilen.txt', inhalt: gedankenTxt },
  buch: { name: 'Buchnotizen.md', inhalt: buchnotizenMd },
  ohneKopf: { name: 'Ohne Kopf.txt', inhalt: ohneKopfTxt },
};

function quelle(datei: { name: string; inhalt: string }): Quelle {
  const gelesen = leseDatei(datei);
  if (!gelesen) throw new Error(`nicht lesbar: ${datei.name}`);
  return gelesen;
}

function eintrag(datei: { name: string; inhalt: string }): Eintrag {
  return bildeEintraege([quelle(datei)])[0];
}

function auftrag(e: Eintrag, optionen: Partial<ImportAuftrag['optionen']> = {}): ImportAuftrag {
  return { eintrag: e, optionen: { ...STANDARD_OPTIONEN, ...optionen } };
}

function leererBestand(): Datenbestand {
  return { listen: [eingangsListe()], notizen: [], einstellungen: { thema: 'dunkel' }, tagesgedanke_verlauf: [] };
}

/** Importiert in einen Bestand und liefert den neuen Bestand samt Ergebnis. */
function importiere(bestand: Datenbestand, auftraege: ImportAuftrag[], jetzt = JETZT, tagesgedanke = true) {
  const ergebnis = baueImport(auftraege, bestand.listen, testUmgebung(jetzt), { tagesgedanke });
  const neu: Datenbestand = {
    ...bestand,
    listen: [...bestand.listen, ...ergebnis.listen],
    notizen: [...bestand.notizen, ...ergebnis.notizen],
    importe: [...(bestand.importe ?? []), ergebnis.eintrag],
  };
  return { ergebnis, bestand: neu };
}

function baum(listen: Liste[], notizen: Notiz[]): string[] {
  const karte = alsKarte(listen);
  return listen
    .filter((l) => !l.geloescht && l.id !== EINGANG_ID)
    .map((l) => `${pfadText(l.id, karte)} (${notizen.filter((n) => n.liste_id === l.id && !n.geloescht).length})`)
    .sort();
}

describe('Dateien einlesen', () => {
  it('liest den Markdown-Export: Titel aus der Überschrift, kein Datum, kein Ordner', () => {
    const q = quelle(DATEIEN.lissabonMd);
    expect(q).toMatchObject({
      name: 'Reise nach Lissabon.md',
      art: 'markdown',
      titel: 'Reise nach Lissabon',
      ordner: [],
      erstellt: null,
      geaendert: null,
      hinweise: [],
    });
    expect(q.rumpf).not.toContain('# Reise nach Lissabon');
  });

  it('liest die Kurzbefehl-Datei mit vollständigem Kopf', () => {
    const q = quelle(DATEIEN.lissabonTxt);
    expect(q).toMatchObject({
      art: 'kurzbefehl',
      titel: 'Reise nach Lissabon',
      ordner: ['Projekte', 'Reisen'],
      erstellt: '2024-03-12T20:04:00Z',
      geaendert: '2026-10-02T06:15:00Z',
    });
    // Der Titel stand im Text noch einmal als erste Zeile und ist dort entfernt.
    expect(q.rumpf.split('\n')[0]).toBe('Vier Tage im Mai, Unterkunft in der Alfama. #reise');
  });

  it('liest eine Kurzbefehl-Datei mit unvollständigem Kopf', () => {
    expect(quelle(DATEIEN.gedanken)).toMatchObject({ art: 'kurzbefehl', titel: 'Gedanken ohne Leerzeilen', ordner: [], erstellt: null });
  });

  it('liest eine Textdatei ohne Kopf und sagt, was fehlt', () => {
    const q = quelle(DATEIEN.ohneKopf);
    expect(q).toMatchObject({ art: 'kurzbefehl', titel: 'Ohne Kopf', erstellt: null });
    expect(q.hinweise).toEqual(['Kopf fehlt – Datum und Ordner unbekannt']);
  });

  it('übergeht Bilder und andere Dateien, die Apple neben die Markdown-Datei legt', () => {
    expect(istImportDatei('Reise/Attachments/IMG_0042.jpeg')).toBe(false);
    expect(istImportDatei('Reise/.DS_Store')).toBe(false);
    expect(istImportDatei('Reise/Reise.MD')).toBe(true);
    expect(leseDatei({ name: 'Attachments/Skizze.png', inhalt: '…' })).toBeNull();
  });

  it('macht aus eingefügtem Text eine Quelle mit dem angegebenen Titel', () => {
    const q = quelleAusText('  Einkauf  ', 'Einkauf\r\n- [ ] Milch\r\n- [x] Brot');
    expect(q).toMatchObject({ art: 'text', titel: 'Einkauf', rumpf: '- [ ] Milch\n- [x] Brot' });
  });
});

describe('Vorschau der Testdateien', () => {
  it('Markdown-Export: Überschriften, Checkliste, Unterpunkte, Tabelle, Bild', () => {
    const v = vorschau(eintrag(DATEIEN.lissabonMd), STANDARD_OPTIONEN);
    expect(v).toMatchObject({ listen: 5, notizen: 12, aufgabenOffen: 3, aufgabenErledigt: 1, schonImportiert: null });
    expect(v.zerlegung.anhaenge).toBe(1);
    expect(v.zerlegung.modus).toBe('leerzeilen');
    expect(v.zerlegung.abschnitte.map((a) => [a.pfad.join(' › '), a.notizen.length])).toEqual([
      ['', 2],
      ['Packliste', 4],
      ['Ideen vor Ort', 3],
      ['Ideen vor Ort › Tagesausflug', 2],
      ['Kosten', 1],
    ]);
    const ideen = v.zerlegung.abschnitte[2].notizen.map((n) => n.text);
    expect(ideen).toEqual([
      'Straßenbahn Linie 28 am frühen Morgen\n- vor 9 Uhr ist sie fast leer\n- Tagesticket lohnt sich',
      'Pastéis in Belém, siehe [Empfehlung](https://example.org/belem)',
      '*Fado* am Abend, aber nicht in der Touristenstraße',
    ]);
    expect(v.zerlegung.abschnitte[3].notizen[1].text).toBe(
      '| Ziel | Dauer | Preis |\n|---|---|---|\n| Sintra | 40 min | 5 € |\n| Cascais | 35 min | 5 € |',
    );
  });

  it('Kurzbefehl-Datei ohne Leerzeilen: jede Zeile eine Notiz, Anhang gezählt', () => {
    const v = vorschau(eintrag(DATEIEN.lissabonTxt), STANDARD_OPTIONEN);
    expect(v.zerlegung.modus).toBe('zeilen');
    expect(v.zerlegung.anhaenge).toBe(1);
    expect(v).toMatchObject({ listen: 1, notizen: 10, aufgabenOffen: 0 });
  });

  it('Checkliste mit Kreis- und Haken-Zeichen', () => {
    const v = vorschau(eintrag(DATEIEN.einkauf), STANDARD_OPTIONEN);
    expect(v).toMatchObject({ listen: 1, notizen: 6, aufgabenOffen: 3, aufgabenErledigt: 2 });
    expect(v.zerlegung.abschnitte[0].notizen[5]).toEqual({ text: 'Nicht vergessen: Pfandflaschen mitnehmen', aufgabe: null });
  });

  it('Markdown mit zwei Überschriften-Ebenen, maskierten Zeichen und Anhang', () => {
    const v = vorschau(eintrag(DATEIEN.buch), STANDARD_OPTIONEN);
    expect(v.zerlegung.abschnitte.map((a) => [a.pfad.join(' › '), a.notizen.map((n) => n.text)])).toEqual([
      ['', ['Sammlung aus dem Lesekreis, Stand Herbst.']],
      ['Sachbücher', []],
      [
        'Sachbücher › Gewohnheiten',
        [
          'Kleine Schritte schlagen große Vorsätze. **Wichtig:** den Auslöser festlegen.',
          'Das Kapitel über *Umgebung* war das beste, siehe auch datei_name_alt.',
          'Auslöser',
          'Verhalten',
          'Belohnung',
        ],
      ],
      ['Sachbücher › Schlaf', ['Nach 14 Uhr kein Kaffee mehr - zumindest laut Kapitel 3.']],
      [
        'Romane',
        [
          'Den zweiten Band ausleihen',
          'Rezension für den Lesekreis schreiben',
          'Offene Frage: Wer bringt nächstes Mal den Kuchen mit? #lesekreis',
        ],
      ],
    ]);
    expect(v.zerlegung.anhaenge).toBe(1);
    expect(v).toMatchObject({ aufgabenOffen: 1, aufgabenErledigt: 1 });
  });

  it('Textdatei ohne Kopf: Absätze bleiben zusammen, Punkte werden einzeln', () => {
    const v = vorschau(eintrag(DATEIEN.ohneKopf), STANDARD_OPTIONEN);
    expect(v.zerlegung.abschnitte[0].notizen.map((n) => n.text)).toEqual([
      'Werkstatt aufräumen',
      'Zuerst die Regale an der Nordwand leeren.\nAlles, was zwei Jahre nicht benutzt wurde, kommt weg.',
      'Danach Werkzeug nach Häufigkeit sortieren.',
      'Schraubenzieher an die Lochwand',
      'Farben in den Keller',
    ]);
  });
});

describe('Kombination A + B', () => {
  const quellen = () => [quelle(DATEIEN.lissabonMd), quelle(DATEIEN.lissabonTxt), quelle(DATEIEN.einkauf)];

  it('nimmt den Inhalt aus Markdown, Datum und Ordner aus der Kurzbefehl-Datei', () => {
    const eintraege = bildeEintraege(quellen());
    expect(eintraege).toHaveLength(2);
    expect(eintraege[0]).toMatchObject({
      titel: 'Reise nach Lissabon',
      weg: 'kombiniert',
      kombinierbar: true,
      ordner: ['Projekte', 'Reisen'],
      erstellt: '2024-03-12T20:04:00Z',
      geaendert: '2026-10-02T06:15:00Z',
    });
    expect(eintraege[0].rumpf).toContain('## Packliste');
    expect(eintraege[0].quellen.map((q) => q.art)).toEqual(['markdown', 'kurzbefehl']);
    expect(eintraege[1]).toMatchObject({ titel: 'Wocheneinkauf', weg: 'kurzbefehl', kombinierbar: false });
  });

  it('lässt beide getrennt, wenn die Kombination abgelehnt wird', () => {
    const eintraege = bildeEintraege(quellen(), new Set(['reise nach lissabon']));
    expect(eintraege.map((e) => [e.titel, e.weg, e.kombinierbar])).toEqual([
      ['Reise nach Lissabon', 'markdown', true],
      ['Reise nach Lissabon', 'kurzbefehl', true],
      ['Wocheneinkauf', 'kurzbefehl', false],
    ]);
  });

  it('erkennt den gleichen Titel trotz anderer Groß- und Kleinschreibung', () => {
    const md = quelle({ name: 'reise NACH lissabon.md', inhalt: 'Nur Text, keine Überschrift.' });
    expect(bildeEintraege([md, quelle(DATEIEN.lissabonTxt)])).toHaveLength(1);
  });

  it('kombiniert nicht, wenn der Titel mehrfach vorkommt', () => {
    const zweite = quelle({ name: 'Reise nach Lissabon.md', inhalt: '# Reise nach Lissabon\n\nEine andere Notiz.' });
    const eintraege = bildeEintraege([...quellen(), zweite]);
    expect(eintraege.filter((e) => e.weg === 'kombiniert')).toHaveLength(0);
    expect(eintraege).toHaveLength(4);
  });

  it('zählt dieselbe Datei im Stapel nur einmal', () => {
    const doppelt = { ...DATEIEN.einkauf, name: 'Kopie von Wocheneinkauf.txt' };
    expect(bildeEintraege([quelle(DATEIEN.einkauf), quelle(doppelt)])).toHaveLength(1);
  });
});

describe('Import bauen', () => {
  it('legt Ordner als Listen an, die Notiz als Unterliste und Überschriften als weitere Unterlisten', () => {
    const [kombiniert, einkauf] = bildeEintraege([quelle(DATEIEN.lissabonMd), quelle(DATEIEN.lissabonTxt), quelle(DATEIEN.einkauf)]);
    const { ergebnis, bestand } = importiere(leererBestand(), [auftrag(kombiniert), auftrag(einkauf)]);

    expect(baum(bestand.listen, bestand.notizen)).toEqual([
      'Haushalt (0)',
      'Haushalt › Listen (0)',
      'Haushalt › Listen › Wocheneinkauf (6)',
      'Projekte (0)',
      'Projekte › Reisen (0)',
      'Projekte › Reisen › Reise nach Lissabon (2)',
      'Projekte › Reisen › Reise nach Lissabon › Ideen vor Ort (3)',
      'Projekte › Reisen › Reise nach Lissabon › Ideen vor Ort › Tagesausflug (2)',
      'Projekte › Reisen › Reise nach Lissabon › Kosten (1)',
      'Projekte › Reisen › Reise nach Lissabon › Packliste (4)',
    ]);
    expect(ergebnis.eintrag).toMatchObject({
      datum: JETZT,
      weg: 'gemischt',
      dateien: 3,
      listen: 10,
      notizen: 18,
      aufgaben: 9,
      offen: 6,
      rueckgaengig: null,
    });
    expect(ergebnis.eintrag.fingerabdruecke).toHaveLength(3);
    expect(zusammenfassung(ergebnis.eintrag)).toBe('18 Notizen in 10 Listen, 9 Aufgaben, davon 6 offen');
  });

  it('benutzt eine gleichnamige Liste an gleicher Stelle, statt sie doppelt anzulegen', () => {
    const haushalt = baueListe({ name: 'haushalt', position: 3 });
    const bestand = { ...leererBestand(), listen: [eingangsListe(), haushalt] };
    const { ergebnis, bestand: neu } = importiere(bestand, [auftrag(eintrag(DATEIEN.einkauf))]);

    expect(ergebnis.listen.map((l) => l.name)).toEqual(['Listen', 'Wocheneinkauf']);
    expect(ergebnis.listen[0].eltern_id).toBe(haushalt.id);
    expect(neu.listen.filter((l) => l.name.toLowerCase() === 'haushalt')).toHaveLength(1);
  });

  it('benutzt keine gelöschte Liste und keine gleichnamige an anderer Stelle', () => {
    const geloescht = baueListe({ name: 'Haushalt', geloescht: '2026-11-01T00:00:00Z' });
    const woanders = baueListe({ name: 'Haushalt', eltern_id: EINGANG_ID });
    const bestand = { ...leererBestand(), listen: [eingangsListe(), geloescht, woanders] };
    const { ergebnis } = importiere(bestand, [auftrag(eintrag(DATEIEN.einkauf))]);
    expect(ergebnis.listen.map((l) => l.name)).toEqual(['Haushalt', 'Listen', 'Wocheneinkauf']);
    expect(ergebnis.listen[0].eltern_id).toBeNull();
  });

  it('hängt alles unter die gewählte Ziel-Liste und sortiert neue Listen hinten ein', () => {
    const archiv = baueListe({ name: 'Archiv', position: 5 });
    const alt = baueListe({ name: 'Alt', eltern_id: archiv.id, position: 2 });
    const bestand = { ...leererBestand(), listen: [eingangsListe(), archiv, alt] };
    const { ergebnis } = importiere(bestand, [auftrag(eintrag(DATEIEN.buch), { ziel: archiv.id }), auftrag(eintrag(DATEIEN.ohneKopf), { ziel: archiv.id })]);

    const buch = ergebnis.listen.find((l) => l.name === 'Buchnotizen')!;
    const ohne = ergebnis.listen.find((l) => l.name === 'Ohne Kopf')!;
    expect([buch.eltern_id, buch.position]).toEqual([archiv.id, 3]);
    expect([ohne.eltern_id, ohne.position]).toEqual([archiv.id, 4]);
  });

  it('gibt allen Notizen das Erstell- und Änderungsdatum der Apple-Notiz', () => {
    const { ergebnis } = importiere(leererBestand(), [auftrag(eintrag(DATEIEN.einkauf))]);
    expect(new Set(ergebnis.notizen.map((n) => n.erstellt))).toEqual(new Set(['2026-09-01T05:30:00Z']));
    expect(new Set(ergebnis.notizen.map((n) => n.geaendert))).toEqual(new Set(['2026-11-14T17:45:10Z']));
    const liste = ergebnis.listen.find((l) => l.name === 'Wocheneinkauf')!;
    expect([liste.erstellt, liste.geaendert]).toEqual(['2026-09-01T05:30:00Z', JETZT]);
  });

  it('nimmt ohne bekanntes Datum das Importdatum – oder das von Hand gesetzte', () => {
    const ohne = importiere(leererBestand(), [auftrag(eintrag(DATEIEN.gedanken))]).ergebnis;
    expect(ohne.notizen.every((n) => n.erstellt === JETZT && n.geaendert === JETZT)).toBe(true);

    const gesetzt = importiere(leererBestand(), [auftrag(eintrag(DATEIEN.gedanken), { datum: '2023-05-04' })]).ergebnis;
    const erwartet = new Date(2023, 4, 4, 12).toISOString().slice(0, 19) + 'Z';
    expect(gesetzt.notizen.every((n) => n.erstellt === erwartet && n.geaendert === erwartet)).toBe(true);
  });

  it('legt nie ein Datum in die Zukunft', () => {
    const zukunft = quelle({ name: 'Morgen.txt', inhalt: '---\ntitel: Morgen\nerstellt: 2031-01-01T10:00:00Z\n---\nText' });
    const { ergebnis } = importiere(leererBestand(), [auftrag(bildeEintraege([zukunft])[0])]);
    expect(ergebnis.notizen[0]).toMatchObject({ erstellt: JETZT, geaendert: JETZT });
  });

  it('übernimmt Checklisten als Aufgaben ohne Fälligkeit – also ohne Kalendertermin', () => {
    const { ergebnis } = importiere(leererBestand(), [auftrag(eintrag(DATEIEN.einkauf))]);
    const aufgaben = ergebnis.notizen.filter((n) => n.aufgabe);
    expect(aufgaben.map((n) => [n.text, n.aufgabe!.erledigt])).toEqual([
      ['Haferflocken', false],
      ['Äpfel', false],
      ['Kaffee', true],
      ['Spülmittel', true],
      ['Brot vom Bäcker am Markt', false],
    ]);
    expect(aufgaben.every((n) => n.aufgabe!.faellig === null && n.aufgabe!.kalender_event_id === null)).toBe(true);
    expect(aufgaben.filter((n) => n.aufgabe!.erledigt).every((n) => n.aufgabe!.erledigt_am === '2026-11-14T17:45:10Z')).toBe(true);
  });

  it('erkennt Tags samt Häufigkeit für das Tag-Dropdown', () => {
    const { ergebnis } = importiere(leererBestand(), [auftrag(eintrag(DATEIEN.gedanken)), auftrag(eintrag(DATEIEN.lissabonMd))]);
    expect(tagHaeufigkeit(ergebnis.notizen)).toEqual([
      { tag: 'notizen', anzahl: 2 },
      { tag: 'reise', anzahl: 2 },
      { tag: 'arbeit', anzahl: 1 },
      { tag: 'budget', anzahl: 1 },
    ]);
  });

  it('gibt importierte Listen für den Gedanken des Tages frei – oder lässt es', () => {
    const an = importiere(leererBestand(), [auftrag(eintrag(DATEIEN.buch))]);
    const karteAn = alsKarte(an.bestand.listen);
    // Auch die Unterlisten der Überschriften erben die Freigabe.
    expect(an.ergebnis.listen.every((l) => tagesgedankeAktiv(l.id, karteAn))).toBe(true);

    const aus = importiere(leererBestand(), [auftrag(eintrag(DATEIEN.buch))], JETZT, false);
    const karteAus = alsKarte(aus.bestand.listen);
    expect(aus.ergebnis.listen.some((l) => tagesgedankeAktiv(l.id, karteAus))).toBe(false);
  });

  it('lässt ausgeschlossene und leere Einträge weg', () => {
    const leer = bildeEintraege([quelle({ name: 'Leer.md', inhalt: '# Leer\n\n\n' })])[0];
    const { ergebnis } = importiere(leererBestand(), [
      auftrag(eintrag(DATEIEN.einkauf), { ausgeschlossen: true }),
      auftrag(leer),
      auftrag(eintrag(DATEIEN.gedanken)),
    ]);
    expect(ergebnis.listen.map((l) => l.name)).toEqual(['Gedanken ohne Leerzeilen']);
    expect(ergebnis.eintrag).toMatchObject({ dateien: 1, listen: 1, notizen: 5, weg: 'kurzbefehl' });
  });

  it('kennzeichnet alles Neue mit der import_id', () => {
    const { ergebnis } = importiere(leererBestand(), [auftrag(eintrag(DATEIEN.lissabonMd))]);
    const id = ergebnis.eintrag.id;
    expect(ergebnis.listen.every((l) => l.import_id === id)).toBe(true);
    expect(ergebnis.notizen.every((n) => n.import_id === id)).toBe(true);
  });

  it('respektiert die Einstellungen je Datei', () => {
    const e = eintrag(DATEIEN.lissabonMd);
    const { ergebnis } = importiere(leererBestand(), [auftrag(e, { ueberschriftenAlsListen: false, punkteEinzeln: false })]);
    expect(ergebnis.listen).toHaveLength(1);
    expect(ergebnis.notizen.map((n) => n.text)).toContain('**Packliste**');
  });
});

describe('Hin- und Rückumwandlung', () => {
  it('importierte Daten → Drive-Markdown → identische Daten', () => {
    const alle = bildeEintraege(Object.values(DATEIEN).map(quelle));
    const { bestand } = importiere(leererBestand(), alle.map((e) => auftrag(e)));
    const sortiert: Datenbestand = {
      ...bestand,
      // Die Liste „Tagebuch“ gibt es immer; beim Lesen kommt sie dazu.
      listen: [...bestand.listen, tagebuchListe()].sort((a, b) => (a.id < b.id ? -1 : 1)),
      notizen: [...bestand.notizen].sort((a, b) => (a.id < b.id ? -1 : 1)),
    };

    const dateien = zuDateien(sortiert);
    const zurueck = ausDateien(dateien, testUmgebung('2030-01-01T00:00:00Z'));
    expect(zurueck).toEqual(sortiert);
    // … und noch einmal: Das Format ist stabil.
    expect(zuDateien(zurueck)).toEqual(dateien);
  });

  it('legt die import_id unauffällig im Kommentar und im Dateikopf ab', () => {
    const { bestand, ergebnis } = importiere(leererBestand(), [auftrag(eintrag(DATEIEN.gedanken))]);
    const datei = zuDateien(bestand).get('Gedanken ohne Leerzeilen.md')!;
    expect(datei).toContain(`\nimport: ${ergebnis.eintrag.id}\n---`);
    expect(datei).toMatch(new RegExp(`<!-- id:\\S+ erstellt:\\S+ geaendert:\\S+ pos:1 imp:${ergebnis.eintrag.id} -->`));
    expect(JSON.parse(zuDateien(bestand).get('_meta.json')!).importe).toEqual([ergebnis.eintrag]);
  });

  it('schreibt ohne Import nichts Neues in die Dateien', () => {
    const notiz = baueNotiz({ text: 'Von Hand', liste_id: EINGANG_ID });
    const dateien = zuDateien({ ...leererBestand(), notizen: [notiz] });
    expect(dateien.get('Eingang.md')).not.toContain('imp:');
    expect(dateien.get('Eingang.md')).not.toContain('import:');
    expect(dateien.get('_meta.json')).not.toContain('importe');
  });
});

describe('Dubletten', () => {
  it('erkennt eine schon importierte Datei, auch unter anderem Namen', () => {
    const { bestand } = importiere(leererBestand(), [auftrag(eintrag(DATEIEN.einkauf))]);
    const nochmal = eintrag({ name: 'umbenannt.txt', inhalt: DATEIEN.einkauf.inhalt });
    expect(vorschau(nochmal, STANDARD_OPTIONEN, bestand.importe).schonImportiert).toBe(bestand.importe![0]);
    expect(vorschau(eintrag(DATEIEN.gedanken), STANDARD_OPTIONEN, bestand.importe).schonImportiert).toBeNull();
  });

  it('erkennt sie auch mit anderen Zeilenenden, aber nicht nach einer inhaltlichen Änderung', () => {
    const { bestand } = importiere(leererBestand(), [auftrag(eintrag(DATEIEN.einkauf))]);
    const windows = eintrag({ name: 'Wocheneinkauf.txt', inhalt: DATEIEN.einkauf.inhalt.replace(/\n/g, '\r\n') });
    expect(vorschau(windows, STANDARD_OPTIONEN, bestand.importe).schonImportiert).not.toBeNull();
    const geaendert = eintrag({ name: 'Wocheneinkauf.txt', inhalt: DATEIEN.einkauf.inhalt + '◦ Butter\n' });
    expect(vorschau(geaendert, STANDARD_OPTIONEN, bestand.importe).schonImportiert).toBeNull();
  });

  it('erkennt eine kombinierte Notiz an jeder ihrer beiden Dateien', () => {
    const [kombiniert] = bildeEintraege([quelle(DATEIEN.lissabonMd), quelle(DATEIEN.lissabonTxt)]);
    const { bestand } = importiere(leererBestand(), [auftrag(kombiniert)]);
    expect(vorschau(eintrag(DATEIEN.lissabonMd), STANDARD_OPTIONEN, bestand.importe).schonImportiert).not.toBeNull();
    expect(vorschau(eintrag(DATEIEN.lissabonTxt), STANDARD_OPTIONEN, bestand.importe).schonImportiert).not.toBeNull();
  });

  it('gilt nicht mehr, wenn der frühere Import rückgängig gemacht wurde', () => {
    const { bestand } = importiere(leererBestand(), [auftrag(eintrag(DATEIEN.einkauf))]);
    const importe: ImportEintrag[] = [{ ...bestand.importe![0], rueckgaengig: '2026-11-18T00:00:00Z' }];
    expect(vorschau(eintrag(DATEIEN.einkauf), STANDARD_OPTIONEN, importe).schonImportiert).toBeNull();
  });
});

describe('Rückgängig', () => {
  const SPAETER = '2026-11-20T10:00:00Z';

  function vorbereitet() {
    const eigene = baueListe({ name: 'Eigene Liste' });
    const eigeneNotiz = baueNotiz({ text: 'Schon vorher da', liste_id: eigene.id });
    const haushalt = baueListe({ name: 'Haushalt' });
    const start: Datenbestand = { ...leererBestand(), listen: [eingangsListe(), eigene, haushalt], notizen: [eigeneNotiz] };
    const { bestand, ergebnis } = importiere(start, [auftrag(eintrag(DATEIEN.einkauf)), auftrag(eintrag(DATEIEN.buch))]);
    return { bestand, ergebnis, eigene, eigeneNotiz, haushalt };
  }

  function wendeAn(bestand: Datenbestand, plan: { listen: Liste[]; notizen: Notiz[] }): Datenbestand {
    const listen = new Map(bestand.listen.map((l) => [l.id, l]));
    const notizen = new Map(bestand.notizen.map((n) => [n.id, n]));
    for (const l of plan.listen) listen.set(l.id, l);
    for (const n of plan.notizen) notizen.set(n.id, n);
    return { ...bestand, listen: [...listen.values()], notizen: [...notizen.values()] };
  }

  it('legt alles aus dem Import in den Papierkorb und lässt alles andere stehen', () => {
    const { bestand, ergebnis, eigeneNotiz } = vorbereitet();
    const plan = planeRueckgaengig(ergebnis.eintrag, bestand.listen, bestand.notizen, SPAETER);

    expect(plan.bearbeitet).toBe(0);
    expect(plan.behalten).toBe(0);
    expect(plan.notizen).toHaveLength(ergebnis.notizen.length);
    expect(plan.listen).toHaveLength(ergebnis.listen.length);
    expect([...plan.listen, ...plan.notizen].every((e) => e.geloescht === SPAETER && e.geaendert === SPAETER)).toBe(true);

    const danach = wendeAn(bestand, plan);
    // Übrig: die eigene Liste und die schon vorher vorhandene Liste „Haushalt“ (sie wurde nur mitbenutzt).
    expect(baum(danach.listen, danach.notizen)).toEqual(['Eigene Liste (1)', 'Haushalt (0)']);
    expect(danach.notizen.find((n) => n.id === eigeneNotiz.id)!.geloescht).toBeNull();
  });

  it('zählt, was seit dem Import bearbeitet wurde', () => {
    const { bestand, ergebnis } = vorbereitet();
    const [erste, zweite] = ergebnis.notizen;
    const liste = ergebnis.listen.find((l) => l.name === 'Buchnotizen')!;
    const bearbeitet: Datenbestand = {
      ...bestand,
      notizen: bestand.notizen.map((n) =>
        n.id === erste.id ? { ...n, text: 'geändert', geaendert: SPAETER } : n.id === zweite.id ? { ...n, geaendert: '2026-11-18T09:00:00Z' } : n,
      ),
      listen: bestand.listen.map((l) => (l.id === liste.id ? { ...l, name: 'Bücher', geaendert: SPAETER } : l)),
    };
    const plan = planeRueckgaengig(ergebnis.eintrag, bearbeitet.listen, bearbeitet.notizen, '2026-11-21T00:00:00Z');
    expect(plan.bearbeitet).toBe(3);
    // Rückgängig nimmt trotzdem alles mit – die App fragt vorher einmal nach.
    expect(plan.notizen).toHaveLength(ergebnis.notizen.length);
  });

  it('behält Listen, in denen inzwischen etwas Eigenes liegt', () => {
    const { bestand, ergebnis } = vorbereitet();
    const schlaf = ergebnis.listen.find((l) => l.name === 'Schlaf')!;
    const neu = baueNotiz({ text: 'Selbst ergänzt', liste_id: schlaf.id, erstellt: SPAETER, geaendert: SPAETER });
    const plan = planeRueckgaengig(ergebnis.eintrag, bestand.listen, [...bestand.notizen, neu], '2026-11-21T00:00:00Z');

    // „Schlaf“ und seine Elternlisten „Sachbücher“ und „Buchnotizen“ bleiben.
    expect(plan.behalten).toBe(3);
    const danach = wendeAn({ ...bestand, notizen: [...bestand.notizen, neu] }, plan);
    expect(baum(danach.listen, danach.notizen)).toEqual([
      'Buchnotizen (0)',
      'Buchnotizen › Sachbücher (0)',
      'Buchnotizen › Sachbücher › Schlaf (1)',
      'Eigene Liste (1)',
      'Haushalt (0)',
    ]);
  });

  it('fasst schon gelöschte Notizen nicht noch einmal an', () => {
    const { bestand, ergebnis } = vorbereitet();
    const weg = ergebnis.notizen[0];
    const notizen = bestand.notizen.map((n) => (n.id === weg.id ? { ...n, geloescht: '2026-11-18T00:00:00Z', geaendert: '2026-11-18T00:00:00Z' } : n));
    const plan = planeRueckgaengig(ergebnis.eintrag, bestand.listen, notizen, SPAETER);
    expect(plan.notizen.map((n) => n.id)).not.toContain(weg.id);
    expect(plan.bearbeitet).toBe(0);
  });

  it('lässt sich über den Papierkorb zurückholen: Liste samt Inhalt', () => {
    const { bestand, ergebnis } = vorbereitet();
    const danach = wendeAn(bestand, planeRueckgaengig(ergebnis.eintrag, bestand.listen, bestand.notizen, SPAETER));
    const buch = ergebnis.listen.find((l) => l.name === 'Buchnotizen')!;
    const wieder = stelleListeWiederHer(buch.id, alsKarte(danach.listen), danach.notizen, '2026-11-22T00:00:00Z');
    const zurueck = wendeAn(danach, wieder);
    expect(baum(zurueck.listen, zurueck.notizen)).toContain('Buchnotizen › Sachbücher › Gewohnheiten (5)');
  });
});

describe('Ablauf: erst sichern, dann schreiben', () => {
  it('sichert den Stand von vor dem Import als ZIP und schreibt erst danach', async () => {
    const vorher = baueNotiz({ text: 'War schon da', liste_id: EINGANG_ID });
    const bestand: Datenbestand = { ...leererBestand(), notizen: [vorher] };
    const schritte: string[] = [];
    let zip: Uint8Array | null = null;
    let verlaufId = '';

    const ergebnis = await fuehreImportAus([auftrag(eintrag(DATEIEN.einkauf))], bestand, testUmgebung(JETZT), { tagesgedanke: true }, {
      sichere: async (z) => {
        await Promise.resolve();
        schritte.push('sichern');
        zip = z;
      },
      schreibe: (listen, notizen, e) => {
        schritte.push(`schreiben: ${listen.length} Listen, ${notizen.length} Notizen`);
        verlaufId = e.id;
      },
    });

    expect(verlaufId).toBe(ergebnis.eintrag.id);
    expect(schritte[0]).toBe('sichern');
    expect(schritte).toEqual(['sichern', 'schreiben: 3 Listen, 6 Notizen']);
    const gesichert = entpacke(zip!);
    expect(gesichert.get('Eingang.md')).toContain('War schon da');
    expect([...gesichert.keys()].some((pfad) => pfad.includes('Wocheneinkauf'))).toBe(false);
  });

  it('importiert nichts, wenn die Sicherung fehlschlägt', async () => {
    let geschrieben = false;
    const versuch = fuehreImportAus([auftrag(eintrag(DATEIEN.einkauf))], leererBestand(), testUmgebung(JETZT), { tagesgedanke: true }, {
      sichere: async () => {
        throw new Error('Speicher voll');
      },
      schreibe: () => {
        geschrieben = true;
      },
    });
    await expect(versuch).rejects.toThrow('Speicher voll');
    expect(geschrieben).toBe(false);
  });

  it('bricht ab, wenn es nichts zu importieren gibt', async () => {
    const versuch = fuehreImportAus([auftrag(eintrag(DATEIEN.einkauf), { ausgeschlossen: true })], leererBestand(), testUmgebung(JETZT), { tagesgedanke: true }, {
      sichere: async () => {},
      schreibe: () => {},
    });
    await expect(versuch).rejects.toThrow('nichts zum Importieren');
  });

  it('warnt nur ohne Verbindung zu Google', () => {
    expect(warnungOhneDrive(true)).toBeNull();
    expect(warnungOhneDrive(false)).toContain('Du bist nicht mit Google verbunden.');
    expect(warnungOhneDrive(false)).toContain('Erst verbinden?');
  });
});

describe('Import-Verlauf im Abgleich', () => {
  const eintragA: ImportEintrag = {
    id: '01A',
    datum: '2026-11-17T08:00:00Z',
    weg: 'markdown',
    dateien: 1,
    listen: 1,
    notizen: 2,
    aufgaben: 0,
    offen: 0,
    fingerabdruecke: ['a-1'],
    rueckgaengig: null,
  };
  const eintragB: ImportEintrag = { ...eintragA, id: '01B', fingerabdruecke: ['b-1'] };

  it('vereinigt die Verläufe beider Geräte', () => {
    const lokal = { ...leererBestand(), importe: [eintragA] };
    const fern = { ...leererBestand(), importe: [eintragB] };
    expect(verschmelze(lokal, fern, null, JETZT).importe).toEqual([eintragA, eintragB]);
  });

  it('behält „rückgängig gemacht“, egal auf welchem Gerät es geschah', () => {
    const zurueck = { ...eintragA, rueckgaengig: '2026-11-18T00:00:00Z' };
    const a = verschmelze({ ...leererBestand(), importe: [zurueck] }, { ...leererBestand(), importe: [eintragA] }, null, JETZT);
    const b = verschmelze({ ...leererBestand(), importe: [eintragA] }, { ...leererBestand(), importe: [zurueck] }, null, JETZT);
    expect(a.importe).toEqual([zurueck]);
    expect(b.importe).toEqual([zurueck]);
  });

  it('lässt Bestände ohne Import unverändert', () => {
    expect(verschmelze(leererBestand(), leererBestand(), null, JETZT)).not.toHaveProperty('importe');
  });

  it('trägt die import_id durch den Abgleich: neu importierte Notizen kommen auf dem anderen Gerät an', () => {
    const { bestand, ergebnis } = importiere(leererBestand(), [auftrag(eintrag(DATEIEN.gedanken))]);
    const fern = ausDateien(zuDateien(leererBestand()), testUmgebung(JETZT));
    const ergebnisB = verschmelze(leererBestand(), verschmelze(bestand, fern, null, JETZT), null, JETZT);
    expect(ergebnisB.notizen.filter((n) => n.import_id === ergebnis.eintrag.id)).toHaveLength(5);
    expect(ergebnisB.importe).toEqual([ergebnis.eintrag]);
  });
});
