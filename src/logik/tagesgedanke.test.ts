import { describe, expect, it } from 'vitest';
import type { Notiz, VerlaufEintrag } from '../modell/typen';
import { alsKarte } from './listen';
import { kandidaten, waehleTagesgedanke } from './tagesgedanke';
import { baueListe, baueNotiz } from './test-hilfe';
import { verschiebeDatum } from './zeit';

// A (an) → A1 (erben = an), A2 (aus)
// B (erben, ganz oben = aus)
// C (aus) → C1 (an)
const a = baueListe({ name: 'A', tagesgedanke: 'an' });
const a1 = baueListe({ name: 'A1', eltern_id: a.id });
const a2 = baueListe({ name: 'A2', eltern_id: a.id, tagesgedanke: 'aus' });
const b = baueListe({ name: 'B' });
const c = baueListe({ name: 'C', tagesgedanke: 'aus' });
const c1 = baueListe({ name: 'C1', eltern_id: c.id, tagesgedanke: 'an' });
const listen = alsKarte([a, a1, a2, b, c, c1]);

const inA = baueNotiz({ text: 'in A', liste_id: a.id });
const inA1 = baueNotiz({ text: 'in A1 (geerbt)', liste_id: a1.id });
const inA2 = baueNotiz({ text: 'in A2 (aus)', liste_id: a2.id });
const inB = baueNotiz({ text: 'in B (nicht markiert)', liste_id: b.id });
const inC = baueNotiz({ text: 'in C (aus)', liste_id: c.id });
const inC1 = baueNotiz({ text: 'in C1 (an)', liste_id: c1.id });
const aufgabe = baueNotiz({
  text: 'Aufgabe in A',
  liste_id: a.id,
  aufgabe: { erledigt: false, erledigt_am: null, faellig: null, wiederholung: null, kalender_event_id: null, erinnerung: 0, erledigt_verlauf: [] },
});
const geloescht = baueNotiz({ text: 'gelöscht in A', liste_id: a.id, geloescht: '2026-11-01T12:00:00Z' });
const alle = [inA, inA1, inA2, inB, inC, inC1, aufgabe, geloescht];

describe('Gedanke des Tages: Kandidaten', () => {
  it('nur markierte Listen, einschließlich Vererbung', () => {
    expect(kandidaten(alle, listen).map((n) => n.text)).toEqual(['in A', 'in A1 (geerbt)', 'in C1 (an)']);
  });

  it('ohne markierte Liste gibt es keinen Gedanken', () => {
    const ergebnis = waehleTagesgedanke([inB, inC, inA2], listen, [], '2026-11-15');
    expect(ergebnis.notiz).toBeNull();
    expect(ergebnis.verlauf).toEqual([]);
  });
});

describe('Gedanke des Tages: Auswahl', () => {
  it('am selben Tag immer derselbe – auch ohne gespeicherten Verlauf', () => {
    const erster = waehleTagesgedanke(alle, listen, [], '2026-11-15');
    const zweiter = waehleTagesgedanke(alle, listen, [], '2026-11-15');
    expect(erster.notiz).not.toBeNull();
    expect(zweiter.notiz!.id).toBe(erster.notiz!.id);
    expect(erster.verlauf).toEqual([{ datum: '2026-11-15', notiz_id: erster.notiz!.id }]);
  });

  it('bleibt am selben Tag fest, auch wenn Notizen dazukommen', () => {
    const erster = waehleTagesgedanke(alle, listen, [], '2026-11-15');
    const mehr = [...alle, ...Array.from({ length: 30 }, (_, i) => baueNotiz({ text: `neu ${i}`, liste_id: a.id }))];
    const spaeter = waehleTagesgedanke(mehr, listen, erster.verlauf, '2026-11-15');
    expect(spaeter.notiz!.id).toBe(erster.notiz!.id);
    expect(spaeter.verlauf).toBe(erster.verlauf);
  });

  it('wählt neu, wenn der heutige Gedanke gelöscht wurde', () => {
    const erster = waehleTagesgedanke(alle, listen, [], '2026-11-15');
    const ohne = alle.map((n) => (n.id === erster.notiz!.id ? { ...n, geloescht: '2026-11-15T12:00:00Z' } : n));
    const neu = waehleTagesgedanke(ohne, listen, erster.verlauf, '2026-11-15');
    expect(neu.notiz).not.toBeNull();
    expect(neu.notiz!.id).not.toBe(erster.notiz!.id);
    expect(neu.verlauf.filter((e) => e.datum === '2026-11-15')).toHaveLength(1);
  });

  it('wiederholt 30 Tage lang nichts, solange genug Notizen da sind', () => {
    const viele: Notiz[] = Array.from({ length: 40 }, (_, i) => baueNotiz({ text: `Gedanke ${i}`, liste_id: a.id }));
    let verlauf: VerlaufEintrag[] = [];
    const gezeigt: string[] = [];
    for (let tag = 0; tag < 30; tag++) {
      const ergebnis = waehleTagesgedanke(viele, listen, verlauf, verschiebeDatum('2026-11-01', tag));
      verlauf = ergebnis.verlauf;
      gezeigt.push(ergebnis.notiz!.id);
    }
    expect(new Set(gezeigt).size).toBe(30);
  });

  it('sind alle kürzlich gezeigt worden, kommt die am längsten nicht gezeigte', () => {
    const verlauf: VerlaufEintrag[] = [
      { datum: '2026-11-12', notiz_id: inA.id },
      { datum: '2026-11-13', notiz_id: inC1.id },
      { datum: '2026-11-14', notiz_id: inA1.id },
    ];
    const ergebnis = waehleTagesgedanke(alle, listen, verlauf, '2026-11-15');
    expect(ergebnis.notiz!.id).toBe(inA.id);
  });

  it('wechselt über mehrere Tage', () => {
    let verlauf: VerlaufEintrag[] = [];
    const gezeigt = new Set<string>();
    for (let tag = 0; tag < 3; tag++) {
      const ergebnis = waehleTagesgedanke(alle, listen, verlauf, verschiebeDatum('2026-11-15', tag));
      verlauf = ergebnis.verlauf;
      gezeigt.add(ergebnis.notiz!.id);
    }
    expect(gezeigt.size).toBe(3);
  });
});
