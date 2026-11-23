/** Kleine Linien-Symbole als SVG, damit keine Symbol-Schrift geladen werden muss. */
import type { ReactNode } from 'react';

function Symbol({ children, groesse = 18 }: { children: ReactNode; groesse?: number }) {
  return (
    <svg
      width={groesse}
      height={groesse}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const Zahnrad = () => (
  <Symbol>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Symbol>
);

export const Lupe = () => (
  <Symbol>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Symbol>
);

export const PfeilZurueck = () => (
  <Symbol groesse={20}>
    <path d="m15 18-6-6 6-6" />
  </Symbol>
);

export const Plus = () => (
  <Symbol groesse={16}>
    <path d="M12 5v14M5 12h14" />
  </Symbol>
);

export const Kreuz = () => (
  <Symbol groesse={16}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Symbol>
);

export const Trichter = () => (
  <Symbol groesse={16}>
    <path d="M4 5h16l-6 7.5V19l-4-2v-4.5z" />
  </Symbol>
);

export const Punkte = () => (
  <Symbol groesse={16}>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </Symbol>
);

export const Griff = () => (
  <Symbol groesse={14}>
    <circle cx="9" cy="6" r="1" />
    <circle cx="15" cy="6" r="1" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="9" cy="18" r="1" />
    <circle cx="15" cy="18" r="1" />
  </Symbol>
);

export const Haken = () => (
  <Symbol groesse={12}>
    <path d="m5 12.5 4.5 4.5L19 7.5" strokeWidth="2.6" />
  </Symbol>
);

export const KaestchenSymbol = () => (
  <Symbol groesse={16}>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="m8.5 12.3 2.5 2.5 4.5-5" />
  </Symbol>
);

export const Uhr = () => (
  <Symbol groesse={16}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Symbol>
);

export const Nadel = () => (
  <Symbol groesse={16}>
    <path d="M12 17v4M8 4h8l-1 6 3 3v2H6v-2l3-3z" />
  </Symbol>
);

export const Korb = () => (
  <Symbol groesse={16}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" />
  </Symbol>
);

export const OrdnerPfeil = () => (
  <Symbol groesse={16}>
    <path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    <path d="M10 13.5h5m-2-2 2 2-2 2" />
  </Symbol>
);

export const Stift = () => (
  <Symbol groesse={16}>
    <path d="m4 20 1-4L16.5 4.5a1.5 1.5 0 0 1 2 0l1 1a1.5 1.5 0 0 1 0 2L8 19z" />
  </Symbol>
);

export const PfeilRechts = () => (
  <Symbol groesse={18}>
    <path d="M5 12h14m-6-6 6 6-6 6" />
  </Symbol>
);

const WOLKE = 'M7 18.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10.6a4 4 0 0 1-1 7.9z';

/** Abgeglichen: Wolke mit Haken */
/** Ortsmarke (Ort eines Tagebuchtags) */
export const Ortsmarke = () => (
  <Symbol groesse={16}>
    <path d="M12 21s-6-5.7-6-11a6 6 0 0 1 12 0c0 5.3-6 11-6 11z" />
    <circle cx="12" cy="10" r="2.2" />
  </Symbol>
);

/** Kalenderblatt (Tag im Tagebuch wählen) */
export const Kalender = () => (
  <Symbol groesse={18}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M9 3v4m6-4v4" />
  </Symbol>
);

/** Spitze zum Auf- und Zuklappen einer Notiz */
export const Winkel = () => (
  <Symbol groesse={18}>
    <path d="m9 6 6 6-6 6" />
  </Symbol>
);

export const WolkeFertig = () => (
  <Symbol>
    <path d={WOLKE} />
    <path d="m9.3 13.4 2 2 3.6-3.8" />
  </Symbol>
);

/** Abgleich läuft oder steht aus: Wolke mit Pfeil nach oben */
export const WolkeHoch = () => (
  <Symbol>
    <path d={WOLKE} />
    <path d="M12 16v-4.6m-2 1.8 2-2 2 2" />
  </Symbol>
);

/** Offline: durchgestrichene Wolke */
export const WolkeAus = () => (
  <Symbol>
    <path d={WOLKE} />
    <path d="M4 4l16 16" />
  </Symbol>
);

/** Anmeldung nötig oder Fehler: Wolke mit Ausrufezeichen */
export const WolkeAchtung = () => (
  <Symbol>
    <path d={WOLKE} />
    <path d="M12 11.2v3.2m0 2.1v.1" />
  </Symbol>
);

/** Wiederholung: zwei Pfeile im Kreis */
export const Wiederholen = () => (
  <Symbol groesse={12}>
    <path d="M4 11a8 8 0 0 1 13.7-5.2L20 8M20 4v4h-4M20 13a8 8 0 0 1-13.7 5.2L4 16m0 4v-4h4" strokeWidth="2" />
  </Symbol>
);

export const Flagge = () => (
  <Symbol groesse={11}>
    <path d="M5 21V4" />
    <path d="M5 4h12l-2.5 4.5L17 13H5" />
  </Symbol>
);
