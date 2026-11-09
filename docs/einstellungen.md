# Einstellungen

*Art: Referenz. Alle Optionen im Admin-Bereich unter „Einstellungen“.*

Die Einstellungen gehören zum Projekt und stehen in jeder Sicherung – außer dem PIN, der nur am Gerät liegt.

| Option | Werte | Standard | Wirkung |
|---|---|---|---|
| Farbschema | Violett, Blau, Türkis, Grün, Gelb, Orange, Rot, Grau | Violett | Farben von Hintergrund, Knöpfen und Kacheln. Alle Kachelschriften haben einen Kontrast von mindestens 4,5:1. |
| Modus | Vorauszahlung, Deckel | Vorauszahlung | Anzeige der Salden und ob „Kassieren“ und die Kassierliste erscheinen. Jederzeit umschaltbar. Siehe [Stricheln und Kassieren](stricheln-und-kassieren.md). |
| Schwärzung ein | ein/aus | ein (Vorauszahlung), aus (Deckel) | Schwärzt Mitglieder unter der Grenze. |
| Schwärzungsgrenze | Euro, 0 oder negativ, höchstens 2 Nachkommastellen | -20,00 | Gilt für alle Mitglieder gleich. |
| PIN | 4 Ziffern oder keiner | keiner | Sperrt den Admin-Bereich. |
| Speicher | nur Anzeige | – | Zeigt, ob der Browser dauerhaften Speicher gewährt hat. |

## Schwärzung

- Geschwärzt wird ein Mitglied, sobald sein Guthaben **unter** die Grenze fällt.
- Aufgehoben wird die Schwärzung erst, wenn das Guthaben wieder **0 oder mehr** beträgt.
- Geschwärzte Mitglieder erscheinen als schwarze Kachel und können keine Artikel buchen. Kassieren und Aufbuchung bleiben möglich, ebenso Storno.
- Wird die Schwärzung eingeschaltet oder die Grenze geändert, berechnet µEBS den Zustand aller Mitglieder neu: geschwärzt ist dann, wer unter der neuen Grenze liegt.
- Eine geschwärzte Kachel sehen alle am Tresen.

## PIN

- Ist ein PIN gesetzt, fragt µEBS beim Öffnen des Admin-Bereichs danach.
- Der Bereich bleibt entsperrt, bis „Sperren“ angetippt wird oder 5 Minuten lang keine Eingabe erfolgt.
- „PIN entfernen“ hebt die Sperre auf.
- Ohne PIN erreichbar bleiben: Buchen, Storno, Kassieren, Kassierliste und „Sicherung exportieren“ auf der Startseite.
- Der PIN ist nur ein Bedienschutz, siehe [Datensicherheit](datensicherheit.md).

## Speicher

µEBS bittet den Browser beim Start um dauerhaften Speicher. Wird er nicht gewährt, darf der Browser die Daten bei Speichermangel löschen. Dann besonders regelmäßig sichern.
