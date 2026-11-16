/** Wiederverwendbare Bausteine der Oberfläche: Dialoge, Menüs, Umschalter. */
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useZustand } from '../db/speicher';
import { kinderVon, pfadText } from '../logik/listen';
import type { Liste } from '../modell/typen';
import { AbgleichSymbol } from './AbgleichSymbol';
import { adresse, type Route } from './router';
import { Kreuz, PfeilZurueck } from './Symbole';

/** Fügt Klassennamen zusammen und lässt leere weg. */
export function klassen(...teile: (string | false | null | undefined)[]): string {
  return teile.filter(Boolean).join(' ');
}

/** Ruft `beiKlick` auf, wenn außerhalb des Elements geklickt oder Escape gedrückt wird. */
export function useAussenklick(ref: RefObject<HTMLElement | null>, aktiv: boolean, beiKlick: () => void): void {
  const merker = useRef(beiKlick);
  merker.current = beiKlick;
  useEffect(() => {
    if (!aktiv) return;
    const zeiger = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) merker.current();
    };
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') merker.current();
    };
    document.addEventListener('pointerdown', zeiger);
    document.addEventListener('keydown', taste);
    return () => {
      document.removeEventListener('pointerdown', zeiger);
      document.removeEventListener('keydown', taste);
    };
  }, [ref, aktiv]);
}

/** Kopfzeile der Unterseiten: Zurück-Pfeil, Titel, rechts Platz für Knöpfe. */
export function Kopfzeile({ zurueck, titel, rechts }: { zurueck: Route; titel: ReactNode; rechts?: ReactNode }) {
  return (
    <header className="kopfzeile">
      <a className="symbolknopf" href={adresse(zurueck)} aria-label="Zurück">
        <PfeilZurueck />
      </a>
      <div className="kopfzeile-titel">{titel}</div>
      <div className="kopfzeile-rechts">
        <AbgleichSymbol />
        {rechts}
      </div>
    </header>
  );
}

/** Fenster über der Seite. Schließt mit Escape oder Klick daneben. */
export function Dialog({
  titel,
  onSchliessen,
  children,
}: {
  titel: string;
  onSchliessen: () => void;
  children: ReactNode;
}) {
  const fenster = useRef<HTMLDivElement>(null);
  useAussenklick(fenster, true, onSchliessen);
  return (
    <div className="dialog-hintergrund">
      <div className="dialog" role="dialog" aria-modal="true" aria-label={titel} ref={fenster}>
        <div className="dialog-kopf">
          <h2>{titel}</h2>
          <button className="symbolknopf" onClick={onSchliessen} aria-label="Schließen">
            <Kreuz />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Fragt einen kurzen Text ab (z. B. den Namen einer Liste). */
export function EingabeDialog({
  titel,
  startwert = '',
  platzhalter,
  knopf,
  onFertig,
}: {
  titel: string;
  startwert?: string;
  platzhalter?: string;
  knopf: string;
  onFertig: (wert: string | null) => void;
}) {
  const [wert, setWert] = useState(startwert);
  return (
    <Dialog titel={titel} onSchliessen={() => onFertig(null)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (wert.trim()) onFertig(wert.trim());
        }}
      >
        <input
          className="eingabe"
          autoFocus
          value={wert}
          placeholder={platzhalter}
          onChange={(e) => setWert(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
        <div className="dialog-knoepfe">
          <button type="button" className="knopf" onClick={() => onFertig(null)}>
            Abbrechen
          </button>
          <button type="submit" className="knopf haupt" disabled={!wert.trim()}>
            {knopf}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Fragt nach, bevor etwas Endgültiges passiert. */
export function BestaetigungsDialog({
  titel,
  text,
  knopf,
  onFertig,
}: {
  titel: string;
  text: string;
  knopf: string;
  onFertig: (ja: boolean) => void;
}) {
  return (
    <Dialog titel={titel} onSchliessen={() => onFertig(false)}>
      <p className="dialog-text">{text}</p>
      <div className="dialog-knoepfe">
        <button className="knopf" autoFocus onClick={() => onFertig(false)}>
          Abbrechen
        </button>
        <button className="knopf gefahr" onClick={() => onFertig(true)}>
          {knopf}
        </button>
      </div>
    </Dialog>
  );
}

/** Alle aktiven Listen in Baum-Reihenfolge, jeweils mit ihrer Tiefe. */
export function useListenBaum(): { liste: Liste; tiefe: number }[] {
  const z = useZustand();
  return useMemo(() => {
    const ergebnis: { liste: Liste; tiefe: number }[] = [];
    const sammle = (eltern_id: string | null, tiefe: number) => {
      for (const liste of kinderVon(eltern_id, z.listen)) {
        ergebnis.push({ liste, tiefe });
        sammle(liste.id, tiefe + 1);
      }
    };
    sammle(null, 0);
    return ergebnis;
  }, [z]);
}

/**
 * „Verschieben nach…“: Liste auswählen, mit Suchfeld.
 * `onWahl` bekommt die ID der Liste, null für „oberste Ebene“ oder undefined bei Abbruch.
 */
export function ListenWahlDialog({
  titel,
  gesperrt,
  mitOberster = false,
  onWahl,
}: {
  titel: string;
  /** Diese Listen können nicht gewählt werden. */
  gesperrt?: Set<string>;
  mitOberster?: boolean;
  onWahl: (id: string | null | undefined) => void;
}) {
  const z = useZustand();
  const baum = useListenBaum();
  const [suche, setSuche] = useState('');
  const gesucht = suche.trim().toLowerCase();
  const passend = baum.filter(
    ({ liste }) => !gesperrt?.has(liste.id) && (!gesucht || pfadText(liste.id, z.listen).toLowerCase().includes(gesucht)),
  );

  return (
    <Dialog titel={titel} onSchliessen={() => onWahl(undefined)}>
      <input
        className="eingabe"
        autoFocus
        placeholder="Liste suchen …"
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && passend.length > 0) onWahl(passend[0].liste.id);
        }}
      />
      <div className="listenwahl">
        {mitOberster && !gesucht && (
          <button className="listenwahl-zeile gedaempft" onClick={() => onWahl(null)}>
            Oberste Ebene
          </button>
        )}
        {passend.map(({ liste, tiefe }) => (
          <button
            key={liste.id}
            className="listenwahl-zeile"
            style={{ paddingLeft: gesucht ? undefined : 12 + tiefe * 18 }}
            onClick={() => onWahl(liste.id)}
          >
            {gesucht ? pfadText(liste.id, z.listen) : liste.name}
          </button>
        ))}
        {passend.length === 0 && <p className="hinweis">Keine passende Liste.</p>}
      </div>
    </Dialog>
  );
}

/** Umschalter mit zwei bis vier Möglichkeiten nebeneinander. */
export function Segment<T extends string>({
  optionen,
  wert,
  onWahl,
}: {
  optionen: { wert: T; text: string }[];
  wert: T;
  onWahl: (wert: T) => void;
}) {
  return (
    <div className="segment" role="radiogroup">
      {optionen.map((o) => (
        <button
          key={o.wert}
          type="button"
          role="radio"
          aria-checked={o.wert === wert}
          className={klassen(o.wert === wert && 'gewaehlt')}
          onClick={() => onWahl(o.wert)}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}

/** Ausklapp-Menü an einem Knopf. */
export function Menue({
  knopf,
  beschriftung,
  knopfKlasse,
  links = false,
  children,
}: {
  knopf: ReactNode;
  beschriftung: string;
  /** Aussehen des Knopfs (Standard: rundes Symbol). */
  knopfKlasse?: string;
  /** Menü am linken statt am rechten Rand des Knopfs ausrichten. */
  links?: boolean;
  /** Inhalt; bekommt eine Funktion zum Schließen. */
  children: (schliessen: () => void) => ReactNode;
}) {
  const [offen, setOffen] = useState(false);
  const huelle = useRef<HTMLDivElement>(null);
  useAussenklick(huelle, offen, () => setOffen(false));
  return (
    <div className="menue-huelle" ref={huelle}>
      <button
        type="button"
        className={klassen(knopfKlasse ?? 'symbolknopf', offen && 'aktiv')}
        aria-label={beschriftung}
        title={beschriftung}
        aria-expanded={offen}
        onClick={() => setOffen(!offen)}
      >
        {knopf}
      </button>
      {offen && <div className={klassen('menue', links && 'links')}>{children(() => setOffen(false))}</div>}
    </div>
  );
}
