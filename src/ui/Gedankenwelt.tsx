/** Gedankenwelt: alle Listen als Kacheln, angeheftete oben. */
import { useMemo, useState } from 'react';
import { erstelleListe } from '../db/aktionen';
import { useZustand, type Zustand } from '../db/speicher';
import { kinderVon, mitNachfahren, pfadVon } from '../logik/listen';
import type { Liste } from '../modell/typen';
import { EingabeDialog, Kopfzeile } from './Bausteine';
import { adresse, gehe } from './router';
import { Plus } from './Symbole';

/** Zählt je Liste die aktiven Notizen – einschließlich aller Unterlisten. */
export function useNotizAnzahl(): (liste_id: string) => number {
  const z = useZustand();
  return useMemo(() => {
    const direkt = new Map<string, number>();
    for (const n of z.notizen.values()) if (!n.geloescht) direkt.set(n.liste_id, (direkt.get(n.liste_id) ?? 0) + 1);
    const gesamt = new Map<string, number>();
    return (liste_id: string) => {
      let summe = gesamt.get(liste_id);
      if (summe === undefined) {
        summe = 0;
        for (const id of mitNachfahren(liste_id, z.listen)) {
          if (!z.listen.get(id)?.geloescht) summe += direkt.get(id) ?? 0;
        }
        gesamt.set(liste_id, summe);
      }
      return summe;
    };
  }, [z]);
}

export function anzahlText(anzahl: number): string {
  return anzahl === 1 ? '1 Notiz' : `${anzahl} Notizen`;
}

/** Kleine Kachel: Name und Anzahl. */
export function ListenKachel({ liste, anzahl }: { liste: Liste; anzahl: number }) {
  return (
    <a className="kachel" href={adresse({ seite: 'liste', id: liste.id })}>
      <span className="kachel-name">{liste.name}</span>
      <span className="mono meta">{anzahlText(anzahl)}</span>
    </a>
  );
}

function AngeheftetKachel({ liste, z, anzahl }: { liste: Liste; z: Zustand; anzahl: (id: string) => number }) {
  const unterlisten = kinderVon(liste.id, z.listen);
  const eltern = pfadVon(liste.id, z.listen)
    .slice(0, -1)
    .map((l) => l.name)
    .join(' › ');
  return (
    <div className="kachel gross">
      <a className="kachel-kopf" href={adresse({ seite: 'liste', id: liste.id })}>
        <span className="kachel-name">
          <span className="punkt blau" />
          {liste.name}
        </span>
        <span className="mono meta">
          {eltern && `${eltern} · `}
          {anzahlText(anzahl(liste.id))}
        </span>
      </a>
      {unterlisten.length > 0 && (
        <div className="unterkacheln">
          {unterlisten.map((u) => (
            <a key={u.id} className="unterkachel" href={adresse({ seite: 'liste', id: u.id })}>
              {u.name}
              <span className="mono meta">{anzahl(u.id)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function Gedankenwelt() {
  const z = useZustand();
  const anzahl = useNotizAnzahl();
  const [neu, setNeu] = useState(false);

  const angeheftet = [...z.listen.values()]
    .filter((l) => l.angeheftet && !l.geloescht)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name, 'de'));
  const uebrige = kinderVon(null, z.listen).filter((l) => !l.angeheftet);

  return (
    <div className="seite">
      <Kopfzeile
        zurueck={{ seite: 'start' }}
        titel={<h1>Gedankenwelt</h1>}
        rechts={
          <button className="knopf mit-symbol" onClick={() => setNeu(true)}>
            <Plus /> Liste
          </button>
        }
      />

      {angeheftet.length > 0 && (
        <section>
          <div className="etikett blau">Angeheftet</div>
          <div className="kacheln gross">
            {angeheftet.map((liste) => (
              <AngeheftetKachel key={liste.id} liste={liste} z={z} anzahl={anzahl} />
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="etikett">{angeheftet.length > 0 ? 'Alle Listen' : 'Listen'}</div>
        <div className="kacheln">
          {uebrige.map((liste) => (
            <ListenKachel key={liste.id} liste={liste} anzahl={anzahl(liste.id)} />
          ))}
        </div>
      </section>

      {neu && (
        <EingabeDialog
          titel="Neue Liste"
          platzhalter="Name der Liste"
          knopf="Anlegen"
          onFertig={(name) => {
            setNeu(false);
            const liste = name ? erstelleListe(name, null) : null;
            if (liste) gehe({ seite: 'liste', id: liste.id });
          }}
        />
      )}
    </div>
  );
}
