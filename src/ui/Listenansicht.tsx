/** Eine geöffnete Liste: Pfad, Unterlisten als Kacheln, darunter der Schreibbereich. */
import { useEffect, useState } from 'react';
import {
  benenneListeUm,
  darfVerschieben,
  erstelleListe,
  loescheListe,
  setzeAngeheftet,
  setzeTagesgedanke,
  verschiebeListe,
} from '../db/aktionen';
import { useZustand } from '../db/speicher';
import { kinderVon, mitNachfahren, pfadVon, tagesgedankeAktiv } from '../logik/listen';
import { EINGANG_ID, type Liste } from '../modell/typen';
import { EingabeDialog, Kopfzeile, ListenWahlDialog, Menue, Segment } from './Bausteine';
import { ListenKachel, useNotizAnzahl } from './Gedankenwelt';
import { adresse, gehe, type Route } from './router';
import { Schreibbereich } from './Schreibbereich';
import { Korb, Nadel, OrdnerPfeil, Plus, Punkte, Stift } from './Symbole';
import { merkeZuletzt } from './zuletzt';

type Dialog = 'umbenennen' | 'unterliste' | 'verschieben' | null;

export function Listenansicht({ id, notiz }: { id: string; notiz?: string }) {
  const z = useZustand();
  const anzahl = useNotizAnzahl();
  const [dialog, setDialog] = useState<Dialog>(null);
  const liste = z.listen.get(id);

  useEffect(() => {
    if (liste && !liste.geloescht) merkeZuletzt(id);
    if (!notiz) window.scrollTo(0, 0);
  }, [id, notiz, liste]);

  if (!liste || liste.geloescht) {
    return (
      <div className="seite">
        <Kopfzeile zurueck={{ seite: 'welt' }} titel={<h1>Liste nicht gefunden</h1>} />
        <p className="hinweis">
          Diese Liste gibt es nicht mehr. Vielleicht liegt sie im{' '}
          <a href={adresse({ seite: 'papierkorb' })}>Papierkorb</a>.
        </p>
      </div>
    );
  }

  const pfad = pfadVon(id, z.listen);
  const eltern = pfad[pfad.length - 2];
  const zurueck: Route = eltern ? { seite: 'liste', id: eltern.id } : { seite: 'welt' };
  const unterlisten = kinderVon(id, z.listen);

  return (
    <div className="seite">
      <Kopfzeile
        zurueck={zurueck}
        titel={
          <nav className="pfad mono" aria-label="Pfad">
            <a href={adresse({ seite: 'welt' })}>Gedankenwelt</a>
            {pfad.slice(0, -1).map((l) => (
              <span key={l.id}>
                {' › '}
                <a href={adresse({ seite: 'liste', id: l.id })}>{l.name}</a>
              </span>
            ))}
          </nav>
        }
        rechts={
          <Menue knopf={<Punkte />} beschriftung="Liste bearbeiten">
            {(schliessen) => (
              <ListenMenue
                liste={liste}
                geerbtAktiv={eltern ? tagesgedankeAktiv(eltern.id, z.listen) : false}
                oeffne={(d) => {
                  schliessen();
                  setDialog(d);
                }}
                onGeloescht={() => gehe(zurueck)}
              />
            )}
          </Menue>
        }
      />

      <h1 className="listentitel">
        {liste.angeheftet && <span className="punkt blau" title="Angeheftet" />}
        {liste.name}
      </h1>

      {unterlisten.length > 0 && (
        <div className="kacheln">
          {unterlisten.map((u) => (
            <ListenKachel key={u.id} liste={u} anzahl={anzahl(u.id)} />
          ))}
        </div>
      )}

      {/* key: Beim Wechsel der Liste beginnt der Schreibbereich frisch. */}
      <Schreibbereich key={id} liste_id={id} hervorheben={notiz} />

      {dialog === 'umbenennen' && (
        <EingabeDialog
          titel="Liste umbenennen"
          startwert={liste.name}
          knopf="Speichern"
          onFertig={(name) => {
            if (name) benenneListeUm(id, name);
            setDialog(null);
          }}
        />
      )}
      {dialog === 'unterliste' && (
        <EingabeDialog
          titel={`Unterliste in „${liste.name}“`}
          platzhalter="Name der Unterliste"
          knopf="Anlegen"
          onFertig={(name) => {
            setDialog(null);
            const neu = name ? erstelleListe(name, id) : null;
            if (neu) gehe({ seite: 'liste', id: neu.id });
          }}
        />
      )}
      {dialog === 'verschieben' && (
        <ListenWahlDialog
          titel={`„${liste.name}“ verschieben nach …`}
          mitOberster={liste.eltern_id !== null}
          gesperrt={new Set([...mitNachfahren(id, z.listen), liste.eltern_id ?? ''])}
          onWahl={(ziel) => {
            if (ziel !== undefined && darfVerschieben(id, ziel)) verschiebeListe(id, ziel);
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}

function ListenMenue({
  liste,
  geerbtAktiv,
  oeffne,
  onGeloescht,
}: {
  liste: Liste;
  geerbtAktiv: boolean;
  oeffne: (dialog: Dialog) => void;
  onGeloescht: () => void;
}) {
  const istEingang = liste.id === EINGANG_ID;
  return (
    <>
      <button className="menue-zeile" onClick={() => oeffne('unterliste')}>
        <Plus /> Unterliste anlegen
      </button>
      {!istEingang && (
        <>
          <button className="menue-zeile" onClick={() => oeffne('umbenennen')}>
            <Stift /> Umbenennen
          </button>
          <button className="menue-zeile" onClick={() => oeffne('verschieben')}>
            <OrdnerPfeil /> Verschieben nach …
          </button>
        </>
      )}
      <button className="menue-zeile" onClick={() => setzeAngeheftet(liste.id, !liste.angeheftet)}>
        <Nadel /> {liste.angeheftet ? 'Nicht mehr anheften' : 'Anheften'}
      </button>

      <div className="menue-block">
        <div className="etikett violett">Gedanke des Tages</div>
        <Segment
          wert={liste.tagesgedanke}
          onWahl={(wert) => setzeTagesgedanke(liste.id, wert)}
          optionen={[
            { wert: 'an', text: 'An' },
            { wert: 'aus', text: 'Aus' },
            { wert: 'erben', text: 'Erben' },
          ]}
        />
        {liste.tagesgedanke === 'erben' && (
          <p className="hinweis klein">
            {liste.eltern_id
              ? `Übernimmt die Einstellung der Liste darüber: ${geerbtAktiv ? 'an' : 'aus'}.`
              : 'Ganz oben bedeutet „Erben“: aus.'}
          </p>
        )}
      </div>

      {!istEingang && (
        <button
          className="menue-zeile gefahr"
          onClick={() => {
            loescheListe(liste.id);
            onGeloescht();
          }}
        >
          <Korb /> In den Papierkorb
        </button>
      )}
    </>
  );
}
