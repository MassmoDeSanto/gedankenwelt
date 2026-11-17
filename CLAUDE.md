# gedankenwelt

## Ziel
Persönliche Notiz-App für genau einen Nutzer (Massimo): kurze Gedanken, Aufgaben und längere Texte, in Listen sortiert, mit schneller fehlertoleranter Suche. Läuft als installierbare Web-App (PWA) am Ubuntu-Laptop und später am iPhone.

- Konzept und Aufträge: `~/Dokumente/Claude/ideen/Gedankenwelt/KONZEPT.md` und `PHASE-1.md` (liegen bewusst **nicht** in diesem Repo, weil `ideen/` nie in ein Git-Repo kopiert wird). Vor größeren Änderungen dort nachlesen.
- Aktueller Stand: Phase 4 gebaut (Import aus Apple Notizen: Kurzbefehl-Dateien, Markdown-Export, Text einfügen). Phase 2 und 3 sind noch nie gegen das echte Google gelaufen, Phase 4 noch nie mit echten Exportdateien – offene Schritte stehen in der README, Abschnitt 9 „Später erledigen“. Aufträge: `~/Downloads/PHASE-2.md`, `~/Downloads/PHASE-3.md`, `~/Downloads/PHASE-4.md`

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
- Wichtig für Claude: Node.js ist über `nvm` installiert und in Claudes Befehlen nicht automatisch im Pfad. Jedem `npm`-, `npx`- oder `node`-Befehl `. ~/.nvm/nvm.sh && ` voranstellen. (In Massimos eigenem Terminal ist das nicht nötig.)
- Vorschau im Browser: Startbefehle stehen in `.claude/launch.json` (`gedankenwelt` = Entwicklungsversion auf Port 5173, `gedankenwelt-gebaut` = gebaute Version auf Port 4173). Läuft Massimos eigenes `npm run dev` schon, ist Port 5173 belegt – dann einfach `http://localhost:5173` öffnen statt einen zweiten Server zu starten.

## Ordnerstruktur
- `src/modell/`: Datentypen (Notiz, Liste) und ID-Erzeugung
- `src/logik/`: reine Logik ohne Oberfläche und ohne Datenbank (Absatz-Zerlegung, Markdown-Format, Suche, Gedanke des Tages). Hier liegen die Tests (`*.test.ts`).
- `src/logik/abgleich/`: Abgleich mit Google Drive (Zusammenführen, Abgleich-Runde, simuliertes Drive für Tests)
- `src/logik/kalender/`: Erinnerungen (Kalender-Schnittstelle, Abgleich Aufgaben → Termine, simulierter Kalender)
- `src/logik/wiederholung.ts`: Regeln für wiederkehrende Aufgaben
- `src/logik/import/`: Import aus Apple Notizen (Kopf lesen, bereinigen, zerlegen, Einträge und Import bauen, Rückgängig). `marker.ts` ist die eine Tabelle für Checklisten- und Aufzählungszeichen. `testdaten/` enthält nur erfundene Dateien.
- `src/db/`: Speicherung (IndexedDB), alle Änderungen an Daten, ZIP-Export/-Import, Beispieldaten
- `src/ui/`: Oberfläche (React-Komponenten und CSS)
- `public/`: Symbol der App

## Regeln für dieses Projekt
- Geheimnisse (API-Schlüssel, Passwörter) nur in `.env`; `.env.example` zeigt, welche Schlüssel nötig sind.
- Vor dem Commit: `npm test` und `npm run pruefen` laufen lassen.
- Oberflächentexte, Bezeichner im Datenmodell und Kommentare auf Deutsch.
- Logik in `src/logik/` bleibt frei von Browser- und Datenbank-Zugriffen, damit sie testbar ist und Phase 2 (Drive) sie wiederverwenden kann.
- Keine echten Notizen von Massimo ins Repo (auch nicht als Testdaten oder Beispieldaten).
- Echte Exportdateien aus Apple Notizen liegen in `import-beispiele/` (steht in `.gitignore`). Nie von dort in `src/logik/import/testdaten/` oder in Tests kopieren – auch nicht auszugsweise. Erkenntnisse daraus nur als erfundene Nachbildung übernehmen.
- Unsichtbare Sonderzeichen (z. B. U+2028, U+FFFC, U+200B) im Code immer als `\uXXXX` schreiben, nie wörtlich – wörtlich zerbrechen sie Suchmuster oder sind beim Lesen nicht zu sehen.
- Das GitHub-Repository ist öffentlich (GitHub Pages): nichts Privates committen, keine echten Notizen, keine Zugangsschlüssel. Die Google-Client-ID in `src/konfig.ts` ist öffentlich und darf drinstehen. Ein Client-Secret gehört nie ins Repo.
- Absender der Commits: In diesem Repo ist `user.email` bewusst auf Massimos anonyme GitHub-Adresse (`…@users.noreply.github.com`) gestellt, weil seine private E-Mail-Adresse nicht öffentlich sichtbar sein soll. Nicht zurückstellen. Vor jedem Push bei Zweifel prüfen: `git log --format='%ae' | sort -u` darf nur die noreply-Adresse zeigen.
- Jeder Push auf `main` veröffentlicht automatisch (GitHub Actions lässt vorher die Tests laufen). Also nur pushen, wenn `npm test` und `npm run pruefen` bestehen.
- Massimo macht die Google-Cloud-Einrichtung später. Bis dahin: nichts von ihm verlangen, wofür er etwas einrichten, freigeben oder am iPhone testen müsste. Neues gegen simuliertes Drive/simulierten Kalender bauen und prüfen; was er später tun muss, in der README im Abschnitt „Später erledigen“ sammeln.

## Offene Punkte
- Siehe `README.md`: Abschnitt 5 (Stand Phase 1), 7 (Phase 2), 8 (Phase 3), 10 (Phase 4) und 9 („Später erledigen“ – alles, was nur Massimo tun kann).
- Sobald echte Beispieldateien in `import-beispiele/` liegen: Marker-Tabelle und Automatik daran prüfen und anpassen (README, Abschnitt 9, Schritt 7).
- Phase 5 (`[[ ]]`-Links) steht noch aus.
