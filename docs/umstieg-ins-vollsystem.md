# Umstieg ins Vollsystem

*Art: Anleitung. Von µEBS ins Vollsystem [Ergo Bibamus](https://github.com/relaxin101/barsystem) wechseln.*

> **Warnung:** Nur in ein **leeres** Vollsystem importieren. Die ids aus µEBS werden übernommen, und das Vollsystem bucht die Guthaben **zusätzlich** auf. In einem Vollsystem mit Daten entstehen sonst doppelte oder falsche Einträge.

Das Format ist gegen Commit `6ef739e` des Vollsystems geprüft.

## 1. Dateien exportieren

Admin-Bereich → „Exporte“ → „Umstieg ins Vollsystem“. Drei Knöpfe laden je eine Datei:

| Datei | Spalten | Inhalt |
|---|---|---|
| `mitglieder_v1.csv` | `id;name;nickname;aktiv;schwaerzungs_grenze` | Alle Mitglieder. `schwaerzungs_grenze` ist die globale Grenze in Euro, wenn die Schwärzung ein ist; leer, wenn aus (im Vollsystem „Kein Limit“). |
| `artikel_v1.csv` | `id;reihenfolge;name;preis;aktiv;typ` | Alle Artikel, Preis in Euro, `typ` immer `stueck`. |
| `guthaben_v1.csv` | `id;betrag` | Nur Mitglieder mit Saldo ≠ 0; `betrag` ist der Saldo, auch negativ. |

Alle Dateien: Semikolon als Trenner, UTF-8 mit BOM, Euro mit Dezimalkomma, `aktiv` als 1/0, Zeilenende CRLF. Textfelder stehen in Anführungszeichen; beginnt ein Text mit `=`, `+`, `-`, `@`, Tab oder CR, steht ein `'` davor.

## 2. CSV in Excel öffnen und als .xlsx speichern

Das Vollsystem liest Excel-Dateien.

1. Die CSV-Datei in Excel öffnen (Doppelklick oder „Datei → Öffnen“). Dank BOM erkennt Excel die Umlaute.
2. Prüfen, dass die Spalten getrennt sind. Falls nicht: „Daten → Aus Text/CSV“, Trennzeichen „Semikolon“, Dateiursprung „UTF-8“.
3. Spaltenüberschriften **nicht** ändern.
4. „Datei → Speichern unter“ → Dateityp „Excel-Arbeitsmappe (*.xlsx)“.
5. Für alle drei Dateien wiederholen.

## 3. Ins Vollsystem importieren

1. Im Vollsystem zuerst Mitglieder, dann Artikel importieren.
2. Im Import-Formular des Vollsystems die **Spaltennamen unverändert lassen** – sie passen bereits.
3. Zuletzt die Guthaben importieren: Spalte Mitglied-ID `id`, Spalte Aufbuchung `betrag`. Das Vollsystem bucht die Beträge summativ auf.
4. Stichprobe: Einige Salden im Vollsystem mit µEBS vergleichen.

## Was nicht übernommen wird

Einzelbuchungen, Stornos und der PIN gehen nicht ins Vollsystem. Für die Unterlagen vorher eine [Sicherung](sicherung-und-projekt.md) aufheben.
