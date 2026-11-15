/**
 * Eine Abgleich-Runde zwischen diesem Gerät und Google Drive (PHASE-2.md, Abschnitt 3).
 *
 * Ablauf:
 *  1. Ordner „Gedankenwelt“ in Drive auflisten, geänderte Dateien herunterladen.
 *  2. Lokalen Stand, Drive-Stand und den Stand vom letzten Abgleich zusammenführen
 *     (pro Notiz gewinnt die neuere Fassung) und das Ergebnis lokal übernehmen.
 *  3. Drive an das Ergebnis angleichen: Inhalte schreiben, Dateien anlegen,
 *     umbenennen, verschieben – und erst ganz am Ende aufräumen.
 *
 * Dateien werden an der ID der Liste erkannt, die in ihnen steht, nicht am Namen.
 * Darum wird eine umbenannte oder verschobene Liste in Drive nur umbenannt bzw.
 * verschoben und nie neu angelegt.
 *
 * Die Runde verändert nichts „halb“: Bricht sie ab, bleibt alles lokal erhalten und
 * die nächste Runde stellt aus den drei Ständen wieder dasselbe Ziel her.
 */
import { EINGANG_ID, type Datenbestand, type Zeitstempel } from '../../modell/typen';
import { festeId, neueId } from '../../modell/ulid';
import type { Umgebung } from '../absatz';
import {
  LISTEN_DATEI,
  META_DATEI,
  PAPIERKORB_DATEI,
  ausDateien,
  ohneDateikopf,
  zuDateienMitVerzeichnis,
  type Dateien,
  type LeseProtokoll,
} from '../markdown';
import { VersionsKonflikt, type Drive, type DriveEintrag } from './drive';
import { verschmelze } from './verschmelzen';

/** Was sich das Gerät zu einer Drive-Datei merkt, um sie nicht jedes Mal neu zu laden. */
export interface CacheEintrag extends DriveEintrag {
  /** Zuletzt geladener Inhalt (nur bei Dateien, die zur App gehören) */
  inhalt?: string;
}

/** Was der Abgleich von einem Gerät braucht. In der App steckt dahinter die Browser-Datenbank. */
export interface Geraet {
  leseLokal(): Datenbestand;
  /** Übernimmt das Ergebnis des Zusammenführens als neuen lokalen Stand. */
  schreibeLokal(bestand: Datenbestand): void;
  /** Der Stand, auf den sich Gerät und Drive beim letzten erfolgreichen Abgleich geeinigt hatten. */
  leseBasis(): Datenbestand | null;
  schreibeBasis(bestand: Datenbestand): void | Promise<void>;
  leseCache(): Map<string, CacheEintrag>;
  schreibeCache(cache: Map<string, CacheEintrag>): void | Promise<void>;
}

export interface RundenErgebnis {
  heruntergeladen: number;
  /** Schreibvorgänge in Drive (Inhalt, Anlegen, Umbenennen, Verschieben, Löschen) */
  hochgeladen: number;
}

const ordnerVon = (pfad: string) => (pfad.includes('/') ? pfad.slice(0, pfad.lastIndexOf('/')) : '');
const nameVon = (pfad: string) => pfad.slice(pfad.lastIndexOf('/') + 1);
const tiefe = (pfad: string) => pfad.split('/').length;
const nachId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Gehört diese Datei zum Format der App? Alles andere (z. B. der Ordner _import) bleibt unangetastet. */
function istAppDatei(pfad: string): boolean {
  const teile = pfad.split('/');
  const datei = teile.pop()!;
  if (teile.some((t) => t.startsWith('_'))) return false;
  if (teile.length === 0 && (datei === META_DATEI || datei === PAPIERKORB_DATEI)) return true;
  if (!datei.endsWith('.md')) return false;
  return !datei.startsWith('_') || (datei === LISTEN_DATEI && teile.length > 0);
}

async function eineRunde(drive: Drive, geraet: Geraet, jetzt: Zeitstempel): Promise<RundenErgebnis> {
  const umg: Umgebung = { jetzt, neueId: (hinweis) => (hinweis ? festeId(hinweis) : neueId()) };

  // ── 1. Drive lesen ──
  const wurzel = await drive.wurzel();
  const eintraege = (await drive.liste(wurzel)).sort(nachId);
  const jeId = new Map(eintraege.map((e) => [e.id, e]));

  const pfadVon = (e: DriveEintrag): string | null => {
    const teile = [e.name];
    let eltern = e.eltern;
    for (let schritte = 0; eltern !== wurzel; schritte++) {
      const ordner = jeId.get(eltern);
      if (!ordner || schritte > 100) return null;
      teile.unshift(ordner.name);
      eltern = ordner.eltern;
    }
    return teile.join('/');
  };

  const alt = geraet.leseCache();
  const cache = new Map<string, CacheEintrag>();
  const pfade = new Map<string, string>();
  let heruntergeladen = 0;

  for (const e of eintraege) {
    const pfad = pfadVon(e);
    if (pfad === null) continue;
    pfade.set(e.id, pfad);
    if (e.ordner || !istAppDatei(pfad)) {
      cache.set(e.id, { ...e });
      continue;
    }
    const bekannt = alt.get(e.id);
    let inhalt = bekannt?.version === e.version ? bekannt.inhalt : undefined;
    if (inhalt === undefined) {
      inhalt = await drive.lese(e.id);
      heruntergeladen++;
    }
    cache.set(e.id, { ...e, inhalt });
  }
  await geraet.schreibeCache(cache);

  // Dateien nach Pfad ordnen. Gibt es einen Pfad doppelt, werden die Inhalte zusammengelegt
  // und die überzählige Datei am Ende entfernt.
  const dateien: Dateien = new Map();
  const dateiJePfad = new Map<string, CacheEintrag>();
  const ordnerJePfad = new Map<string, CacheEintrag>();
  const ueberzaehlig: CacheEintrag[] = [];

  for (const e of cache.values()) {
    const pfad = pfade.get(e.id)!;
    if (e.ordner) {
      if (!ordnerJePfad.has(pfad)) ordnerJePfad.set(pfad, e);
    } else if (e.inhalt !== undefined) {
      if (!dateiJePfad.has(pfad)) {
        dateiJePfad.set(pfad, e);
        dateien.set(pfad, e.inhalt);
      } else {
        ueberzaehlig.push(e);
        if (pfad.endsWith('.md')) dateien.set(pfad, dateien.get(pfad)! + '\n' + ohneDateikopf(e.inhalt));
      }
    }
  }

  const protokoll: LeseProtokoll = { listeJePfad: new Map(), ordnerJePfad: new Map() };
  const fernHatMeta = dateien.has(META_DATEI);
  const fern = ausDateien(dateien, umg, protokoll);
  // Steht der Eingang (noch) nicht in Drive, darf der beim Lesen ergänzte leere Eingang den lokalen nicht verdrängen.
  if (![...protokoll.listeJePfad.values()].includes(EINGANG_ID)) {
    fern.listen = fern.listen.filter((l) => l.id !== EINGANG_ID);
  }

  // ── 2. Zusammenführen: lesen, verschmelzen und lokal schreiben ohne Pause dazwischen ──
  const ergebnis = verschmelze(geraet.leseLokal(), fern, geraet.leseBasis(), jetzt, { fernHatMeta });
  geraet.schreibeLokal(ergebnis);

  // ── 3. Drive angleichen ──
  const { dateien: ziel, verzeichnis } = zuDateienMitVerzeichnis(ergebnis);

  /** Vorhandene Drive-Dateien, erkannt an ihrer Kennung (ID der Liste bzw. Papierkorb/Meta) */
  const vorhanden = new Map<string, CacheEintrag>();
  for (const [pfad, e] of dateiJePfad) {
    const kennung =
      pfad === META_DATEI ? '_meta' : pfad === PAPIERKORB_DATEI ? '_papierkorb' : protokoll.listeJePfad.get(pfad);
    if (!kennung) continue;
    if (vorhanden.has(kennung)) ueberzaehlig.push(e);
    else vorhanden.set(kennung, e);
  }

  const soll = [
    ...verzeichnis.map((v) => ({ kennung: v.id, pfad: v.pfad })),
    { kennung: '_papierkorb', pfad: PAPIERKORB_DATEI },
    { kennung: '_meta', pfad: META_DATEI },
  ].map((s) => ({ ...s, inhalt: ziel.get(s.pfad)! }));

  let hochgeladen = 0;

  // 3a. Inhalte bestehender Dateien (zuerst, damit der neue Zeitstempel einer Liste vor ihrem Umzug in Drive steht)
  for (const s of soll) {
    const e = vorhanden.get(s.kennung);
    if (e && e.inhalt !== s.inhalt) {
      Object.assign(e, await drive.schreibe(e.id, s.inhalt, e.version), { inhalt: s.inhalt });
      hochgeladen++;
    }
  }

  // 3b. Ordner: Der Ordner einer Liste wird an der Liste erkannt und nur umbenannt oder verschoben.
  const ordnerVonListe = new Map<string, CacheEintrag>();
  for (const [pfad, liste_id] of protokoll.ordnerJePfad) {
    const ordner = ordnerJePfad.get(pfad);
    if (ordner && !ordnerVonListe.has(liste_id)) ordnerVonListe.set(liste_id, ordner);
  }
  const ordnerIds = new Map<string, string>([['', wurzel]]);
  const sollOrdner = verzeichnis
    .filter((v) => nameVon(v.pfad) === LISTEN_DATEI)
    .map((v) => ({ pfad: ordnerVon(v.pfad), liste_id: v.id }))
    .sort((a, b) => tiefe(a.pfad) - tiefe(b.pfad) || (a.pfad < b.pfad ? -1 : 1));

  for (const o of sollOrdner) {
    const eltern = ordnerIds.get(ordnerVon(o.pfad))!;
    const name = nameVon(o.pfad);
    let ordner = ordnerVonListe.get(o.liste_id);
    if (!ordner) {
      ordner = await drive.erstelleOrdner(name, eltern);
      cache.set(ordner.id, ordner);
      hochgeladen++;
    } else if (ordner.name !== name || ordner.eltern !== eltern) {
      Object.assign(ordner, await drive.aendere(ordner.id, { name, eltern }));
      hochgeladen++;
    }
    ordnerIds.set(o.pfad, ordner.id);
  }

  // 3c. Dateien: neue anlegen, vorhandene an ihren Platz bringen
  for (const s of soll) {
    const eltern = ordnerIds.get(ordnerVon(s.pfad))!;
    const name = nameVon(s.pfad);
    const e = vorhanden.get(s.kennung);
    if (!e) {
      const neu = await drive.erstelleDatei(name, eltern, s.inhalt);
      cache.set(neu.id, { ...neu, inhalt: s.inhalt });
      hochgeladen++;
    } else if (e.name !== name || e.eltern !== eltern) {
      Object.assign(e, await drive.aendere(e.id, { name, eltern }));
      hochgeladen++;
    }
  }

  // 3d. Aufräumen – erst jetzt, wo alles andere sicher in Drive steht.
  const gebraucht = new Set(soll.map((s) => s.kennung));
  for (const [kennung, e] of vorhanden) if (!gebraucht.has(kennung)) ueberzaehlig.push(e);
  for (const e of ueberzaehlig) {
    await drive.loesche(e.id);
    cache.delete(e.id);
    hochgeladen++;
  }
  // Leere Ordner, die zu keiner Liste mehr gehören (tiefste zuerst, bis keiner mehr übrig ist)
  const ordnerInGebrauch = new Set(ordnerIds.values());
  for (let entfernt = true; entfernt; ) {
    entfernt = false;
    for (const e of [...cache.values()]) {
      if (!e.ordner || ordnerInGebrauch.has(e.id)) continue;
      if ((pfade.get(e.id) ?? '').split('/').some((t) => t.startsWith('_'))) continue;
      if ([...cache.values()].some((k) => k.eltern === e.id)) continue;
      await drive.loesche(e.id);
      cache.delete(e.id);
      hochgeladen++;
      entfernt = true;
    }
  }

  await geraet.schreibeCache(cache);
  await geraet.schreibeBasis(ergebnis);
  return { heruntergeladen, hochgeladen };
}

/**
 * Gleicht das Gerät mit Drive ab. Hat während der Runde ein anderes Gerät geschrieben
 * (Versionskonflikt), beginnt die Runde von vorn – höchstens dreimal.
 */
export async function abgleiche(drive: Drive, geraet: Geraet, jetzt: () => Zeitstempel): Promise<RundenErgebnis> {
  for (let versuch = 1; ; versuch++) {
    try {
      return await eineRunde(drive, geraet, jetzt());
    } catch (fehler) {
      if (!(fehler instanceof VersionsKonflikt) || versuch >= 3) throw fehler;
    }
  }
}
