/**
 * Import aus Apple Notizen (PHASE-4.md, Abschnitt 5):
 *   1. Weg wählen   2. Dateien auswählen oder Text einfügen   3. Vorschau und Zuordnung
 *   4. Warnung ohne Google-Verbindung   5. Importieren und Zusammenfassung
 *
 * Die Seite zeigt nur an und sammelt Entscheidungen. Was aus einer Datei wird, bestimmt
 * src/logik/import/ – dieselben Funktionen, die auch die Tests prüfen.
 */
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useAbgleichStatus } from '../db/abgleichDienst';
import { importiere } from '../db/importAktionen';
import { useZustand } from '../db/speicher';
import { warnungOhneDrive } from '../logik/import/ablauf';
import {
  STANDARD_OPTIONEN,
  WEG_NAME,
  baueImport,
  bildeEintraege,
  findeFrueherenImport,
  quelleAusText,
  vorschau,
  zusammenfassung,
  type Eintrag,
  type EintragOptionen,
  type EintragVorschau,
  type Quelle,
} from '../logik/import/plan';
import { vergleichsName } from '../logik/import/bereinigen';
import type { Trennmodus } from '../logik/import/zerlegen';
import { pfadText } from '../logik/listen';
import { formatOrtsdatum, formatStempel, jetztStempel, lokalesDatum } from '../logik/zeit';
import type { ImportEintrag } from '../modell/typen';
import { Dialog, Kopfzeile, ListenWahlDialog, Segment, klassen } from './Bausteine';
import { ausAblage, ausAuswahl, leseDateien, type GewaehlteDatei } from './importDateien';
import { adresse } from './router';

/** Ausführliche Anleitung in der README auf GitHub (Abschnitt 10) */
const ANLEITUNG = 'https://github.com/MassmoDeSanto/gedankenwelt#';

type Stufe = 'wahl' | 'text' | 'vorschau';

interface Sitzung {
  stufe: Stufe;
  quellen: Quelle[];
  /** Titel (in Vergleichsform), bei denen Markdown und Kurzbefehl getrennt bleiben sollen */
  getrennt: Set<string>;
  /** Von Hand geänderte Einstellungen je Eintrag */
  optionen: Map<string, EintragOptionen>;
  tagesgedanke: boolean;
  /** Übergangene Dateien (Bilder, Anhänge, Unlesbares) */
  uebergangen: number;
}

const leereSitzung = (): Sitzung => ({
  stufe: 'wahl',
  quellen: [],
  getrennt: new Set(),
  optionen: new Map(),
  tagesgedanke: true,
  uebergangen: 0,
});

/**
 * Die Auswahl bleibt erhalten, wenn man die Seite kurz verlässt (z. B. um erst Google zu verbinden).
 * Nach dem Import oder dem Neuladen der App ist sie leer.
 */
let gemerkt: Sitzung | null = null;

interface Zeile {
  eintrag: Eintrag;
  optionen: EintragOptionen;
  vorschau: EintragVorschau;
}

function mehrzahl(n: number, eins: string, viele: string): string {
  return `${n} ${n === 1 ? eins : viele}`;
}

export function ImportSeite() {
  const z = useZustand();
  const verbunden = useAbgleichStatus().zustand !== 'aus';
  const [s, setS] = useState<Sitzung>(() => gemerkt ?? leereSitzung());
  useEffect(() => {
    gemerkt = s;
  }, [s]);

  const [markiert, setMarkiert] = useState<Set<string>>(new Set());
  const [zielFuer, setZielFuer] = useState<string[] | null>(null);
  const [warnung, setWarnung] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<ImportEintrag | null>(null);
  const [ziehen, setZiehen] = useState(false);
  const dateiwahl = useRef<HTMLInputElement>(null);

  const eintraege = useMemo(() => bildeEintraege(s.quellen, s.getrennt), [s.quellen, s.getrennt]);
  const zeilen: Zeile[] = useMemo(
    () =>
      eintraege.map((eintrag) => {
        // Schon einmal importiert? Dann ist „überspringen“ vorgewählt.
        const frueher = findeFrueherenImport(eintrag, z.importe);
        const optionen = s.optionen.get(eintrag.schluessel) ?? { ...STANDARD_OPTIONEN, ausgeschlossen: !!frueher };
        return { eintrag, optionen, vorschau: vorschau(eintrag, optionen, z.importe) };
      }),
    [eintraege, s.optionen, z.importe],
  );

  /** Probelauf ohne Speichern: liefert genau die Zahlen, die der Import ergeben wird. */
  const probe = useMemo(() => {
    let n = 0;
    return baueImport(zeilen, z.listen.values(), { jetzt: jetztStempel(), neueId: () => `probe${n++}` }, { tagesgedanke: s.tagesgedanke })
      .eintrag;
  }, [zeilen, z.listen, s.tagesgedanke]);

  const setze = (schluessel: string[], teil: Partial<EintragOptionen>) =>
    setS((alt) => {
      const optionen = new Map(alt.optionen);
      for (const k of schluessel) {
        const zeile = zeilen.find((zl) => zl.eintrag.schluessel === k);
        if (zeile) optionen.set(k, { ...zeile.optionen, ...teil });
      }
      return { ...alt, optionen };
    });

  const nimmDateien = async (dateien: GewaehlteDatei[]) => {
    setFehler(null);
    const gelesen = await leseDateien(dateien);
    if (gelesen.quellen.length === 0) {
      setFehler(
        dateien.length === 0
          ? 'Es wurde keine Datei gewählt.'
          : 'In der Auswahl war keine Text- oder Markdown-Datei (Endung .txt oder .md).',
      );
      return;
    }
    setS((alt) => ({
      ...alt,
      stufe: 'vorschau',
      quellen: [...alt.quellen, ...gelesen.quellen],
      uebergangen: alt.uebergangen + gelesen.uebergangen,
    }));
  };

  const ablegen = (e: DragEvent) => {
    e.preventDefault();
    setZiehen(false);
    void ausAblage(e.dataTransfer).then(nimmDateien);
  };

  const starte = async () => {
    setWarnung(false);
    setLaeuft(true);
    setFehler(null);
    try {
      const eintrag = await importiere(zeilen, s.tagesgedanke);
      setErgebnis(eintrag);
      setS(leereSitzung());
      setMarkiert(new Set());
      window.scrollTo(0, 0);
    } catch (grund) {
      setFehler(`Der Import hat nicht geklappt: ${grund instanceof Error ? grund.message : 'unbekannter Fehler'} Es wurde nichts geändert.`);
    } finally {
      setLaeuft(false);
    }
  };

  const dateiEingabe = (
    <input
      ref={dateiwahl}
      type="file"
      // Bewusst ohne „accept“: Das iPhone graut sonst Dateien aus, deren Typ es nicht zuordnen kann
      // (z. B. .md). Was keine Text- oder Markdown-Datei ist, sortiert die App selbst aus.
      multiple
      hidden
      onChange={(e) => {
        const dateien = ausAuswahl(e.target.files);
        e.target.value = '';
        void nimmDateien(dateien);
      }}
    />
  );

  // ───────── 5. Zusammenfassung nach dem Import ─────────
  if (ergebnis) {
    return (
      <div className="seite">
        <Kopfzeile zurueck={{ seite: 'einstellungen' }} titel={<h1>Import fertig</h1>} />
        <section className="karte import-fertig">
          <div className="etikett tuerkis">Importiert</div>
          <p className="import-summe">{zusammenfassung(ergebnis)}</p>
          <p className="hinweis">
            Vor dem Import wurde der bisherige Stand gesichert. Die Sicherung und „Rückgängig“ findest du unter Einstellungen →
            Import aus Apple Notizen.
            {!verbunden && ' Die Notizen liegen im Moment nur auf diesem Gerät.'}
          </p>
          <div className="knopfreihe">
            <a className="knopf haupt" href={adresse({ seite: 'welt' })}>
              Zur Gedankenwelt
            </a>
            <button className="knopf" onClick={() => setErgebnis(null)}>
              Weitere importieren
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ───────── Weg C: Text einfügen ─────────
  if (s.stufe === 'text') {
    return (
      <div className="seite">
        <Kopfzeile zurueck={{ seite: 'einstellungen' }} titel={<h1>Text einfügen</h1>} />
        <TextFormular
          onAbbruch={() => setS((alt) => ({ ...alt, stufe: alt.quellen.length > 0 ? 'vorschau' : 'wahl' }))}
          onFertig={(quelle, ziel, datum) =>
            setS((alt) => {
              const optionen = new Map(alt.optionen);
              optionen.set(quelle.fingerabdruck, { ...STANDARD_OPTIONEN, ziel, datum });
              return { ...alt, stufe: 'vorschau', quellen: [...alt.quellen, quelle], optionen };
            })
          }
        />
      </div>
    );
  }

  // ───────── 1. und 2. Weg wählen, Dateien auswählen ─────────
  if (s.stufe === 'wahl') {
    return (
      <div
        className={klassen('seite', ziehen && 'ablage')}
        onDragOver={(e) => {
          e.preventDefault();
          setZiehen(true);
        }}
        onDragLeave={() => setZiehen(false)}
        onDrop={ablegen}
      >
        <Kopfzeile zurueck={{ seite: 'einstellungen' }} titel={<h1>Import aus Apple Notizen</h1>} />
        <p className="hinweis">
          Ein einmaliger Umzug: Jede Apple-Notiz wird eine Liste, ihre Absätze werden Notizen. Vor dem Import siehst du eine
          Vorschau, danach lässt sich alles rückgängig machen.
        </p>

        <section className="karte import-weg">
          <div className="etikett">Weg A · Kurzbefehl</div>
          <p>Alle Notizen auf einmal, mit Datum und Ordner. Liefert reinen Text: Formatierung und Links gehen verloren.</p>
          <div className="knopfreihe">
            <button className="knopf haupt" onClick={() => dateiwahl.current?.click()}>
              Dateien auswählen
            </button>
            <a className="textknopf" href={`${ANLEITUNG}weg-a-kurzbefehl`} target="_blank" rel="noreferrer">
              Anleitung
            </a>
          </div>
        </section>

        <section className="karte import-weg">
          <div className="etikett">Weg B · Als Markdown exportieren</div>
          <p>
            Notiz für Notiz über „Teilen“, mit Überschriften, Listen, Links, fett und kursiv. Datum und Ordner legst du in der
            Vorschau fest.
          </p>
          <div className="knopfreihe">
            <button className="knopf haupt" onClick={() => dateiwahl.current?.click()}>
              Dateien auswählen
            </button>
            <a className="textknopf" href={`${ANLEITUNG}weg-b-als-markdown-exportieren`} target="_blank" rel="noreferrer">
              Anleitung
            </a>
          </div>
        </section>

        <section className="karte import-weg">
          <div className="etikett">Weg C · Text einfügen</div>
          <p>Die Notlösung: den Text einer Notiz kopieren und hier einfügen.</p>
          <div className="knopfreihe">
            <button className="knopf" onClick={() => setS((alt) => ({ ...alt, stufe: 'text' }))}>
              Text einfügen
            </button>
            <a className="textknopf" href={`${ANLEITUNG}weg-c-text-in-die-app-kopieren`} target="_blank" rel="noreferrer">
              Anleitung
            </a>
          </div>
        </section>

        <p className="hinweis klein">
          Weg A und B lassen sich mischen: Liegt dieselbe Notiz in beiden Formen vor, nimmt die App den Inhalt aus Markdown und
          Datum und Ordner aus der Kurzbefehl-Datei. Am Laptop kannst du Dateien oder ganze Ordner auch auf diese Seite ziehen.
          Bilder und Anhänge werden nicht übernommen.
        </p>
        {fehler && (
          <p className="meldung warnung" role="alert">
            {fehler}
          </p>
        )}
        {dateiEingabe}
      </div>
    );
  }

  // ───────── 3. Vorschau und Zuordnung ─────────
  const dabei = zeilen.filter((zl) => !zl.optionen.ausgeschlossen);
  const alleSchluessel = zeilen.map((zl) => zl.eintrag.schluessel);
  const markierte = alleSchluessel.filter((k) => markiert.has(k));
  const zielDialogStart = zielFuer && zeilen.find((zl) => zl.eintrag.schluessel === zielFuer[0]);

  return (
    <div
      className={klassen('seite', ziehen && 'ablage')}
      onDragOver={(e) => {
        e.preventDefault();
        setZiehen(true);
      }}
      onDragLeave={() => setZiehen(false)}
      onDrop={ablegen}
    >
      <Kopfzeile zurueck={{ seite: 'einstellungen' }} titel={<h1>Vorschau</h1>} />

      <section className="karte">
        <div className="etikett">Das wird importiert</div>
        <p className="import-summe">{probe.notizen > 0 ? zusammenfassung(probe) : 'Nichts ausgewählt'}</p>
        <p className="hinweis klein">
          aus {mehrzahl(dabei.length, 'Apple-Notiz', 'Apple-Notizen')}
          {zeilen.length > dabei.length && ` · ${zeilen.length - dabei.length} übersprungen`}
          {s.uebergangen > 0 && ` · ${mehrzahl(s.uebergangen, 'andere Datei', 'andere Dateien')} (Bilder, Anhänge) nicht gelesen`}
        </p>
        <div className="knopfreihe import-leiste">
          <button className="knopf" onClick={() => dateiwahl.current?.click()}>
            Weitere Dateien
          </button>
          <button className="knopf" onClick={() => setS((alt) => ({ ...alt, stufe: 'text' }))}>
            Text einfügen
          </button>
          <button
            className="textknopf"
            onClick={() => {
              setS(leereSitzung());
              setMarkiert(new Set());
            }}
          >
            Auswahl verwerfen
          </button>
        </div>
        {zeilen.length > 1 && (
          <div className="knopfreihe import-leiste">
            <label className="import-haken">
              <input
                type="checkbox"
                checked={markierte.length === zeilen.length}
                onChange={(e) => setMarkiert(new Set(e.target.checked ? alleSchluessel : []))}
              />
              Alle markieren
            </label>
            {markierte.length > 0 && (
              <>
                <span className="mono meta">{markierte.length} markiert:</span>
                <button className="knopf" onClick={() => setZielFuer(markierte)}>
                  Ziel-Liste …
                </button>
                <button className="knopf" onClick={() => setze(markierte, { ausgeschlossen: true })}>
                  Nicht importieren
                </button>
                <button className="knopf" onClick={() => setze(markierte, { ausgeschlossen: false })}>
                  Importieren
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {zeilen.map((zeile) => (
        <EintragKarte
          key={zeile.eintrag.schluessel}
          zeile={zeile}
          zielName={zeile.optionen.ziel ? pfadText(zeile.optionen.ziel, z.listen) : null}
          mitMarkierung={zeilen.length > 1}
          markiert={markiert.has(zeile.eintrag.schluessel)}
          onMarkiert={(an) =>
            setMarkiert((alt) => {
              const neu = new Set(alt);
              if (an) neu.add(zeile.eintrag.schluessel);
              else neu.delete(zeile.eintrag.schluessel);
              return neu;
            })
          }
          onOption={(teil) => setze([zeile.eintrag.schluessel], teil)}
          onZiel={() => setZielFuer([zeile.eintrag.schluessel])}
          onKombination={(kombinieren) =>
            setS((alt) => {
              const getrennt = new Set(alt.getrennt);
              const titel = vergleichsName(zeile.eintrag.titel);
              if (kombinieren) getrennt.delete(titel);
              else getrennt.add(titel);
              return { ...alt, getrennt };
            })
          }
        />
      ))}

      <section className="karte">
        <label className="einstellung import-schalter">
          <span>
            Importierte Listen für den Gedanken des Tages freigeben
            <span className="hinweis klein">Dann können importierte Notizen auf der Startseite als Gedanke des Tages erscheinen.</span>
          </span>
          <input
            type="checkbox"
            checked={s.tagesgedanke}
            onChange={(e) => setS((alt) => ({ ...alt, tagesgedanke: e.target.checked }))}
          />
        </label>
        {fehler && (
          <p className="meldung warnung" role="alert">
            {fehler}
          </p>
        )}
        <div className="knopfreihe import-start">
          <button
            className="knopf haupt gross"
            disabled={laeuft || probe.notizen === 0}
            onClick={() => (warnungOhneDrive(verbunden) ? setWarnung(true) : void starte())}
          >
            {laeuft ? 'Importiere …' : probe.notizen === 0 ? 'Nichts zu importieren' : `${mehrzahl(probe.notizen, 'Notiz', 'Notizen')} importieren`}
          </button>
        </div>
        <p className="hinweis klein">Vorher wird der jetzige Stand automatisch als ZIP gesichert.</p>
      </section>

      {dateiEingabe}

      {zielFuer && (
        <ListenWahlDialog
          titel={zielFuer.length > 1 ? `Ziel-Liste für ${zielFuer.length} Notizen` : `Ziel-Liste für „${zielDialogStart?.eintrag.titel ?? ''}“`}
          mitOberster
          onWahl={(id) => {
            if (id !== undefined) setze(zielFuer, { ziel: id });
            setZielFuer(null);
          }}
        />
      )}

      {warnung && (
        <Dialog titel="Nicht mit Google verbunden" onSchliessen={() => setWarnung(false)}>
          <p className="dialog-text">{warnungOhneDrive(false)}</p>
          <div className="dialog-knoepfe">
            <a className="knopf" href={adresse({ seite: 'einstellungen' })}>
              Erst verbinden
            </a>
            <button className="knopf haupt" onClick={() => void starte()}>
              Trotzdem importieren
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

// ───────────────────────── Eine Apple-Notiz in der Vorschau ─────────────────────────

const TRENNMODI: { wert: Trennmodus; text: string }[] = [
  { wert: 'automatisch', text: 'Automatisch' },
  { wert: 'leerzeilen', text: 'Leerzeilen' },
  { wert: 'zeilen', text: 'Jede Zeile' },
];
const JA_NEIN: { wert: 'ja' | 'nein'; text: string }[] = [
  { wert: 'ja', text: 'Einzeln' },
  { wert: 'nein', text: 'Zusammen' },
];
const UEBERSCHRIFTEN: { wert: 'ja' | 'nein'; text: string }[] = [
  { wert: 'ja', text: 'Als Unterliste' },
  { wert: 'nein', text: 'Als Notiz' },
];

function EintragKarte({
  zeile,
  zielName,
  mitMarkierung,
  markiert,
  onMarkiert,
  onOption,
  onZiel,
  onKombination,
}: {
  zeile: Zeile;
  zielName: string | null;
  mitMarkierung: boolean;
  markiert: boolean;
  onMarkiert: (an: boolean) => void;
  onOption: (teil: Partial<EintragOptionen>) => void;
  onZiel: () => void;
  onKombination: (kombinieren: boolean) => void;
}) {
  const { eintrag, optionen, vorschau: v } = zeile;
  const heute = lokalesDatum();
  const aufgaben = v.aufgabenOffen + v.aufgabenErledigt;
  const pfad = [zielName, ...eintrag.ordner].filter(Boolean) as string[];

  const datum = optionen.datum
    ? formatOrtsdatum(optionen.datum, heute)
    : eintrag.erstellt
      ? formatStempel(eintrag.erstellt, heute)
      : null;

  const hinweise: string[] = [];
  if (v.schonImportiert) hinweise.push(`schon am ${formatStempel(v.schonImportiert.datum, heute)} importiert`);
  if (!datum) hinweise.push('Datum unbekannt – es gilt das Importdatum');
  if (v.zerlegung.anhaenge > 0) {
    hinweise.push(
      v.zerlegung.anhaenge === 1
        ? '1 Bild oder Anhang wird nicht übernommen'
        : `${v.zerlegung.anhaenge} Bilder oder Anhänge werden nicht übernommen`,
    );
  }
  if (v.notizen === 0) hinweise.push('leer – es gibt nichts zu importieren');
  hinweise.push(...eintrag.hinweise);

  return (
    <section className={klassen('karte import-eintrag', optionen.ausgeschlossen && 'aus')}>
      <div className="import-kopf">
        {mitMarkierung && (
          <input
            type="checkbox"
            aria-label={`„${eintrag.titel}“ markieren`}
            checked={markiert}
            onChange={(e) => onMarkiert(e.target.checked)}
          />
        )}
        <div className="import-titel">
          {pfad.length > 0 && <span className="pfad">{pfad.join(' › ')} › </span>}
          <strong>{eintrag.titel}</strong>
        </div>
        <button className="textknopf" onClick={() => onOption({ ausgeschlossen: !optionen.ausgeschlossen })}>
          {optionen.ausgeschlossen ? 'Doch importieren' : 'Nicht importieren'}
        </button>
      </div>

      <p className="mono meta import-zahlen">
        {mehrzahl(v.notizen, 'Notiz', 'Notizen')}
        {aufgaben > 0 && ` · ${mehrzahl(aufgaben, 'Aufgabe', 'Aufgaben')} (${v.aufgabenOffen} offen, ${v.aufgabenErledigt} erledigt)`}
        {v.listen > 1 && ` · ${v.listen} Listen`}
        {datum && ` · ${datum}`}
        {` · ${WEG_NAME[eintrag.weg]}`}
      </p>

      {optionen.ausgeschlossen && <p className="hinweis klein">Wird übersprungen.</p>}
      {hinweise.length > 0 && (
        <ul className="import-hinweise">
          {hinweise.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}
      {eintrag.kombinierbar && (
        <p className="hinweis klein import-kombi">
          {eintrag.weg === 'kombiniert'
            ? 'Liegt als Markdown und als Kurzbefehl-Datei vor: Inhalt aus Markdown, Datum und Ordner aus der Kurzbefehl-Datei.'
            : 'Diese Notiz liegt auch in der anderen Form vor.'}{' '}
          <button className="textknopf" onClick={() => onKombination(eintrag.weg !== 'kombiniert')}>
            {eintrag.weg === 'kombiniert' ? 'Getrennt lassen' : 'Kombinieren'}
          </button>
        </p>
      )}

      {!optionen.ausgeschlossen && (
        <>
          <details className="diagnose">
            <summary>Zuordnung und Zerlegung</summary>
            <div className="import-optionen">
              <span>Ziel-Liste</span>
              <button className="knopf" onClick={onZiel}>
                {zielName ?? 'Oberste Ebene'}
              </button>

              <span>
                Neue Notiz
                {optionen.trennmodus === 'automatisch' && (
                  <span className="hinweis klein">
                    Automatik: {v.zerlegung.modus === 'zeilen' ? 'jede Zeile eine Notiz' : 'Leerzeile trennt'}
                  </span>
                )}
              </span>
              <Segment optionen={TRENNMODI} wert={optionen.trennmodus} onWahl={(trennmodus) => onOption({ trennmodus })} />

              <span>Aufzählungspunkte</span>
              <Segment
                optionen={JA_NEIN}
                wert={optionen.punkteEinzeln ? 'ja' : 'nein'}
                onWahl={(w) => onOption({ punkteEinzeln: w === 'ja' })}
              />

              <span>Überschriften</span>
              <Segment
                optionen={UEBERSCHRIFTEN}
                wert={optionen.ueberschriftenAlsListen ? 'ja' : 'nein'}
                onWahl={(w) => onOption({ ueberschriftenAlsListen: w === 'ja' })}
              />

              <span>
                Datum
                <span className="hinweis klein">{eintrag.erstellt ? 'aus der Datei' : 'leer = Importdatum'}</span>
              </span>
              <span className="import-datum">
                <input
                  type="date"
                  className="eingabe"
                  aria-label="Datum der Notiz"
                  max={heute}
                  value={optionen.datum ?? ''}
                  onChange={(e) => onOption({ datum: e.target.value || null })}
                />
                {optionen.datum && (
                  <button className="textknopf" onClick={() => onOption({ datum: null })}>
                    zurücksetzen
                  </button>
                )}
              </span>
            </div>
          </details>

          <details className="diagnose">
            <summary>Erste Notizen ansehen</summary>
            <div className="import-vorschau">
              {v.zerlegung.abschnitte
                .filter((a) => a.notizen.length > 0 || a.pfad.length > 0)
                .map((a) => (
                  <div key={a.pfad.join('\n')}>
                    <div className="import-abschnitt">
                      {[eintrag.titel, ...a.pfad].join(' › ')}
                      <span className="mono meta"> {a.notizen.length}</span>
                    </div>
                    {a.notizen.slice(0, 3).map((n, i) => (
                      <p key={i} className="import-notiz">
                        {n.aufgabe && <span className={klassen('minikasten', n.aufgabe === 'erledigt' && 'an')} />}
                        {n.text.length > 220 ? `${n.text.slice(0, 220)} …` : n.text}
                      </p>
                    ))}
                    {a.notizen.length > 3 && <p className="mono meta">… und {a.notizen.length - 3} weitere</p>}
                  </div>
                ))}
            </div>
          </details>
        </>
      )}
    </section>
  );
}

// ───────────────────────── Weg C: Importfeld ─────────────────────────

function TextFormular({
  onFertig,
  onAbbruch,
}: {
  onFertig: (quelle: Quelle, ziel: string | null, datum: string | null) => void;
  onAbbruch: () => void;
}) {
  const z = useZustand();
  const [titel, setTitel] = useState('');
  const [text, setText] = useState('');
  const [ziel, setZiel] = useState<string | null>(null);
  const [datum, setDatum] = useState('');
  const [zielwahl, setZielwahl] = useState(false);
  const bereit = titel.trim().length > 0 && text.trim().length > 0;

  return (
    <section className="karte import-formular">
      <label>
        <span className="etikett">Titel</span>
        <input
          className="eingabe"
          autoFocus
          value={titel}
          placeholder="Wird der Name der neuen Liste"
          onChange={(e) => setTitel(e.target.value)}
        />
      </label>

      <div className="import-optionen">
        <span>Ziel-Liste</span>
        <button className="knopf" onClick={() => setZielwahl(true)}>
          {ziel ? pfadText(ziel, z.listen) : 'Oberste Ebene'}
        </button>
        <span>
          Datum
          <span className="hinweis klein">leer = heute</span>
        </span>
        <input
          type="date"
          className="eingabe"
          aria-label="Datum der Notiz"
          max={lokalesDatum()}
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
        />
      </div>

      <label>
        <span className="etikett">Text der Notiz</span>
        <textarea
          className="eingabe import-text"
          value={text}
          placeholder="Hier den kopierten Text einfügen"
          onChange={(e) => setText(e.target.value)}
        />
      </label>

      <div className="knopfreihe">
        <button className="knopf haupt" disabled={!bereit} onClick={() => onFertig(quelleAusText(titel, text), ziel, datum || null)}>
          Zur Vorschau
        </button>
        <button className="knopf" onClick={onAbbruch}>
          Abbrechen
        </button>
      </div>

      {zielwahl && (
        <ListenWahlDialog
          titel="Ziel-Liste"
          mitOberster
          onWahl={(id) => {
            if (id !== undefined) setZiel(id);
            setZielwahl(false);
          }}
        />
      )}
    </section>
  );
}
