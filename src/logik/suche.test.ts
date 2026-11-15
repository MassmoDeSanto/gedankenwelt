import { beforeEach, describe, expect, it } from 'vitest';
import { alsKarte } from './listen';
import { LEERER_FILTER, Suchindex, markiere, type SuchFilter } from './suche';
import { baueListe, baueNotiz } from './test-hilfe';

const reise = baueListe({ name: 'Reise-App' });
const geld = baueListe({ name: 'Monetarisierung', eltern_id: reise.id });
const kochen = baueListe({ name: 'Kochen' });
const listen = alsKarte([reise, geld, kochen]);

const offen = { erledigt: false, erledigt_am: null, faellig: null, wiederholung: null, kalender_event_id: null };

const n1 = baueNotiz({
  text: 'Affiliate-Links für Hotels als Einnahmequelle. #geschäftsmodell',
  liste_id: geld.id,
});
const n2 = baueNotiz({
  text: 'Hotelbewertungen sammeln #idee',
  liste_id: reise.id,
  geaendert: '2026-11-12T12:00:00Z',
});
const n3 = baueNotiz({
  text: 'Preise der Konkurrenz vergleichen #geschäftsmodell',
  liste_id: geld.id,
  erstellt: '2026-11-10T12:00:00Z',
  geaendert: '2026-11-10T12:00:00Z',
  aufgabe: offen,
});
const n4 = baueNotiz({
  text: 'Rezept für Lasagne aufschreiben',
  liste_id: kochen.id,
  aufgabe: { ...offen, erledigt: true, erledigt_am: '2026-04-01T12:00:00Z' },
});
const geloescht = baueNotiz({
  text: 'Affiliate im Papierkorb',
  liste_id: geld.id,
  geloescht: '2026-11-01T12:00:00Z',
});

let index: Suchindex;
beforeEach(() => {
  index = new Suchindex();
  index.setzeAlle([n1, n2, n3, n4, geloescht]);
});

const suche = (anfrage: string, filter: Partial<SuchFilter> = {}) =>
  index
    .suche(anfrage, { ...LEERER_FILTER, ...filter }, listen)
    .map((t) => t.notiz.id)
    .sort();
const ids = (...notizen: { id: string }[]) => notizen.map((n) => n.id).sort();

describe('Suche: Text', () => {
  it('findet trotz Tippfehler („Afilliate“ → „Affiliate“)', () => {
    expect(suche('Afilliate')).toEqual(ids(n1));
  });

  it('findet Wortanfänge („Hotel“ → „Hotels“, „Hotelbewertungen“)', () => {
    expect(suche('Hotel')).toEqual(ids(n1, n2));
  });

  it('Groß-/Kleinschreibung und Umlaute spielen keine Rolle', () => {
    expect(suche('GESCHAFTSMODELL')).toEqual(ids(n1, n3));
    expect(suche('für')).toEqual(ids(n1, n4));
  });

  it('mehrere Wörter müssen alle vorkommen', () => {
    expect(suche('hotel affiliate')).toEqual(ids(n1));
    expect(suche('hotel lasagne')).toEqual([]);
  });

  it('durchsucht den Papierkorb nicht', () => {
    expect(suche('Papierkorb')).toEqual([]);
    expect(suche('Affiliate')).toEqual(ids(n1));
  });

  it('ohne Suchtext und ohne Filter gibt es keine Treffer', () => {
    expect(suche('')).toEqual([]);
    expect(suche('   ')).toEqual([]);
  });

  it('liefert die gefundenen Wörter zum Hervorheben', () => {
    const treffer = index.suche('Hotel', LEERER_FILTER, listen).find((t) => t.notiz.id === n1.id)!;
    expect(treffer.terme).toContain('hotels');
    expect(markiere(n1.text, treffer.terme).filter((a) => a.treffer).map((a) => a.text)).toEqual(['Hotels']);
  });
});

describe('Suche: Filter', () => {
  it('Liste einschließlich Unterlisten', () => {
    expect(suche('hotel', { liste_id: reise.id })).toEqual(ids(n1, n2));
    expect(suche('hotel', { liste_id: geld.id })).toEqual(ids(n1));
    expect(suche('hotel', { liste_id: kochen.id })).toEqual([]);
    expect(suche('', { liste_id: reise.id })).toEqual(ids(n1, n2, n3));
  });

  it('Tags (alle gewählten müssen passen)', () => {
    expect(suche('', { tags: ['geschäftsmodell'] })).toEqual(ids(n1, n3));
    expect(suche('', { tags: ['idee'] })).toEqual(ids(n2));
    expect(suche('', { tags: ['idee', 'geschäftsmodell'] })).toEqual([]);
  });

  it('Aufgaben: offen / erledigt / keine Aufgabe', () => {
    expect(suche('', { aufgaben: 'offen' })).toEqual(ids(n3));
    expect(suche('', { aufgaben: 'erledigt' })).toEqual(ids(n4));
    expect(suche('', { aufgaben: 'keine' })).toEqual(ids(n1, n2));
  });

  it('Datum: erstellt im Zeitraum', () => {
    expect(suche('', { von: '2026-11-01', bis: '2026-11-30' })).toEqual(ids(n3));
    expect(suche('', { bis: '2026-03-31' })).toEqual(ids(n1, n2, n4));
    expect(suche('', { von: '2026-11-10', bis: '2026-11-10' })).toEqual(ids(n3));
  });

  it('Datum: geändert im Zeitraum', () => {
    expect(suche('', { datumFeld: 'geaendert', von: '2026-11-11' })).toEqual(ids(n2));
    expect(suche('', { datumFeld: 'geaendert', von: '2026-11-01' })).toEqual(ids(n2, n3));
  });

  it('alle Filter kombiniert mit Suchtext', () => {
    const filter: Partial<SuchFilter> = {
      liste_id: reise.id,
      tags: ['geschäftsmodell'],
      aufgaben: 'offen',
      von: '2026-11-01',
      bis: '2026-11-30',
    };
    expect(suche('preise', filter)).toEqual(ids(n3));
    expect(suche('hotel', filter)).toEqual([]);
    expect(suche('preise', { ...filter, aufgaben: 'erledigt' })).toEqual([]);
    expect(suche('preise', { ...filter, liste_id: kochen.id })).toEqual([]);
  });

  it('ohne Suchtext: neueste Änderung zuerst', () => {
    const treffer = index.suche('', { ...LEERER_FILTER, liste_id: reise.id }, listen);
    expect(treffer.map((t) => t.notiz.id)).toEqual([n2.id, n3.id, n1.id]);
  });
});

describe('Suche: Index aktuell halten', () => {
  it('bearbeitete Notiz wird unter dem neuen Text gefunden', () => {
    index.aktualisiere({ ...n2, text: 'Flugpreise beobachten' });
    expect(suche('Hotelbewertungen')).toEqual([]);
    expect(suche('Flugpreise')).toEqual(ids(n2));
  });

  it('neue Notiz wird gefunden, gelöschte nicht mehr, wiederhergestellte wieder', () => {
    const neu = baueNotiz({ text: 'Zitronenkuchen', liste_id: kochen.id });
    index.aktualisiere(neu);
    expect(suche('Zitronen')).toEqual(ids(neu));

    index.aktualisiere({ ...neu, geloescht: '2026-11-15T12:00:00Z' });
    expect(suche('Zitronen')).toEqual([]);

    index.aktualisiere(neu);
    expect(suche('Zitronen')).toEqual(ids(neu));
  });
});

describe('Suche: Geschwindigkeit', () => {
  it('antwortet bei 20.000 Notizen in unter 100 ms', () => {
    const woerter = 'reise hotel affiliate preis idee markt kunde app liste gedanke plan woche geld zeit ort'.split(' ');
    const viele = Array.from({ length: 20000 }, (_, i) =>
      baueNotiz({
        text: Array.from({ length: 12 }, (_, j) => woerter[(i * 7 + j * 13 + (i % 5) * j) % woerter.length] + (i % 97)).join(' '),
        liste_id: kochen.id,
      }),
    );
    const gross = new Suchindex();
    gross.setzeAlle(viele);

    const anfragen = ['hotel', 'afilliate12', 'reise4 markt', 'gedanke', 'pla'];
    const start = performance.now();
    for (const anfrage of anfragen) gross.suche(anfrage, LEERER_FILTER, listen);
    const proSuche = (performance.now() - start) / anfragen.length;
    expect(proSuche).toBeLessThan(100);
  });
});

describe('markiere', () => {
  it('teilt den Text in normale und hervorgehobene Abschnitte', () => {
    expect(markiere('Affiliate-Links für Hotels', ['hotels'])).toEqual([
      { text: 'Affiliate-Links für ', treffer: false },
      { text: 'Hotels', treffer: true },
    ]);
  });

  it('ohne Treffer bleibt der Text ganz', () => {
    expect(markiere('nur Text', [])).toEqual([{ text: 'nur Text', treffer: false }]);
  });
});
