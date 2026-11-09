# Sicherung und Projekt

*Art: Anleitung. Daten sichern, wiederherstellen und ein neues Projekt beginnen.*

Alle Daten liegen nur in diesem Browser auf diesem Gerät. µEBS sichert nicht automatisch und erinnert nicht daran. Wann die letzte Sicherung war, steht im Admin-Bereich.

## Sicherung exportieren

- Startseite → „Sicherung exportieren“ (ohne PIN), oder Admin-Bereich → „Exporte“.
- Dateiname: `muebs_sicherung_JJJJ-MM-TT_HHMM.json`.
- Enthält Projekt-Einstellungen, Mitglieder, Artikel und alle Buchungen – aber nie den PIN und nie die Geräte-Kennung.

Lege die Datei an einem sicheren Ort ab, z. B. in einem Cloud-Ordner. Sie ist nicht verschlüsselt.

## Sicherung laden

1. Admin-Bereich → „Sicherung laden“ (oder auf der Init-Seite „Sicherung/Projekt laden“).
2. Datei wählen, „Laden“.
3. µEBS prüft die ganze Datei. Erst danach fragt es „Vorher sichern?“ und „Alle Daten am Gerät werden ersetzt“.
4. Alle Daten werden in einem Schritt ersetzt. Geht dabei etwas schief, bleibt der alte Zustand vollständig erhalten.

Abgelehnt werden u. a.:

- Dateien über 25 MB,
- Dateien aus einer neueren µEBS-Version („Datei aus neuerer Version“),
- Dateien, deren Guthaben nicht zu den Buchungen passen („Sicherung ist in sich nicht stimmig“),
- unbekannte Felder, falsche Typen, Verweise auf nicht vorhandene Mitglieder, Artikel oder Buchungen,
- Demo-Exporte (sie tragen `"demo": true`).

## Leeres Projekt (z. B. neues Semester)

Admin-Bereich → „Exporte“ → „Leeres Projekt exportieren“. Das Projekt enthält Mitglieder, Artikel und Einstellungen, aber keine Buchungen. µEBS fragt:

- **Guthaben auf 0 setzen** – alle starten bei 0. Zusätzlich wird `abrechnung_v1.csv` heruntergeladen: pro Person `guthaben`, `offen` und `bezahlt` (Summe der Zahlungen im Projekt).
- **Guthaben übernehmen** – je Mitglied mit Saldo ≠ 0 entsteht eine Buchung „Übertrag“.

Dateiname: `muebs_projekt_JJJJ-MM-TT_HHMM.json`. Laden wie eine Sicherung.

## Gerät zurücksetzen

Admin-Bereich → „Gerät zurücksetzen“. µEBS schlägt eine Sicherung vor und fragt zweimal nach. Danach sind alle Daten, die Demo und der PIN gelöscht, und das Gerät bekommt eine neue Kennung.

## Datenerhalt

- µEBS bittet den Browser um dauerhaften Speicher; den Status zeigen die [Einstellungen](einstellungen.md).
- Browser können Daten trotzdem löschen, z. B. beim Löschen der Website-Daten oder auf iOS nach langer Nichtnutzung.
- Vor Import, Zurücksetzen und Datenbank-Aktualisierungen schlägt µEBS eine Sicherung vor.

## Dateiformat

JSON mit `format` (derzeit `1`), `typ` (`sicherung` oder `projekt`), `erstellt`, `projekt`, `mitglieder`, `artikel` und `buchungen`. Beträge sind ganze Cent. Exporte aus der Demo heißen `muebs_demo_…` und tragen `"demo": true`.
