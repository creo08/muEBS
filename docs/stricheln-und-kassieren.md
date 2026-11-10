# Stricheln und Kassieren

*Art: Anleitung. Für den Betrieb an der Schank.*

## Die beiden Modi

| | Vorauszahlung | Deckel |
|---|---|---|
| Ablauf | erst Geld aufbuchen, dann stricheln | erst stricheln, dann zahlen |
| Anzeige | Guthaben, z. B. `-3,50 €` | `offen 3,50 €`, bei 0 nichts, bei Plus `Guthaben 3,50 €` |
| Kassieren auf der Buchen-Seite | – | ja |
| Kassierliste auf der Startseite | – | ja |

Der Modus lässt sich jederzeit in den [Einstellungen](einstellungen.md) umschalten.

## Stricheln

1. Startseite: Kachel antippen oder den Namen, Spitznamen oder Betrag suchen.
2. Buchen-Seite: Jeder Tipp auf eine Artikel-Kachel fügt ein Stück hinzu (auf dem Tablet steht die Bestellung als Bon rechts daneben). Jeder Tipp auf eine Zeile der Bestellung entfernt ein Stück; bei 0 verschwindet die Zeile.
3. „Jetzt X,XX € buchen“ antippen. Der Knopf sperrt sich sofort, ein Doppeltipp bucht also nur einmal.
4. Nach dem Speichern geht es automatisch zur Startseite.

Schlägt das Speichern fehl, bleibt die Seite mit Fehlermeldung offen und die Bestellung erhalten. Bei vollem Speicher steht dort „Speicher voll – bitte sichern“.

„Zurück“ verlässt die Seite ohne zu buchen.

## Storno

Unten auf der Buchen-Seite stehen die letzten 10 Buchungen.

- **Storno** macht eine Buchung ungültig (mit Rückfrage). Die Zeile wird durchgestrichen, das Guthaben korrigiert.
- **Storno aufheben** macht sie wieder gültig (mit Rückfrage).
- Das lässt sich beliebig oft wiederholen. Stornierbar sind Artikel, Aufbuchungen, Zahlungen und Überträge.
- Nichts wird gelöscht: Jedes Storno ist ein eigener Eintrag.

## Aufbuchen (Einzahlung)

Admin-Bereich → „Aufbuchung (Einzahlung)“: Namen oder Spitznamen ins Suchfeld tippen, das Mitglied in der Trefferliste antippen, Betrag in Euro eingeben, „Aufbuchen“. Danach steht die Suche für das nächste Mitglied bereit. Geht auch für geschwärzte Mitglieder. Aus der Mitglieder-Seite im Admin-Bereich führt „Aufbuchen“ direkt mit dem gewählten Mitglied hierher.

## Kassieren (Deckel)

1. Buchen-Seite des Mitglieds öffnen.
2. Unter „Kassieren“ steht die Aufstellung: alle gültigen Buchungen seit dem letzten Zeitpunkt, an dem nichts offen war – Artikel gruppiert (Menge × Name, Summe), darunter Teilzahlungen und der offene Betrag.
3. Der Betrag ist mit dem offenen Betrag vorbelegt. Für eine Teilzahlung ändern.
4. „X,XX € kassiert“ antippen. Die Zahlung ist eine normale Buchung und lässt sich stornieren.

Kassieren braucht keinen PIN und geht auch bei geschwärzten Mitgliedern. Es gibt keinen Druck und keinen Export der Aufstellung.

## Kassierliste (Deckel)

Kopfleiste → „Kassierliste“:

- Oben: **Summe offen** und **kassiert seit Beginn des Kassiertags**. Der Kassiertag beginnt um 06:00 Uhr Ortszeit.
- Darunter alle Mitglieder mit offenem Betrag. „bezahlt“ (mit Rückfrage) bucht den ganzen offenen Betrag als Zahlung.

## Startseite

- Ohne Suche zeigt die Startseite die aktiven Mitglieder, die in den letzten 14 Tagen mindestens einen Artikel gebucht haben. Passen nicht alle auf den Bildschirm, kommen die mit den meisten Stück dran. Angezeigt wird immer alphabetisch.
- Die Suche findet immer alle aktiven Mitglieder.

## Mitglieder und Artikel verwalten

Admin-Bereich → „Mitglieder“ bzw. „Artikel“: eine Tabelle mit Suchfeld. Ein Tipp auf den Namen öffnet die Seite zum Bearbeiten (Name, Spitzname bzw. Preis und Reihenfolge, aktiv). „Neues Mitglied“ und „Neuer Artikel“ bleiben nach dem Anlegen offen, damit mehrere Einträge schnell hintereinander gehen. Gelöscht wird nie, nur deaktiviert; eine Nr. wird nie neu vergeben. Artikelnamen sind eindeutig, auch gegenüber inaktiven Artikeln (das Vollsystem verlangt das beim Umstieg).

Auf dem Tablet steht die Navigation des Admin-Bereichs links, auf dem Handy ist sie die Übersicht, und jede Unterseite hat „Zurück zum Admin-Bereich“.
