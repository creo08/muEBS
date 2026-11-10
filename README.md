# µEBS

Strichliste als Offline-Web-App für Vereins- und Verbindungsbars: Daten bleiben am Gerät, kein Server, kein Konto. Mini-Version von [Ergo Bibamus](https://github.com/relaxin101/barsystem).

> µEBS ist eine Mini-Version und ersetzt kein Vollsystem.

## Was µEBS kann

- **Stricheln an der Schank:** Mitgliederkacheln mit Suche, Bestellung per Tipp, Buchung mit einem Knopf, Storno und Storno aufheben.
- **Zwei Modi:** Vorauszahlung (erst aufbuchen) oder Deckel (stricheln, dann kassieren, mit Kassierliste).
- **Schwärzung:** Wer unter eine Grenze fällt, wird schwarz angezeigt und kann keine Artikel buchen, bis das Guthaben wieder bei 0 liegt.
- **Offline:** Nach dem ersten Laden läuft µEBS ohne Internet und lässt sich auf dem Homescreen installieren.
- **Sicherung und leeres Projekt** als Datei, **Umstieg ins Vollsystem** per CSV.
- **Demo** mit erfundenen Daten, getrennt von echten Daten.

## Bedienung

| Seite | Inhalt |
|---|---|
| [Erste Schritte](docs/erste-schritte.md) | Installieren, Projekt anlegen, erste Buchung |
| [Stricheln und Kassieren](docs/stricheln-und-kassieren.md) | Buchen, Storno, Aufbuchen, Kassieren, Kassierliste |
| [Einstellungen](docs/einstellungen.md) | Farbschema, Modus, Schwärzung, PIN, Speicher |
| [Sicherung und Projekt](docs/sicherung-und-projekt.md) | Sichern, Laden, leeres Projekt, Gerät zurücksetzen |
| [Umstieg ins Vollsystem](docs/umstieg-ins-vollsystem.md) | CSV-Export, Excel, Import ins Vollsystem |
| [Datensicherheit](docs/datensicherheit.md) | Datenschutzhinweis, PIN, Schwärzung, CSP |
| [Entwicklung](docs/entwicklung.md) | Aufbau, Tests, Handprüfung vor dem Release |

## Umstieg ins Vollsystem

Unter „Exporte“ erzeugt µEBS `mitglieder_v2.csv`, `artikel_v1.csv` und `guthaben_v1.csv` im Format von Ergo Bibamus. Die Dateien in Excel öffnen, als `.xlsx` speichern und im Vollsystem mit unveränderten Spaltennamen importieren.

> **Warnung:** Nur in ein **leeres** Vollsystem importieren. Die Guthaben werden dort zusätzlich aufgebucht; in einem befüllten System entstehen falsche Salden.

Schritt für Schritt: [docs/umstieg-ins-vollsystem.md](docs/umstieg-ins-vollsystem.md).

## Datenschutz in Kürze

Alle Daten bleiben unverschlüsselt im Browser des Geräts. GitHub protokolliert beim Laden der App die IP-Adresse. Keine Analytics, kein Tracking. Der PIN ist nur ein Bedienschutz. Mehr in [docs/datensicherheit.md](docs/datensicherheit.md), Sicherheitslücken bitte über [SECURITY.md](SECURITY.md) melden.

## Release

Releases entstehen per Knopfdruck in GitHub Actions:

1. Im Repository **Actions** → Workflow **Release** → **Run workflow** wählen.
2. Art der Version wählen: `patch`, `minor` oder `major`.
3. Der Workflow prüft (Typen, Tests, `scripts/cleanup.sh`), berechnet die nächste Version nach SemVer aus dem letzten Tag `v*` (ohne Tag: `v0.1.0`), schreibt `version.json` ins Artefakt und deployt nach GitHub Pages.
4. Erst nach erfolgreichem Deploy setzt er den Tag `vX.Y.Z` und legt ein GitHub Release mit automatischen Release Notes an.

Die App zeigt danach `vX.Y.Z (sha)` im Hinweis. Geöffnete Geräte zeigen auf der Startseite „Neue Version – jetzt laden“. Vor jedem Release die [Handprüfung](docs/entwicklung.md#handprüfung-vor-jedem-release) machen.

## Entwicklung

```bash
npm ci
npx tsc --noEmit && node --test tests/unit/ && npx playwright test && bash scripts/cleanup.sh
```

Details in [docs/entwicklung.md](docs/entwicklung.md).

## Lizenz

[MIT](LICENSE)
