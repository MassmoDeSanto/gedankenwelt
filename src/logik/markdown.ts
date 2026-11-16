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
 *
 * Phase 1 packt diese Dateien in ein ZIP, Phase 2 legt dieselben Dateien in Google Drive ab.
 * Eine „Datei“ ist hier nur ein Paar aus Pfad und Textinhalt.
 */
import {
  EINGANG_ID,
  STANDARD_EINSTELLUNGEN,
  eingangsListe,
  type Aufgabe,
  type Datenbestand,
  type Einstellungen,
  type Liste,
  type Notiz,
  type TagesgedankeSchalter,
  type VerlaufEintrag,
} from '../modell/typen';
import { leseAufgabenPraefix, mitAufgabenPraefix, type Umgebung } from './absatz';
import { leseTags } from './tags';
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
    '---',
    '',
  ].join('\n');
}

/** Eine Notiz: Text, darunter die Metadaten als HTML-Kommentar. */
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
  }
  if (imPapierkorb) {
    meta.push(`liste:${notiz.liste_id}`);
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
} {
  const dateien: Dateien = new Map();
  const aktiveListen = bestand.listen.filter((l) => !l.geloescht);
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
  for (const notiz of bestand.notizen) {
    if (notiz.geloescht || !aktiveIds.has(notiz.liste_id)) papierkorb.push(notiz);
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

  const meta = {
    version: 1,
    einstellungen: bestand.einstellungen,
    tagesgedanke_verlauf: bestand.tagesgedanke_verlauf,
    listen: verzeichnis.sort(nachId),
    geloeschte_listen: bestand.listen.filter((l) => l.geloescht).sort(nachId),
  };
  dateien.set(META_DATEI, JSON.stringify(meta, null, 2) + '\n');

  return { dateien, verzeichnis };
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
function baueNotizen(rumpf: string, liste_id: string | null, umg: Umgebung): Notiz[] {
  const roh = leseRumpf(rumpf);
  const allePositionen = roh.every((r) => r.meta && Number.isFinite(Number(r.meta.get('pos'))));
  /** Wie oft derselbe Text ohne Metadaten in dieser Datei schon vorkam (für eindeutige Hinweise) */
  const gleicheTexte = new Map<string, number>();
  const hinweis = (text: string) => {
    const n = gleicheTexte.get(text) ?? 0;
    gleicheTexte.set(text, n + 1);
    return `notiz|${liste_id ?? '_papierkorb'}|${n}|${text}`;
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
        }
      : null;
    const erstellt = meta.get('erstellt') ?? umg.jetzt;

    let geloescht: string | null = null;
    if (liste_id === null) geloescht = r.meta ? (meta.get('geloescht') ?? null) : umg.jetzt;

    return {
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

  for (const [pfad, inhalt] of dateien) {
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
    } catch {
      // beschädigte Meta-Datei: mit Standardwerten weitermachen, Notizen sind trotzdem da
    }
  }

  if (!listen.some((l) => l.id === EINGANG_ID)) listen.push(eingangsListe(umg.jetzt));

  return {
    listen: listen.sort(nachId),
    notizen: notizen.sort(nachId),
    einstellungen,
    tagesgedanke_verlauf,
  };
}
