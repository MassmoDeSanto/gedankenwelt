import { describe, expect, it } from 'vitest';
import { baueListe, baueNotiz, testId } from '../logik/test-hilfe';
import { EINGANG_ID, eingangsListe } from '../modell/typen';
import { beispieldaten, findeBeispieldaten } from './beispieldaten';

describe('Beispieldaten wiederfinden', () => {
  const daten = beispieldaten(new Date('2026-11-15T12:00:00Z'), testId, 1, 0);
  const eingang = eingangsListe('2026-01-01T12:00:00Z');

  it('findet alle Beispiellisten und -notizen, auch die im Eingang', () => {
    const gefunden = findeBeispieldaten([eingang, ...daten.listen], daten.notizen);
    expect(gefunden.listenIds.sort()).toEqual(daten.listen.map((l) => l.id).sort());
    expect(gefunden.notizIds.sort()).toEqual(daten.notizen.map((n) => n.id).sort());
    expect(gefunden.listenIds).not.toContain(EINGANG_ID);
  });

  it('lässt eigene Listen und Notizen in Ruhe', () => {
    const eigene = baueListe({ name: 'Meine Liste' });
    const eigeneNotiz = baueNotiz({ text: 'Mein eigener Gedanke', liste_id: eigene.id });
    const imEingang = baueNotiz({ text: 'Eigenes im Eingang', liste_id: EINGANG_ID });
    const gefunden = findeBeispieldaten([eingang, eigene, ...daten.listen], [eigeneNotiz, imEingang, ...daten.notizen]);
    expect(gefunden.listenIds).not.toContain(eigene.id);
    expect(gefunden.notizIds).not.toContain(eigeneNotiz.id);
    expect(gefunden.notizIds).not.toContain(imEingang.id);
  });

  it('eine Beispielliste mit eigener Notiz bleibt samt Elternliste erhalten', () => {
    const geld = daten.listen.find((l) => l.name === 'Monetarisierung')!;
    const reise = daten.listen.find((l) => l.name === 'Reise-App')!;
    const eigene = baueNotiz({ text: 'Hier habe ich selbst etwas ergänzt', liste_id: geld.id });
    const gefunden = findeBeispieldaten([eingang, ...daten.listen], [...daten.notizen, eigene]);
    expect(gefunden.listenIds).not.toContain(geld.id);
    expect(gefunden.listenIds).not.toContain(reise.id);
    expect(gefunden.listenIds).toContain(daten.listen.find((l) => l.name === 'Features')!.id);
    expect(gefunden.notizIds).not.toContain(eigene.id);
  });

  it('eine leere eigene Liste, die zufällig „Ideen“ heißt, ist keine Beispielliste', () => {
    const ideen = baueListe({ name: 'Ideen' });
    expect(findeBeispieldaten([eingang, ideen], []).listenIds).toEqual([]);
  });
});
