# Sicherung und Projekt

*Art: Anleitung. Daten sichern, wiederherstellen und ein neues Projekt beginnen.*

Alle Daten liegen nur in diesem Browser auf diesem Gerät. µEBS sichert nicht automatisch und erinnert nicht daran. Wann die letzte Sicherung war, steht im Admin-Bereich.

## Sicherung exportieren

- Kopfleiste → „Sicherung“ (ohne PIN, auf jeder Seite), oder Admin-Bereich → „Exporte“ → „Sicherung herunterladen“.
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

Admin-Bereich → „Exporte“ → „Leeres Projekt“. Das leere Projekt ist **nur ein Export**: Die Daten an diesem Gerät bleiben unverändert. Erst wer die Datei lädt (hier oder auf einem anderen Gerät), ersetzt damit die Daten.

Die Datei enthält alle Mitglieder und Artikel (auch inaktive) und die Einstellungen. Zuerst die Variante wählen:

### Guthaben auf 0 setzen (mit Abrechnung)

Alle Mitglieder starten mit Guthaben 0, die Datei enthält keine Buchungen. Damit offene Beträge nicht verloren gehen, gibt es dazu eine Abrechnung:

1. **„Abrechnung speichern“** lädt `abrechnung_v1.csv` herunter.
2. Erst danach wird **„Projekt speichern“** aktiv und lädt die Projektdatei herunter. Beide Dateien entstehen aus demselben Datenstand.

Zwei getrennte Knöpfe, weil iOS pro Tipp nur einen Download zulässt. Wer die Variante wechselt, muss die Abrechnung neu speichern.

`abrechnung_v1.csv` hat die Spalten `id;name;nickname;guthaben;offen;bezahlt`:

| Spalte | Inhalt |
|---|---|
| `guthaben` | der Saldo (Summe aller nicht stornierten Buchungen) |
| `offen` | der offene Betrag, wenn der Saldo unter 0 liegt, sonst 0,00 |
| `bezahlt` | Summe der nicht stornierten Zahlungen (Kassieren) im Projekt |

Format wie beim [Umstieg](umstieg-ins-vollsystem.md): Semikolon, UTF-8 mit BOM, Euro mit Dezimalkomma, Zeilenende CRLF, Textfelder geschützt.

### Guthaben übernehmen

**„Projekt speichern“** lädt die Projektdatei herunter. Je Mitglied mit Saldo ≠ 0 enthält sie eine Buchung „Übertrag“ über genau diesen Saldo (mit dem Zeitpunkt des Exports); das Guthaben im neuen Projekt ist damit gleich. Ein Übertrag lässt sich wie jede Buchung stornieren.

Dateiname: `muebs_projekt_JJJJ-MM-TT_HHMM.json`. Laden wie eine Sicherung.

In der Demo heißen die Dateien `muebs_demo_projekt_…json` und `muebs_demo_abrechnung_v1.csv`; die Projektdatei trägt `"demo": true` und lässt sich nicht als echte Daten laden.

## Gerät zurücksetzen

Admin-Bereich → „Gerät zurücksetzen“. µEBS schlägt eine Sicherung vor und fragt zweimal nach. Danach sind alle Daten, die Demo und der PIN gelöscht, und das Gerät bekommt eine neue Kennung.

Ist µEBS noch in einem anderen Fenster oder Browser-Tab offen, kann das Löschen nicht weiter. µEBS meldet dann „Bitte andere µEBS-Fenster und Browser-Tabs schließen“ und macht von selbst weiter, sobald sie zu sind. Kommt µEBS beim Start nicht an die Daten, erscheint nach 10 Sekunden „µEBS wartet auf die Daten“ mit dem Knopf „Neu laden“.

## Datenerhalt

- µEBS bittet den Browser um dauerhaften Speicher; den Status zeigen die [Einstellungen](einstellungen.md).
- Browser können Daten trotzdem löschen, z. B. beim Löschen der Website-Daten oder auf iOS nach langer Nichtnutzung.
- Vor Import, Zurücksetzen und Datenbank-Aktualisierungen schlägt µEBS eine Sicherung vor.

## Dateiformat

JSON mit `format` (derzeit `1`), `typ` (`sicherung` oder `projekt`), `erstellt`, `projekt`, `mitglieder`, `artikel` und `buchungen`. Beträge sind ganze Cent. Exporte aus der Demo heißen `muebs_demo_…` und tragen `"demo": true`.
