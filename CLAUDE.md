# gedankenwelt

## Ziel
Persönliche Notiz-App für genau einen Nutzer (Massimo): kurze Gedanken, Aufgaben und längere Texte, in Listen sortiert, mit schneller fehlertoleranter Suche. Läuft als installierbare Web-App (PWA) am Ubuntu-Laptop und später am iPhone.

- Konzept und Aufträge: `~/Dokumente/Claude/ideen/Gedankenwelt/KONZEPT.md` und `PHASE-1.md` (liegen bewusst **nicht** in diesem Repo, weil `ideen/` nie in ein Git-Repo kopiert wird). Vor größeren Änderungen dort nachlesen.
- Aktueller Stand: Phase 2 in Arbeit (Google Drive und iPhone). Auftrag: `~/Downloads/PHASE-2.md`

## Technik
- Plattform: Web (PWA), Chrome am Laptop, später Safari am iPhone
- Sprache/Framework: TypeScript, React, Vite
- Backend/Datenbank: kein Server; IndexedDB im Browser (über Dexie). Ab Phase 2 Google Drive als Quelle der Wahrheit.
- Weitere Dienste: in Phase 1 keine. Später Google Drive und Google Kalender.
- Warum diese Wahl: Technik ist in PHASE-1.md vorgegeben. React statt Svelte, weil es dafür die ausgereiftesten Bausteine (Ziehen-und-Ablegen, Tests) gibt.

## Befehle
- Abhängigkeiten installieren: `npm install`
- Starten: `npm run dev`
- Tests: `npm test`
- Code prüfen (Typen): `npm run pruefen`
- Fertige Version bauen: `npm run build`

## Ordnerstruktur
- `src/modell/`: Datentypen (Notiz, Liste) und ID-Erzeugung
- `src/logik/`: reine Logik ohne Oberfläche und ohne Datenbank (Absatz-Zerlegung, Markdown-Format, Suche, Gedanke des Tages). Hier liegen die Tests (`*.test.ts`).
- `src/logik/abgleich/`: Abgleich mit Google Drive (Zusammenführen, Abgleich-Runde, simuliertes Drive für Tests)
- `src/db/`: Speicherung (IndexedDB), alle Änderungen an Daten, ZIP-Export/-Import, Beispieldaten
- `src/ui/`: Oberfläche (React-Komponenten und CSS)
- `public/`: Symbol der App

## Regeln für dieses Projekt
- Geheimnisse (API-Schlüssel, Passwörter) nur in `.env`; `.env.example` zeigt, welche Schlüssel nötig sind.
- Vor dem Commit: `npm test` und `npm run pruefen` laufen lassen.
- Oberflächentexte, Bezeichner im Datenmodell und Kommentare auf Deutsch.
- Logik in `src/logik/` bleibt frei von Browser- und Datenbank-Zugriffen, damit sie testbar ist und Phase 2 (Drive) sie wiederverwenden kann.
- Keine echten Notizen von Massimo ins Repo (auch nicht als Testdaten oder Beispieldaten).
- Das GitHub-Repository ist öffentlich (GitHub Pages): nichts Privates committen, keine echten Notizen, keine Zugangsschlüssel. Die Google-Client-ID in `src/konfig.ts` ist öffentlich und darf drinstehen.

## Offene Punkte
- Siehe `README.md`, Abschnitt „Stand“.
