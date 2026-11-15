# Gedankenwelt

Persönliche Notiz-App für kurze Gedanken, Aufgaben und längere Texte. Sie läuft als Web-App im Browser.

**Stand: Phase 1** – Kern am Laptop. Alle Daten liegen nur in deinem Browser auf diesem Laptop. Google Drive, iPhone, Erinnerungen und der Import aus Apple Notizen kommen in den nächsten Phasen.

---

## 1. Einmalig einrichten

Du brauchst **Node.js**. Das ist das Programm, das die Entwicklungswerkzeuge (Starten, Testen, Bauen) ausführt. Die App selbst läuft danach im Browser.

> Auf diesem Laptop ist Node.js bereits installiert (15. Nov 2026, Version 26 über `nvm`). Die folgenden zwei Befehle brauchst du nur auf einem neuen Rechner.

Ein **Terminal** öffnest du mit `Strg` + `Alt` + `T`.

**Schritt 1: nvm installieren.** `nvm` ist ein kleiner Verwalter für Node.js-Versionen. Er installiert alles in deinen Benutzerordner (`~/.nvm`) und braucht kein Admin-Passwort.

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.41.0/install.sh | bash
```

**Schritt 2: Node.js installieren.** Der erste Teil lädt `nvm` in das offene Terminal, der zweite installiert die aktuelle Langzeit-Version (LTS) von Node.js.

```bash
source ~/.nvm/nvm.sh && nvm install --lts
```

**Prüfen:** Dieser Befehl zeigt die Versionsnummer, z. B. `v26.13.1`.

```bash
node --version
```

Erscheint „Kommando nicht gefunden“, schließe das Terminal und öffne ein neues.

---

## 2. Projekt starten

**In den Projektordner wechseln** (`cd` = „change directory“, Ordner wechseln):

```bash
cd ~/Dokumente/Claude/gedankenwelt
```

**Bausteine herunterladen.** `npm` gehört zu Node.js und lädt alle Bibliotheken, die in `package.json` stehen, in den Ordner `node_modules`. Das ist nur beim ersten Mal nötig – und immer dann, wenn sich `package.json` geändert hat.

```bash
npm install
```

**App starten.** Das startet einen kleinen lokalen Webserver, der nur auf deinem Laptop erreichbar ist.

```bash
npm run dev
```

Im Terminal steht dann eine Adresse, normalerweise `http://localhost:5173`. Öffne sie in **Chrome**. Änderungen am Code erscheinen sofort im Browser.

**Beenden:** im Terminal `Strg` + `C` drücken.

### Gleich ausprobieren

Zahnrad oben rechts → **Einstellungen** → **Beispieldaten laden**. Danach findest du Listen, Unterlisten, Tags und Aufgaben in der Gedankenwelt.

---

## 3. Tests laufen lassen

Tests sind kleine Programme, die automatisch prüfen, ob die wichtigen Regeln noch stimmen (Absatz-Zerlegung, Markdown-Format, Suche, Gedanke des Tages, Papierkorb, ZIP).

**Alle Tests einmal ausführen:**

```bash
npm test
```

Am Ende sollte stehen: `Test Files  6 passed (6)` und `Tests  68 passed (68)`.

**Typen prüfen.** Kontrolliert, ob im Code alles zusammenpasst, ohne ihn auszuführen. Keine Ausgabe heißt: alles in Ordnung.

```bash
npm run pruefen
```

**Fertige Version bauen** (so, wie sie später veröffentlicht wird; das Ergebnis liegt im Ordner `dist`):

```bash
npm run build
```

**Gebaute Version ansehen** (inklusive Offline-Betrieb). Sie läuft unter einer anderen Adresse (`http://localhost:4173`) und hat deshalb ihre eigenen, getrennten Daten.

```bash
npm run preview
```

---

## 4. So bedienst du die App

**Schreiben in einer Liste**

| Taste | Wirkung |
|---|---|
| 1× Enter | neue Zeile in derselben Notiz |
| 2× Enter (oder öfter) | neue Notiz darunter |
| Rücktaste am Anfang einer Notiz | mit der Notiz darüber zusammenführen |
| Entf am Ende einer Notiz | die Notiz darunter anhängen |
| Pfeil hoch / runter am Rand | zur Notiz davor / danach |
| `#` | Tag-Dropdown (Pfeiltasten, Enter wählt, Esc schließt) |
| `[ ] ` am Anfang | macht die Notiz zur Aufgabe, `[x] ` zu einer erledigten |

Fährst du mit der Maus über eine Notiz (oder klickst hinein), erscheinen rechts unter dem Text kleine Knöpfe: Tag einfügen, Aufgabe an/aus, Fälligkeit, Verschieben nach …, Papierkorb. Links erscheint ein Griff aus sechs Punkten zum Umsortieren per Ziehen.

**Listen:** In einer geöffneten Liste oben rechts auf `…` klicken: Unterliste anlegen, umbenennen, verschieben, anheften, „Gedanke des Tages“ an/aus/erben, löschen.

**Suche:** Suchfeld auf der Startseite. Das Trichter-Symbol öffnet die Filter (Liste, Tags, Datum, Aufgaben). Ein Klick auf einen Treffer springt zur Notiz.

**Wo liegen meine Daten?** In der Datenbank deines Browsers (IndexedDB), getrennt je Browser und Adresse. Wenn du die Website-Daten von `localhost` in Chrome löschst, sind die Notizen weg. Mach deshalb ab und zu einen **Export als ZIP** (Einstellungen).

---

## 5. Stand

### Fertig (Phase 1)

- Datenmodell mit allen Feldern, auch für spätere Phasen (`wiederholung`, `kalender_event_id`, `verweise` bleiben leer)
- Schreiben mit Absatz-Regel, automatischem Erstelldatum, Teilen und Zusammenführen
- Tags: Dropdown über `#` und Tag-Knopf, sortiert nach Häufigkeit, filtert beim Tippen, neue Tags anlegbar
- Listen: Eingang (fest), beliebig tiefe Unterlisten, anlegen, umbenennen, verschieben, anheften, Tagesgedanke-Schalter, löschen
- Aufgaben: `[ ]` oder Kästchen-Knopf, abhaken, Fälligkeit mit Datum und optionaler Uhrzeit
- Suche: fehlertolerant, Wortanfang, Hervorhebung, alle Filter
- Startseite: Suchfeld, Gedanke des Tages, To-do-Box mit Sammelansicht, großer Gedankenwelt-Knopf
- Gedankenwelt und Listenansicht mit Kacheln und Unterkacheln, Notizen umsortieren und verschieben
- Design „Nachtlabor“, dunkel als Standard, heller Modus umschaltbar, Schriften lokal eingebunden
- Papierkorb: 30 Tage, Wiederherstellen, Leeren
- Markdown-Format als „Export als ZIP“ und „Import aus ZIP“
- Beispieldaten
- PWA-Grundgerüst (Offline-Zwischenspeicher wird beim Bauen erzeugt)
- 68 automatische Tests

### Geprüft und nicht geprüft

- **Geprüft:** Alle Tests bestehen. Im eingebauten Browser der Claude-App (Chromium, dieselbe Technik wie Chrome) habe ich durchgespielt: Schreiben, 4× Enter, Teilen, Zusammenführen, Tag-Dropdown, `[ ]`, Suche mit Tippfehler, Sprung zum Treffer, Neuladen, Umsortieren, Verschieben, Papierkorb, Export und Import, heller Modus, Handy-Breite.
- **Nicht geprüft:** dein echtes Chrome, Safari und das iPhone. Die Installation als App und der Offline-Betrieb sind nur gebaut, nicht ausprobiert (das gehört zu Phase 2).

### Bewusst offen

- Google-Anmeldung, Drive-Abgleich, GitHub Pages, iPhone – Phase 2
- Wiederkehrende Aufgaben, Google Kalender – Phase 3 (im Fälligkeits-Menü steht „Wiederholung“ schon ausgegraut)
- Import aus Apple Notizen – Phase 4
- `[[ ]]`-Links und KI – später
- Listen lassen sich noch nicht per Ziehen umsortieren (nur Notizen). Neue Listen kommen ans Ende.
- „Markdown light“ wird nicht umgewandelt dargestellt: `**fett**` bleibt als Text stehen. Nur Tags werden eingefärbt.
- Das App-Symbol gibt es nur als SVG. Das iPhone braucht zusätzlich PNG-Dateien – Phase 2.
- Nach 30 Tagen wird Gelöschtes wirklich entfernt. Für den Drive-Abgleich muss Phase 2 klären, wie ein zweites Gerät davon erfährt.
- `npm install` meldet 6 Sicherheitshinweise (2 niedrig, 4 mittel). Sie betreffen nur Werkzeuge, die beim Bauen laufen (über `vite-plugin-pwa`), nicht die App im Browser: `npm audit --omit=dev` meldet 0. Nicht behoben, weil die angebotene Korrektur eine ältere Version des Werkzeugs erzwingen würde.

### Entscheidungen

| Entscheidung | Grund |
|---|---|
| **React** statt Svelte | Am weitesten verbreitet; ausgereifte Bausteine für Ziehen-und-Ablegen (`dnd-kit`, funktioniert auch per Finger). |
| KONZEPT.md und PHASE-1.md liegen **nicht** im Repo | Sie bleiben in `~/Dokumente/Claude/ideen/Gedankenwelt/`, weil `ideen/` nie in ein Git-Repo kopiert werden soll. `CLAUDE.md` verweist darauf. |
| Jede Notiz ist ein eigenes Textfeld | So bleiben IDs und Erstelldaten beim Teilen und Zusammenführen eindeutig. Ein einziges großes Textfeld hätte die Zuordnung erraten müssen. |
| Zeitstempel in **Weltzeit mit Sekunden** (`2026-03-12T20:04:11Z`) | Abweichung vom Beispiel im Konzept (Ortszeit mit Minuten). „Neuere Fassung gewinnt“ braucht beim Abgleich genaue, eindeutige Zeiten. Angezeigt wird in Ortszeit. Fälligkeiten bleiben Ortszeit (`2026-11-20T18:00`). |
| `pos:` im Metadaten-Kommentar | Die Reihenfolge muss beim Abgleich je Notiz zusammenführbar sein. Fehlt `pos:`, gilt die Reihenfolge in der Datei. |
| Listendateien enthalten zusätzlich `position`, `erstellt`, `geaendert` | Nötig, damit Hin- und Rückumwandlung exakt dieselben Daten ergibt. |
| `[ ]` steht nur in der Datei, nicht im gespeicherten Text | In der App ist die Aufgabe ein Kästchen; die Suche findet den reinen Text. |
| Tags werden klein geschrieben geführt | `#Idee` und `#idee` sind derselbe Tag. Im Text bleibt die Schreibweise, wie getippt. |
| Eingang hat eine feste ID | Auf jedem Gerät dieselbe Liste; kann nicht gelöscht, umbenannt oder verschoben werden. |
| Liste löschen = alles darin mitlöschen | Unterlisten und Notizen bekommen denselben Lösch-Zeitpunkt und kommen beim Wiederherstellen gemeinsam zurück. |
| Zusammenführen legt die untere Notiz in den Papierkorb | So steht es im Konzept. Ihr Text ist danach doppelt vorhanden: in der oberen Notiz und im Papierkorb. |
| Leer getippte Notiz → Papierkorb mit altem Text | Wer versehentlich alles löscht, findet den Text von vorher im Papierkorb. |
| Gedanke des Tages zeigt keine Aufgaben | „Müll rausbringen“ ist kein Gedanke. |
| Import **ersetzt** alle Daten | Entspricht Phase 2: Der lokale Bestand wird vollständig aus den Dateien aufgebaut. Vorher wird nachgefragt. |
| Dateien ohne Metadaten werden trotzdem gelesen | Von Hand in Drive ergänzte Absätze bekommen eine neue ID und das aktuelle Datum. |
| Alle Notizen im Arbeitsspeicher, Datenbank als Sicherung | Dadurch ist die Suche schnell (Test: unter 100 ms bei 20.000 Notizen). |

---

## 6. Aufbau des Codes

| Ordner | Inhalt |
|---|---|
| `src/modell/` | Datentypen (Notiz, Liste) und ID-Erzeugung |
| `src/logik/` | Regeln ohne Oberfläche und ohne Datenbank, mit Tests (`*.test.ts`) |
| `src/db/` | Speicherung im Browser, alle Daten-Änderungen, Beispieldaten |
| `src/ui/` | Oberfläche (React-Komponenten) und `stil.css` |
| `public/` | Symbol der App |

Phase 2 kann `src/logik/markdown.ts` unverändert für Google Drive benutzen: Es wandelt den Datenbestand in Dateien (Pfad + Text) um und zurück.
