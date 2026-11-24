# gedankenwelt

## Ziel
Persönliche Notiz-App für genau einen Nutzer (Massimo): kurze Gedanken, Aufgaben und längere Texte, in Listen sortiert, mit schneller fehlertoleranter Suche. Läuft als installierbare Web-App (PWA) am Ubuntu-Laptop und später am iPhone.

- Konzept und Aufträge: `~/Dokumente/Claude/ideen/Gedankenwelt/KONZEPT.md` und `PHASE-1.md` (liegen bewusst **nicht** in diesem Repo, weil `ideen/` nie in ein Git-Repo kopiert wird). Vor größeren Änderungen dort nachlesen.
- Aktueller Stand (23. Nov 2026): Phasen 1–4 gebaut, dazu To-do-Feld (Priorität/Stand), Notizen mit Namen und kompakte Listen, Tagebuch (Etappen 1–4 plus Ort), Design „Planer“. Anmeldung, Drive-Abgleich und Kalender laufen am Laptop gegen das echte Google. Noch nie getestet: iPhone, echte Exportdateien für den Import – offene Schritte stehen in der README, Abschnitt 9 „Später erledigen“. Aufträge: `~/Downloads/PHASE-2.md` bis `PHASE-6.md`.
- Design „Planer“ am 23. Nov 2026 gebaut und veröffentlicht (README Abschnitt 14): warmes Grau, To-dos als Zweier-Raster mit nach Datum getönten Kästchen und Kalenderblatt, Filter-Chips in „Alle Aufgaben“. Massimo ist damit zufrieden (24. Nov 2026).
- **Als Nächstes:** Phase 6 – Etappe A (Datensicherheit, Sicherheit) am 24. Nov 2026 erledigt, weiter mit Etappe B (README Abschnitt 15). Dann echter Import, iPhone ganz am Ende.

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
- `src/logik/tagebuch.ts`: Tagebuch (Tageswechsel, Monatsdatei-Pfade, Herkunft, Tagesspur, Monatsübersicht). `src/logik/impulse.ts`: Schreibimpulse. Die Monatsdateien selbst schreibt und liest `src/logik/markdown.ts`.
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
- Die Google Cloud ist seit dem 17. Nov 2026 eingerichtet, die Client-ID steht in `src/konfig.ts` und ist veröffentlicht. Laptop ist verbunden, Abgleich und Kalender-Selbsttest laufen. Kalender-Probe mit echter Aufgabe am 20. Nov 2026 bestanden. Noch offen (README, Abschnitt 9): iPhone, Import. Das kann nur Massimo tun, weil es seine Google-Anmeldung braucht – Claude meldet sich nie für ihn an. Meldet er einen Fehler mit Google: Wortlaut genau lesen; zuständig sind `src/db/googleDrive.ts`, `src/db/googleKalender.ts` und `src/db/anmeldung.ts`.
- Weil die Client-ID jetzt gesetzt ist, läuft in der Entwicklungsversion nicht mehr automatisch der simulierte Kalender. Zum Testen ohne Google im Browser `localStorage` setzen: `gedankenwelt.testkalender = 1` und `gedankenwelt.testdrive = 1` (siehe `src/main.tsx`).
- Neues weiterhin zuerst gegen simuliertes Drive/simulierten Kalender bauen und prüfen; was nur Massimo tun kann, in der README im Abschnitt „Später erledigen“ sammeln.

## Offene Punkte
- Siehe `README.md`: Abschnitt 5 (Stand Phase 1), 7 (Phase 2), 8 (Phase 3), 10 (Phase 4), 11 (To-do-Feld), 12 (Notizen mit Namen), 13 (Tagebuch), 14 (Design „Planer“) und 9 („Später erledigen“ – alles, was nur Massimo tun kann).
- Design: Seit 23. Nov 2026 gilt „Planer“ (README Abschnitt 14) statt „Nachtlabor“ (KONZEPT.md Abschnitt 6 ist dafür veraltet). Das Tagebuch behält „Papier/Kerzenlicht“ (KONZEPT.md 13.7). Alle Farben sind Variablen oben in `src/ui/stil.css` (`:root` = dunkel, `[data-thema='hell']`, Tagebuch unter `[data-raum='tagebuch']`), dazu die Dringlichkeitsfarben (`--ueberfaellig-*`, `--heute-*`, `--bald-*`, `--woche-*`, `--spaeter-*`), `--prio-*`, `--arbeit-*` und `--kachel`. Massimo nutzt meist den hellen Modus.
- Für Phase 6 vorgemerkt: `npm audit` meldet bekannte Sicherheitslücken in bestehenden Programmbausteinen (gesehen am 22. Nov 2026).
- Sobald echte Beispieldateien in `import-beispiele/` liegen: Marker-Tabelle und Automatik daran prüfen und anpassen (README, Abschnitt 9, Schritt 7).
- To-do-Feld überarbeitet am 20. Nov 2026: Priorität (hoch/mittel/niedrig) und Stand (offen/in Arbeit), Entscheidungen in README Abschnitt 11. Deadline = vorhandene Fälligkeit, Kategorie = Tags. Kalender-Probe (README Abschnitt 9, Schritt 4, Punkt 4) am 20. Nov 2026 bestanden.
- Phase 5 (`[[ ]]`-Links, `~/Downloads/PHASE-5.md`) am 20. Nov 2026 auf Massimos Wunsch zurückgestellt – er braucht Verlinken nicht. Stattdessen: Notizen mit Namen und kompakte Listenansicht (README Abschnitt 12).
- **Tagebuch** (KONZEPT.md Abschnitt 13, README Abschnitt 13): Etappen 1 bis 4 am 22. Nov 2026 gebaut (Schreib-Erinnerung als täglicher Serientermin mit Kennung `_schreiberinnerung`). Massimo ist damit zufrieden (23. Nov 2026). „Aufräumen mit Claude“ zurückgestellt.
- Tagebuch in Drive liegt unter `_Tagebuch/` (mit Unterstrich, Schutz vor alten App-Versionen). Gewohnheiten und eigene Schreibimpulse stehen deshalb in `_Tagebuch/_tagebuch.json` (nicht in `_meta.json`). Neue Tagebuch-Einstellungen ebenfalls dort ablegen.
- Geplante Reihenfolge danach: Phase 6 (Härtung, `~/Downloads/PHASE-6.md`) **vor** dem echten Import; iPhone ganz am Ende.

## Phase 6: Was am Auftrag überholt ist (Stand 24. Nov 2026)
`~/Downloads/PHASE-6.md` wurde am 20. Nov geschrieben. Seitdem hat sich einiges geändert; beim Abarbeiten so lesen:
- **§0 Ausgangslage:** Google ist eingerichtet. Laptop ist mit dem echten Drive und Kalender verbunden. Echte Daten können also schon in Drive liegen – jede Änderung am Format muss bestehende Dateien sicher weiterlesen. Gebaut und getestet wird trotzdem gegen simuliertes Drive/Kalender (`localStorage` `gedankenwelt.testdrive = 1`, `gedankenwelt.testkalender = 1`).
- **§0 „Frag mich nach nichts“:** gilt für Dinge, die Massimo einrichten oder testen müsste. Die globale Regel bleibt: vor jedem größeren Teilschritt kurz den Plan zeigen und auf „go“ warten, danach in kleinen, geprüften Commits arbeiten.
- **§1 Versionierung:** betrifft `_meta.json` **und** `_Tagebuch/_tagebuch.json` sowie die Tagebuch-Monatsdateien. Lokale Dexie-Datenbank hat schon Versionen – dort ansetzen.
- **§3 Ende-zu-Ende-Tests:** „Verlinken“ entfällt (Phase 5 zurückgestellt). Dazu kommen: To-do-Feld (Priorität/Stand), Notizen mit Namen/zugeklappte Listen, Tagebuch (Tagesseite, Monat, Gewohnheiten, Schreibimpulse, Ort) und „Alle Aufgaben“ mit Filter-Chips (Design „Planer“).
- **§4 Leistung:** Testdatenbestand nur lokal erzeugen (z. B. im Scratchpad oder per Skript im Browser), nie ins Repo.
- **§5 Bedienbarkeit:** Kontraste vor allem der Dringlichkeitsfarben und Schilder im Design „Planer“ prüfen (hell ist Massimos Hauptmodus). Das Aussehen selbst nicht umgestalten – Massimo ist damit zufrieden.
- **§2:** `npm audit` meldet bekannte Lücken (gesehen am 22. Nov 2026).
- **§6 Einrichtungstag:** Google Cloud, Client-ID, Laptop verbinden und Kalender-Probe sind erledigt. Die Anleitung umfasst nur noch: iPhone installieren und anmelden, Erinnerungen am iPhone, Selbsttests, Import-Beispiele exportieren, Import kalibrieren, echter Import.
- **§7 Aufräumen:** `KONZEPT.md` liegt außerhalb des Repos (`~/Dokumente/Claude/ideen/Gedankenwelt/`, nie committen). Abschnitt 6 dort beschreibt noch „Nachtlabor“ → auf „Planer“ (README §14) nachtragen, aber nur nach kurzer Rückfrage bei Massimo.
- **Umfang:** Phase 6 ist groß. Massimos Nutzungslimit ist begrenzt – sinnvoll in Etappen, je eigener Chat: (A) §1 Datensicherheit + §2 Sicherheit, (B) §3 Ende-zu-Ende-Tests + §5 Bedienbarkeit, (C) §4 Leistung + §6 Einrichtungstag + §7 Aufräumen + §8 Zusammenfassung. Fortschritt jeweils in der README (neuer Abschnitt „Phase 6“) festhalten, damit der nächste Chat dort weitermacht.
