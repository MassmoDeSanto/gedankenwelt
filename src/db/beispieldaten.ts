/**
 * Erfundene Beispieldaten zum Ausprobieren: Listen, Unterlisten, Tags und Aufgaben.
 * Enthält bewusst keine echten Notizen.
 */
import { erzeugeNotizen, leseAufgabenPraefix } from '../logik/absatz';
import { jetztStempel, lokalesDatum, verschiebeDatum } from '../logik/zeit';
import { EINGANG_ID, type Liste, type Notiz, type TagesgedankeSchalter } from '../modell/typen';

interface BeispielNotiz {
  text: string;
  /** vor wie vielen Tagen erstellt */
  alter: number;
  /** Fälligkeit: Tage ab heute, optional Uhrzeit */
  faellig?: [number, string?];
}

interface BeispielListe {
  name: string;
  angeheftet?: boolean;
  tagesgedanke?: TagesgedankeSchalter;
  notizen: BeispielNotiz[];
  unterlisten?: BeispielListe[];
}

const LISTEN: BeispielListe[] = [
  {
    name: 'Reise-App',
    angeheftet: true,
    tagesgedanke: 'an',
    notizen: [
      {
        alter: 200,
        text: 'Kernidee: Reisen planen, ohne zwischen fünf Apps zu springen. Route, Unterkunft und Notizen an einem Ort. #idee',
      },
      { alter: 150, text: 'Zielgruppe zuerst: Paare, die zwei bis drei Wochen am Stück unterwegs sind. #zielgruppe' },
    ],
    unterlisten: [
      {
        name: 'Monetarisierung',
        notizen: [
          { alter: 248, text: 'Affiliate-Links für Hotels als Einnahmequelle. #geschäftsmodell' },
          {
            alter: 120,
            text: 'Einmalkauf statt Abo? Viele sind abo-müde. Eventuell beides anbieten und schauen, was öfter gewählt wird. #geschäftsmodell #frage',
          },
          { alter: 40, text: 'Premium-Funktion: Offline-Karten für ganze Regionen. #geschäftsmodell #idee' },
          { alter: 0, text: '[ ] Preise der Konkurrenz vergleichen', faellig: [5, '18:00'] },
        ],
      },
      {
        name: 'Features',
        notizen: [
          { alter: 90, text: 'Packliste, die sich nach Wetter und Reisedauer richtet. #idee' },
          { alter: 75, text: 'Gemeinsame Planung: Beide sehen Änderungen sofort. #idee' },
          {
            alter: 60,
            text: [
              'Tagesansicht',
              'Morgens eine einzige Seite: Was steht heute an, wie komme ich hin, was brauche ich dafür?',
              'Keine Listen mit zwanzig Punkten. Drei Dinge, die den Tag ausmachen, und der Rest tritt zurück.',
              'Abends dieselbe Seite rückwärts: Was war gut, was würde ich wieder so machen?',
              'Daraus entsteht nebenbei ein Reisetagebuch, ohne dass man es „führen“ muss. #idee',
            ].join('\n'),
          },
          { alter: 3, text: '[ ] Skizze für den Startbildschirm zeichnen', faellig: [1] },
          { alter: 20, text: '[x] Fünf Reise-Apps installieren und ausprobieren' },
        ],
      },
      {
        name: 'Namensideen',
        tagesgedanke: 'aus',
        notizen: [
          { alter: 30, text: 'Wegweiser' },
          { alter: 30, text: 'Kofferfrei' },
          { alter: 29, text: 'Zweiwochen' },
        ],
      },
    ],
  },
  {
    name: 'Lesen',
    angeheftet: true,
    notizen: [
      { alter: 14, text: 'Als Nächstes: ein Buch über Gewohnheiten, danach etwas Leichtes.' },
      { alter: 10, text: '[ ] Bibliotheksausweis verlängern', faellig: [-2] },
    ],
    unterlisten: [
      {
        name: 'Zitate',
        tagesgedanke: 'an',
        notizen: [
          { alter: 80, text: 'Ein Plan ist nur so gut wie der erste Schritt, den man heute wirklich geht. #zitat' },
          { alter: 55, text: 'Was man aufschreibt, muss man nicht mehr im Kopf festhalten. #zitat' },
          { alter: 21, text: 'Lieber eine kleine Sache fertig als drei große angefangen. #zitat #fokus' },
        ],
      },
    ],
  },
  {
    name: 'Ideen',
    tagesgedanke: 'an',
    notizen: [
      { alter: 400, text: 'Alte Idee vom letzten Jahr: ein Tauschregal im Hausflur. #idee' },
      {
        alter: 35,
        text: 'Notizen sollten sich wie ein Gespräch mit dem eigenen Kopf anfühlen: kurz, ehrlich, ohne Format-Zwang. #idee',
      },
      {
        alter: 8,
        text: 'Wöchentlicher Rückblick am Sonntagabend: Was hat Energie gegeben, was hat sie gekostet? #gewohnheit #idee',
      },
    ],
  },
  {
    name: 'Haushalt',
    notizen: [
      { alter: 5, text: '[ ] Zählerstand ablesen', faellig: [0] },
      { alter: 12, text: '[ ] Rauchmelder testen' },
      { alter: 45, text: 'Filter der Dunstabzugshaube: 57 × 47 cm.' },
    ],
  },
  {
    name: 'Lernen',
    notizen: [],
    unterlisten: [
      {
        name: 'Git',
        notizen: [
          { alter: 18, text: 'commit = Zwischenstand speichern.\npush = Zwischenstand hochladen. #git' },
          { alter: 2, text: '[ ] Übung: einen Branch anlegen und wieder zusammenführen #git' },
        ],
      },
    ],
  },
];

const EINGANG: BeispielNotiz[] = [
  { alter: 1, text: 'Podcast-Empfehlung von gestern nachhören' },
  { alter: 0, text: '[ ] Geschenk für Samstag besorgen', faellig: [3] },
];

export function beispieldaten(
  jetzt: Date,
  neueId: () => string,
  startPosition: number,
  eingangPosition: number,
): { listen: Liste[]; notizen: Notiz[] } {
  const listen: Liste[] = [];
  const notizen: Notiz[] = [];
  const heute = lokalesDatum(jetzt);
  const stempel = jetztStempel(jetzt);

  const fuegeNotizenEin = (liste_id: string, vorlagen: BeispielNotiz[], abPosition: number) => {
    vorlagen.forEach((vorlage, i) => {
      const erstellt = jetztStempel(new Date(jetzt.getTime() - vorlage.alter * 24 * 60 * 60 * 1000));
      const [notiz] = erzeugeNotizen(vorlage.text, liste_id, abPosition + i, null, { jetzt: erstellt, neueId });
      if (notiz.aufgabe && vorlage.faellig) {
        const [tage, uhrzeit] = vorlage.faellig;
        const datum = verschiebeDatum(heute, tage);
        notiz.aufgabe.faellig = uhrzeit ? `${datum}T${uhrzeit}` : datum;
      }
      notizen.push(notiz);
    });
  };

  const fuegeListeEin = (vorlage: BeispielListe, eltern_id: string | null, position: number) => {
    const liste: Liste = {
      id: neueId(),
      name: vorlage.name,
      eltern_id,
      angeheftet: vorlage.angeheftet ?? false,
      tagesgedanke: vorlage.tagesgedanke ?? 'erben',
      position,
      erstellt: stempel,
      geaendert: stempel,
      geloescht: null,
    };
    listen.push(liste);
    fuegeNotizenEin(liste.id, vorlage.notizen, 0);
    (vorlage.unterlisten ?? []).forEach((unterliste, i) => fuegeListeEin(unterliste, liste.id, i + 1));
  };

  LISTEN.forEach((vorlage, i) => fuegeListeEin(vorlage, null, startPosition + i));
  // Im Eingang hinter das stellen, was dort schon steht.
  fuegeNotizenEin(EINGANG_ID, EINGANG, eingangPosition);

  return { listen, notizen };
}

/**
 * Findet die Beispieldaten wieder – für die Frage beim ersten Verbinden mit Drive,
 * ob sie gelöscht werden sollen. Erkannt wird am genauen Wortlaut:
 *  - Notizen, deren Text exakt einer Beispielnotiz entspricht
 *  - Listen mit dem Namen einer Beispielliste, die nur Beispielnotizen und Beispiel-Unterlisten
 *    enthalten (und mindestens eines davon). Wer in eine Beispielliste Eigenes geschrieben hat,
 *    behält die Liste; nur die Beispielnotizen darin werden gefunden.
 */
export function findeBeispieldaten(
  listen: Iterable<Liste>,
  notizen: Iterable<Notiz>,
): { listenIds: string[]; notizIds: string[] } {
  const texte = new Set<string>();
  const namen = new Set<string>();
  const sammle = (vorlage: BeispielListe) => {
    namen.add(vorlage.name);
    for (const n of vorlage.notizen) texte.add(leseAufgabenPraefix(n.text).text);
    for (const u of vorlage.unterlisten ?? []) sammle(u);
  };
  LISTEN.forEach(sammle);
  for (const n of EINGANG) texte.add(leseAufgabenPraefix(n.text).text);

  const alleNotizen = [...notizen];
  const alleListen = [...listen];
  const beispielNotizen = new Set(alleNotizen.filter((n) => texte.has(n.text)).map((n) => n.id));

  // Zuerst alle Listen mit passendem Namen und ohne eigene Notizen; dann so lange aussieben,
  // bis jede übrige Liste nur noch Beispiel-Unterlisten hat.
  const kandidaten = new Set(
    alleListen
      .filter((l) => l.id !== EINGANG_ID && namen.has(l.name))
      .filter((l) => alleNotizen.every((n) => n.liste_id !== l.id || beispielNotizen.has(n.id)))
      .map((l) => l.id),
  );
  for (let geaendert = true; geaendert; ) {
    geaendert = false;
    for (const liste of alleListen) {
      if (!kandidaten.has(liste.id)) continue;
      const kinder = alleListen.filter((k) => k.eltern_id === liste.id);
      const hatInhalt = kinder.length > 0 || alleNotizen.some((n) => n.liste_id === liste.id);
      if (!hatInhalt || kinder.some((k) => !kandidaten.has(k.id))) {
        kandidaten.delete(liste.id);
        geaendert = true;
      }
    }
  }
  return { listenIds: [...kandidaten], notizIds: [...beispielNotizen] };
}
