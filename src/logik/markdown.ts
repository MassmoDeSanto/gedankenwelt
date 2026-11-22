/**
 * Markdown-Format (KONZEPT.md, Abschnitt 7): Umwandlung zwischen dem
 * Datenbestand der App und lesbaren Markdown-Dateien – in beide Richtungen.
 *
 *   Eingang.md
 *   Reise-App/
 *     _liste.md            ← Notizen der Liste „Reise-App“ selbst
 *     Monetarisierung.md
 *   _papierkorb.md
 *   _meta.json
 *   _Tagebuch/
 *     2026/
 *       2026-11.md         ← alle Tagebuch-Einträge eines Monats (KONZEPT.md, Abschnitt 13.8)
 *
 * Phase 1 packt diese Dateien in ein ZIP, Phase 2 legt dieselben Dateien in Google Drive ab.
 * Eine „Datei“ ist hier nur ein Paar aus Pfad und Textinhalt.
 */
import {
  EINGANG_ID,
  STANDARD_EINSTELLUNGEN,
  TAGEBUCH_ID,
  eingangsListe,
  tagebuchListe,
  type Aufgabe,
  type Datenbestand,
  type Einstellungen,
  type ImportEintrag,
  type Gewohnheit,
  type Impulse,
  type Liste,
  type Notiz,
  type Prioritaet,
  type TagesgedankeSchalter,
  type Tagebuchtag,
  type VerlaufEintrag,
} from '../modell/typen';
import { leseAufgabenPraefix, mitAufgabenPraefix, type Umgebung } from './absatz';
import { leseTags } from './tags';
import { TAGEBUCH_DATEI, istBewertung, monatAusPfad, monatVon, monatsPfad, tagebuchtagId } from './tagebuch';
import { datumVon } from './zeit';
import { leseRegel, schreibeRegel } from './wiederholung';

/** Pfad → Inhalt. Pfade sind relativ zum Ordner „Gedankenwelt/“ und nutzen „/“. */
export type Dateien = Map<string, string>;

export const PAPIERKORB_DATEI = '_papierkorb.md';
export const META_DATEI = '_meta.json';
export const LISTEN_DATEI = '_liste.md';

const nachId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const nachPosition = (a: { position: number; id: string }, b: { position: number; id: string }) =>
  a.position - b.position || nachId(a, b);

// ───────────────────────── Schreiben: Datenbestand → Dateien ─────────────────────────

/** Macht aus einem Listennamen einen Dateinamen, der überall erlaubt ist. */
function dateiname(name: string): string {
  // eslint-disable-next-line no-control-regex
  let sauber = name.replace(/[/\\:*?"<>|\u0000-\u001f]/g, '-').trim().replace(/\.+$/, '');
  // Namen mit „_“ am Anfang sind für die App reserviert (_liste, _meta, _papierkorb, _import).
  if (sauber.startsWith('_')) sauber = '-' + sauber.slice(1);
  return sauber || 'Liste';
}

/** Geschwister mit gleichem Dateinamen bekommen „ (2)“, „ (3)“ … angehängt. */
function eindeutigeNamen(geschwister: Liste[]): Map<string, string> {
  const vergeben = new Set<string>();
  const namen = new Map<string, string>();
  for (const liste of geschwister) {
    const basis = dateiname(liste.name);
    let name = basis;
    for (let n = 2; vergeben.has(name.toLowerCase()); n++) name = `${basis} (${n})`;
    vergeben.add(name.toLowerCase());
    namen.set(liste.id, name);
  }
  return namen;
}

/** Einfache Namen stehen direkt im Dateikopf, alles andere in Anführungszeichen. */
function kopfText(wert: string): string {
  const einfach = /^[\p{L}][\p{L}\p{N} ._()&+!?,'’-]*$/u.test(wert) && wert === wert.trim();
  const reserviert = /^(true|false|null|yes|no|ja|nein)$/i.test(wert);
  return einfach && !reserviert ? wert : JSON.stringify(wert);
}

function schreibeKopf(liste: Liste): string {
  return [
    '---',
    `id: ${liste.id}`,
    `name: ${kopfText(liste.name)}`,
    // Die Elternliste steht ausdrücklich hier. Der Ordner, in dem die Datei liegt, ist nur die Darstellung davon.
    `eltern: ${liste.eltern_id ?? '-'}`,
    `angeheftet: ${liste.angeheftet}`,
    `tagesgedanke: ${liste.tagesgedanke}`,
    `position: ${liste.position}`,
    `erstellt: ${liste.erstellt}`,
    `geaendert: ${liste.geaendert}`,
    // Nur bei Listen aus einem Import (PHASE-4.md, Abschnitt 6)
    ...(liste.import_id ? [`import: ${liste.import_id}`] : []),
    '---',
    '',
  ].join('\n');
}

/** Eine Notiz: Text, darunter die Metadaten als HTML-Kommentar. */
/** Liest `prio:` aus dem Metadaten-Kommentar. Unbekannte Werte gelten als „keine Priorität“. */
function lesePrioritaet(wert: string | undefined): Prioritaet | null {
  return wert === 'hoch' || wert === 'mittel' || wert === 'niedrig' ? wert : null;
}

function schreibeNotiz(notiz: Notiz, imPapierkorb: boolean): string {
  const meta = [
    `id:${notiz.id}`,
    `erstellt:${notiz.erstellt}`,
    `geaendert:${notiz.geaendert}`,
    `pos:${notiz.position}`,
  ];
  const a = notiz.aufgabe;
  if (a) {
    if (a.faellig) meta.push(`faellig:${a.faellig}`);
    meta.push(`wiederholung:${schreibeRegel(a.wiederholung)}`);
    if (a.erinnerung > 0) meta.push(`erinnerung:${a.erinnerung}`);
    if (a.erledigt_verlauf.length > 0) meta.push(`verlauf:${a.erledigt_verlauf.join(',')}`);
    if (a.erledigt_am) meta.push(`erledigt_am:${a.erledigt_am}`);
    if (a.kalender_event_id) meta.push(`kalender:${encodeURIComponent(a.kalender_event_id)}`);
    if (a.prioritaet) meta.push(`prio:${a.prioritaet}`);
    if (a.stand !== 'offen') meta.push(`stand:${a.stand}`);
  }
  // Nur bei importierten Notizen: unauffällig am Ende des Kommentars
  if (notiz.import_id) meta.push(`imp:${notiz.import_id}`);
  if (imPapierkorb) {
    meta.push(`liste:${notiz.liste_id}`);
    // Tagebuch-Notizen merken sich ihren Tag, damit sie beim Wiederherstellen dorthin zurückfinden.
    if (notiz.tagebuch_tag) meta.push(`tag:${notiz.tagebuch_tag}`);
    if (notiz.geloescht) meta.push(`geloescht:${notiz.geloescht}`);
  }
  return `${mitAufgabenPraefix(notiz)}\n<!-- ${meta.join(' ')} -->\n`;
}

export function zuDateien(bestand: Datenbestand): Dateien {
  return zuDateienMitVerzeichnis(bestand).dateien;
}

/** Wie `zuDateien`, liefert aber zusätzlich, welche Liste in welcher Datei steht. */
export function zuDateienMitVerzeichnis(bestand: Datenbestand): {
  dateien: Dateien;
  verzeichnis: { id: string; pfad: string }[];
  /** Dateien des Tagebuchs (Monatsdateien und _tagebuch.json), mit fester Kennung für den Abgleich */
  tagebuch: { kennung: string; pfad: string }[];
} {
  const dateien: Dateien = new Map();
  // Das Tagebuch hat keine Listendatei: Seine Notizen stehen in den Monatsdateien.
  const aktiveListen = bestand.listen.filter((l) => !l.geloescht && l.id !== TAGEBUCH_ID);
  const aktiveIds = new Set(aktiveListen.map((l) => l.id));

  // Unterlisten je Elternliste (null = oberste Ebene)
  const kinder = new Map<string | null, Liste[]>();
  for (const liste of aktiveListen) {
    const eltern = liste.eltern_id && aktiveIds.has(liste.eltern_id) ? liste.eltern_id : null;
    kinder.set(eltern, [...(kinder.get(eltern) ?? []), liste]);
  }
  for (const reihe of kinder.values()) reihe.sort(nachPosition);

  // Notizen je Liste; alles Gelöschte (oder Heimatlose) kommt in den Papierkorb
  const notizenJeListe = new Map<string, Notiz[]>();
  const papierkorb: Notiz[] = [];
  const tagebuch: Notiz[] = [];
  for (const notiz of bestand.notizen) {
    if (!notiz.geloescht && notiz.liste_id === TAGEBUCH_ID) tagebuch.push(notiz);
    else if (notiz.geloescht || !aktiveIds.has(notiz.liste_id)) papierkorb.push(notiz);
    else notizenJeListe.set(notiz.liste_id, [...(notizenJeListe.get(notiz.liste_id) ?? []), notiz]);
  }

  const verzeichnis: { id: string; pfad: string }[] = [];

  const schreibeListe = (liste: Liste, ordner: string, name: string) => {
    const unterlisten = kinder.get(liste.id) ?? [];
    const pfad = unterlisten.length > 0 ? `${ordner}${name}/${LISTEN_DATEI}` : `${ordner}${name}.md`;
    const notizen = (notizenJeListe.get(liste.id) ?? []).sort(nachPosition);
    const rumpf = notizen.map((n) => schreibeNotiz(n, false)).join('\n');
    dateien.set(pfad, schreibeKopf(liste) + (rumpf ? '\n' + rumpf : ''));
    verzeichnis.push({ id: liste.id, pfad });

    const namen = eindeutigeNamen(unterlisten);
    for (const unterliste of unterlisten) schreibeListe(unterliste, `${ordner}${name}/`, namen.get(unterliste.id)!);
  };

  const oberste = kinder.get(null) ?? [];
  const namen = eindeutigeNamen(oberste);
  for (const liste of oberste) schreibeListe(liste, '', namen.get(liste.id)!);

  dateien.set(
    PAPIERKORB_DATEI,
    papierkorb
      .sort(nachId)
      .map((n) => schreibeNotiz(n, true))
      .join('\n'),
  );

  const tagebuchDateien = schreibeTagebuch(tagebuch, bestand.tagebuchtage ?? [], dateien).map((m) => ({
    kennung: `_tagebuch|${m.monat}`,
    pfad: m.pfad,
  }));
  const gewohnheiten = (bestand.gewohnheiten ?? []).filter((g) => !g.geloescht);
  if (gewohnheiten.length > 0 || bestand.impulse) {
    const inhalt = {
      version: 1,
      gewohnheiten: [...gewohnheiten].sort(nachId),
      ...(bestand.impulse ? { impulse: bestand.impulse } : {}),
    };
    dateien.set(TAGEBUCH_DATEI, JSON.stringify(inhalt, null, 2) + '\n');
    tagebuchDateien.push({ kennung: '_tagebuch|einstellungen', pfad: TAGEBUCH_DATEI });
  }

  const meta = {
    version: 1,
    einstellungen: bestand.einstellungen,
    tagesgedanke_verlauf: bestand.tagesgedanke_verlauf,
    listen: verzeichnis.sort(nachId),
    geloeschte_listen: bestand.listen.filter((l) => l.geloescht).sort(nachId),
    // Der Import-Verlauf steht nur in der Datei, wenn es einen gibt.
    ...(bestand.importe?.length ? { importe: [...bestand.importe].sort(nachId) } : {}),
  };
  dateien.set(META_DATEI, JSON.stringify(meta, null, 2) + '\n');

  return { dateien, verzeichnis, tagebuch: tagebuchDateien };
}

// ───────────────────────── Tagebuch: Monatsdateien ─────────────────────────

const TAG_ZEILE = /^## (\d{4}-\d{2}-\d{2})(?:[ \t]+·[ \t]+(.*?))?[ \t]*$/;
const TAG_META_ZEILE = /^<!--\s+(tag-id:.+?)\s+-->$/;

/** Kopfzeile und Metadaten eines Tages, z. B. „## 2026-11-16 · Ein Tag voller Konzepte“. */
function schreibeTagKopf(datum: string, tag: Tagebuchtag | undefined): string {
  const titel = tag?.titel.replace(/\s+/g, ' ').trim() ?? '';
  const zeilen = [titel ? `## ${datum} · ${titel}` : `## ${datum}`];
  if (tag) {
    const meta = [`tag-id:${tag.id}`, `erstellt:${tag.erstellt}`, `geaendert:${tag.geaendert}`];
    if (tag.bewertung) meta.push(`bewertung:${tag.bewertung}`);
    if (tag.impuls) meta.push(`impuls:${encodeURIComponent(tag.impuls)}`);
    if (tag.gewohnheiten.length > 0) meta.push(`gewohnheiten:${tag.gewohnheiten.join(',')}`);
    zeilen.push(`<!-- ${meta.join(' ')} -->`);
  }
  return zeilen.join('\n') + '\n';
}

/** Schreibt die Monatsdateien des Tagebuchs in `dateien` und gibt sie zurück. */
function schreibeTagebuch(
  notizen: Notiz[],
  tage: Tagebuchtag[],
  dateien: Dateien,
): { monat: string; pfad: string }[] {
  /** Datum → Notizen und Tagebuchtag */
  const jeDatum = new Map<string, { notizen: Notiz[]; tag?: Tagebuchtag }>();
  const eintrag = (datum: string) => {
    let e = jeDatum.get(datum);
    if (!e) jeDatum.set(datum, (e = { notizen: [] }));
    return e;
  };
  for (const n of notizen) eintrag(n.tagebuch_tag ?? datumVon(n.erstellt)).notizen.push(n);
  for (const t of tage) if (!t.geloescht) eintrag(t.datum).tag = t;

  const jeMonat = new Map<string, string[]>();
  for (const datum of [...jeDatum.keys()].sort()) {
    const { notizen: reihe, tag } = jeDatum.get(datum)!;
    const rumpf = reihe
      .sort(nachPosition)
      .map((n) => schreibeNotiz(n, false))
      .join('\n');
    const abschnitt = schreibeTagKopf(datum, tag) + (rumpf ? '\n' + rumpf : '');
    const monat = monatVon(datum);
    jeMonat.set(monat, [...(jeMonat.get(monat) ?? []), abschnitt]);
  }

  const monate: { monat: string; pfad: string }[] = [];
  for (const [monat, abschnitte] of jeMonat) {
    const pfad = monatsPfad(monat);
    dateien.set(pfad, ['---', 'art: tagebuch', `monat: ${monat}`, '---', '', abschnitte.join('\n')].join('\n'));
    monate.push({ monat, pfad });
  }
  return monate.sort((a, b) => (a.monat < b.monat ? -1 : 1));
}

/** Liest _Tagebuch/_tagebuch.json. Unlesbares wird übergangen, statt die App anzuhalten. */
function leseTagebuchDatei(inhalt: string): { gewohnheiten: Gewohnheit[]; impulse: Impulse | undefined } {
  try {
    const roh = JSON.parse(inhalt);
    const gewohnheiten = (Array.isArray(roh?.gewohnheiten) ? roh.gewohnheiten : [])
      .filter((g: Gewohnheit) => typeof g?.id === 'string' && typeof g?.name === 'string')
      .map((g: Gewohnheit) => ({
        id: g.id,
        name: g.name,
        position: Number.isFinite(Number(g.position)) ? Number(g.position) : 0,
        aktiv: g.aktiv !== false,
        erstellt: typeof g.erstellt === 'string' ? g.erstellt : '',
        geaendert: typeof g.geaendert === 'string' ? g.geaendert : '',
        geloescht: typeof g.geloescht === 'string' ? g.geloescht : null,
      }));
    const i = roh?.impulse;
    const impulse =
      i && Array.isArray(i.fragen) && typeof i.geaendert === 'string'
        ? { fragen: i.fragen.filter((f: unknown) => typeof f === 'string'), geaendert: i.geaendert }
        : undefined;
    return { gewohnheiten, impulse };
  } catch {
    return { gewohnheiten: [], impulse: undefined };
  }
}

/** Liest eine Monatsdatei. Absätze vor der ersten Tageszeile gehören zum Ersten des Monats. */
function leseTagebuch(inhalt: string, monat: string, umg: Umgebung): { notizen: Notiz[]; tage: Tagebuchtag[] } {
  const { rumpf } = leseKopf(inhalt);
  const notizen: Notiz[] = [];
  const tage: Tagebuchtag[] = [];

  let datum = `${monat}-01`;
  let titel = '';
  let puffer: string[] = [];
  let kopfGesehen = false;

  const schliesse = () => {
    const zeilen = [...puffer];
    puffer = [];
    // Die Metadaten des Tages stehen direkt unter der Tageszeile.
    const erste = zeilen.findIndex((z) => z.trim() !== '');
    const treffer = kopfGesehen && erste >= 0 ? TAG_META_ZEILE.exec(zeilen[erste].trim()) : null;
    if (treffer) zeilen.splice(erste, 1);

    if (treffer || titel) {
      const meta = treffer ? leseMeta(treffer[1]) : new Map<string, string>();
      const bewertung = Number(meta.get('bewertung'));
      const impuls = meta.get('impuls');
      const erstellt = meta.get('erstellt') ?? umg.jetzt;
      tage.push({
        id: meta.get('tag-id') || tagebuchtagId(datum),
        datum,
        titel,
        bewertung: istBewertung(bewertung) ? bewertung : null,
        impuls: impuls ? decodeURIComponent(impuls) : null,
        gewohnheiten: (meta.get('gewohnheiten') ?? '').split(',').filter(Boolean),
        erstellt,
        geaendert: meta.get('geaendert') ?? erstellt,
        geloescht: null,
      });
    }
    for (const n of baueNotizen(zeilen.join('\n'), TAGEBUCH_ID, umg, `_tagebuch|${datum}`)) {
      notizen.push({ ...n, tagebuch_tag: datum });
    }
  };

  for (const zeile of rumpf.split('\n')) {
    const kopf = TAG_ZEILE.exec(zeile.trim());
    if (kopf && monatVon(kopf[1]) === monat) {
      schliesse();
      datum = kopf[1];
      titel = (kopf[2] ?? '').trim();
      kopfGesehen = true;
    } else {
      puffer.push(zeile);
    }
  }
  schliesse();
  return { notizen, tage };
}

// ───────────────────────── Lesen: Dateien → Datenbestand ─────────────────────────

function leseKopf(inhalt: string): { felder: Map<string, string>; rumpf: string } {
  const text = inhalt.replace(/\r\n?/g, '\n');
  const felder = new Map<string, string>();
  if (!text.startsWith('---\n')) return { felder, rumpf: text };
  const ende = text.indexOf('\n---', 3);
  if (ende < 0) return { felder, rumpf: text };

  for (const zeile of text.slice(4, ende).split('\n')) {
    const trenner = zeile.indexOf(':');
    if (trenner < 0) continue;
    let wert = zeile.slice(trenner + 1).trim();
    if (wert.startsWith('"')) {
      try {
        wert = JSON.parse(wert);
      } catch {
        // kein gültiger Text in Anführungszeichen: unverändert übernehmen
      }
    }
    felder.set(zeile.slice(0, trenner).trim(), wert);
  }
  return { felder, rumpf: text.slice(ende + 4) };
}

/** Der Inhalt einer Listendatei ohne den Kopf zwischen den „---“-Zeilen. */
export function ohneDateikopf(inhalt: string): string {
  return leseKopf(inhalt).rumpf;
}

const META_ZEILE = /^<!--\s+(id:.+?)\s+-->$/;

function leseMeta(text: string): Map<string, string> {
  const meta = new Map<string, string>();
  for (const paar of text.split(/\s+/)) {
    const trenner = paar.indexOf(':');
    if (trenner > 0) meta.set(paar.slice(0, trenner), paar.slice(trenner + 1));
  }
  return meta;
}

interface RohNotiz {
  text: string;
  /** null = von Hand geschriebener Absatz ohne Metadaten-Kommentar */
  meta: Map<string, string> | null;
}

/** Liest die Absätze einer Datei. Jeder Absatz endet mit seinem Metadaten-Kommentar oder einer Leerzeile. */
function leseRumpf(rumpf: string): RohNotiz[] {
  const ergebnis: RohNotiz[] = [];
  let puffer: string[] = [];

  const schliesse = (meta: Map<string, string> | null) => {
    const text = puffer.join('\n').trim();
    puffer = [];
    const letzte = ergebnis[ergebnis.length - 1];
    if (text) ergebnis.push({ text, meta });
    else if (meta && letzte && !letzte.meta) letzte.meta = meta; // Kommentar stand nach einer Leerzeile
  };

  for (const zeile of rumpf.split('\n')) {
    const treffer = META_ZEILE.exec(zeile.trim());
    if (treffer) schliesse(leseMeta(treffer[1]));
    else if (zeile.trim() === '') {
      if (puffer.length > 0) schliesse(null);
    } else puffer.push(zeile);
  }
  if (puffer.length > 0) schliesse(null);
  return ergebnis;
}

/** Baut die Notizen einer Datei. `liste_id` null = Papierkorb-Datei (Liste steht dann im Kommentar). */
function baueNotizen(rumpf: string, liste_id: string | null, umg: Umgebung, bereich?: string): Notiz[] {
  const roh = leseRumpf(rumpf);
  const allePositionen = roh.every((r) => r.meta && Number.isFinite(Number(r.meta.get('pos'))));
  /** Wie oft derselbe Text ohne Metadaten in dieser Datei schon vorkam (für eindeutige Hinweise) */
  const gleicheTexte = new Map<string, number>();
  const hinweis = (text: string) => {
    const n = gleicheTexte.get(text) ?? 0;
    gleicheTexte.set(text, n + 1);
    return `notiz|${bereich ?? liste_id ?? '_papierkorb'}|${n}|${text}`;
  };

  return roh.map((r, index) => {
    const meta = r.meta ?? new Map<string, string>();
    const { text, zustand } = leseAufgabenPraefix(r.text);
    const kalender = meta.get('kalender');
    const aufgabe: Aufgabe | null = zustand
      ? {
          erledigt: zustand === 'erledigt',
          erledigt_am: meta.get('erledigt_am') ?? null,
          faellig: meta.get('faellig') ?? null,
          wiederholung: leseRegel(meta.get('wiederholung')),
          kalender_event_id: kalender ? decodeURIComponent(kalender) : null,
          erinnerung: Math.max(0, Number(meta.get('erinnerung')) || 0),
          erledigt_verlauf: (meta.get('verlauf') ?? '').split(',').filter(Boolean),
          prioritaet: lesePrioritaet(meta.get('prio')),
          stand: meta.get('stand') === 'in_arbeit' ? 'in_arbeit' : 'offen',
        }
      : null;
    const erstellt = meta.get('erstellt') ?? umg.jetzt;

    let geloescht: string | null = null;
    if (liste_id === null) geloescht = r.meta ? (meta.get('geloescht') ?? null) : umg.jetzt;

    const notiz: Notiz = {
      id: meta.get('id') ?? umg.neueId(hinweis(r.text)),
      text,
      liste_id: liste_id ?? meta.get('liste') ?? EINGANG_ID,
      position: allePositionen ? Number(meta.get('pos')) : index + 1,
      tags: leseTags(text),
      erstellt,
      geaendert: meta.get('geaendert') ?? erstellt,
      aufgabe,
      geloescht,
      verweise: [],
    };
    const importId = meta.get('imp');
    if (importId) notiz.import_id = importId;
    const tag = meta.get('tag');
    if (tag && /^\d{4}-\d{2}-\d{2}$/.test(tag)) notiz.tagebuch_tag = tag;
    return notiz;
  });
}

function istSchalter(wert: string | undefined): wert is TagesgedankeSchalter {
  return wert === 'an' || wert === 'aus' || wert === 'erben';
}

/** Was beim Lesen nebenbei festgehalten wird: welche Datei und welcher Ordner zu welcher Liste gehört. */
export interface LeseProtokoll {
  /** Pfad einer Listendatei → ID der Liste */
  listeJePfad: Map<string, string>;
  /** Pfad eines Ordners → ID der Liste, deren Unterlisten darin liegen */
  ordnerJePfad: Map<string, string>;
}

/**
 * Baut den ganzen Datenbestand aus den Dateien neu auf.
 * Von Hand ergänzte Absätze ohne Kommentar bekommen eine neue ID und das aktuelle Datum.
 */
export function ausDateien(dateien: Dateien, umg: Umgebung, protokoll?: LeseProtokoll): Datenbestand {
  const listen: Liste[] = [];
  const notizen: Notiz[] = [];
  /** Ordner einer Liste mit Unterlisten → ihre ID */
  const ordnerZuId = new Map<string, string>();
  /** Liste → Ordner, in dem sie liegt ('' = oberste Ebene) */
  const elternOrdner = new Map<string, string>();
  /** Liste → Elternliste laut Dateikopf (null = oberste Ebene) */
  const angegebeneEltern = new Map<string, string | null>();
  const tagebuchtage: Tagebuchtag[] = [];
  let gewohnheiten: Gewohnheit[] = [];
  let impulse: Impulse | undefined;

  for (const [pfad, inhalt] of dateien) {
    if (pfad === TAGEBUCH_DATEI) {
      ({ gewohnheiten, impulse } = leseTagebuchDatei(inhalt));
      continue;
    }
    const monat = monatAusPfad(pfad);
    if (monat) {
      const gelesen = leseTagebuch(inhalt, monat, umg);
      notizen.push(...gelesen.notizen);
      tagebuchtage.push(...gelesen.tage);
      continue;
    }
    const teile = pfad.split('/');
    const datei = teile.pop()!;
    if (!datei.endsWith('.md')) continue;
    if (teile.some((t) => t.startsWith('_'))) continue; // z. B. _import/
    const istOrdnerListe = datei === LISTEN_DATEI;
    if (datei.startsWith('_') && !istOrdnerListe) continue;
    if (istOrdnerListe && teile.length === 0) continue;

    const ordner = teile.join('/');
    const { felder, rumpf } = leseKopf(inhalt);
    const erstellt = felder.get('erstellt') ?? umg.jetzt;
    const schalter = felder.get('tagesgedanke');
    const position = Number(felder.get('position'));
    const liste: Liste = {
      id: felder.get('id') || umg.neueId(`liste|${pfad}`),
      name: felder.get('name') || (istOrdnerListe ? teile[teile.length - 1] : datei.slice(0, -3)),
      eltern_id: null,
      angeheftet: felder.get('angeheftet') === 'true',
      tagesgedanke: istSchalter(schalter) ? schalter : 'erben',
      position: Number.isFinite(position) ? position : 0,
      erstellt,
      geaendert: felder.get('geaendert') ?? erstellt,
      geloescht: null,
    };
    const importId = felder.get('import');
    if (importId) liste.import_id = importId;
    listen.push(liste);
    protokoll?.listeJePfad.set(pfad, liste.id);
    const eltern = felder.get('eltern');
    if (eltern !== undefined) angegebeneEltern.set(liste.id, eltern === '-' || eltern === '' ? null : eltern);
    if (istOrdnerListe) {
      ordnerZuId.set(ordner, liste.id);
      elternOrdner.set(liste.id, teile.slice(0, -1).join('/'));
    } else {
      elternOrdner.set(liste.id, ordner);
    }
    notizen.push(...baueNotizen(rumpf, liste.id, umg));
  }

  // Ordner ohne eigene _liste.md (z. B. von Hand in Drive angelegt) bekommen eine leere Liste.
  // Nur nötig für Dateien, deren Elternliste nicht im Kopf steht – sonst ist der Ordner bloße Darstellung
  // (und darf z. B. während eines unterbrochenen Abgleichs vorübergehend „falsch“ sein).
  const fehlend = new Set<string>();
  for (const [liste_id, ordner] of elternOrdner) {
    if (angegebeneEltern.has(liste_id)) continue;
    const teile = ordner.split('/');
    for (let tiefe = teile.length; tiefe > 0; tiefe--) {
      const teilPfad = teile.slice(0, tiefe).join('/');
      if (teilPfad && !ordnerZuId.has(teilPfad)) fehlend.add(teilPfad);
    }
  }
  for (const ordner of [...fehlend].sort()) {
    const teile = ordner.split('/');
    const liste: Liste = {
      id: umg.neueId(`ordner|${ordner}`),
      name: teile[teile.length - 1],
      eltern_id: null,
      angeheftet: false,
      tagesgedanke: 'erben',
      position: 0,
      erstellt: umg.jetzt,
      geaendert: umg.jetzt,
      geloescht: null,
    };
    listen.push(liste);
    ordnerZuId.set(ordner, liste.id);
    elternOrdner.set(liste.id, teile.slice(0, -1).join('/'));
  }

  if (protokoll) for (const [ordner, id] of ordnerZuId) protokoll.ordnerJePfad.set(ordner, id);

  for (const liste of listen) {
    // Steht die Elternliste im Dateikopf, gilt sie. Sonst (von Hand angelegte Datei) zählt der Ordner.
    const angegeben = angegebeneEltern.get(liste.id);
    if (angegeben !== undefined) {
      liste.eltern_id = angegeben;
      continue;
    }
    const ordner = elternOrdner.get(liste.id) ?? '';
    liste.eltern_id = ordner ? (ordnerZuId.get(ordner) ?? null) : null;
  }

  // Papierkorb
  const papierkorb = dateien.get(PAPIERKORB_DATEI);
  if (papierkorb) notizen.push(...baueNotizen(papierkorb.replace(/\r\n?/g, '\n'), null, umg));

  // Meta: Einstellungen, Verlauf, gelöschte Listen
  let einstellungen: Einstellungen = { ...STANDARD_EINSTELLUNGEN };
  let tagesgedanke_verlauf: VerlaufEintrag[] = [];
  let importe: ImportEintrag[] = [];
  const metaText = dateien.get(META_DATEI);
  if (metaText) {
    try {
      const meta = JSON.parse(metaText);
      if (meta.einstellungen?.thema === 'hell' || meta.einstellungen?.thema === 'dunkel') {
        einstellungen = { thema: meta.einstellungen.thema };
        if (typeof meta.einstellungen.geaendert === 'string') einstellungen.geaendert = meta.einstellungen.geaendert;
        if (typeof meta.einstellungen.erinnerungen === 'boolean') einstellungen.erinnerungen = meta.einstellungen.erinnerungen;
        if (typeof meta.einstellungen.kalender_id === 'string') einstellungen.kalender_id = meta.einstellungen.kalender_id;
      }
      if (Array.isArray(meta.tagesgedanke_verlauf)) {
        tagesgedanke_verlauf = meta.tagesgedanke_verlauf
          .filter((e: VerlaufEintrag) => typeof e?.datum === 'string' && typeof e?.notiz_id === 'string')
          .map((e: VerlaufEintrag) => ({ datum: e.datum, notiz_id: e.notiz_id }));
      }
      if (Array.isArray(meta.geloeschte_listen)) {
        const vorhanden = new Set(listen.map((l) => l.id));
        for (const l of meta.geloeschte_listen as Liste[]) {
          if (typeof l?.id === 'string' && !vorhanden.has(l.id)) listen.push({ ...l });
        }
      }
      if (Array.isArray(meta.importe)) {
        importe = (meta.importe as ImportEintrag[])
          .filter((e) => typeof e?.id === 'string' && typeof e?.datum === 'string')
          .map((e) => ({
            id: e.id,
            datum: e.datum,
            weg: e.weg ?? 'gemischt',
            dateien: Number(e.dateien) || 0,
            listen: Number(e.listen) || 0,
            notizen: Number(e.notizen) || 0,
            aufgaben: Number(e.aufgaben) || 0,
            offen: Number(e.offen) || 0,
            fingerabdruecke: Array.isArray(e.fingerabdruecke) ? e.fingerabdruecke.filter((f) => typeof f === 'string') : [],
            rueckgaengig: typeof e.rueckgaengig === 'string' ? e.rueckgaengig : null,
          }));
      }
    } catch {
      // beschädigte Meta-Datei: mit Standardwerten weitermachen, Notizen sind trotzdem da
    }
  }

  if (!listen.some((l) => l.id === EINGANG_ID)) listen.push(eingangsListe(umg.jetzt));
  // Das Tagebuch hat keine eigene Datei und ist immer da – mit festen Werten.
  const tagebuchIndex = listen.findIndex((l) => l.id === TAGEBUCH_ID);
  if (tagebuchIndex >= 0) listen.splice(tagebuchIndex, 1);
  listen.push(tagebuchListe());

  return {
    listen: listen.sort(nachId),
    notizen: notizen.sort(nachId),
    einstellungen,
    tagesgedanke_verlauf,
    ...(importe.length > 0 ? { importe: importe.sort(nachId) } : {}),
    ...(tagebuchtage.length > 0 ? { tagebuchtage: tagebuchtage.sort(nachId) } : {}),
    ...(gewohnheiten.length > 0 ? { gewohnheiten: gewohnheiten.sort(nachId) } : {}),
    ...(impulse ? { impulse } : {}),
  };
}
