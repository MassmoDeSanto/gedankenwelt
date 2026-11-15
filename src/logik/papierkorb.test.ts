import { describe, expect, it } from 'vitest';
import { EINGANG_ID, eingangsListe } from '../modell/typen';
import { alsKarte } from './listen';
import {
  abgelaufen,
  loescheListe,
  papierkorbInhalt,
  resttage,
  stelleListeWiederHer,
  stelleNotizWiederHer,
} from './papierkorb';
import { baueListe, baueNotiz } from './test-hilfe';

const JETZT = '2026-11-15T12:00:00Z';

function aufbau() {
  const eingang = eingangsListe('2026-01-01T12:00:00Z');
  const reise = baueListe({ name: 'Reise' });
  const geld = baueListe({ name: 'Geld', eltern_id: reise.id });
  const tief = baueListe({ name: 'Tief', eltern_id: geld.id });
  const andere = baueListe({ name: 'Andere' });
  const notizen = [
    baueNotiz({ text: 'in Reise', liste_id: reise.id }),
    baueNotiz({ text: 'in Geld', liste_id: geld.id }),
    baueNotiz({ text: 'in Tief', liste_id: tief.id }),
    baueNotiz({ text: 'in Andere', liste_id: andere.id }),
    baueNotiz({ text: 'früher gelöscht', liste_id: geld.id, geloescht: '2026-11-01T12:00:00Z' }),
  ];
  return { eingang, reise, geld, tief, andere, notizen, listen: alsKarte([eingang, reise, geld, tief, andere]) };
}

/** Wendet eine Änderung auf Listen und Notizen an (wie es der Speicher der App tut). */
function wendeAn(a: ReturnType<typeof aufbau>, aenderung: ReturnType<typeof loescheListe>) {
  for (const l of aenderung.listen) a.listen.set(l.id, l);
  a.notizen = a.notizen.map((n) => aenderung.notizen.find((g) => g.id === n.id) ?? n);
}

describe('Liste löschen', () => {
  it('löscht Unterlisten und Notizen mit, andere Listen bleiben', () => {
    const a = aufbau();
    wendeAn(a, loescheListe(a.reise.id, a.listen, a.notizen, JETZT));

    expect([a.reise, a.geld, a.tief].map((l) => a.listen.get(l.id)!.geloescht)).toEqual([JETZT, JETZT, JETZT]);
    expect(a.listen.get(a.andere.id)!.geloescht).toBeNull();
    expect(a.notizen.filter((n) => n.geloescht === JETZT).map((n) => n.text)).toEqual(['in Reise', 'in Geld', 'in Tief']);
    expect(a.notizen.find((n) => n.text === 'in Andere')!.geloescht).toBeNull();
    // schon vorher Gelöschtes behält seinen alten Zeitstempel
    expect(a.notizen.find((n) => n.text === 'früher gelöscht')!.geloescht).toBe('2026-11-01T12:00:00Z');
  });

  it('der Eingang kann nicht gelöscht werden', () => {
    const a = aufbau();
    expect(loescheListe(EINGANG_ID, a.listen, a.notizen, JETZT)).toEqual({ listen: [], notizen: [] });
  });
});

describe('Wiederherstellen', () => {
  it('eine Liste kommt mit allem zurück, was mit ihr gelöscht wurde', () => {
    const a = aufbau();
    wendeAn(a, loescheListe(a.reise.id, a.listen, a.notizen, JETZT));
    wendeAn(a, stelleListeWiederHer(a.reise.id, a.listen, a.notizen, '2026-11-16T12:00:00Z'));

    expect([...a.listen.values()].every((l) => l.geloescht === null)).toBe(true);
    expect(a.notizen.filter((n) => n.geloescht).map((n) => n.text)).toEqual(['früher gelöscht']);
  });

  it('eine Unterliste ohne Elternliste kommt nach ganz oben', () => {
    const a = aufbau();
    wendeAn(a, loescheListe(a.geld.id, a.listen, a.notizen, '2026-11-10T12:00:00Z'));
    wendeAn(a, loescheListe(a.reise.id, a.listen, a.notizen, JETZT));
    wendeAn(a, stelleListeWiederHer(a.geld.id, a.listen, a.notizen, '2026-11-16T12:00:00Z'));

    expect(a.listen.get(a.geld.id)).toMatchObject({ geloescht: null, eltern_id: null });
    expect(a.listen.get(a.tief.id)).toMatchObject({ geloescht: null, eltern_id: a.geld.id });
    expect(a.listen.get(a.reise.id)!.geloescht).toBe(JETZT);
  });

  it('eine Notiz aus einer gelöschten Liste landet im Eingang', () => {
    const a = aufbau();
    wendeAn(a, loescheListe(a.reise.id, a.listen, a.notizen, JETZT));
    const alt = a.notizen.find((n) => n.text === 'früher gelöscht')!;
    expect(stelleNotizWiederHer(alt, a.listen, JETZT)).toMatchObject({ geloescht: null, liste_id: EINGANG_ID });

    const b = aufbau();
    const einzeln = b.notizen.find((n) => n.text === 'früher gelöscht')!;
    expect(stelleNotizWiederHer(einzeln, b.listen, JETZT)).toMatchObject({ geloescht: null, liste_id: b.geld.id });
  });
});

describe('Papierkorb-Inhalt', () => {
  it('zeigt gelöschte Äste als eine Liste und einzeln Gelöschtes extra', () => {
    const a = aufbau();
    wendeAn(a, loescheListe(a.reise.id, a.listen, a.notizen, JETZT));
    const inhalt = papierkorbInhalt(a.listen, a.notizen);
    expect(inhalt.listen.map((e) => [e.liste.name, e.anzahlNotizen])).toEqual([['Reise', 3]]);
    expect(inhalt.notizen.map((n) => n.text)).toEqual(['früher gelöscht']);
  });
});

describe('30 Tage', () => {
  it('abgelaufen erst nach mehr als 30 Tagen', () => {
    expect(abgelaufen('2026-10-16T12:00:01Z', new Date(JETZT))).toBe(false);
    expect(abgelaufen('2026-10-16T11:59:59Z', new Date(JETZT))).toBe(true);
  });

  it('resttage zählt herunter', () => {
    expect(resttage(JETZT, new Date(JETZT))).toBe(30);
    expect(resttage('2026-11-05T12:00:00Z', new Date(JETZT))).toBe(20);
    expect(resttage('2026-01-01T12:00:00Z', new Date(JETZT))).toBe(0);
  });
});
