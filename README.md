# Gedankenwelt

Persönliche Notiz-App für kurze Gedanken, Aufgaben und längere Texte. Sie läuft als Web-App im Browser.

**Stand: Phase 3 gebaut.** Wiederkehrende Aufgaben sind fertig und geprüft. Der Abgleich mit Google Drive (Phase 2) und die Erinnerungen über den Google Kalender (Phase 3) sind gebaut und mit simuliertem Drive und simuliertem Kalender geprüft, aber **noch nie gegen das echte Google gelaufen** und nicht am iPhone getestet. Dafür fehlt die Einrichtung in der Google Cloud. Alles, was du dafür später tun musst, steht in einer einzigen Reihenfolge in Abschnitt 9, „Später erledigen“.

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

Am Ende sollte stehen: `Test Files  12 passed (12)` und `Tests  189 passed (189)`.

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
| `**fett**`, `*kursiv*`, `` `Code` ``, `- Punkt`, `[Text](Adresse)` | wird schön dargestellt, sobald du die Notiz verlässt |

Fährst du mit der Maus über eine Notiz (oder klickst hinein), erscheinen rechts unter dem Text kleine Knöpfe: Tag einfügen, Aufgabe an/aus, Fälligkeit, Verschieben nach …, Papierkorb. Links erscheint ein Griff aus sechs Punkten zum Umsortieren per Ziehen.

**Aufgaben:** Unter jeder Aufgabe steht ein kleiner Knopf: „Termin“ (wenn noch kein Datum gesetzt ist) oder die Fälligkeit. Er öffnet das Aufgaben-Menü mit Datum, Uhrzeit, Erinnerung und Wiederholung. Hakst du eine wiederkehrende Aufgabe ab, springt sie auf ihre nächste Fälligkeit; unten erscheint für einige Sekunden „Nächstes Mal: …“ mit „Rückgängig“.

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
- Markdown light in der Anzeige: `**fett**`, `*kursiv*`, `` `Code` ``, Links und Aufzählungen mit `-`. Beim Bearbeiten sieht man den Rohtext.
- 189 automatische Tests (Phase 1 bis 3)

### Geprüft und nicht geprüft

- **Geprüft:** Alle Tests bestehen. Im eingebauten Browser der Claude-App (Chromium, dieselbe Technik wie Chrome) habe ich durchgespielt: Schreiben, 4× Enter, Teilen, Zusammenführen, Tag-Dropdown, `[ ]`, Suche mit Tippfehler, Sprung zum Treffer, Neuladen, Umsortieren, Verschieben, Papierkorb, Export und Import, heller Modus, Handy-Breite.
- **Nicht geprüft:** dein echtes Chrome, Safari und das iPhone. Die Installation als App und der Offline-Betrieb sind nur gebaut, nicht ausprobiert (das gehört zu Phase 2).

### Bewusst offen

- Google Drive, iPhone, wiederkehrende Aufgaben und Erinnerungen sind inzwischen gebaut: siehe Abschnitte 7 und 8
- Import aus Apple Notizen – Phase 4
- `[[ ]]`-Links und KI – später
- Listen lassen sich noch nicht per Ziehen umsortieren (nur Notizen). Neue Listen kommen ans Ende.
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
| `public/` | Symbole der App und Startbilder fürs iPhone |
| `werkzeuge/` | Skript, das die Symbole und Startbilder erzeugt (nur nötig, wenn sich das Symbol ändert) |

Phase 2 kann `src/logik/markdown.ts` unverändert für Google Drive benutzen: Es wandelt den Datenbestand in Dateien (Pfad + Text) um und zurück.

---

## 7. Phase 2: Google Drive und iPhone

### Was schon da ist

- **Abgleich-Kern** (`src/logik/abgleich/`), geprüft gegen ein simuliertes Drive mit 28 Tests: zwei Geräte offline, dieselbe Notiz auf beiden geändert, Löschen gegen Bearbeiten, Umbenennen und Verschieben ohne doppelte Dateien, Abbruch an jeder einzelnen Stelle des Hochladens, von Hand in Drive ergänzter Text, Papierkorb nach 30 Tagen.
- **Anschluss an die App:** Warteschlange in der Browser-Datenbank, automatischer Abgleich (beim Öffnen, beim Zurückkehren in die App, wenn das Netz zurückkommt, vier Sekunden nach einer Änderung, alle zwei Minuten), Status-Symbol, erstes Verbinden mit automatischer Sicherung und der Frage nach den Beispieldaten, „Lokale Daten neu aus Drive laden“, „Verbindung trennen“.
- **Anmeldung bei Google** mit stillem Erneuern; Testseite unter Einstellungen → Google Drive → Diagnose.
- **Automatische Veröffentlichung** auf GitHub Pages bei jedem Push (`.github/workflows/veroeffentlichen.yml`).
- **Updates:** Eine neue Version der App wird still übernommen, sobald die App in den Hintergrund geht.
- **iPhone:** App-Symbol und Startbilder als PNG, Darstellung ohne Browserleiste, dunkle Statusleiste, Ränder für Notch und Home-Leiste, größere Tippflächen, Tag-Dropdown mit hohen Zeilen, Platz unter der letzten Notiz für die Tastatur. Die App bittet den Browser um dauerhaften Speicher.

### Geprüft und nicht geprüft

- **Geprüft:** alle Tests; dazu im Browser der ganze Ablauf mit einem simulierten Drive (erstes Verbinden, Beispieldaten löschen, Sicherung, Warteschlange, automatischer Abgleich, Neuaufbau, Status-Symbol).
- **Nicht geprüft:** alles, was das echte Google braucht – die Anmeldung und die Datei `src/db/googleDrive.ts` (die Übersetzung in Googles Schnittstelle). Das geht erst mit deiner Client-ID. Rechne damit, dass beim ersten echten Versuch noch etwas nachzubessern ist.
- **Nicht geprüft:** alles am echten iPhone. Die Handy-Darstellung habe ich nur in einer auf Handy-Breite verkleinerten Vorschau am Laptop gesehen. Ob Startbild, Statusleiste, Tastatur und das Schreiben mit der iOS-Tastatur stimmen, zeigt erst dein Gerät.


### Wie die Anmeldung funktioniert – und ihre Grenze

Die App hat keinen eigenen Server. Google gibt einer reinen Browser-App nur einen Zugangsschlüssel, der etwa eine Stunde gilt, und nichts, womit sie ihn unbemerkt verlängern könnte ([Googles Beschreibung](https://developers.google.com/identity/oauth2/web/guides/use-token-model), Stand 15. Nov 2026). Eine echte Dauer-Anmeldung gibt es nur mit eigenem Server. Das lässt sich nicht umgehen.

Die App holt sich deshalb selbst einen neuen Schlüssel:

- **Weiterleitung, still:** Die App springt kurz zu Google und zurück, ohne dass du etwas tippen musst. Das klappt, solange du im Browser bzw. in der installierten App noch bei Google angemeldet bist. Google beschreibt diesen Weg, rät aber eher zum Pop-up, weil der Schlüssel dabei kurz in der Adresse steht ([Quelle](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)). Die App entfernt ihn sofort wieder aus der Adresse.
- **Rückfall:** Klappt das stille Erneuern nicht, zeigt die App „Neu anmelden“. Ein Tipp genügt dann meist, ohne Passwort.

In beiden Fällen arbeitet die App offline weiter. Es geht nichts verloren.

Ob das stille Erneuern auf deinem iPhone in der installierten App funktioniert, ist **nicht geprüft**. Erfahrungsberichte dazu sind uneinheitlich. Deshalb gibt es die Testseite.

### Google Cloud einrichten (machst du selbst, einmalig – für Drive und Kalender zusammen)

Diese Schritte stammen aus Googles Anleitungen ([Zustimmungsbildschirm](https://developers.google.com/workspace/guides/configure-oauth-consent), [Zugangsdaten](https://developers.google.com/workspace/guides/create-credentials), Stand 15. Nov 2026). Ich konnte sie nicht selbst durchklicken. Die Menüs können auf Deutsch etwas anders heißen.

1. **Projekt anlegen.** Öffne <https://console.cloud.google.com> und melde dich mit dem Google-Konto an, in dessen Drive die Notizen liegen sollen. Oben in der Leiste auf die Projektauswahl klicken → **Neues Projekt** → Name `Gedankenwelt` → **Erstellen**. Danach dieses Projekt auswählen.
2. **Beide Schnittstellen einschalten.** Menü → **APIs & Dienste** → **Bibliothek** → nach `Google Drive API` suchen → **Aktivieren**. Danach genauso `Google Calendar API` suchen → **Aktivieren**. (Drive für den Abgleich, Calendar für die Erinnerungen.)
3. **Zustimmungsbildschirm einrichten.** Menü → **Google Auth Platform** → **Branding** → **Erste Schritte** (Get started).
   - App-Name: `Gedankenwelt`, Support-E-Mail: deine Adresse → **Weiter**
   - Zielgruppe (Audience): **Extern** → **Weiter**
   - Kontakt-E-Mail: deine Adresse → **Weiter**
   - Richtlinie bestätigen → **Weiter** → **Erstellen**
4. **Dich selbst als Testnutzer eintragen.** **Google Auth Platform** → **Zielgruppe** (Audience) → unter **Testnutzer** auf **Nutzer hinzufügen** → deine Google-Adresse → **Speichern**. Damit bist du der einzige, der die App benutzen darf.
5. **Beide Berechtigungen festlegen.** **Google Auth Platform** → **Datenzugriff** (Data Access) → **Bereiche hinzufügen oder entfernen** → diese zwei ankreuzen → **Speichern**:
   - `…/auth/drive.file` – nur Dateien, die die App selbst angelegt hat. Deinen übrigen Drive sieht sie nicht.
   - `…/auth/calendar.app.created` – nur Kalender, die die App selbst angelegt hat, und deren Termine. Deine übrigen Kalender kann sie weder lesen noch ändern.

   Findest du die zweite nicht in der Liste, trage sie unten im Feld für manuelle Bereiche vollständig ein: `https://www.googleapis.com/auth/calendar.app.created`. Die Kalender-Berechtigung fragt die App erst an, wenn du „Erinnerungen aktivieren“ tippst.
6. **Client anlegen.** **Google Auth Platform** → **Clients** → **Client erstellen** → Anwendungstyp **Webanwendung**, Name `Gedankenwelt Web`.
   - Unter **Autorisierte JavaScript-Quellen** zwei Einträge:
     `http://localhost:5173` und `https://massmodesanto.github.io`
   - Unter **Autorisierte Weiterleitungs-URIs** zwei Einträge, jeweils **mit** Schrägstrich am Ende:
     `http://localhost:5173/` und `https://massmodesanto.github.io/gedankenwelt/`
   - **Erstellen**
7. **Client-ID kopieren.** Sie sieht aus wie `1234567890-abc….apps.googleusercontent.com`. Trage sie in `src/konfig.ts` bei `GOOGLE_CLIENT_ID` ein (zwischen die Anführungszeichen) – oder gib sie Claude, dann erledigt er das. Die Client-ID ist kein Geheimnis. Ein „Client-Secret“ brauchst du nicht und sollst du nirgends eintragen.

**Der Hinweis „App nicht überprüft“.** Bei der ersten Anmeldung kann Google warnen, die App sei nicht überprüft. Das heißt nur: Google hat diese App nicht für die Öffentlichkeit geprüft. Das ist hier richtig so, denn du hast sie selbst gebaut und bist der einzige Nutzer. Klicke auf **Erweitert** → **Weiter zu Gedankenwelt**.

**Falls du dich jede Woche neu bestätigen musst:** Im Status „Test“ lässt Google Zustimmungen nach Erfahrungsberichten nach 7 Tagen verfallen. Das habe ich in Googles eigener Dokumentation nicht bestätigt gefunden. Abhilfe laut diesen Berichten: unter **Zielgruppe** auf **App veröffentlichen** klicken. Sag mir Bescheid, wenn das auftritt, bevor du es umstellst.

### GitHub und Veröffentlichung

Das Repository `gedankenwelt` wird öffentlich, weil GitHub Pages mit einem kostenlosen Konto nur so funktioniert. Im Code liegen keine Notizen und keine Geheimnisse; deine Notizen liegen nur in deinem Browser und später in deinem Google Drive.

Die App ist danach unter <https://massmodesanto.github.io/gedankenwelt/> erreichbar. Die Adresse steht auch auf GitHub im Repository unter **Settings** → **Pages**.

Nach einer Änderung am Code veröffentlichst du so:

`git add` merkt die geänderten Dateien vor:

```bash
git add .
```

`git commit` speichert sie als Zwischenstand mit einer kurzen Beschreibung:

```bash
git commit -m "Kurz, was geändert wurde"
```

`git push` lädt den Zwischenstand zu GitHub hoch. GitHub lässt dann die Tests laufen und veröffentlicht die neue Version automatisch (dauert ein bis zwei Minuten; den Fortschritt siehst du im Repository unter **Actions**):

```bash
git push
```

### iPhone

1. In **Safari** die Adresse <https://massmodesanto.github.io/gedankenwelt/> öffnen.
2. Unten auf **Teilen** (Quadrat mit Pfeil) → **Zum Home-Bildschirm** → **Hinzufügen**.
3. Die App vom Home-Bildschirm öffnen → Zahnrad → **Google Drive** → **Mit Google verbinden**.

Wichtig: Die App auf dem Home-Bildschirm hat einen eigenen Speicher, getrennt von Safari ([Apple, WWDC 2023](https://developer.apple.com/videos/play/wwdc2023/10120/)). Melde dich deshalb in der installierten App an, nicht vorher in Safari.

Bitte am iPhone einmal durchprobieren und mir sagen, was nicht stimmt:

- Startet die App ohne Browserleiste, ist oben die Uhrzeit lesbar, und verdeckt die Home-Leiste unten nichts?
- In einer Liste schreiben: einmal Enter = neue Zeile, zweimal Enter = neue Notiz. Bleibt die Tastatur dabei offen?
- Verschwindet die Zeile, in der du tippst, hinter der Tastatur?
- `#` tippen: Lässt sich ein Tag im Dropdown gut mit dem Finger treffen?
- Flugmodus einschalten, App ganz schließen und neu öffnen: Sind die Notizen da?

### Anmeldung testen (Laptop und iPhone)

Unter Einstellungen → Google Drive:

1. **Mit Google verbinden** → bei Google anmelden und zustimmen → du landest wieder in der App, Status „Angemeldet“.
2. **Drive-Zugriff prüfen** → es sollte „Drive-Zugriff klappt“ erscheinen.
3. **Still erneuern** → die App springt kurz weg und zurück. Im Protokoll sollte „Still erneuert – ohne Eingabe“ stehen.
4. **Per Pop-up anmelden** → zum Vergleich der zweite Weg.

Am iPhone bitte alle vier Schritte in der installierten App ausprobieren, dann die App ganz schließen, nach über einer Stunde wieder öffnen und Schritt 3 wiederholen. Das Protokoll mit den Uhrzeiten zeigt, was geklappt hat.

### Abgleich einschalten

Nach dem Anmelden erscheint unter Einstellungen → Google Drive der Kasten **Abgleich einschalten**. Das machst du einmal pro Gerät.

1. Die App sichert zuerst den Stand dieses Geräts als ZIP (in der Browser-Datenbank; später unter „Sicherung vom ersten Verbinden“ herunterladbar).
2. Liegen noch Beispieldaten aus Phase 1 auf dem Gerät, fragt sie einmal, ob sie gelöscht werden sollen.
3. Ist dein Drive leer, wird der Stand hochgeladen. Liegen schon Daten dort (zweites Gerät), wird zusammengeführt.

**Reihenfolge für zwei Geräte:** erst am Laptop einschalten und warten, bis das Wolken-Symbol einen Haken zeigt. Danach am iPhone.

### Das Wolken-Symbol

Oben rechts, neben dem Zahnrad. Antippen zeigt eine Erklärung und „Jetzt abgleichen“.

| Symbol | Bedeutung |
|---|---|
| Wolke mit Haken, blass | alles abgeglichen |
| Wolke mit Pfeil | Änderungen warten oder der Abgleich läuft gerade |
| durchgestrichene Wolke | offline – du kannst normal weiterarbeiten |
| Wolke mit Ausrufezeichen, bernsteinfarben | „Neu anmelden“ nötig |
| Wolke mit Ausrufezeichen, rot | Fehler – Antippen zeigt, was los ist |

Ohne eingerichteten Abgleich ist kein Symbol zu sehen.

### Wenn etwas nicht abgleicht

1. **Symbol antippen.** Dort steht in einem Satz, was los ist.
2. **„Neu anmelden“** erscheint, wenn Google eine Eingabe braucht. Ein Tipp genügt meist. Bis dahin bleibt alles auf dem Gerät gespeichert.
3. **Offline:** nichts tun. Sobald das Netz zurück ist, gleicht die App von selbst ab.
4. **Roter Fehler, der bleibt:** „Jetzt abgleichen“ antippen. Hilft das nicht: Einstellungen → Google Drive → Diagnose → „Drive-Zugriff prüfen“. Die Meldung dort sagt, ob Google erreichbar ist.
5. **Ein Gerät zeigt etwas anderes als das andere:** auf beiden „Jetzt abgleichen“. Die App führt pro Notiz zusammen; es gewinnt die zuletzt geänderte Fassung. Das hängt an den Uhren der Geräte – sie sollten auf „automatisch“ stehen.
6. **Letzter Ausweg:** „Lokale Daten neu aus Drive laden“ wirft den Speicher dieses Geräts weg und baut ihn aus Drive neu auf. Vorher prüfen, dass nichts mehr auf den Abgleich wartet (die App warnt sonst).

Was die App **nie** tut: Dateien in Drive löschen oder leeren, wenn sie den Stand dort nicht vollständig laden konnte. Fehlt in Drive die Datei `_meta.json` (z. B. anderes Konto oder Ordner gelöscht), deutet sie nichts als „gelöscht“, sondern lädt den lokalen Stand neu hoch.

### Was du in Drive tun darfst – und was nicht

- **Text in einer Listendatei ändern oder ergänzen:** ja. Absätze ohne die Kommentarzeile `<!-- id:… -->` werden beim nächsten Abgleich zu neuen Notizen.
- **Einen Absatz samt Kommentarzeile löschen:** Die Notiz landet im Papierkorb der App (30 Tage wiederherstellbar).
- **Dateien verschieben oder umbenennen:** nein. Die App bringt sie an ihren Platz zurück. Listen verschiebst und benennst du in der App.
- **Neue Dateien anlegen:** Die App sieht sie nicht. Ihre Berechtigung (`drive.file`) umfasst nur Dateien, die sie selbst angelegt hat.
- **Die Dateien `_meta.json` und `_papierkorb.md`:** bitte nicht anfassen.

### Entscheidungen in Phase 2

| Entscheidung | Grund |
|---|---|
| Zusammenführen aus drei Ständen (lokal, Drive, letzter gemeinsamer Stand) | Nur so lässt sich unterscheiden, ob etwas auf einer Seite fehlt, weil es neu ist oder weil es dort gelöscht wurde. |
| Die Warteschlange merkt sich, *welche* Notizen und Listen geändert wurden; hochgeladen wird durch Vergleich der Stände | Ein unterbrochener Abgleich muss nichts „nachspielen“: Die nächste Runde stellt aus den Ständen dasselbe Ziel wieder her. Das prüfen die Abbruch-Tests an jeder einzelnen Stelle. |
| Dateien werden an der Listen-ID im Dateikopf erkannt, nicht am Namen | Umbenennen und Verschieben benennt bzw. verschiebt die Datei in Drive, statt sie neu anzulegen. |
| `eltern:` steht im Dateikopf | Der Ordner ist nur die Darstellung. Sonst würde ein unterbrochenes Verschieben beim nächsten Abgleich rückgängig gemacht. |
| Bei gleichem Zeitstempel gilt die Fassung aus Drive | So landen alle Geräte beim selben Ergebnis. |
| Notiz lebt, ihre Liste wurde woanders gelöscht → die Liste kommt zurück | „Löschen ist älter als die Bearbeitung“ soll die Notiz an ihrem Ort zurückbringen, nicht im Eingang abladen. |
| „Alle Daten löschen“ gibt es nur ohne Drive-Verbindung | Ein Fehlklick soll nie den Drive leeren. Verbunden gibt es stattdessen „Lokale Daten neu aus Drive laden“. |
| Sicherung vor dem ersten Verbinden liegt in der Browser-Datenbank | Ein automatischer Download wäre am iPhone ein störendes Fenster. Herunterladen geht jederzeit in den Einstellungen. |
| Stilles Erneuern nur beim Öffnen, beim Zurückkehren oder nach 30 Sekunden ohne Tastendruck | Die Seite springt dafür kurz zu Google. Das soll nie mitten im Tippen passieren. |
| Abgleich einschalten ist ein eigener Knopf | Anmelden allein soll noch nichts hochladen. |

### Einschränkungen

- **Keine Dauer-Anmeldung ohne Server** (siehe oben). Am iPhone ungetestet.
- **Zwischen „nachsehen, ob sich die Datei geändert hat“ und „schreiben“ liegt ein Sekundenbruchteil.** Schreiben beide Geräte exakt gleichzeitig, gewinnt das spätere; die andere Fassung liegt dann im Versionsverlauf von Google Drive. Beim nächsten Abgleich wird trotzdem wieder zusammengeführt.
- **„Neuere Fassung gewinnt“ vertraut den Uhren der Geräte.**
- **Leere Ordner räumt die App weg.** Hast du von Hand eine eigene Datei in einen Listen-Ordner gelegt, sieht die App sie nicht und könnte den Ordner in den Drive-Papierkorb legen (dort 30 Tage wiederherstellbar).

---

## 8. Phase 3: Wiederkehrende Aufgaben und Erinnerungen

### Was fertig ist

- **Wiederkehrende Aufgaben** (rein lokal, vollständig gebaut und geprüft): täglich, wöchentlich an einem oder mehreren Wochentagen, monatlich an einem Tag oder an einem Wochentag (z. B. erster Montag, letzter Freitag), jährlich – jeweils auch „alle n“. Zählweise „nach Kalender“ oder „ab Erledigung“. Ende: nie, an einem Datum oder nach n Mal.
- **Aufgaben-Menü** mit Datum, Uhrzeit, Erinnerung und Wiederholung (Schnellwerte und „Benutzerdefiniert …“ mit Vorschau der nächsten Termine).
- **Abhaken mit Rückmeldung** „Nächstes Mal: …“ und „Rückgängig“.
- **Anzeige:** Wiederholungs-Symbol mit Kurztext („jeden So“, „1. im Monat“), heute Fälliges in Bernstein, Überfälliges ruhig in Rot.
- **Erinnerungen über den Kalender:** ein Termin je offener Aufgabe mit Uhrzeit, in einem eigenen Kalender „Gedankenwelt“. Aktivieren, Deaktivieren, „Erinnerungen neu aufbauen“, Kalender-Selbsttest.
- **Anbindung an den echten Google Kalender** (`src/db/googleKalender.ts`).

### Geprüft und nicht geprüft

- **Geprüft mit Tests:** alle Wiederholungsregeln (38 Tests, u. a. der 31. in kurzen Monaten, 29. Februar, erster/letzter Wochentag, Überspringen verpasster Termine, Enddatum, „nach n Mal“, Zeitumstellung), das Dateiformat hin und zurück, der Kalender-Abgleich gegen den simulierten Kalender (19 Tests, u. a. Abbruch an jeder Stelle, zwei Geräte, im Kalender gelöschter Termin).
- **Geprüft im Browser** (lokale Entwicklungsversion, simulierter Kalender), wie im Auftrag verlangt:
  - „Wochenplanung“, jeden Sonntag 18:00: Nach dem Aktivieren steht der Termin im simulierten Kalender.
  - Abhaken: Die Aufgabe springt auf den nächsten Sonntag, derselbe Termin wandert mit.
  - Offline abhaken: Der Termin bleibt zunächst stehen. Sobald das Netz zurück ist, ist er verschoben – ein Termin, kein doppelter. (Offline habe ich im Browser per Skript nachgestellt, nicht über die Entwicklerwerkzeuge.)
  - Aufgabe mit Uhrzeit löschen: Termin verschwindet. Aus dem Papierkorb holen: Termin ist wieder da.
  - Zwei vor dem Aktivieren angelegte Aufgaben mit Uhrzeit wurden beim Aktivieren nachgetragen, die ohne Uhrzeit nicht.
  - Gebaute Version ohne Google-Verbindung: „Verfügbar, sobald Google verbunden ist“, Knopf gesperrt, kein Fehler. Der simulierte Kalender steckt nicht im veröffentlichten Paket.
  - Kalender-Selbsttest läuft gegen den simulierten Kalender durch.
  - Menü, Dialog und Aufgaben-Zeilen in der auf Handy-Breite verkleinerten Vorschau.
- **Nur mit nachgebauten Google-Antworten geprüft (17 Tests), nie gegen das echte Google:** die Anbindung an den Google Kalender. Geprüft ist, dass Anfragen richtig aufgebaut sind und Fehlerantworten richtig behandelt werden. Ob Google wirklich so antwortet wie dokumentiert, zeigt erst der Selbsttest nach der Einrichtung.
- **Gar nicht geprüft:** die Anfrage der Kalender-Berechtigung bei Google, Benachrichtigungen auf iPhone und Laptop, alles am echten iPhone.

### Format der Wiederholungsregeln

Regel, Erinnerung und Verlauf stehen im Metadaten-Kommentar unter der Aufgabe. Die Regel ist ein einziges Wort ohne Leerzeichen: erst die Art, dann Angaben mit `;` getrennt.

```
[ ] Wochenplanung
<!-- id:01… erstellt:… geaendert:… pos:2 faellig:2026-11-22T18:00 wiederholung:woechentlich;tage=SO;ab=faellig erinnerung:15 verlauf:2026-11-08T17:10:00Z,2026-11-15T17:55:12Z kalender:abc123 -->
```

| Regel | Schreibweise |
|---|---|
| keine Wiederholung | `wiederholung:keine` |
| täglich | `taeglich;ab=faellig` |
| alle 3 Tage | `taeglich;alle=3;ab=faellig` |
| jeden Montag und Donnerstag | `woechentlich;tage=MO,DO;ab=faellig` |
| alle 2 Wochen am Montag | `woechentlich;tage=MO;alle=2;ab=faellig` |
| werktags | `woechentlich;tage=MO,DI,MI,DO,FR;ab=faellig` |
| am 15. jedes Monats | `monatlich;tag=15;ab=faellig` |
| jeden Monatsersten | `monatlich;tag=1;ab=faellig` |
| erster Montag im Monat | `monatlich;am=1.MO;ab=faellig` |
| letzter Freitag im Monat | `monatlich;am=letzter.FR;ab=faellig` |
| jährlich am 15. März | `jaehrlich;datum=03-15;ab=faellig` |
| 3 Tage nach dem letzten Abhaken | `taeglich;alle=3;ab=erledigung` |
| … endet am 31. Januar 2027 | `…;ende=2027-01-31` |
| … noch 3 Mal | `…;noch=3` |

Weitere Angaben im Kommentar:

- `faellig:2026-11-22T18:00` – Ortszeit, ohne Uhrzeit nur das Datum.
- `erinnerung:15` – Minuten vor der Fälligkeit. Fehlt die Angabe, gilt „zur Uhrzeit“.
- `verlauf:…` – wann die Aufgabe abgehakt wurde (die letzten 12 Male, in Weltzeit, mit Komma getrennt).
- `kalender:…` – ID des Termins im Kalender.

Wochentage: `MO DI MI DO FR SA SO`. Gibt es einen Tag nicht (31. im Februar, 29. Februar außerhalb von Schaltjahren), gilt der letzte Tag des Monats.

### So verhalten sich Wiederholungen

- **Nach Kalender** (`ab=faellig`, Standard): Die Termine folgen dem Kalender, egal wann du abhakst. „Jeden Montag“ bleibt jeden Montag.
- **Ab Erledigung** (`ab=erledigung`): Der Abstand zählt ab dem Tag des Abhakens. Wochentage und Monatstage spielen dann keine Rolle, nur „alle n Tage, Wochen, Monate oder Jahre“.
- **Verpasste Termine werden übersprungen.** War „täglich“ einen Monat liegen geblieben, springt die Aufgabe beim Abhaken auf morgen, nicht auf gestern vor vier Wochen. Bei „alle 2 Wochen“ bleibt der Zwei-Wochen-Rhythmus erhalten.
- **Vorzeitig abgehakt** (vor der Fälligkeit): Es folgt der Termin nach der eigentlichen Fälligkeit.
- **Ende erreicht:** Die Aufgabe wird normal erledigt.
- **Uhrzeiten sind Ortszeit.** 9:00 bleibt nach der Zeitumstellung 9:00.

### So verhalten sich Erinnerungen

- Jede **offene Aufgabe mit Uhrzeit** hat genau einen Termin im Kalender „Gedankenwelt“: Titel = erste Zeile der Aufgabe ohne Tags, Dauer 15 Minuten, Zeitzone Europe/Berlin, Benachrichtigung laut Einstellung an der Aufgabe. In der Beschreibung stehen der Pfad und ein Link, der die App bei dieser Aufgabe öffnet.
- Aufgaben ohne Uhrzeit bekommen keinen Termin.
- **Wiederkehrende Aufgaben** sind keine Serie im Kalender, sondern immer nur der eine Termin der nächsten Fälligkeit. Nach dem Abhaken wandert er weiter.
- Abhaken, Löschen oder Uhrzeit entfernen löscht den Termin. Wiederherstellen aus dem Papierkorb legt ihn neu an, wenn er noch in der Zukunft liegt.
- **Die App ist die einzige Wahrheit – es gibt keinen Abgleich zurück.** Änderst du einen Termin direkt im Kalender, überschreibt die App ihn beim nächsten Abgleich wieder. Löschst du ihn dort, legt die App ihn neu an, solange die Aufgabe offen ist und in der Zukunft liegt. Eigene Termine, die du von Hand in den Kalender „Gedankenwelt“ einträgst, lässt die App in Ruhe.
- **Die Erinnerung lässt sich schon vorher einstellen.** Solange die Erinnerungen nicht aktiviert sind, steht im Menü „Erinnerungen sind noch nicht aktiviert“. Beim Aktivieren werden alle offenen Aufgaben mit Uhrzeit nachgetragen.
- Kalender-Änderungen laufen über dieselbe Warteschlange wie der Drive-Abgleich und werden nach einer Offline-Phase nachgeholt. Vorgemerkt wird nur, wenn Drive verbunden ist oder die Erinnerungen aktiv sind.

### Entscheidungen in Phase 3

| Entscheidung | Grund |
|---|---|
| Berechtigung `calendar.app.created` | Die schmalste, die reicht: eigene Kalender anlegen und deren Termine verwalten. Geprüft in Googles Dokumentation am 16. Nov 2026: Sie gilt für Kalender anlegen, prüfen, löschen und für Termine – aber nicht für die Liste aller Kalender ([Übersicht](https://developers.google.com/workspace/calendar/api/auth), [Kalender anlegen](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert), [Termine](https://developers.google.com/workspace/calendar/api/v3/reference/events/list), [Kalenderliste](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list)). |
| Die App findet ihren Kalender nur über die gemerkte ID | Folge der schmalen Berechtigung: Sie darf die Liste deiner Kalender nicht lesen. Die ID steht in `_meta.json`. Geht sie verloren, legt die App einen neuen Kalender an. |
| Kalender-Abgleich vergleicht „soll“ und „ist“, statt Änderungen nachzuspielen | Wie beim Drive-Abgleich: Ein unterbrochener Abgleich muss nichts nachholen, die nächste Runde stellt dasselbe Ziel her. |
| Bei doppelten Terminen bleibt der mit der kleineren Termin-ID | So entscheiden sich Laptop und iPhone immer für denselben, egal wer zuerst abgleicht. |
| Die Termin-ID wird mit einem um eine Sekunde erhöhten Zeitstempel in die Notiz eingetragen | Sie soll über Drive auf dem anderen Gerät ankommen, darf aber nie eine echte Bearbeitung verdrängen, die dort inzwischen gemacht wurde. |
| Verwaiste Termine räumt nur „Erinnerungen neu aufbauen“ auf | Im normalen Abgleich könnte ein Gerät sonst den Termin einer Aufgabe löschen, die das andere Gerät gerade erst angelegt hat. |
| Termine in der Vergangenheit werden nicht neu angelegt | Eine Erinnerung käme ohnehin nicht mehr. Vorhandene bleiben, solange die Aufgabe offen ist. |
| „Nach n Mal“ wird als „noch n Mal“ gespeichert und zählt herunter | So steht in der Datei immer, wie oft die Aufgabe noch kommt, ohne den Verlauf auszählen zu müssen. |
| Der Abhak-Verlauf behält die letzten 12 Zeitpunkte | Der Kommentar in der Drive-Datei soll lesbar bleiben. |
| Ohne Fälligkeit keine Wiederholung | Wer eine Wiederholung ohne Datum setzt, bekommt den ersten Termin der Regel als Datum. „Fälligkeit entfernen“ entfernt auch die Wiederholung. |
| „Ab Erledigung“ kennt nur Abstände | „3 Tage nach dem letzten Mal“ und „jeden Montag“ widersprechen sich; darum gibt es dort keine Wochentage. |
| Termine zählen im Kalender nicht als „beschäftigt“ | Sie sind Erinnerungen, keine Termine mit Dauer. |
| Die Einstellung „Erinnerungen aktiv“ wandert über Drive auf alle Geräte | Du aktivierst einmal. Jedes Gerät pflegt den Kalender dann mit. |
| Am Handy erscheint das Aufgaben-Menü unten über die ganze Breite | Gut mit dem Daumen erreichbar; nichts ragt aus dem Bildschirm. |

### Einschränkungen

- **Gleichen Laptop und iPhone in denselben Sekunden ab, kann ein Termin kurz hin- und herspringen** (z. B. alter und neuer Titel), bis beide den Stand aus Drive haben. Danach stimmt er.
- **Uhren:** Wie beim Drive-Abgleich gewinnt die zuletzt geänderte Fassung.
- **Die Zeitzone ist fest Europe/Berlin.** Auf Reisen in eine andere Zeitzone erinnert der Kalender zur deutschen Uhrzeit.
- **„Kalender behalten“ beim Deaktivieren** lässt die bisherigen Termine stehen. Sie erinnern weiter, werden aber nicht mehr gepflegt.
- **`[x] ` am Zeilenanfang tippen** erledigt eine Aufgabe sofort, auch eine wiederkehrende. Die Wiederholung greift nur beim Abhaken über das Kästchen.

---

## 9. Später erledigen

Alles, was noch offen ist und was nur du tun kannst – in einer Reihenfolge, damit du die Google-Einrichtung nur einmal machen musst.

### 1. Google Cloud einrichten

Folge Abschnitt 7, „Google Cloud einrichten“. Er deckt Drive und Kalender zusammen ab: ein Projekt, **Google Drive API und Google Calendar API** aktivieren, Zustimmungsbildschirm, **beide Berechtigungen** eintragen, Client vom Typ Webanwendung mit den erlaubten Adressen.

### 2. Client-ID schicken

Schick mir (Claude) die Client-ID oder trage sie in `src/konfig.ts` bei `GOOGLE_CLIENT_ID` ein, committe und pushe. **Kein Client-Secret.** Danach wird die App automatisch neu veröffentlicht.

### 3. Laptop verbinden

1. <https://massmodesanto.github.io/gedankenwelt/> in Chrome öffnen.
2. Zahnrad → **Google Drive** → **Mit Google verbinden**. Beim Hinweis „App nicht überprüft“: **Erweitert** → **Weiter zu Gedankenwelt** (Erklärung in Abschnitt 7).
3. **Abgleich einschalten** und warten, bis die Wolke oben rechts einen Haken zeigt.
4. In Google Drive nachsehen: Es gibt den Ordner „Gedankenwelt“ mit lesbaren Markdown-Dateien.
5. Unter **Diagnose: Anmeldung testen** einmal **Still erneuern** ausprobieren (siehe Abschnitt 7, „Anmeldung testen“).

### 4. Erinnerungen aktivieren und Selbsttest

1. Zahnrad → **Erinnerungen** → **Aktivieren**. Die App springt kurz zu Google und fragt die Kalender-Berechtigung an. Zustimmen.
2. Zurück in der App: **Diagnose: Kalender-Selbsttest** aufklappen → **Kalender-Selbsttest starten**. Er meldet fünf Schritte und am Ende „Alles in Ordnung“.
3. Im Google Kalender nachsehen: Links gibt es den Kalender „Gedankenwelt“, deine übrigen Kalender sind unverändert.
4. Eine Aufgabe „Wochenplanung“, jeden Sonntag 18:00, anlegen → nach wenigen Sekunden steht sie im Kalender „Gedankenwelt“.

Meldet der Selbsttest einen Fehler, schick mir den Wortlaut. Das ist die Stelle, an der sich zeigt, ob die Anbindung an das echte Google stimmt.

### 5. iPhone

1. App installieren und verbinden: Abschnitt 7, „iPhone“. Danach **Abgleich einschalten**.
2. Die Prüfliste aus Abschnitt 7 durchgehen (Start ohne Browserleiste, Schreiben mit zweimal Enter, Tastatur, Tag-Dropdown, Flugmodus).
3. **Benachrichtigungen einrichten – empfohlen: die Google-Kalender-App.**
   - „Google Kalender“ aus dem App Store installieren und mit demselben Google-Konto anmelden.
   - Beim ersten Start **Mitteilungen erlauben**. Falls übersprungen: iPhone-Einstellungen → Mitteilungen → Google Kalender → Mitteilungen erlauben.
   - In der App: Menü (drei Striche) → prüfen, dass bei **Gedankenwelt** ein Haken sitzt. Ist der Kalender nicht zu sehen: nach unten ziehen zum Aktualisieren.
   - Fokus-Modi („Nicht stören“, „Schlafen“) lassen Mitteilungen nur durch, wenn Google Kalender dort erlaubt ist.
4. Zum Testen eine Aufgabe mit Uhrzeit in fünf Minuten anlegen, Erinnerung „Zur Uhrzeit“.

**Warum die Google-App und nicht Apples Kalender?** Einen belastbaren Vergleich habe ich nicht gefunden (Stand 16. Nov 2026), nur Erfahrungsberichte. Die sprechen für die Google-App: Apples Kalender holt Google-Termine in Abständen ab und nicht sofort; Nutzer und ein Entwickler berichten von 30 Sekunden bis mehreren Minuten Verzögerung und von langsamem Abgleich ([Apple-Entwicklerforum](https://developer.apple.com/forums/thread/766375), [Apple-Forum](https://discussions.apple.com/thread/255205067)). Bei einer Aufgabe, die du kurz vor ihrer Uhrzeit anlegst oder verschiebst, käme die Erinnerung dann zu spät oder gar nicht. Das ist eine Einschätzung aus Berichten, keine Messung.

**Wenn du trotzdem Apples Kalender nutzen willst:** iPhone-Einstellungen → Kalender → Accounts → Google-Konto hinzufügen, „Kalender“ einschalten. Zusätzliche Kalender wie „Gedankenwelt“ gibst du für Apple-Geräte unter <https://calendar.google.com/calendar/syncselect> frei (Haken bei „Gedankenwelt“ setzen, speichern). Diesen Weg kenne ich aus früheren Google-Anleitungen; ich habe ihn für diese README nicht neu nachgeprüft.

### 6. Laptop: Benachrichtigungen in Chrome unter Ubuntu

Quelle: [Google-Hilfe „Fehlende Kalender-Benachrichtigungen“](https://support.google.com/calendar/answer/12200012), Stand 16. Nov 2026.

1. <https://calendar.google.com> in Chrome öffnen → Zahnrad → **Einstellungen** → links unter **Allgemein** → **Benachrichtigungseinstellungen** → **Desktop-Benachrichtigungen** wählen.
2. Fragt Chrome, ob calendar.google.com Benachrichtigungen zeigen darf: **Zulassen**. Nachträglich: Schloss-Symbol links neben der Adresse → Benachrichtigungen → Zulassen.
3. **Der Kalender muss in einem Tab offen sein**, sonst erscheint am Laptop nichts. Am einfachsten: den Tab anpinnen (Rechtsklick auf den Tab → „Anpinnen“).
4. Kommt trotzdem nichts: In die Adresszeile `chrome://flags/#enable-system-notifications` eingeben, die Einstellung umschalten, Chrome neu starten. Google nennt das ausdrücklich für Linux. Prüfe außerdem in den Ubuntu-Einstellungen → Benachrichtigungen, dass Chrome erlaubt ist und „Nicht stören“ aus ist.

Unter Ubuntu selbst habe ich das nicht ausprobiert.

### 7. Wenn etwas nicht klappt

**Der Abgleich:** Abschnitt 7, „Wenn etwas nicht abgleicht“.

**Eine Erinnerung kommt nicht:**

1. Hat die Aufgabe eine **Uhrzeit**? Ohne Uhrzeit gibt es keinen Termin.
2. Steht der Termin im Google Kalender unter „Gedankenwelt“? Wenn nein: In der App die Wolke antippen → „Jetzt abgleichen“. Steht dort ein bernsteinfarbener Hinweis zu den Erinnerungen, sagt er, was fehlt.
3. Fehlt auf einem Gerät die Kalender-Berechtigung: Zahnrad → Erinnerungen → erneut aktivieren.
4. Der Termin steht im Kalender, aber es kommt keine Mitteilung: Das liegt dann am Gerät – Mitteilungen der Kalender-App, Fokus-Modus, am Laptop der offene Kalender-Tab (Schritte 5 und 6).
5. Stimmt im Kalender etwas nicht (doppelt, veraltet, verwaist): Zahnrad → Erinnerungen → **Erinnerungen neu aufbauen**.
6. Den Kalender „Gedankenwelt“ versehentlich im Google Kalender gelöscht: Die App legt ihn beim nächsten Abgleich neu an und trägt alle offenen Aufgaben mit Uhrzeit wieder ein.
7. Hilft nichts: **Kalender-Selbsttest** starten und mir die Meldungen schicken.
