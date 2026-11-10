# Testprotokoll für v1.0.0

*Art: Anleitung zum Ausfüllen. Für die Feldtests vor dem ersten Major-Release.*

Dieses Protokoll gehört zur Freigabe von `v1.0.0` (siehe [Entwicklung](entwicklung.md#weg-zu-v100)). Jede Zeile beschreibt einen Ablauf und was dabei passieren soll. In die Spalte **Befund** kommt „ok“ oder was stattdessen passiert ist, mit Gerät und Version.

## So ausfüllen

1. Die getestete Version steht unten im Hinweis der App, z. B. `v0.4.1 (abc1234)`. Bitte bei jedem Befund angeben.
2. Diese Datei kopieren (oder den Inhalt in ein Issue bzw. eine Nachricht übernehmen) und die Spalte **Befund** ausfüllen.
3. Bei Fehlern hilft: was angetippt wurde, was zu sehen war (Bildschirmfoto), installierte App oder Browser-Tab, online oder offline.

## Geräte

| Gerät | System und Browser | Installiert oder Tab | Version der App |
|---|---|---|---|
| iPhone | iOS …, Safari | | |
| Android | Android …, Chrome … | | |
| Tablet an der Schank | | | |

## Abläufe

### Installation und Betrieb

| Nr. | Ablauf | Erwartet | Befund |
|---|---|---|---|
| 1 | Seite öffnen, zum Homescreen hinzufügen, vom Homescreen starten | App startet ohne Browserleiste, Hinweis zeigt `vX.Y.Z (sha)` | |
| 2 | Flugmodus ein, App schließen und neu öffnen, eine Buchung machen | App lädt, Buchung wird gespeichert | |
| 3 | Nach einem Release: App auf der Startseite öffnen | Banner „Neue Version – jetzt laden“; nach dem Tippen neue Version im Hinweis | |
| 4 | Erster Start nach einem Release mit neuer Datenbank-Version (falls angekündigt) | Einmal „Vorher sichern?“, danach normal weiter, auch wenn man länger überlegt | |

### An der Schank

| Nr. | Ablauf | Erwartet | Befund |
|---|---|---|---|
| 5 | Startseite: Mitglied suchen nach Name, Spitzname, Betrag | Treffer erscheinen beim Tippen | |
| 6 | Startseite nach einigen Buchungen | Zuletzt aktive Mitglieder als Kacheln, alphabetisch, ohne Scrollen | |
| 7 | Buchen: Artikel antippen, Zeile im Bon antippen, „Jetzt X,XX € buchen“ doppelt antippen | Stück dazu bzw. weg; nur eine Buchung; zurück zur Startseite | |
| 8 | Storno und „Storno aufheben“ in „Letzte Buchungen“ | Rückfrage, Zeile durchgestrichen bzw. wieder normal, Guthaben stimmt | |
| 9 | Schwärzung: Mitglied unter die Grenze buchen, dann diese Buchung stornieren | Kachel schwarz; nach dem Storno wieder normal, auch wenn noch unter 0 | |
| 10 | Geschwärztes Mitglied: Artikel antippen, kassieren (Deckel) bzw. aufbuchen | Artikel gesperrt; Kassieren und Aufbuchen gehen | |
| 11 | Deckel: Kassieren mit vollem und mit geändertem Betrag | Aufstellung stimmt, Zahlung erscheint, offen stimmt | |
| 12 | Deckel: Kassierliste, „bezahlt“ | Summe offen und Summe kassiert seit 06:00 stimmen | |

### Admin-Bereich

| Nr. | Ablauf | Erwartet | Befund |
|---|---|---|---|
| 13 | Aufbuchung: Mitglied suchen, antippen, Betrag, „Aufbuchen“ | Meldung, Suche bereit für das nächste Mitglied | |
| 14 | Mitglied und Artikel anlegen, bearbeiten, deaktivieren | Nr. wird nie neu vergeben; inaktive erscheinen nicht an der Schank | |
| 15 | Artikel mit einem schon vergebenen Namen anlegen | Meldung „Es gibt schon einen Artikel …“ | |
| 16 | Einstellungen ändern und ohne Speichern weg | Rückfrage Speichern, Verwerfen, Bleiben | |
| 17 | PIN setzen, sperren, fünfmal falsch eingeben | Nach dem fünften Fehlversuch 30 Sekunden Pause | |
| 18 | „Gerät zurücksetzen“, einmal mit und einmal ohne offenen Browser-Tab | Willkommensseite bzw. Meldung „Bitte andere µEBS-Fenster … schließen“; kein Hängen bei „wird geladen“ | |

### Daten

| Nr. | Ablauf | Erwartet | Befund |
|---|---|---|---|
| 19 | „Sicherung“ in der Kopfleiste, dann über „Sicherung laden“ wieder laden | Datei landet in Dateien/Downloads; nach dem Laden alles wie vorher | |
| 20 | Demo starten, Sicherung exportieren, Demo beenden, diese Datei laden | Ablehnung als Demo-Datei; echte Daten unverändert | |
| 21 | Leeres Projekt „Guthaben auf 0“ auf dem **iPhone**: „Abrechnung speichern“, dann „Projekt speichern“ | Beide Dateien kommen an | |
| 22 | Leeres Projekt „Guthaben übernehmen“, Datei auf einem zweiten Gerät laden | Guthaben gleich, je Mitglied ein Übertrag | |

### Umstieg ins Vollsystem

| Nr. | Ablauf | Erwartet | Befund |
|---|---|---|---|
| 23 | Die drei CSV in **Excel** öffnen (österreichische Einstellungen), als `.xlsx` speichern | Umlaute richtig, `betrag` und `preis` rechtsbündig (Zahlen) | |
| 24 | In ein **leeres** Vollsystem importieren: Mitglieder, Artikel, Guthaben | Alle Mitglieder, Artikel und Guthaben wie in µEBS; bei Schwärzung aus die globale Grenze | |

## Ergebnis

| | |
|---|---|
| Offene Fehler | |
| Freigabe für `v1.0.0` | ja / nein |
