/**
 * Zusammenführen zweier Stände (KONZEPT.md Abschnitt 7, PHASE-2.md Abschnitt 3).
 *
 * Drei Stände spielen mit:
 *  - `lokal`: was dieses Gerät gerade hat
 *  - `fern`:  was in Google Drive steht
 *  - `basis`: worauf sich beide beim letzten erfolgreichen Abgleich geeinigt hatten
 *
 * Regel pro Notiz und pro Liste (erkannt an der `id`): Die Fassung mit dem
 * neueren `geaendert` gewinnt. Löschen ist auch nur eine Änderung mit Zeitstempel.
 * Die Basis hilft zu erkennen, ob etwas auf einer Seite *fehlt*, weil es neu ist
 * oder weil es dort endgültig entfernt wurde.
 *
 * Die Funktion ist „rein“: keine Datenbank, kein Netz – darum gut testbar.
 */
import {
  EINGANG_ID,
  TAGEBUCH_ID,
  eingangsListe,
  tagebuchListe,
  type Datenbestand,
  type Einstellungen,
  type Gewohnheit,
  type ImportEintrag,
  type Liste,
  type Notiz,
  type Tagebuchtag,
  type VerlaufEintrag,
  type Zeitstempel,
} from '../../modell/typen';
import { abgelaufen } from '../papierkorb';

interface Eintrag {
  id: string;
  geaendert: Zeitstempel;
  geloescht: Zeitstempel | null;
}

const nachId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function alsKarte<T extends { id: string }>(eintraege: T[]): Map<string, T> {
  return new Map(eintraege.map((e) => [e.id, e]));
}

function gleicheNotiz(a: Notiz, b: Notiz): boolean {
  return (
    a.text === b.text &&
    a.liste_id === b.liste_id &&
    a.position === b.position &&
    a.geloescht === b.geloescht &&
    a.tagebuch_tag === b.tagebuch_tag &&
    JSON.stringify(a.aufgabe) === JSON.stringify(b.aufgabe)
  );
}

function gleicherTag(a: Tagebuchtag, b: Tagebuchtag): boolean {
  return (
    a.datum === b.datum &&
    a.titel === b.titel &&
    a.bewertung === b.bewertung &&
    a.impuls === b.impuls &&
    a.geloescht === b.geloescht &&
    a.gewohnheiten.join(',') === b.gewohnheiten.join(',')
  );
}

function gleicheListe(a: Liste, b: Liste): boolean {
  return (
    a.name === b.name &&
    a.eltern_id === b.eltern_id &&
    a.angeheftet === b.angeheftet &&
    a.tagesgedanke === b.tagesgedanke &&
    a.position === b.position &&
    a.geloescht === b.geloescht
  );
}

/**
 * Wurde etwas direkt in Drive von Hand geändert, hat es noch den alten Zeitstempel,
 * aber anderen Inhalt als beim letzten Abgleich. Solche Einträge bekommen die
 * aktuelle Zeit, damit die Änderung als „neu“ gilt und auf allen Geräten ankommt.
 */
function stempleHandarbeit<T extends Eintrag>(
  fern: T[],
  basis: Map<string, T> | null,
  gleich: (a: T, b: T) => boolean,
  jetzt: Zeitstempel,
): T[] {
  if (!basis) return fern;
  return fern.map((f) => {
    const b = basis.get(f.id);
    return b && b.geaendert === f.geaendert && !gleich(f, b) ? { ...f, geaendert: jetzt } : f;
  });
}

function verschmelzeMenge<T extends Eintrag>(
  lokal: T[],
  fern: T[],
  basis: Map<string, T> | null,
  jetzt: Zeitstempel,
): T[] {
  const lokalKarte = alsKarte(lokal);
  const fernKarte = alsKarte(fern);
  const ergebnis: T[] = [];

  for (const id of new Set([...lokalKarte.keys(), ...fernKarte.keys()])) {
    const l = lokalKarte.get(id);
    const f = fernKarte.get(id);
    const b = basis?.get(id);

    if (l && f) {
      // Auf beiden Seiten vorhanden: neuere Fassung gewinnt, bei Gleichstand die aus Drive.
      ergebnis.push(f.geaendert >= l.geaendert ? f : l);
    } else if (l) {
      // Fehlt in Drive.
      if (!b || l.geaendert > b.geaendert) {
        ergebnis.push(l); // hier neu angelegt oder seit dem letzten Abgleich bearbeitet
      } else if (!b.geloescht) {
        // War in Drive und ist dort verschwunden (z. B. Absatz von Hand gelöscht): in den Papierkorb.
        ergebnis.push({ ...l, geloescht: jetzt, geaendert: jetzt });
      }
      // sonst: lag schon im Papierkorb und wurde dort endgültig entfernt → auch hier entfernen
    } else if (f) {
      // Fehlt lokal.
      if (!b || f.geaendert > b.geaendert) ergebnis.push(f); // woanders neu oder seither geändert
      // sonst: hier endgültig entfernt (Papierkorb geleert) → bleibt entfernt
    }
  }
  return ergebnis;
}

/** Sorgt dafür, dass der Baum stimmt: kein Kreis, keine lebende Notiz in einer gelöschten oder fehlenden Liste. */
function repariere(listen: Liste[], notizen: Notiz[], jetzt: Zeitstempel): { listen: Liste[]; notizen: Notiz[] } {
  const karte = alsKarte(listen.map((l) => ({ ...l })));

  // Der Eingang ist immer da und liegt ganz oben.
  const eingang = karte.get(EINGANG_ID);
  if (!eingang) karte.set(EINGANG_ID, eingangsListe(jetzt));
  else if (eingang.geloescht || eingang.eltern_id) {
    karte.set(EINGANG_ID, { ...eingang, geloescht: null, eltern_id: null, geaendert: jetzt });
  }
  // Das Tagebuch ist immer da, mit festen Werten (es steht in Drive nicht als Listendatei).
  karte.set(TAGEBUCH_ID, tagebuchListe());

  // Fehlende Eltern und Kreise (A liegt in B, B liegt in A) auflösen: nach ganz oben.
  for (const liste of [...karte.values()].sort(nachId)) {
    if (liste.eltern_id && !karte.has(liste.eltern_id)) {
      liste.eltern_id = null;
      liste.geaendert = jetzt;
      continue;
    }
    const gesehen = new Set<string>([liste.id]);
    let aktuell = liste.eltern_id ? karte.get(liste.eltern_id) : undefined;
    while (aktuell) {
      if (gesehen.has(aktuell.id)) {
        liste.eltern_id = null;
        liste.geaendert = jetzt;
        break;
      }
      gesehen.add(aktuell.id);
      aktuell = aktuell.eltern_id ? karte.get(aktuell.eltern_id) : undefined;
    }
  }

  // Lebende Notizen brauchen eine Liste: fehlt sie ganz, wandern sie in den Eingang.
  const neueNotizen = notizen.map((n) =>
    !n.geloescht && !karte.has(n.liste_id) ? { ...n, liste_id: EINGANG_ID, geaendert: jetzt } : n,
  );

  // Was lebt, hält sein Zuhause am Leben: Listen (samt Elternlisten) lebender Notizen und Unterlisten.
  const belebe = (id: string | null) => {
    let aktuell = id ? karte.get(id) : undefined;
    while (aktuell) {
      if (aktuell.geloescht) {
        aktuell.geloescht = null;
        aktuell.geaendert = jetzt;
      }
      aktuell = aktuell.eltern_id ? karte.get(aktuell.eltern_id) : undefined;
    }
  };
  for (const n of neueNotizen) if (!n.geloescht) belebe(n.liste_id);
  for (const l of [...karte.values()]) if (!l.geloescht) belebe(l.eltern_id);

  return { listen: [...karte.values()], notizen: neueNotizen };
}

function verschmelzeEinstellungen(lokal: Einstellungen, fern: Einstellungen): Einstellungen {
  return (fern.geaendert ?? '') >= (lokal.geaendert ?? '') ? fern : lokal;
}

/** Verlauf des Tagesgedankens: pro Tag ein Eintrag; sind sich die Geräte uneins, gilt der aus Drive. */
function verschmelzeVerlauf(lokal: VerlaufEintrag[], fern: VerlaufEintrag[]): VerlaufEintrag[] {
  const jeTag = new Map<string, VerlaufEintrag>();
  for (const e of lokal) jeTag.set(e.datum, e);
  for (const e of fern) jeTag.set(e.datum, e);
  return [...jeTag.values()].sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0)).slice(-400);
}

/**
 * Import-Verlauf: Einträge beider Seiten werden vereinigt. Ein Import, der irgendwo rückgängig
 * gemacht wurde, bleibt rückgängig gemacht – das lässt sich nicht zurücknehmen.
 */
function verschmelzeImporte(lokal: ImportEintrag[], fern: ImportEintrag[]): ImportEintrag[] {
  const jeId = new Map<string, ImportEintrag>();
  for (const e of [...lokal, ...fern]) {
    const alt = jeId.get(e.id);
    jeId.set(e.id, alt && alt.rueckgaengig && !e.rueckgaengig ? alt : e);
  }
  return [...jeId.values()].sort(nachId);
}

/**
 * Gewohnheiten: Vereinigung beider Seiten, bei gleicher ID gewinnt die neuere Fassung.
 * Eine Gewohnheit, die nur auf einer Seite fehlt, gilt nie als gelöscht (es gibt nur „inaktiv“).
 * So geht auch bei einer beschädigten oder fehlenden Datei in Drive keine verloren.
 */
function verschmelzeGewohnheiten(lokal: Gewohnheit[], fern: Gewohnheit[]): Gewohnheit[] {
  const jeId = new Map<string, Gewohnheit>();
  for (const g of [...lokal, ...fern]) {
    const alt = jeId.get(g.id);
    if (!alt || g.geaendert >= alt.geaendert) jeId.set(g.id, g);
  }
  return [...jeId.values()].sort(nachId);
}

export interface VerschmelzOptionen {
  /**
   * Gab es in Drive eine Meta-Datei? Wenn nicht, ist Drive leer oder der Zustand unklar:
   * Dann wird nichts als „in Drive gelöscht“ gedeutet und die Basis ignoriert.
   */
  fernHatMeta: boolean;
}

export function verschmelze(
  lokal: Datenbestand,
  fern: Datenbestand,
  basis: Datenbestand | null,
  jetzt: Zeitstempel,
  optionen: VerschmelzOptionen = { fernHatMeta: true },
): Datenbestand {
  const gueltigeBasis = optionen.fernHatMeta ? basis : null;
  const basisNotizen = gueltigeBasis ? alsKarte(gueltigeBasis.notizen) : null;
  const basisListen = gueltigeBasis ? alsKarte(gueltigeBasis.listen) : null;

  const basisTage = gueltigeBasis ? alsKarte(gueltigeBasis.tagebuchtage ?? []) : null;

  const fernNotizen = stempleHandarbeit(fern.notizen, basisNotizen, gleicheNotiz, jetzt);
  const fernTage = stempleHandarbeit(fern.tagebuchtage ?? [], basisTage, gleicherTag, jetzt);
  const tagebuchtage = verschmelzeMenge(lokal.tagebuchtage ?? [], fernTage, basisTage, jetzt)
    .filter((t) => !t.geloescht)
    .sort(nachId);
  const fernListen = stempleHandarbeit(fern.listen, basisListen, gleicheListe, jetzt);

  const notizen = verschmelzeMenge(lokal.notizen, fernNotizen, basisNotizen, jetzt);
  const listen = verschmelzeMenge(lokal.listen, fernListen, basisListen, jetzt);
  const repariert = repariere(listen, notizen, jetzt);

  // Papierkorb: Was länger als 30 Tage gelöscht ist, verschwindet – auf allen Geräten gleich.
  const stichtag = new Date(jetzt);
  const bleibt = (e: Eintrag) => !e.geloescht || !abgelaufen(e.geloescht, stichtag);

  const importe = optionen.fernHatMeta
    ? verschmelzeImporte(lokal.importe ?? [], fern.importe ?? [])
    : (lokal.importe ?? []);

  const gewohnheiten = verschmelzeGewohnheiten(lokal.gewohnheiten ?? [], fern.gewohnheiten ?? []);
  // Eigene Schreibimpulse: die neuere Fassung gewinnt; fehlen sie in Drive, bleiben die eigenen.
  const impulse =
    lokal.impulse && fern.impulse
      ? fern.impulse.geaendert >= lokal.impulse.geaendert
        ? fern.impulse
        : lokal.impulse
      : (lokal.impulse ?? fern.impulse);

  return {
    ...(importe.length > 0 ? { importe } : {}),
    ...(tagebuchtage.length > 0 ? { tagebuchtage } : {}),
    ...(gewohnheiten.length > 0 ? { gewohnheiten } : {}),
    ...(impulse ? { impulse } : {}),
    listen: repariert.listen.filter(bleibt).sort(nachId),
    notizen: repariert.notizen.filter(bleibt).sort(nachId),
    einstellungen: optionen.fernHatMeta
      ? verschmelzeEinstellungen(lokal.einstellungen, fern.einstellungen)
      : lokal.einstellungen,
    tagesgedanke_verlauf: optionen.fernHatMeta
      ? verschmelzeVerlauf(lokal.tagesgedanke_verlauf, fern.tagesgedanke_verlauf)
      : lokal.tagesgedanke_verlauf,
  };
}
