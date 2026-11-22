/**
 * Monatsansicht des Tagebuchs (KONZEPT.md, Abschnitt 13.6): Monatsname, Durchschnitt,
 * Kalenderraster mit den Tagen nach Bewertung eingefärbt, darunter bester Tag, Zahlen und Tags.
 */
import { useMemo } from 'react';
import { useZustand } from '../db/speicher';
import {
  BEWERTUNG_WORTE,
  ersterWochentag,
  monatVon,
  monatsName,
  monatsuebersicht,
  tagKurz,
  tagebuchTagVon,
  verschiebeMonat,
} from '../logik/tagebuch';
import { lokalJetzt } from '../logik/zeit';
import { Kopfzeile, klassen } from './Bausteine';
import { adresse, gehe } from './router';
import { PfeilZurueck, Winkel } from './Symbole';
import { useTagebuchRaum } from './TagebuchSeite';

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** „Sport 14/20 Tage“ – aktive Gewohnheiten und inaktive, die in diesem Monat noch abgehakt wurden. */
function GewohnheitenImMonat({ anzahl, bisher }: { anzahl: Map<string, number>; bisher: number }) {
  const z = useZustand();
  const reihe = [...z.gewohnheiten.values()]
    .filter((g) => !g.geloescht && (g.aktiv || (anzahl.get(g.id) ?? 0) > 0))
    .sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1));
  if (reihe.length === 0) return null;
  return (
    <section className="tb-gewohnheiten-monat">
      <div className="etikett">Gewohnheiten</div>
      {reihe.map((g) => {
        const n = anzahl.get(g.id) ?? 0;
        return (
          <div key={g.id} className="tb-gewohnheit-zeile">
            <span>{g.name}</span>
            <span className="tb-gewohnheit-balken" aria-hidden="true">
              <span style={{ width: `${bisher ? Math.min(100, (n / bisher) * 100) : 0}%` }} />
            </span>
            <span className="mono meta">
              {n}/{bisher} Tage
            </span>
          </div>
        );
      })}
    </section>
  );
}

export function TagebuchMonat({ monat: gewaehlt }: { monat?: string }) {
  useTagebuchRaum();
  const z = useZustand();
  const heute = tagebuchTagVon(lokalJetzt());
  const aktuell = monatVon(heute);
  const monat = gewaehlt && gewaehlt <= aktuell ? gewaehlt : aktuell;
  const m = useMemo(() => monatsuebersicht(monat, z.notizen.values(), z.tagebuchtage.values()), [z, monat]);

  const bisher = m.tage.filter((t) => t.datum <= heute).length;
  const zeige = (ziel: string) => gehe({ seite: 'tagebuchmonat', monat: ziel === aktuell ? undefined : ziel });

  return (
    <div className="seite tagebuch">
      <Kopfzeile zurueck={{ seite: 'tagebuch' }} titel={<span className="mono tb-nav-text">Tagebuch</span>} />

      <div className="tb-monatskopf">
        <div>
          <h1 className="tb-monatsname">{monatsName(monat)}</h1>
          <span className="mono meta">
            {m.durchschnitt !== null
              ? `Ø ${String(m.durchschnitt).replace('.', ',')} · ${BEWERTUNG_WORTE[Math.round(m.durchschnitt) as 1 | 2 | 3 | 4 | 5]}`
              : 'noch keine Bewertung'}
          </span>
        </div>
        <nav className="tb-nav" aria-label="Monat wechseln">
          <button className="symbolknopf" onClick={() => zeige(verschiebeMonat(monat, -1))} aria-label="Vorheriger Monat" title="Vorheriger Monat">
            <PfeilZurueck />
          </button>
          <button
            className="symbolknopf"
            onClick={() => zeige(verschiebeMonat(monat, 1))}
            disabled={monat >= aktuell}
            aria-label="Nächster Monat"
            title="Nächster Monat"
          >
            <Winkel />
          </button>
        </nav>
      </div>

      <div className="tb-raster" role="grid" aria-label={`Kalender ${monatsName(monat)}`}>
        {WOCHENTAGE.map((w) => (
          <span key={w} className="tb-raster-kopf mono">
            {w}
          </span>
        ))}
        {Array.from({ length: ersterWochentag(monat) }, (_, i) => (
          <span key={`leer${i}`} />
        ))}
        {m.tage.map((t) => {
          const zahl = Number(t.datum.slice(8));
          const zukunft = t.datum > heute;
          const klasse = klassen(
            'tb-zelle',
            t.bewertung ? `stufe-${t.bewertung}` : t.geschrieben ? 'geschrieben' : 'leer',
            t.datum === heute && 'heute',
            zukunft && 'zukunft',
          );
          const beschriftung = `${tagKurz(t.datum)}${t.bewertung ? ` · ${BEWERTUNG_WORTE[t.bewertung]}` : t.geschrieben ? ' · geschrieben' : ''}`;
          return zukunft ? (
            <span key={t.datum} className={klasse} aria-label={beschriftung}>
              {zahl}
            </span>
          ) : (
            <a key={t.datum} className={klasse} href={adresse({ seite: 'tagebuch', datum: t.datum })} aria-label={beschriftung} title={beschriftung}>
              {zahl}
            </a>
          );
        })}
      </div>

      {m.besterTag && (
        <a className="tb-bester" href={adresse({ seite: 'tagebuch', datum: m.besterTag.datum })}>
          <span className="etikett">Bester Tag</span>
          <span className="tb-bester-titel">{m.besterTag.titel || tagKurz(m.besterTag.datum)}</span>
          <span className="mono meta">
            {m.besterTag.titel && `${tagKurz(m.besterTag.datum)} · `}
            {BEWERTUNG_WORTE[m.besterTag.bewertung]}
          </span>
        </a>
      )}

      <div className="tb-zahlen">
        <div>
          <span className="tb-zahl">{m.geschrieben}</span>
          <span className="mono meta">von {bisher} Tagen geschrieben</span>
        </div>
        <div>
          <span className="tb-zahl">{m.erledigt}</span>
          <span className="mono meta">Aufgaben erledigt</span>
        </div>
        <div>
          <span className="tb-zahl">{m.neueGedanken}</span>
          <span className="mono meta">neue Gedanken</span>
        </div>
      </div>

      <GewohnheitenImMonat anzahl={m.gewohnheiten} bisher={bisher} />

      {m.tags.length > 0 && (
        <section>
          <div className="etikett">Häufigste Tags</div>
          <div className="tb-tags">
            {m.tags.map((t) => (
              <span key={t.tag} className="tb-tagchip">
                #{t.tag} <span className="mono meta">{t.anzahl}</span>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
