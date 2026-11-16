# Gedankenwelt

Persönliche Notiz-App für kurze Gedanken, Aufgaben und längere Texte. Sie läuft als Web-App im Browser.

**Stand: Phase 2 in Arbeit.** Phase 1 (Kern am Laptop) ist fertig. Der Abgleich mit Google Drive ist gebaut und an die App angeschlossen, aber **noch nie gegen das echte Google Drive gelaufen** – dafür fehlt die Client-ID aus deiner Google Cloud. Bis du die App verbindest, liegen alle Daten nur in deinem Browser. Was du einrichten musst, steht in Abschnitt 7.

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

Am Ende sollte stehen: `Test Files  9 passed (9)` und `Tests  111 passed (111)`.

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
- 111 automatische Tests

### Geprüft und nicht geprüft

- **Geprüft:** Alle Tests bestehen. Im eingebauten Browser der Claude-App (Chromium, dieselbe Technik wie Chrome) habe ich durchgespielt: Schreiben, 4× Enter, Teilen, Zusammenführen, Tag-Dropdown, `[ ]`, Suche mit Tippfehler, Sprung zum Treffer, Neuladen, Umsortieren, Verschieben, Papierkorb, Export und Import, heller Modus, Handy-Breite.
- **Nicht geprüft:** dein echtes Chrome, Safari und das iPhone. Die Installation als App und der Offline-Betrieb sind nur gebaut, nicht ausprobiert (das gehört zu Phase 2).

### Bewusst offen

- Google-Anmeldung, Drive-Abgleich, GitHub Pages, iPhone – Phase 2
- Wiederkehrende Aufgaben, Google Kalender – Phase 3 (im Fälligkeits-Menü steht „Wiederholung“ schon ausgegraut)
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

## 7. Phase 2: Google Drive und iPhone (in Arbeit)

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

### Google Cloud einrichten (machst du selbst, einmalig)

Diese Schritte stammen aus Googles Anleitungen ([Zustimmungsbildschirm](https://developers.google.com/workspace/guides/configure-oauth-consent), [Zugangsdaten](https://developers.google.com/workspace/guides/create-credentials), Stand 15. Nov 2026). Ich konnte sie nicht selbst durchklicken. Die Menüs können auf Deutsch etwas anders heißen.

1. **Projekt anlegen.** Öffne <https://console.cloud.google.com> und melde dich mit dem Google-Konto an, in dessen Drive die Notizen liegen sollen. Oben in der Leiste auf die Projektauswahl klicken → **Neues Projekt** → Name `Gedankenwelt` → **Erstellen**. Danach dieses Projekt auswählen.
2. **Google Drive API einschalten.** Menü → **APIs & Dienste** → **Bibliothek** → nach `Google Drive API` suchen → **Aktivieren**.
3. **Zustimmungsbildschirm einrichten.** Menü → **Google Auth Platform** → **Branding** → **Erste Schritte** (Get started).
   - App-Name: `Gedankenwelt`, Support-E-Mail: deine Adresse → **Weiter**
   - Zielgruppe (Audience): **Extern** → **Weiter**
   - Kontakt-E-Mail: deine Adresse → **Weiter**
   - Richtlinie bestätigen → **Weiter** → **Erstellen**
4. **Dich selbst als Testnutzer eintragen.** **Google Auth Platform** → **Zielgruppe** (Audience) → unter **Testnutzer** auf **Nutzer hinzufügen** → deine Google-Adresse → **Speichern**. Damit bist du der einzige, der die App benutzen darf.
5. **Berechtigung festlegen.** **Google Auth Platform** → **Datenzugriff** (Data Access) → **Bereiche hinzufügen oder entfernen** → `…/auth/drive.file` ankreuzen → **Speichern**. Diese Berechtigung erlaubt der App nur Dateien, die sie selbst angelegt hat. Deinen übrigen Drive sieht sie nicht.
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
