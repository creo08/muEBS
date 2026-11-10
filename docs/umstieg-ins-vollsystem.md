# Umstieg ins Vollsystem

*Art: Anleitung. Von µEBS ins Vollsystem [Ergo Bibamus](https://github.com/relaxin101/barsystem) wechseln.*

> **Warnung:** Nur in ein **leeres** Vollsystem importieren. In einem schon befüllten Vollsystem überschreibt der Import Mitglieder und Artikel mit derselben id (Name, Spitzname, aktiv, Grenze bzw. Name, Preis, aktiv, Typ) und zählt die Guthaben zu den vorhandenen dazu. Ist die Schwärzung in µEBS aus, behalten vorhandene Mitglieder ihre Grenze. Gibt es dort schon einen Artikel mit gleichem Namen unter einer anderen id, bricht der Artikel-Import ganz ab, Mitglieder und Guthaben kommen trotzdem an.

Das Format ist gegen Commit `6ef739e` des Vollsystems geprüft: Import über die Admin-Formulare in ein leeres System, mit SQLite und mit PostgreSQL, danach stimmen alle Mitglieder, Artikel und Guthaben überein (Testdaten: Demo und `tests/fixtures/umstieg-grenzfaelle.json`).

## 1. Dateien exportieren

Admin-Bereich → „Exporte“ → „Umstieg ins Vollsystem“. Dort steht auch die Adresse des Vollsystems. Drei Knöpfe laden je eine Datei:

| Datei | Spalten | Inhalt |
|---|---|---|
| `mitglieder_v2.csv` | Schwärzung ein: `id;name;nickname;aktiv;schwaerzungs_grenze`<br>Schwärzung aus: `id;name;nickname;aktiv` | Alle Mitglieder, auch inaktive (`aktiv` 0). Bei Schwärzung ein steht die Grenze aus µEBS in Euro in `schwaerzungs_grenze`. Bei Schwärzung aus fehlt die Spalte: Neue Mitglieder bekommen dann die globale Grenze des Vollsystems (`MINDEST_GUTHABEN` in seiner `.env`; ist dort keine gesetzt, gilt kein Limit). |
| `artikel_v1.csv` | `id;reihenfolge;name;preis;aktiv;typ` | Alle Artikel, auch inaktive (`aktiv` 0), Preis in Euro, `typ` immer `stueck`. |
| `guthaben_v1.csv` | `id;betrag` | Nur Mitglieder mit Saldo ≠ 0 (auch inaktive); `betrag` ist der Saldo, auch negativ. |

Ein Knopf lädt genau eine Datei, es gibt kein ZIP.

Artikelnamen müssen im Vollsystem eindeutig sein. µEBS lässt deshalb keine zwei Artikel mit gleichem Namen zu, auch nicht neben einem inaktiven. Stammen doppelte Namen aus einer älteren Sicherung, bricht der Export mit einer Meldung ab, die die betroffenen Nummern nennt; nach dem Umbenennen geht es.

In der Demo heißen die Dateien `muebs_demo_mitglieder_v2.csv` usw.

`mitglieder_v2.csv` ersetzt `mitglieder_v1.csv`: In v1 stand bei Schwärzung aus eine leere Grenze, die im Vollsystem die Grenze vorhandener Mitglieder löscht.

Alle Dateien: Semikolon als Trenner, UTF-8 mit BOM, Euro mit Dezimalkomma, `aktiv` als 1/0, Zeilenende CRLF. Textfelder stehen in Anführungszeichen; beginnt ein Text mit `=`, `+`, `-`, `@`, Tab oder CR, steht ein `'` davor.

## 2. CSV in Excel öffnen und als .xlsx speichern

Das Vollsystem liest Excel-Dateien.

1. Die CSV-Datei in Excel öffnen (Doppelklick oder „Datei → Öffnen“). Dank BOM erkennt Excel die Umlaute.
2. Prüfen, dass die Spalten getrennt sind. Falls nicht: „Daten → Aus Text/CSV“, Trennzeichen „Semikolon“, Dateiursprung „UTF-8“.
3. Spaltenüberschriften **nicht** ändern.
   Die Spalten `betrag`, `preis` und `schwaerzungs_grenze` müssen als **Zahlen** erkannt sein (rechtsbündig). Stehen sie als Text da, etwa weil Excel nicht mit deutschen oder österreichischen Einstellungen läuft, übernimmt das Vollsystem beim Guthaben-Import keine einzige Zeile („Keine gültigen Zeilen gefunden.“). Mitglieder und Artikel kommen auch mit Text an.
4. „Datei → Speichern unter“ → Dateityp „Excel-Arbeitsmappe (*.xlsx)“.
5. Für alle drei Dateien wiederholen.

## 3. Ins Vollsystem importieren

Reihenfolge: **Mitglieder, Artikel, Guthaben**.

1. Mitglieder importieren (`mitglieder_v2.xlsx`). Fehlt die Spalte `schwaerzungs_grenze` (Schwärzung aus), das Feld im Formular trotzdem unverändert lassen; der Import überspringt es.
2. Artikel importieren (`artikel_v1.xlsx`).
   Im Import-Formular des Vollsystems die **Spaltennamen unverändert lassen** – sie passen bereits.
3. Zuletzt die Guthaben importieren (`guthaben_v1.xlsx`): Spalte Mitglied-ID `id`, Spalte Aufbuchung `betrag`. Das Vollsystem bucht die Beträge summativ auf.
4. Stichprobe: Einige Salden im Vollsystem mit µEBS vergleichen.

## Was nicht übernommen wird

Einzelbuchungen, Stornos und der PIN gehen nicht ins Vollsystem. Für die Unterlagen vorher eine [Sicherung](sicherung-und-projekt.md) aufheben.
