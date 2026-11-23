/** Startseite: Datum, Suche, Gedanke des Tages, To-dos, großer Gedankenwelt-Knopf. */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { erstelleNotizen, gedankeDesTages } from '../db/aktionen';
import { suchindex, useZustand } from '../db/speicher';
import {
  abstandText,
  dringlichkeitsstufe,
  gruppiereAufgaben,
  kalenderblatt,
  offeneAufgaben,
} from '../logik/aufgaben';
import { kinderVon, pfadText } from '../logik/listen';
import {
  BEWERTUNG_WORTE,
  herkunftText,
  notizenDesTages,
  tagKurz,
  tagZuDatum,
  tagebuchTagVon,
  vorEinemJahr,
} from '../logik/tagebuch';
import { LEERER_FILTER, filterAktiv, type SuchFilter, type Treffer } from '../logik/suche';
import { tagHaeufigkeit } from '../logik/tags';
import { faelligUhrzeit, formatFaellig, formatKopfdatum, formatStempel, lokalJetzt, lokalesDatum } from '../logik/zeit';
import { EINGANG_ID, TAGEBUCH_ID, type Notiz } from '../modell/typen';
import { AbgleichSymbol } from './AbgleichSymbol';
import { Segment, klassen, useListenBaum } from './Bausteine';
import { WiederholungsHinweis } from './FaelligAnzeige';
import { PrioStandHinweis } from './PrioStand';
import { MarkdownAnzeige } from './MarkdownAnzeige';
import { hakeAbMitMeldung } from './meldung';
import { adresse } from './router';
import { Haken, Kreuz, Lupe, PfeilRechts, Plus, Trichter, Zahnrad } from './Symbole';
import { zuletztGeoeffnet } from './zuletzt';

/** Suchtext und Filter bleiben erhalten, wenn man einen Treffer öffnet und zurückkommt. */
let gemerkteSuche: { anfrage: string; filter: SuchFilter; filterOffen: boolean } = {
  anfrage: '',
  filter: LEERER_FILTER,
  filterOffen: false,
};

export function Start() {
  const z = useZustand();
  const [suche, setSucheIntern] = useState(gemerkteSuche);
  const setSuche = (teil: Partial<typeof gemerkteSuche>) => {
    gemerkteSuche = { ...gemerkteSuche, ...teil };
    setSucheIntern(gemerkteSuche);
  };
  const { anfrage, filter, filterOffen } = suche;
  const sucht = anfrage.trim() !== '' || filterAktiv(filter);

  const treffer = useMemo(
    () => (sucht ? suchindex.suche(anfrage, filter, z.listen, 60) : []),
    [sucht, anfrage, filter, z],
  );

  return (
    <div className="seite">
      <header className="startkopf">
        <span className="mono">{formatKopfdatum()}</span>
        <span className="startkopf-rechts">
          <AbgleichSymbol />
          <a className="symbolknopf" href={adresse({ seite: 'einstellungen' })} aria-label="Einstellungen">
            <Zahnrad />
          </a>
        </span>
      </header>

      <div className="suchfeld">
        <Lupe />
        <input
          type="search"
          placeholder="Suchen …"
          aria-label="Notizen durchsuchen"
          value={anfrage}
          onChange={(e) => setSuche({ anfrage: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSuche({ anfrage: '', filter: LEERER_FILTER, filterOffen: false });
          }}
        />
        {sucht && (
          <button
            className="symbolknopf klein"
            aria-label="Suche leeren"
            onClick={() => setSuche({ anfrage: '', filter: LEERER_FILTER })}
          >
            <Kreuz />
          </button>
        )}
        <button
          className={klassen('symbolknopf klein', (filterOffen || filterAktiv(filter)) && 'aktiv')}
          aria-label="Filter"
          aria-expanded={filterOffen}
          onClick={() => setSuche({ filterOffen: !filterOffen })}
        >
          <Trichter />
        </button>
      </div>

      {filterOffen && <FilterLeiste filter={filter} setFilter={(f) => setSuche({ filter: f })} />}

      {sucht ? (
        <Trefferliste treffer={treffer} />
      ) : (
        <>
          <TagesgedankeKarte />
          <TodoBox />
          <TagebuchKarte />
          <WeltKnopf />
        </>
      )}
    </div>
  );
}

// ───────────────────────── Suche ─────────────────────────

function FilterLeiste({ filter, setFilter }: { filter: SuchFilter; setFilter: (f: SuchFilter) => void }) {
  const z = useZustand();
  const baum = useListenBaum();
  const tags = useMemo(() => tagHaeufigkeit(z.notizen.values()).slice(0, 16), [z]);
  const setze = (teil: Partial<SuchFilter>) => setFilter({ ...filter, ...teil });

  return (
    <div className="filter">
      <label className="filter-zeile">
        <span className="etikett">Liste</span>
        <select value={filter.liste_id ?? ''} onChange={(e) => setze({ liste_id: e.target.value || null })}>
          <option value="">Alle Listen</option>
          {baum.map(({ liste, tiefe }) => (
            <option key={liste.id} value={liste.id}>
              {'  '.repeat(tiefe) + liste.name}
            </option>
          ))}
        </select>
      </label>

      {tags.length > 0 && (
        <div className="filter-zeile">
          <span className="etikett">Tags</span>
          <div className="chips">
            {tags.map(({ tag }) => {
              const an = filter.tags.includes(tag);
              return (
                <button
                  key={tag}
                  className={klassen('chip', an && 'an')}
                  aria-pressed={an}
                  onClick={() => setze({ tags: an ? filter.tags.filter((t) => t !== tag) : [...filter.tags, tag] })}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="filter-zeile">
        <span className="etikett">Datum</span>
        <div className="datumsfilter">
          <select
            value={filter.datumFeld}
            aria-label="Welches Datum"
            onChange={(e) => setze({ datumFeld: e.target.value as SuchFilter['datumFeld'] })}
          >
            <option value="erstellt">erstellt</option>
            <option value="geaendert">geändert</option>
          </select>
          <input
            type="date"
            aria-label="von"
            value={filter.von ?? ''}
            onChange={(e) => setze({ von: e.target.value || null })}
          />
          <span className="gedaempft">bis</span>
          <input
            type="date"
            aria-label="bis"
            value={filter.bis ?? ''}
            onChange={(e) => setze({ bis: e.target.value || null })}
          />
        </div>
      </div>

      <div className="filter-zeile">
        <span className="etikett">Aufgaben</span>
        <Segment
          wert={filter.aufgaben}
          onWahl={(aufgaben) => setze({ aufgaben })}
          optionen={[
            { wert: 'alle', text: 'Alle' },
            { wert: 'offen', text: 'Offen' },
            { wert: 'erledigt', text: 'Erledigt' },
            { wert: 'keine', text: 'Keine Aufgabe' },
          ]}
        />
      </div>

      <div className="filter-zeile">
        <span className="etikett">Tagebuch</span>
        <Segment
          wert={filter.tagebuch}
          onWahl={(tagebuch) => setze({ tagebuch })}
          optionen={[
            { wert: 'ein', text: 'Mit' },
            { wert: 'aus', text: 'Ohne' },
            { wert: 'nur', text: 'Nur Tagebuch' },
          ]}
        />
      </div>

      {filterAktiv(filter) && (
        <button className="textknopf" onClick={() => setFilter(LEERER_FILTER)}>
          Filter zurücksetzen
        </button>
      )}
    </div>
  );
}

function Trefferliste({ treffer }: { treffer: Treffer[] }) {
  const z = useZustand();
  const heute = lokalesDatum();
  if (treffer.length === 0) return <p className="hinweis leer">Nichts gefunden.</p>;
  return (
    <div className="trefferliste">
      <div className="etikett">
        {treffer.length === 60 ? 'Die ersten 60 Treffer' : `${treffer.length} Treffer`}
      </div>
      {treffer.map(({ notiz, terme }) => (
        <a key={notiz.id} className="treffer" href={adresse({ seite: 'liste', id: notiz.liste_id, notiz: notiz.id })}>
          <div className="treffer-zeile">
            {notiz.aufgabe && <span className={klassen('minikasten', notiz.aufgabe.erledigt && 'an')} />}
            <div className={klassen('treffer-text', notiz.aufgabe?.erledigt && 'erledigt')}>
              <MarkdownAnzeige text={notiz.text} terme={terme} ohneLinks />
            </div>
          </div>
          <div className="mono meta">
            {herkunftText(notiz, z.listen, z.tagebuchtage.values())}
            {/* Im Tagebuch steht das Datum schon in der Herkunft. */}
            {!notiz.tagebuch_tag && ` · ${formatStempel(notiz.erstellt, heute)}`}
          </div>
        </a>
      ))}
    </div>
  );
}

// ───────────────────────── Gedanke des Tages ─────────────────────────

function TagesgedankeKarte() {
  const z = useZustand();
  // Die Auswahl wird beim ersten Mal am Tag gemerkt und bleibt dann gleich.
  const notiz = useMemo(() => gedankeDesTages(), [z]);
  const [offen, setOffen] = useState(false);
  const [zuLang, setZuLang] = useState(false);
  const text = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = text.current;
    if (el && !offen) setZuLang(el.scrollHeight > el.clientHeight + 1);
  }, [notiz?.id, notiz?.text, offen]);

  if (!notiz) {
    return (
      <section className="karte gedanke">
        <div className="etikett violett">Gedanke des Tages</div>
        <p className="hinweis">
          Noch keine Liste ausgewählt. Öffne eine Liste und stelle im Menü „Gedanke des Tages“ auf „An“.
        </p>
      </section>
    );
  }

  return (
    <section className="karte gedanke">
      <div className="etikett violett">Gedanke des Tages</div>
      <div ref={text} className={klassen('gedanke-text', !offen && 'gekuerzt')}>
        <MarkdownAnzeige text={notiz.text} />
      </div>
      {(zuLang || offen) && (
        <button className="textknopf" onClick={() => setOffen(!offen)}>
          {offen ? 'Weniger' : 'Weiterlesen'}
        </button>
      )}
      <a className="mono meta herkunft" href={adresse({ seite: 'liste', id: notiz.liste_id, notiz: notiz.id })}>
        {pfadText(notiz.liste_id, z.listen)} · {formatStempel(notiz.erstellt)}
      </a>
    </section>
  );
}

// ───────────────────────── To-dos ─────────────────────────

/**
 * Eine offene Aufgabe als Kästchen im Raster (Design „Planer“): ganz in der Farbe der
 * Dringlichkeit getönt, oben links das Kalenderblatt (nur mit Datum), daneben der Titel und
 * rechts das Abhak-Kästchen; darunter Abstand („morgen“), Priorität, Stand, Wiederholung und
 * Herkunft. Ohne `herkunft` steht dort der Listenname.
 */
export function AufgabenZeile({ notiz, heute, herkunft }: { notiz: Notiz; heute: string; herkunft?: string }) {
  const z = useZustand();
  const aufgabe = notiz.aufgabe;
  const faellig = aufgabe?.faellig ?? null;
  const blatt = faellig ? kalenderblatt(faellig, heute) : null;
  const uhrzeit = faellig ? faelligUhrzeit(faellig) : null;
  const woher = herkunft ?? z.listen.get(notiz.liste_id)?.name;
  return (
    <div className={klassen('aufgabenkachel', `stufe-${dringlichkeitsstufe(faellig, heute)}`, !blatt && 'ohne-blatt')}>
      {faellig && blatt && (
        <span className="kalenderblatt" title={formatFaellig(faellig, heute)}>
          <span className="blatt-oben">{blatt.oben}</span>
          <span className="blatt-zahl">{blatt.zahl}</span>
        </span>
      )}
      <a className="aufgabentext" href={adresse({ seite: 'liste', id: notiz.liste_id, notiz: notiz.id })}>
        <MarkdownAnzeige text={notiz.text} einzeilig ohneLinks />
      </a>
      <button
        className="kaestchen"
        role="checkbox"
        aria-checked={false}
        aria-label="Abhaken"
        onClick={() => hakeAbMitMeldung(notiz.id, true)}
      >
        <Haken />
      </button>
      <span className="aufgabeninfo">
        {faellig && (
          <span className="abstand">
            {abstandText(faellig, heute)}
            {uhrzeit && ` · ${uhrzeit}`}
          </span>
        )}
        {aufgabe && <PrioStandHinweis aufgabe={aufgabe} />}
        {aufgabe && <WiederholungsHinweis aufgabe={aufgabe} />}
        {woher && <span className="herkunftstext">{woher}</span>}
      </span>
    </div>
  );
}

function TodoBox() {
  const z = useZustand();
  const heute = lokalesDatum();
  const offen = useMemo(() => offeneAufgaben(z.notizen.values()), [z]);
  const gruppen = gruppiereAufgaben(offen, heute);
  const [neu, setNeu] = useState<string | null>(null);

  const lege = () => {
    if (neu?.trim()) erstelleNotizen(EINGANG_ID, neu.replace(/\n+/g, ' '), { alsAufgabe: true });
    setNeu('');
  };

  return (
    <section className="karte">
      <div className="kartenkopf">
        <span className="etikett tuerkis">To-dos</span>
        {offen.length === 0 ? (
          <span className="mono meta">nichts offen</span>
        ) : (
          <span className="zaehlchips">
            {gruppen.ueberfaellig.length > 0 && (
              <a className="zaehlchip ueberfaellig" href={adresse({ seite: 'aufgaben', filter: 'ueberfaellig' })}>
                {gruppen.ueberfaellig.length} überfällig
              </a>
            )}
            {gruppen.heute.length > 0 && (
              <a className="zaehlchip heute" href={adresse({ seite: 'aufgaben', filter: 'heute' })}>
                {gruppen.heute.length} heute
              </a>
            )}
            <a className="zaehlchip" href={adresse({ seite: 'aufgaben' })}>
              {offen.length} offen
            </a>
          </span>
        )}
      </div>

      <div className="aufgabenraster">
        {offen.slice(0, 6).map((notiz) => (
          <AufgabenZeile key={notiz.id} notiz={notiz} heute={heute} />
        ))}
      </div>

      {neu !== null && (
        <form
          className="aufgabe-neu-kachel"
          onSubmit={(e) => {
            e.preventDefault();
            lege();
          }}
        >
          <input
            className="aufgabe-neu"
            autoFocus
            placeholder="Neue Aufgabe im Eingang – Enter zum Anlegen"
            value={neu}
            onChange={(e) => setNeu(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setNeu(null);
            }}
            onBlur={() => {
              if (!neu.trim()) setNeu(null);
            }}
          />
        </form>
      )}

      <div className="kartenfuss">
        <button className="textknopf mit-symbol" onClick={() => setNeu(neu === null ? '' : neu)}>
          <Plus /> Neu
        </button>
        <a className="textknopf" href={adresse({ seite: 'aufgaben' })}>
          Alle anzeigen
        </a>
      </div>
    </section>
  );
}

// ───────────────────────── Tagebuch ─────────────────────────

/** Karte in den Tagebuch-Farben (KONZEPT.md, Abschnitt 13.6): der heutige Tag auf einen Blick. */
function TagebuchKarte() {
  const z = useZustand();
  const heute = tagebuchTagVon(lokalJetzt());
  const tag = tagZuDatum(z.tagebuchtage.values(), heute);
  const ersterAbsatz = useMemo(() => notizenDesTages(z.notizen.values(), heute)[0], [z, heute]);
  const damals = useMemo(() => vorEinemJahr(heute, z.notizen.values(), z.tagebuchtage.values()), [z, heute]);
  const bewertung = tag?.bewertung ?? null;

  return (
    <a className="karte tb-karte" href={adresse({ seite: 'tagebuch' })}>
      <div className="kartenkopf">
        <span className="etikett tb-etikett">Tagebuch</span>
        <span
          className="tb-punkte"
          aria-label={bewertung ? `Bewertung: ${BEWERTUNG_WORTE[bewertung]}` : 'noch nicht bewertet'}
          data-wert={bewertung ?? 0}
        >
          {[1, 2, 3, 4, 5].map((stufe) => (
            <span key={stufe} className={klassen('tb-punkt-stufe', bewertung !== null && stufe <= bewertung && 'an')} />
          ))}
        </span>
      </div>
      {tag?.titel ? (
        <div className="tb-karte-titel">{tag.titel}</div>
      ) : ersterAbsatz ? (
        <div className="tb-karte-text">
          <MarkdownAnzeige text={ersterAbsatz.text} einzeilig ohneLinks />
        </div>
      ) : (
        <div className="tb-karte-leer">Was war heute?</div>
      )}
      {damals && (
        <div className="mono meta tb-karte-damals">
          Vor einem Jahr · {tagKurz(damals.datum)}
          {damals.titel ? `: ${damals.titel}` : ''}
        </div>
      )}
    </a>
  );
}

// ───────────────────────── Gedankenwelt-Knopf ─────────────────────────

function WeltKnopf() {
  const z = useZustand();
  const untertitel = useMemo(() => {
    const anzahl = [...z.listen.values()].filter((l) => !l.geloescht && l.id !== TAGEBUCH_ID).length;
    let zuletzt = z.listen.get(zuletztGeoeffnet() ?? '');
    if (!zuletzt || zuletzt.geloescht) {
      // Ersatz: die Liste mit der zuletzt geänderten Notiz
      let neueste: Notiz | undefined;
      for (const n of z.notizen.values()) if (!n.geloescht && (!neueste || n.geaendert > neueste.geaendert)) neueste = n;
      zuletzt = neueste ? z.listen.get(neueste.liste_id) : undefined;
    }
    const listenText = anzahl === 1 ? '1 Liste' : `${anzahl} Listen`;
    return zuletzt ? `${listenText} · zuletzt: ${zuletzt.name}` : listenText;
  }, [z]);

  const leer = kinderVon(null, z.listen).length <= 1 && z.notizen.size === 0;

  return (
    <>
      <a className="weltknopf" href={adresse({ seite: 'welt' })}>
        <span>
          <span className="weltknopf-titel">Gedankenwelt</span>
          <span className="weltknopf-unter mono">{untertitel}</span>
        </span>
        <PfeilRechts />
      </a>
      {leer && (
        <p className="hinweis leer">
          Noch alles leer. In den <a href={adresse({ seite: 'einstellungen' })}>Einstellungen</a> kannst du
          Beispieldaten laden.
        </p>
      )}
    </>
  );
}
