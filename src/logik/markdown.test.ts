import { describe, expect, it } from 'vitest';
import { EINGANG_ID, eingangsListe, type Datenbestand } from '../modell/typen';
import { ausDateien, zuDateien } from './markdown';
import { baueListe, baueNotiz, testUmgebung } from './test-hilfe';

const nachId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);

function sortiert(b: Datenbestand): Datenbestand {
  return { ...b, listen: [...b.listen].sort(nachId), notizen: [...b.notizen].sort(nachId) };
}

function beispiel(): Datenbestand {
  const eingang = eingangsListe('2026-01-01T12:00:00Z');
  const reise = baueListe({ id: '01LISTE0000000000000REJSE1', name: 'Reise-App', angeheftet: true, tagesgedanke: 'an' });
  const geld = baueListe({ id: '01LISTE0000000000000GE1D01', name: 'Monetarisierung', eltern_id: reise.id, position: 1 });
  const features = baueListe({ name: 'Features', eltern_id: reise.id, position: 2, tagesgedanke: 'aus' });
  const karte = baueListe({ name: 'Karte', eltern_id: features.id });
  const wild = baueListe({ name: 'Ideen: "wild" / neu', position: 2.5 });
  const doppelt1 = baueListe({ name: 'Doppelt', position: 3 });
  const doppelt2 = baueListe({ name: 'Doppelt', position: 4 });
  const unterstrich = baueListe({ name: '_liste', position: 5 });
  const alt = baueListe({ name: 'Alt', position: 6, geloescht: '2026-11-01T12:00:00Z' });

  return {
    listen: [eingang, reise, geld, features, karte, wild, doppelt1, doppelt2, unterstrich, alt],
    notizen: [
      baueNotiz({ text: 'Schneller Gedanke', liste_id: EINGANG_ID }),
      baueNotiz({ text: 'Notiz direkt in der Reise-App\nmit zweiter Zeile', liste_id: reise.id }),
      baueNotiz({
        id: '01N0T1Z00000000000000000A1',
        text: 'Affiliate-Links für Hotels als Einnahmequelle. #geschäftsmodell',
        liste_id: geld.id,
        position: 1,
      }),
      baueNotiz({
        id: '01N0T1Z00000000000000000A2',
        text: 'Preise der Konkurrenz vergleichen',
        liste_id: geld.id,
        position: 2,
        erstellt: '2026-11-15T09:20:00Z',
        geaendert: '2026-11-15T09:20:00Z',
        aufgabe: {
          erledigt: false,
          erledigt_am: null,
          faellig: '2026-11-20T18:00',
          wiederholung: null,
          kalender_event_id: null,
          erinnerung: 0,
          erledigt_verlauf: [],
          prioritaet: 'hoch',
          stand: 'in_arbeit',
        },
      }),
      baueNotiz({
        id: '01N0T1Z00000000000000000A3',
        text: 'Zwischen zwei anderen #idee #Reise',
        liste_id: geld.id,
        position: 1.5,
      }),
      baueNotiz({
        text: 'Erledigt ohne Datum',
        liste_id: karte.id,
        aufgabe: {
          erledigt: true,
          erledigt_am: '2026-11-14T08:00:00Z',
          faellig: '2026-11-13',
          wiederholung: null,
          kalender_event_id: null,
          erinnerung: 0,
          erledigt_verlauf: [],
          prioritaet: null,
          stand: 'offen',
        },
      }),
      baueNotiz({ text: 'In der wilden Liste', liste_id: wild.id }),
      baueNotiz({
        id: '01N0T1Z00000000000000000B1',
        text: 'Wochenplanung',
        liste_id: wild.id,
        position: 2,
        aufgabe: {
          erledigt: false,
          erledigt_am: null,
          faellig: '2026-11-22T18:00',
          wiederholung: { art: 'woechentlich', tage: ['SO'], intervall: 1, ab: 'faellig', ende: { art: 'nie' } },
          kalender_event_id: 'abc123 /?',
          erinnerung: 15,
          erledigt_verlauf: ['2026-11-08T17:10:00Z', '2026-11-15T17:55:12Z'],
          prioritaet: null,
          stand: 'offen',
        },
      }),
      baueNotiz({
        text: 'Filter wechseln',
        liste_id: wild.id,
        position: 3,
        aufgabe: {
          erledigt: false,
          erledigt_am: null,
          faellig: '2026-12-01',
          wiederholung: {
            art: 'monatlich-wochentag',
            woche: -1,
            wochentag: 'FR',
            intervall: 3,
            ab: 'erledigung',
            ende: { art: 'anzahl', anzahl: 4 },
          },
          kalender_event_id: null,
          erinnerung: 0,
          erledigt_verlauf: [],
          prioritaet: null,
          stand: 'offen',
        },
      }),
      baueNotiz({ text: 'Erste Doppelte', liste_id: doppelt1.id }),
      baueNotiz({ text: 'Zweite Doppelte', liste_id: doppelt2.id }),
      baueNotiz({ text: 'Einzeln gelöscht #weg', liste_id: reise.id, geloescht: '2026-11-10T12:00:00Z' }),
      baueNotiz({ text: 'Mit der Liste gelöscht', liste_id: alt.id, geloescht: '2026-11-01T12:00:00Z' }),
      baueNotiz({
        text: 'Gelöschte Aufgabe',
        liste_id: EINGANG_ID,
        geloescht: '2026-11-11T12:00:00Z',
        aufgabe: { erledigt: false, erledigt_am: null, faellig: null, wiederholung: null, kalender_event_id: null, erinnerung: 0, erledigt_verlauf: [], prioritaet: null, stand: 'offen' },
      }),
    ],
    einstellungen: { thema: 'hell', geaendert: '2026-11-15T10:00:00Z', erinnerungen: true, kalender_id: 'kal-1@group.calendar.google.com' },
    tagesgedanke_verlauf: [{ datum: '2026-11-14', notiz_id: '01N0T1Z00000000000000000A1' }],
  };
}

describe('Markdown-Format', () => {
  it('Hin- und Rückumwandlung ergibt exakt dieselben Daten', () => {
    const bestand = beispiel();
    const zurueck = ausDateien(zuDateien(bestand), testUmgebung());
    expect(zurueck).toEqual(sortiert(bestand));
  });

  it('zweimal hin und zurück ergibt dieselben Dateien', () => {
    const einmal = zuDateien(beispiel());
    const zweimal = zuDateien(ausDateien(einmal, testUmgebung()));
    expect([...zweimal.entries()].sort()).toEqual([...einmal.entries()].sort());
  });

  it('legt die beschriebene Ordnerstruktur an', () => {
    const pfade = [...zuDateien(beispiel()).keys()].sort();
    expect(pfade).toEqual(
      [
        'Eingang.md',
        'Reise-App/_liste.md',
        'Reise-App/Monetarisierung.md',
        'Reise-App/Features/_liste.md',
        'Reise-App/Features/Karte.md',
        'Ideen- -wild- - neu.md',
        'Doppelt.md',
        'Doppelt (2).md',
        '-liste.md',
        '_papierkorb.md',
        '_meta.json',
      ].sort(),
    );
  });

  it('schreibt lesbare Dateien: Kopf, Text, Metadaten als Kommentar', () => {
    const inhalt = zuDateien(beispiel()).get('Reise-App/Monetarisierung.md');
    expect(inhalt).toBe(
      [
        '---',
        'id: 01LISTE0000000000000GE1D01',
        'name: Monetarisierung',
        'eltern: 01LISTE0000000000000REJSE1',
        'angeheftet: false',
        'tagesgedanke: erben',
        'position: 1',
        'erstellt: 2026-01-01T12:00:00Z',
        'geaendert: 2026-01-01T12:00:00Z',
        '---',
        '',
        'Affiliate-Links für Hotels als Einnahmequelle. #geschäftsmodell',
        '<!-- id:01N0T1Z00000000000000000A1 erstellt:2026-03-12T12:00:00Z geaendert:2026-03-12T12:00:00Z pos:1 -->',
        '',
        'Zwischen zwei anderen #idee #Reise',
        '<!-- id:01N0T1Z00000000000000000A3 erstellt:2026-03-12T12:00:00Z geaendert:2026-03-12T12:00:00Z pos:1.5 -->',
        '',
        '[ ] Preise der Konkurrenz vergleichen',
        '<!-- id:01N0T1Z00000000000000000A2 erstellt:2026-11-15T09:20:00Z geaendert:2026-11-15T09:20:00Z pos:2 faellig:2026-11-20T18:00 wiederholung:keine prio:hoch stand:in_arbeit -->',
        '',
      ].join('\n'),
    );
  });

  it('Wiederholung, Erinnerung und Verlauf stehen lesbar im Kommentar', () => {
    const inhalt = zuDateien(beispiel()).get('Ideen- -wild- - neu.md')!;
    expect(inhalt).toContain(
      [
        '[ ] Wochenplanung',
        '<!-- id:01N0T1Z00000000000000000B1 erstellt:2026-03-12T12:00:00Z geaendert:2026-03-12T12:00:00Z pos:2 ' +
          'faellig:2026-11-22T18:00 wiederholung:woechentlich;tage=SO;ab=faellig erinnerung:15 ' +
          'verlauf:2026-11-08T17:10:00Z,2026-11-15T17:55:12Z kalender:abc123%20%2F%3F -->',
      ].join('\n'),
    );
    expect(inhalt).toContain('wiederholung:monatlich;am=letzter.FR;alle=3;ab=erledigung;noch=4 -->');
  });

  it('Priorität und Stand: alte Kommentare ohne die Angaben und unbekannte Werte', () => {
    const datei = [
      '[ ] Alte Aufgabe',
      '<!-- id:01N0T1Z00000000000000000C1 erstellt:2026-03-12T12:00:00Z geaendert:2026-03-12T12:00:00Z pos:1 wiederholung:keine -->',
      '',
      '[ ] Unbekannte Werte',
      '<!-- id:01N0T1Z00000000000000000C2 erstellt:2026-03-12T12:00:00Z geaendert:2026-03-12T12:00:00Z pos:2 wiederholung:keine prio:dringend stand:wartet -->',
      '',
      '[ ] Niedrig',
      '<!-- id:01N0T1Z00000000000000000C3 erstellt:2026-03-12T12:00:00Z geaendert:2026-03-12T12:00:00Z pos:3 wiederholung:keine prio:niedrig -->',
      '',
    ].join('\n');
    const bestand = ausDateien(new Map([['Eingang.md', datei]]), testUmgebung());
    const aufgabe = (text: string) => bestand.notizen.find((n) => n.text === text)!.aufgabe!;
    expect(aufgabe('Alte Aufgabe')).toMatchObject({ prioritaet: null, stand: 'offen' });
    expect(aufgabe('Unbekannte Werte')).toMatchObject({ prioritaet: null, stand: 'offen' });
    expect(aufgabe('Niedrig')).toMatchObject({ prioritaet: 'niedrig', stand: 'offen' });
  });

  it('Wiederholungsregeln und Verlauf überstehen die Hin- und Rückumwandlung exakt', () => {
    const zurueck = ausDateien(zuDateien(beispiel()), testUmgebung());
    const wochenplanung = zurueck.notizen.find((n) => n.text === 'Wochenplanung')!;
    expect(wochenplanung.aufgabe).toEqual({
      erledigt: false,
      erledigt_am: null,
      faellig: '2026-11-22T18:00',
      wiederholung: { art: 'woechentlich', tage: ['SO'], intervall: 1, ab: 'faellig', ende: { art: 'nie' } },
      kalender_event_id: 'abc123 /?',
      erinnerung: 15,
      erledigt_verlauf: ['2026-11-08T17:10:00Z', '2026-11-15T17:55:12Z'],
      prioritaet: null,
      stand: 'offen',
    });
    expect(zurueck.notizen.find((n) => n.text === 'Filter wechseln')!.aufgabe?.wiederholung).toEqual({
      art: 'monatlich-wochentag',
      woche: -1,
      wochentag: 'FR',
      intervall: 3,
      ab: 'erledigung',
      ende: { art: 'anzahl', anzahl: 4 },
    });
  });

  it('gelöschte Notizen stehen nur im Papierkorb, gelöschte Listen in der Meta-Datei', () => {
    const dateien = zuDateien(beispiel());
    const papierkorb = dateien.get('_papierkorb.md')!;
    expect(papierkorb).toContain('Einzeln gelöscht #weg');
    expect(papierkorb).toContain('Mit der Liste gelöscht');
    expect(papierkorb).toContain('[ ] Gelöschte Aufgabe');
    expect(papierkorb).toContain('geloescht:2026-11-10T12:00:00Z');
    expect(dateien.get('Reise-App/_liste.md')).not.toContain('Einzeln gelöscht');

    const meta = JSON.parse(dateien.get('_meta.json')!);
    expect(meta.geloeschte_listen.map((l: { name: string }) => l.name)).toEqual(['Alt']);
    expect(meta.einstellungen).toMatchObject({ thema: 'hell', erinnerungen: true });
    expect(meta.tagesgedanke_verlauf).toHaveLength(1);
  });

  it('Tags und Aufgaben werden beim Lesen aus dem Text abgeleitet', () => {
    const zurueck = ausDateien(zuDateien(beispiel()), testUmgebung());
    const mitTags = zurueck.notizen.find((n) => n.text.startsWith('Zwischen'))!;
    expect(mitTags.tags).toEqual(['idee', 'reise']);
    const aufgabe = zurueck.notizen.find((n) => n.text === 'Preise der Konkurrenz vergleichen')!;
    expect(aufgabe.aufgabe).toMatchObject({ erledigt: false, faellig: '2026-11-20T18:00' });
  });

  it('von Hand geschriebene Dateien ohne Metadaten werden eingelesen', () => {
    const umg = testUmgebung();
    const dateien = new Map([
      ['Neu.md', 'Erster Gedanke\nzweite Zeile\n\n\n\n[x] Erledigte Aufgabe\n'],
      ['Ordner/Kind.md', '---\nname: Kind mit Namen\n---\n\nText #tag\n'],
    ]);
    const bestand = ausDateien(dateien, umg);

    const neu = bestand.listen.find((l) => l.name === 'Neu')!;
    const ordner = bestand.listen.find((l) => l.name === 'Ordner')!;
    const kind = bestand.listen.find((l) => l.name === 'Kind mit Namen')!;
    expect(neu.eltern_id).toBeNull();
    expect(kind.eltern_id).toBe(ordner.id);
    expect(bestand.listen.some((l) => l.id === EINGANG_ID)).toBe(true);

    const notizen = bestand.notizen.filter((n) => n.liste_id === neu.id).sort((a, b) => a.position - b.position);
    expect(notizen.map((n) => n.text)).toEqual(['Erster Gedanke\nzweite Zeile', 'Erledigte Aufgabe']);
    expect(notizen[0].erstellt).toBe(umg.jetzt);
    expect(notizen[1].aufgabe?.erledigt).toBe(true);
    expect(new Set(bestand.notizen.map((n) => n.id)).size).toBe(bestand.notizen.length);
  });

  it('leerer Bestand: nur Eingang, Papierkorb und Meta', () => {
    const leer: Datenbestand = {
      listen: [eingangsListe('2026-01-01T12:00:00Z')],
      notizen: [],
      einstellungen: { thema: 'dunkel' },
      tagesgedanke_verlauf: [],
    };
    const dateien = zuDateien(leer);
    expect([...dateien.keys()].sort()).toEqual(['Eingang.md', '_meta.json', '_papierkorb.md']);
    expect(ausDateien(dateien, testUmgebung())).toEqual(leer);
  });
});
