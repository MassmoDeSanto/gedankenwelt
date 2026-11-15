/**
 * Zeigt einen Notiztext mit „Markdown light“ an: fett, kursiv, Code, Links,
 * Aufzählungen und farbige Tags. Optional werden Suchtreffer hervorgehoben.
 */
import { Fragment, type ReactNode } from 'react';
import { leseMarkdownLight, type Inline } from '../logik/markdownLight';
import { markiere } from '../logik/suche';

function zeigeInline(teile: Inline[], terme: string[] | undefined, ohneLinks: boolean): ReactNode[] {
  return teile.map((teil, i) => {
    switch (teil.art) {
      case 'fett':
        return <strong key={i}>{zeigeInline(teil.kinder, terme, ohneLinks)}</strong>;
      case 'kursiv':
        return <em key={i}>{zeigeInline(teil.kinder, terme, ohneLinks)}</em>;
      case 'code':
        return <code key={i}>{teil.text}</code>;
      case 'link':
        // Innerhalb eines anderen Links (Suchtreffer, Aufgabenzeile) darf kein weiterer Link stehen.
        if (ohneLinks) {
          return (
            <span key={i} className="md-link">
              {teil.text}
            </span>
          );
        }
        return (
          <a key={i} href={teil.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            {teil.text}
          </a>
        );
      case 'tag':
        return (
          <span key={i} className="tag">
            {teil.text}
          </span>
        );
      default:
        if (!terme?.length) return <Fragment key={i}>{teil.text}</Fragment>;
        return (
          <Fragment key={i}>
            {markiere(teil.text, terme).map((a, j) => (a.treffer ? <mark key={j}>{a.text}</mark> : a.text))}
          </Fragment>
        );
    }
  });
}

export function MarkdownAnzeige({
  text,
  terme,
  einzeilig = false,
  ohneLinks = false,
}: {
  text: string;
  /** Gefundene Suchwörter, die hervorgehoben werden sollen */
  terme?: string[];
  /** Alles in einer Zeile (für Aufgaben-Zeilen, die abgeschnitten werden) */
  einzeilig?: boolean;
  /** Links nur als Text zeigen, nicht anklickbar */
  ohneLinks?: boolean;
}) {
  const zeilen = leseMarkdownLight(text);

  if (einzeilig) {
    return (
      <span className="md">
        {zeilen.map((zeile, i) => (
          <Fragment key={i}>
            {i > 0 && ' '}
            {zeile.art === 'punkt' && '• '}
            {zeigeInline(zeile.inhalt, terme, ohneLinks)}
          </Fragment>
        ))}
      </span>
    );
  }

  return (
    <div className="md">
      {zeilen.map((zeile, i) => (
        <div
          key={i}
          className={zeile.art === 'punkt' ? 'md-punkt' : undefined}
          style={zeile.einzug ? { marginLeft: `${zeile.einzug * 1.2}em` } : undefined}
        >
          {/* Das unsichtbare Zeichen gibt auch leeren Zeilen ihre Höhe. */}
          {zeile.inhalt.length > 0 ? zeigeInline(zeile.inhalt, terme, ohneLinks) : '\u200b'}
        </div>
      ))}
    </div>
  );
}
