/**
 * Tests für den Abgleich (PHASE-2.md, Abschnitt 7): zwei „Geräte“ A und B und ein
 * simuliertes Drive. Es wird kein echtes Google-Konto benutzt.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { EINGANG_ID, eingangsListe, type Datenbestand, type Liste, type Notiz } from '../../modell/typen';
import { neueId } from '../../modell/ulid';
import { bearbeiteNotiz, erzeugeNotizen } from '../absatz';
import { alsKarte } from '../listen';
import * as papierkorb from '../papierkorb';
import { mitTerminId } from '../kalender/abgleich';
import { KeineVerbindung } from './drive';
import { abgleiche, type CacheEintrag, type Geraet } from './runde';
import { SimuliertesDrive } from './simuliertesDrive';

const T0 = '2026-11-01T08:00:00Z';
/** Zeitpunkt am 1. November, z. B. um('10:30') */
const um = (uhrzeit: string) => `2026-11-01T${uhrzeit}:00Z`;

/** Ein Gerät mit eigenem lokalen Stand – wie ein Browser mit seiner Datenbank. */
class TestGeraet implements Geraet {
  lokal: Datenbestand = {
    listen: [eingangsListe(T0)],
    notizen: [],
    einstellungen: { thema: 'dunkel' },
    tagesgedanke_verlauf: [],
  };
  basis: Datenbestand | null = null;
  cache = new Map<string, CacheEintrag>();

  leseLokal = () => this.lokal;
  schreibeLokal = (b: Datenbestand) => void (this.lokal = b);
  leseBasis = () => this.basis;
  schreibeBasis = (b: Datenbestand) => void (this.basis = structuredClone(b));
  leseCache = () => new Map([...this.cache].map(([id, e]) => [id, { ...e }]));
  schreibeCache = (c: Map<string, CacheEintrag>) => void (this.cache = new Map([...c].map(([id, e]) => [id, { ...e }])));

  // ── Bedienung, wie sie die App vornimmt ──

  neueListe(name: string, eltern_id: string | null, zeit: string): Liste {
    const liste: Liste = {
      id: neueId(),
      name,
      eltern_id,
      angeheftet: false,
      tagesgedanke: 'erben',
      position: this.lokal.listen.length,
      erstellt: zeit,
      geaendert: zeit,
      geloescht: null,
    };
    this.lokal = { ...this.lokal, listen: [...this.lokal.listen, liste] };
    return liste;
  }

  aendereListe(id: string, teil: Partial<Liste>, zeit: string): void {
    this.lokal = {
      ...this.lokal,
      listen: this.lokal.listen.map((l) => (l.id === id ? { ...l, ...teil, geaendert: zeit } : l)),
    };
  }

  loescheListe(id: string, zeit: string): void {
    const a = papierkorb.loescheListe(id, alsKarte(this.lokal.listen), this.lokal.notizen, zeit);
    this.lokal = {
      ...this.lokal,
      listen: this.lokal.listen.map((l) => a.listen.find((g) => g.id === l.id) ?? l),
      notizen: this.lokal.notizen.map((n) => a.notizen.find((g) => g.id === n.id) ?? n),
    };
  }

  schreibe(liste_id: string, text: string, zeit: string): Notiz {
    const letzte = Math.max(0, ...this.lokal.notizen.filter((n) => n.liste_id === liste_id).map((n) => n.position));
    const neue = erzeugeNotizen(text, liste_id, letzte, null, { jetzt: zeit, neueId: () => neueId() });
    this.lokal = { ...this.lokal, notizen: [...this.lokal.notizen, ...neue] };
    return neue[0];
  }

  bearbeite(id: string, text: string, zeit: string): void {
    const notiz = this.notiz(id);
    const { notiz: neu } = bearbeiteNotiz(notiz, text, null, { jetzt: zeit, neueId: () => neueId() });
    this.ersetze(neu!);
  }

  loesche(id: string, zeit: string): void {
    this.ersetze({ ...this.notiz(id), geloescht: zeit, geaendert: zeit });
  }

  /** Papierkorb leeren: gelöschte Notizen endgültig entfernen. */
  leerePapierkorb(): void {
    this.lokal = { ...this.lokal, notizen: this.lokal.notizen.filter((n) => !n.geloescht) };
  }

  private ersetze(notiz: Notiz): void {
    this.lokal = { ...this.lokal, notizen: this.lokal.notizen.map((n) => (n.id === notiz.id ? notiz : n)) };
  }

  // ── Nachsehen ──

  notiz(id: string): Notiz {
    const notiz = this.lokal.notizen.find((n) => n.id === id);
    if (!notiz) throw new Error(`Notiz ${id} gibt es auf diesem Gerät nicht.`);
    return notiz;
  }

  hat(id: string): boolean {
    return this.lokal.notizen.some((n) => n.id === id);
  }

  liste(id: string): Liste {
    return this.lokal.listen.find((l) => l.id === id)!;
  }

  /** Texte der lebenden Notizen einer Liste, in Reihenfolge */
  texte(liste_id: string): string[] {
    return this.lokal.notizen
      .filter((n) => n.liste_id === liste_id && !n.geloescht)
      .sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1))
      .map((n) => n.text);
  }
}

let drive: SimuliertesDrive;
let a: TestGeraet;
let b: TestGeraet;

beforeEach(() => {
  drive = new SimuliertesDrive();
  a = new TestGeraet();
  b = new TestGeraet();
});

const gleicheAb = (geraet: TestGeraet, zeit: string) => abgleiche(drive, geraet, () => zeit);

/** Beide Geräte abgleichen, bis alles überall angekommen ist. */
async function alleAbgleichen(zeit: string): Promise<void> {
  await gleicheAb(a, zeit);
  await gleicheAb(b, zeit);
  await gleicheAb(a, zeit);
}

function erwarteGleichstand(): void {
  expect(b.lokal.notizen).toEqual(a.lokal.notizen);
  expect(b.lokal.listen).toEqual(a.lokal.listen);
}

/** Kein Pfad doppelt, keine Datei mit derselben Listen-ID doppelt. */
function erwarteKeineDoppelten(): void {
  const pfade = drive.pfade();
  expect(new Set(pfade).size).toBe(pfade.length);
  const ids = [...drive.dateien().values()].map((inhalt) => /^id: (\S+)$/m.exec(inhalt)?.[1]).filter(Boolean);
  expect(new Set(ids).size).toBe(ids.length);
}

/**
 * Die Dateien in Drive, wobei jede ID durch „ID“ ersetzt ist. So lassen sich zwei
 * Durchläufe vergleichen, obwohl jeder Durchlauf eigene zufällige IDs vergibt.
 */
function dateienOhneIds(): Map<string, string> {
  return new Map([...drive.dateien()].map(([pfad, inhalt]) => [pfad, inhalt.replace(/[0-9A-HJKMNP-TV-Z]{26}/g, 'ID')]));
}

/** Gemeinsamer Ausgangspunkt: „Reise“ mit Unterliste „Geld“, auf beiden Geräten abgeglichen. */
async function grundaufbau() {
  const reise = a.neueListe('Reise', null, um('09:00'));
  const geld = a.neueListe('Geld', reise.id, um('09:00'));
  const n1 = a.schreibe(reise.id, 'Erste Notiz', um('09:01'));
  const n2 = a.schreibe(reise.id, 'Zweite Notiz', um('09:02'));
  const n3 = a.schreibe(geld.id, 'Affiliate-Links #geschäftsmodell', um('09:03'));
  await alleAbgleichen(um('09:10'));
  return { reise, geld, n1, n2, n3 };
}

describe('Erstes Verbinden', () => {
  it('leeres Drive bekommt den lokalen Stand in der beschriebenen Ordnerstruktur', async () => {
    const { reise } = await grundaufbau();
    expect(drive.pfade()).toEqual(['Eingang.md', 'Reise/Geld.md', 'Reise/_liste.md', '_meta.json', '_papierkorb.md']);
    expect(drive.dateien().get('Reise/_liste.md')).toContain('Erste Notiz');
    expect(b.texte(reise.id)).toEqual(['Erste Notiz', 'Zweite Notiz']);
    erwarteGleichstand();
  });

  it('gibt es schon Daten in Drive, wird zusammengeführt', async () => {
    const { reise } = await grundaufbau();
    const c = new TestGeraet();
    const eigene = c.neueListe('Nur auf C', null, um('09:30'));
    c.schreibe(eigene.id, 'Notiz von C', um('09:31'));
    c.schreibe(EINGANG_ID, 'Im Eingang von C', um('09:32'));

    await gleicheAb(c, um('10:00'));
    await gleicheAb(a, um('10:01'));

    expect(c.texte(reise.id)).toEqual(['Erste Notiz', 'Zweite Notiz']);
    expect(a.texte(eigene.id)).toEqual(['Notiz von C']);
    expect(a.texte(EINGANG_ID)).toEqual(['Im Eingang von C']);
    expect(drive.pfade()).toContain('Nur auf C.md');
    erwarteKeineDoppelten();
  });

  it('ohne Änderungen passiert beim nächsten Abgleich nichts', async () => {
    await grundaufbau();
    expect(await gleicheAb(a, um('11:00'))).toEqual({ heruntergeladen: 0, hochgeladen: 0 });
    expect(await gleicheAb(b, um('11:00'))).toEqual({ heruntergeladen: 0, hochgeladen: 0 });
  });
});

describe('Zwei Geräte arbeiten offline', () => {
  it('verschiedene Notizen derselben Liste: beide Änderungen bleiben', async () => {
    const { reise, n1, n2 } = await grundaufbau();
    a.bearbeite(n1.id, 'Erste Notiz, von A geändert', um('10:00'));
    b.bearbeite(n2.id, 'Zweite Notiz, von B geändert', um('10:05'));
    b.schreibe(reise.id, 'Neu von B', um('10:06'));

    await alleAbgleichen(um('11:00'));

    expect(a.texte(reise.id)).toEqual(['Erste Notiz, von A geändert', 'Zweite Notiz, von B geändert', 'Neu von B']);
    erwarteGleichstand();
  });

  it.each([
    ['A gleicht zuerst ab', true],
    ['B gleicht zuerst ab', false],
  ])('dieselbe Notiz: die neuere Fassung gewinnt (%s)', async (_name, aZuerst) => {
    const { n1 } = await grundaufbau();
    a.bearbeite(n1.id, 'ältere Fassung von A', um('10:00'));
    b.bearbeite(n1.id, 'neuere Fassung von B', um('10:30'));

    if (aZuerst) await alleAbgleichen(um('11:00'));
    else {
      await gleicheAb(b, um('11:00'));
      await gleicheAb(a, um('11:00'));
      await gleicheAb(b, um('11:00'));
    }

    expect(a.notiz(n1.id).text).toBe('neuere Fassung von B');
    expect(b.notiz(n1.id).text).toBe('neuere Fassung von B');
    expect(a.notiz(n1.id).erstellt).toBe(um('09:01'));
    erwarteGleichstand();
  });

  it('A löscht, B bearbeitet später: die Notiz bleibt', async () => {
    const { n1 } = await grundaufbau();
    a.loesche(n1.id, um('10:00'));
    b.bearbeite(n1.id, 'später von B bearbeitet', um('10:30'));

    await alleAbgleichen(um('11:00'));

    expect(a.notiz(n1.id)).toMatchObject({ text: 'später von B bearbeitet', geloescht: null });
    erwarteGleichstand();
  });

  it('A löscht nach der Bearbeitung von B: die Notiz bleibt gelöscht', async () => {
    const { n1 } = await grundaufbau();
    b.bearbeite(n1.id, 'früher von B bearbeitet', um('10:00'));
    a.loesche(n1.id, um('10:30'));

    await alleAbgleichen(um('11:00'));

    expect(a.notiz(n1.id).geloescht).toBe(um('10:30'));
    expect(b.notiz(n1.id).geloescht).toBe(um('10:30'));
    expect(drive.dateien().get('_papierkorb.md')).toContain('Erste Notiz');
    expect(drive.dateien().get('Reise/_liste.md')).not.toContain('Erste Notiz');
    erwarteGleichstand();
  });
});

describe('Listen umbenennen und verschieben', () => {
  it('Liste auf A umbenannt, auf B neue Notizen: beides kommt an, keine doppelte Datei', async () => {
    const { geld } = await grundaufbau();
    const dateiVorher = drive.driveId('Reise/Geld.md');

    a.aendereListe(geld.id, { name: 'Monetarisierung' }, um('10:00'));
    b.schreibe(geld.id, 'Neu von B', um('10:05'));
    await alleAbgleichen(um('11:00'));

    expect(a.liste(geld.id).name).toBe('Monetarisierung');
    expect(b.liste(geld.id).name).toBe('Monetarisierung');
    expect(a.texte(geld.id)).toEqual(['Affiliate-Links #geschäftsmodell', 'Neu von B']);
    expect(drive.pfade()).toEqual([
      'Eingang.md',
      'Reise/Monetarisierung.md',
      'Reise/_liste.md',
      '_meta.json',
      '_papierkorb.md',
    ]);
    // dieselbe Datei wie vorher – nur umbenannt, nicht neu angelegt
    expect(drive.driveId('Reise/Monetarisierung.md')).toBe(dateiVorher);
    erwarteKeineDoppelten();
    erwarteGleichstand();
  });

  it('Unterliste verschoben, während das andere Gerät darin schreibt', async () => {
    const { reise, geld } = await grundaufbau();
    const ideen = a.neueListe('Ideen', null, um('09:20'));
    await alleAbgleichen(um('09:30'));
    const geldDatei = drive.driveId('Reise/Geld.md');
    const reiseDatei = drive.driveId('Reise/_liste.md');

    a.aendereListe(geld.id, { eltern_id: ideen.id }, um('10:00'));
    b.schreibe(geld.id, 'Währenddessen von B', um('10:05'));
    await alleAbgleichen(um('11:00'));

    expect(b.liste(geld.id).eltern_id).toBe(ideen.id);
    expect(a.texte(geld.id)).toEqual(['Affiliate-Links #geschäftsmodell', 'Währenddessen von B']);
    // „Ideen“ hat jetzt eine Unterliste und wird zum Ordner, „Reise“ hat keine mehr und wird zur einzelnen Datei.
    expect(drive.pfade()).toEqual(['Eingang.md', 'Ideen/Geld.md', 'Ideen/_liste.md', 'Reise.md', '_meta.json', '_papierkorb.md']);
    expect(drive.ordner()).toEqual(['Ideen']);
    expect(drive.driveId('Ideen/Geld.md')).toBe(geldDatei);
    expect(drive.driveId('Reise.md')).toBe(reiseDatei);
    expect(a.texte(reise.id)).toEqual(['Erste Notiz', 'Zweite Notiz']);
    erwarteKeineDoppelten();
    erwarteGleichstand();
  });

  it('Ordner mit Unterlisten wird umbenannt, nicht neu angelegt', async () => {
    const { reise } = await grundaufbau();
    const dateiVorher = drive.driveId('Reise/Geld.md');

    a.aendereListe(reise.id, { name: 'Reise-App' }, um('10:00'));
    await alleAbgleichen(um('11:00'));

    expect(drive.pfade()).toContain('Reise-App/Geld.md');
    expect(drive.pfade()).toContain('Reise-App/_liste.md');
    expect(drive.ordner()).toEqual(['Reise-App']);
    expect(drive.driveId('Reise-App/Geld.md')).toBe(dateiVorher);
    expect(b.liste(reise.id).name).toBe('Reise-App');
  });

  it('Liste gelöscht, auf dem anderen Gerät später darin geschrieben: Liste und Notiz kommen zurück', async () => {
    const { geld } = await grundaufbau();
    a.loescheListe(geld.id, um('10:00'));
    const neu = b.schreibe(geld.id, 'Nach dem Löschen geschrieben', um('10:30'));

    await alleAbgleichen(um('11:00'));

    expect(a.liste(geld.id).geloescht).toBeNull();
    expect(a.notiz(neu.id).geloescht).toBeNull();
    // die alte Notiz der Liste bleibt gelöscht, sie wurde ja nicht mehr angefasst
    expect(a.texte(geld.id)).toEqual(['Nach dem Löschen geschrieben']);
    erwarteGleichstand();
  });
});

describe('Abbruch mitten im Hochladen', () => {
  /** Zählt, wie viele Schreibvorgänge ein vollständiger Abgleich braucht. */
  async function schreibvorgaengeFuer(vorbereiten: () => Promise<void>): Promise<number> {
    await vorbereiten();
    const vorher = drive.schreibvorgaenge;
    await gleicheAb(a, um('12:00'));
    return drive.schreibvorgaenge - vorher;
  }

  it('erstes Hochladen: nach jedem möglichen Abbruch wird sauber fortgesetzt', async () => {
    const aufbau = async () => {
      drive = new SimuliertesDrive();
      a = new TestGeraet();
      b = new TestGeraet();
      const reise = a.neueListe('Reise', null, um('09:00'));
      const geld = a.neueListe('Geld', reise.id, um('09:00'));
      a.schreibe(reise.id, 'Erste Notiz', um('09:01'));
      a.schreibe(geld.id, 'Affiliate-Links', um('09:02'));
      a.schreibe(EINGANG_ID, 'Im Eingang', um('09:03'));
    };
    const gesamt = await schreibvorgaengeFuer(aufbau);
    const sollDateien = dateienOhneIds();
    expect(gesamt).toBeGreaterThan(4);

    for (let abbruch = 0; abbruch < gesamt; abbruch++) {
      await aufbau();
      drive.abbruchNach = abbruch;
      await expect(gleicheAb(a, um('12:00'))).rejects.toBeInstanceOf(KeineVerbindung);

      // „Neustart“: Verbindung ist wieder da
      drive.abbruchNach = null;
      await gleicheAb(a, um('12:00'));

      expect(dateienOhneIds()).toEqual(sollDateien);
      erwarteKeineDoppelten();
      expect(a.lokal.notizen).toHaveLength(3);
      // ein zweites Gerät sieht genau denselben Stand
      await gleicheAb(b, um('12:05'));
      erwarteGleichstand();
    }
  });

  it('Umbenennen, Verschieben und Löschen: nach jedem möglichen Abbruch stimmt das Ergebnis', async () => {
    let ideenId = '';
    const aufbau = async () => {
      drive = new SimuliertesDrive();
      a = new TestGeraet();
      b = new TestGeraet();
      const { reise, geld, n1 } = await grundaufbau();
      const ideen = a.neueListe('Ideen', null, um('10:00'));
      ideenId = ideen.id;
      a.aendereListe(geld.id, { eltern_id: ideen.id, name: 'Monetarisierung' }, um('10:01'));
      a.aendereListe(reise.id, { name: 'Reise-App' }, um('10:02'));
      a.loesche(n1.id, um('10:03'));
      a.schreibe(ideen.id, 'Neue Idee', um('10:04'));
    };
    const gesamt = await schreibvorgaengeFuer(aufbau);
    const sollDateien = dateienOhneIds();
    const sollOrdner = drive.ordner();
    expect(sollOrdner).toEqual(['Ideen']);

    for (let abbruch = 0; abbruch < gesamt; abbruch++) {
      await aufbau();
      drive.abbruchNach = abbruch;
      await expect(gleicheAb(a, um('12:00'))).rejects.toBeInstanceOf(KeineVerbindung);

      drive.abbruchNach = null;
      await gleicheAb(a, um('12:00'));

      expect(dateienOhneIds()).toEqual(sollDateien);
      expect(drive.ordner()).toEqual(sollOrdner);
      erwarteKeineDoppelten();
      await gleicheAb(b, um('12:05'));
      expect(b.texte(ideenId)).toEqual(['Neue Idee']);
      erwarteGleichstand();
    }
  });

  it('auch wenn das zweite Gerät während der Unterbrechung abgleicht, geht nichts verloren', async () => {
    const { reise, n1 } = await grundaufbau();
    a.bearbeite(n1.id, 'von A geändert', um('10:00'));
    a.aendereListe(reise.id, { name: 'Reise-App' }, um('10:01'));
    b.schreibe(reise.id, 'Neu von B', um('10:02'));

    drive.abbruchNach = 1; // A kommt nur einen Schritt weit
    await expect(gleicheAb(a, um('11:00'))).rejects.toBeInstanceOf(KeineVerbindung);
    drive.abbruchNach = null;

    await gleicheAb(b, um('11:01'));
    await alleAbgleichen(um('11:02'));

    expect(a.liste(reise.id).name).toBe('Reise-App');
    expect(a.texte(reise.id)).toEqual(['von A geändert', 'Zweite Notiz', 'Neu von B']);
    erwarteKeineDoppelten();
    erwarteGleichstand();
  });
});

describe('Datei direkt in Google Drive bearbeitet', () => {
  it('ergänzter Text ohne Metadaten wird als neue Notiz übernommen – genau einmal', async () => {
    const { reise } = await grundaufbau();
    drive.bearbeiteVonHand('Reise/_liste.md', (inhalt) => inhalt + '\nVon Hand in Drive ergänzt #neu\n\n[ ] Aufgabe von Hand\n');

    await gleicheAb(a, um('11:00'));

    expect(a.texte(reise.id)).toEqual(['Erste Notiz', 'Zweite Notiz', 'Von Hand in Drive ergänzt #neu', 'Aufgabe von Hand']);
    const neu = a.lokal.notizen.find((n) => n.text.startsWith('Von Hand'))!;
    expect(neu.tags).toEqual(['neu']);
    expect(a.lokal.notizen.find((n) => n.text === 'Aufgabe von Hand')!.aufgabe?.erledigt).toBe(false);
    // Die App hat die Datei mit Metadaten zurückgeschrieben.
    expect(drive.dateien().get('Reise/_liste.md')).toContain(`id:${neu.id}`);

    // Weitere Abgleiche erzeugen keine Doppelten, und B bekommt dieselbe Notiz mit derselben ID.
    expect(await gleicheAb(a, um('11:05'))).toEqual({ heruntergeladen: 0, hochgeladen: 0 });
    await gleicheAb(b, um('11:10'));
    expect(b.notiz(neu.id).text).toBe('Von Hand in Drive ergänzt #neu');
    expect(b.texte(reise.id)).toHaveLength(4);
    erwarteGleichstand();
  });

  it('bleibt auch bei unterbrochenem Zurückschreiben eine einzige Notiz', async () => {
    const { reise } = await grundaufbau();
    drive.bearbeiteVonHand('Reise/_liste.md', (inhalt) => inhalt + '\nVon Hand ergänzt\n');

    drive.abbruchNach = 0;
    await expect(gleicheAb(a, um('11:00'))).rejects.toBeInstanceOf(KeineVerbindung);
    drive.abbruchNach = null;
    await alleAbgleichen(um('11:30'));

    expect(a.texte(reise.id).filter((t) => t === 'Von Hand ergänzt')).toHaveLength(1);
    erwarteGleichstand();
  });

  it('von Hand geänderter Text einer bestehenden Notiz wird übernommen', async () => {
    const { n1 } = await grundaufbau();
    drive.bearbeiteVonHand('Reise/_liste.md', (inhalt) => inhalt.replace('Erste Notiz', 'Erste Notiz, in Drive korrigiert'));

    await alleAbgleichen(um('11:00'));

    expect(a.notiz(n1.id).text).toBe('Erste Notiz, in Drive korrigiert');
    expect(b.notiz(n1.id).text).toBe('Erste Notiz, in Drive korrigiert');
    erwarteGleichstand();
  });

  it('von Hand gelöschter Absatz landet im Papierkorb der App, nicht im Nichts', async () => {
    const { reise, n2 } = await grundaufbau();
    drive.bearbeiteVonHand('Reise/_liste.md', (inhalt) => inhalt.replace(/Zweite Notiz\n<!--.*-->\n/, ''));

    await alleAbgleichen(um('11:00'));

    expect(a.texte(reise.id)).toEqual(['Erste Notiz']);
    expect(a.notiz(n2.id).geloescht).toBe(um('11:00'));
    expect(b.notiz(n2.id).geloescht).toBe(um('11:00'));
  });

  it('wird während des Abgleichs in Drive geschrieben, beginnt die Runde neu und nichts geht verloren', async () => {
    const { reise, n1 } = await grundaufbau();
    a.bearbeite(n1.id, 'von A geändert', um('10:00'));
    // Kurz bevor A schreibt, ändert jemand dieselbe Datei in Drive.
    drive.vorSchreiben = () =>
      drive.bearbeiteVonHand('Reise/_liste.md', (inhalt) => inhalt + '\nIn letzter Sekunde ergänzt\n');

    await gleicheAb(a, um('11:00'));

    expect(a.texte(reise.id)).toEqual(['von A geändert', 'Zweite Notiz', 'In letzter Sekunde ergänzt']);
    const datei = drive.dateien().get('Reise/_liste.md')!;
    expect(datei).toContain('von A geändert');
    expect(datei).toContain('In letzter Sekunde ergänzt');
  });
});

describe('Papierkorb', () => {
  it('Einträge älter als 30 Tage verschwinden beim Abgleich – auf allen Geräten', async () => {
    const { n1 } = await grundaufbau();
    a.loesche(n1.id, um('10:00'));
    await alleAbgleichen(um('11:00'));
    expect(b.notiz(n1.id).geloescht).toBe(um('10:00'));

    // nach 29 Tagen noch da
    await alleAbgleichen('2026-11-30T10:00:00Z');
    expect(a.hat(n1.id)).toBe(true);
    expect(drive.dateien().get('_papierkorb.md')).toContain('Erste Notiz');

    // nach 31 Tagen endgültig weg
    await gleicheAb(a, '2026-12-02T10:00:01Z');
    expect(a.hat(n1.id)).toBe(false);
    expect(drive.dateien().get('_papierkorb.md')).not.toContain('Erste Notiz');

    // B gleicht mit nachgehender Uhr ab und übernimmt das Entfernen trotzdem
    await gleicheAb(b, '2026-11-30T12:00:00Z');
    expect(b.hat(n1.id)).toBe(false);
    erwarteGleichstand();
  });

  it('gelöschte Liste: nach 30 Tagen sind Liste und Notizen überall weg', async () => {
    const { geld, n3 } = await grundaufbau();
    a.loescheListe(geld.id, um('10:00'));
    await alleAbgleichen(um('11:00'));
    expect(drive.pfade()).not.toContain('Reise/Geld.md');
    expect(JSON.parse(drive.dateien().get('_meta.json')!).geloeschte_listen).toHaveLength(1);

    await alleAbgleichen('2026-12-02T10:00:01Z');

    expect(a.lokal.listen.some((l) => l.id === geld.id)).toBe(false);
    expect(b.lokal.listen.some((l) => l.id === geld.id)).toBe(false);
    expect(b.hat(n3.id)).toBe(false);
    expect(JSON.parse(drive.dateien().get('_meta.json')!).geloeschte_listen).toHaveLength(0);
  });

  it('„Papierkorb leeren“ auf einem Gerät gilt danach überall', async () => {
    const { n1 } = await grundaufbau();
    a.loesche(n1.id, um('10:00'));
    await alleAbgleichen(um('11:00'));

    a.leerePapierkorb();
    await alleAbgleichen(um('12:00'));

    expect(a.hat(n1.id)).toBe(false);
    expect(b.hat(n1.id)).toBe(false);
    expect(drive.dateien().get('_papierkorb.md')).toBe('');
  });
});

describe('Sicherheit: bei unklarem Zustand wird nichts gelöscht', () => {
  it('ist Drive plötzlich leer, bleibt lokal alles erhalten und wird neu hochgeladen', async () => {
    const { reise } = await grundaufbau();
    const vorher = a.lokal.notizen.length;
    drive = new SimuliertesDrive(); // z. B. anderes Konto oder Ordner gelöscht

    await gleicheAb(a, um('11:00'));

    expect(a.lokal.notizen).toHaveLength(vorher);
    expect(a.lokal.notizen.every((n) => !n.geloescht)).toBe(true);
    expect(a.texte(reise.id)).toEqual(['Erste Notiz', 'Zweite Notiz']);
    expect(drive.pfade()).toContain('Reise/_liste.md');
  });

  it('eine in Drive von Hand gelöschte Listendatei legt Liste und Notizen in den Papierkorb der App', async () => {
    const { geld, n3 } = await grundaufbau();
    drive.loescheVonHand('Reise/Geld.md');

    await alleAbgleichen(um('11:00'));

    expect(a.liste(geld.id).geloescht).toBe(um('11:00'));
    expect(a.notiz(n3.id).geloescht).toBe(um('11:00'));
    // … und lässt sich dort wie jede gelöschte Liste wiederherstellen
    const zurueck = papierkorb.stelleListeWiederHer(geld.id, alsKarte(a.lokal.listen), a.lokal.notizen, um('11:30'));
    expect(zurueck.notizen.map((n) => n.id)).toEqual([n3.id]);
    erwarteGleichstand();
  });

  it('fremde Dateien und der Ordner _import bleiben unangetastet', async () => {
    await grundaufbau();
    const wurzel = await drive.wurzel();
    const importOrdner = await drive.erstelleOrdner('_import', wurzel);
    await drive.erstelleDatei('Apple-Notiz.txt', importOrdner.id, 'Text aus Apple Notizen');
    await drive.erstelleDatei('Urlaubsfoto.jpg', wurzel, '…');

    a.schreibe(EINGANG_ID, 'Noch eine Notiz', um('10:00'));
    await alleAbgleichen(um('11:00'));

    expect(drive.pfade()).toContain('_import/Apple-Notiz.txt');
    expect(drive.pfade()).toContain('Urlaubsfoto.jpg');
    expect(a.lokal.listen.some((l) => l.name === '_import')).toBe(false);
  });
});

describe('Termin-ID aus dem Kalender', () => {
  /** Trägt – wie der Kalender-Abgleich in der App – eine Termin-ID ein. */
  function trageTerminEin(geraet: TestGeraet, id: string, terminId: string): void {
    geraet.lokal = {
      ...geraet.lokal,
      notizen: geraet.lokal.notizen.map((n) => (n.id === id ? mitTerminId(n, terminId) : n)),
    };
  }

  it('kommt beim anderen Gerät an', async () => {
    const { reise } = await grundaufbau();
    const aufgabe = a.schreibe(reise.id, '[ ] Wochenplanung', um('09:20'));
    await alleAbgleichen(um('09:30'));

    trageTerminEin(a, aufgabe.id, 'termin-0001');
    await alleAbgleichen(um('11:00'));

    expect(a.notiz(aufgabe.id).aufgabe?.kalender_event_id).toBe('termin-0001');
    expect(b.notiz(aufgabe.id).aufgabe?.kalender_event_id).toBe('termin-0001');
    // der Zeitstempel ist nur um eine Sekunde vorgerückt
    expect(b.notiz(aufgabe.id).geaendert).toBe('2026-11-01T09:20:01Z');
    erwarteGleichstand();
  });

  it('verdrängt keine Bearbeitung, die das andere Gerät offline gemacht hat', async () => {
    const { reise } = await grundaufbau();
    const aufgabe = a.schreibe(reise.id, '[ ] Wochenplanung', um('09:20'));
    await alleAbgleichen(um('09:30'));

    // B bearbeitet offline den Text. Erst danach trägt A – ohne davon zu wissen – die Termin-ID ein.
    b.bearbeite(aufgabe.id, 'Wochenplanung mit Tee', um('10:00'));
    trageTerminEin(a, aufgabe.id, 'termin-0001');
    await alleAbgleichen(um('11:00'));

    expect(a.notiz(aufgabe.id).text).toBe('Wochenplanung mit Tee');
    expect(b.notiz(aufgabe.id).text).toBe('Wochenplanung mit Tee');

    // Beim nächsten Kalender-Abgleich trägt A die ID wieder ein – jetzt auf der Fassung mit dem neuen Text.
    trageTerminEin(a, aufgabe.id, 'termin-0001');
    await alleAbgleichen(um('11:05'));

    expect(b.notiz(aufgabe.id)).toMatchObject({ text: 'Wochenplanung mit Tee' });
    expect(b.notiz(aufgabe.id).aufgabe?.kalender_event_id).toBe('termin-0001');
    erwarteGleichstand();
  });
});

describe('Einstellungen und Gedanke des Tages', () => {
  it('die zuletzt geänderte Einstellung gilt überall, der Verlauf wird vereinigt', async () => {
    const { n1, n2 } = await grundaufbau();
    a.lokal = { ...a.lokal, einstellungen: { thema: 'hell', geaendert: um('10:00') } };
    a.lokal = { ...a.lokal, tagesgedanke_verlauf: [{ datum: '2026-11-01', notiz_id: n1.id }] };
    b.lokal = { ...b.lokal, tagesgedanke_verlauf: [{ datum: '2026-10-31', notiz_id: n2.id }] };

    await alleAbgleichen(um('11:00'));
    await gleicheAb(b, um('11:01'));

    expect(b.lokal.einstellungen.thema).toBe('hell');
    expect(a.lokal.tagesgedanke_verlauf).toEqual([
      { datum: '2026-10-31', notiz_id: n2.id },
      { datum: '2026-11-01', notiz_id: n1.id },
    ]);
    expect(b.lokal.tagesgedanke_verlauf).toEqual(a.lokal.tagesgedanke_verlauf);
  });

  it('beim ersten Hochladen bleibt die eigene Einstellung erhalten', async () => {
    a.lokal = { ...a.lokal, einstellungen: { thema: 'hell' } };
    await gleicheAb(a, um('09:00'));
    expect(a.lokal.einstellungen.thema).toBe('hell');
  });
});
