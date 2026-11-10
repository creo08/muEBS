# Entwicklung

*Art: Anleitung und Referenz. Für alle, die am Code von µEBS arbeiten.*

## Grundsätze

- Vanilla HTML, CSS und JavaScript (ES2022, native ES-Module), keine Build-Kette, keine Laufzeit-Abhängigkeiten.
- Jede JS-Datei beginnt mit `// @ts-check` und nutzt JSDoc-Typen; geprüft wird mit TypeScript 7 (`tsc --noEmit`).
- Zielbrowser: iOS Safari ab 16.4 (Homescreen und Tab) und aktuelles Android Chrome. Keine neueren Funktionen wie `Object.groupBy`, `Promise.withResolvers` oder `Array.fromAsync`.
- Texte nur über `textContent`/`createElement`; `innerHTML` und Verwandte sind verboten.
- UI, Doku, Commits und Kommentare auf Deutsch.

## Einrichten

```bash
export PATH=/opt/node26/bin:$PATH   # nur in der Dev-Umgebung; sonst Node.js 26 aus .nvmrc
npm ci
npx playwright install chromium webkit   # nur einmal, falls die Browser fehlen
```

## Prüfen

```bash
npx tsc --noEmit          # Typprüfung
node --test tests/unit/   # reine Funktionen und cleanup.sh
npx playwright test       # E2E in Chromium und WebKit
bash scripts/cleanup.sh   # Git-Regeln und externe Anfragen
```

Lokal ansehen: `node -e "import('./tests/server.js').then(async (m) => console.log((await m.starteServer()).url))"` startet den Testserver und gibt die Adresse aus.

## Aufbau

| Datei | Aufgabe |
|---|---|
| `index.html` | Seite mit CSP (erstes Element im `<head>`), Bannern und Hinweis |
| `sw.js` | Service Worker: Cache je Version (`muebs-<version>-<sha>`), kein automatisches `skipWaiting` |
| `manifest.webmanifest`, `icons/` | Installation als App |
| `css/schemen.css` | 8 Farbschemen als `[data-schema="…"]`, nur CSS-Variablen |
| `css/app.css` | Layout und Bausteine |
| `js/konstanten.js` | alle festen Werte, u. a. Datenbanknamen `muebs` und `muebs_demo` |
| `js/geld.js` | Cent-Umrechnung ohne Gleitkomma |
| `js/regeln.js` | Fachregeln: Saldo, Storno, Schwärzung, Kassiertag, Aufstellung, Hotlist |
| `js/schema.js` | Prüfung importierter Dateien |
| `js/db.js` | IndexedDB: Schema, Migration, Transaktionen |
| `js/csv.js`, `js/umstieg.js` | CSV-Exporte; alle Umstiegs-Spalten nur in `umstieg.js` |
| `js/app.js`, `js/admin.js`, … | Seiten und Abläufe |
| `demo/demo.json` | Demo-Daten im Sicherungsformat, zugleich Test-Fixture |
| `tests/unit/` | `node --test` |
| `tests/e2e/` | Playwright |

## Datenmodell

IndexedDB-Datenbank `muebs` (Demo: `muebs_demo`), Version 1:

| Store | Schlüssel | Inhalt |
|---|---|---|
| `geraet` | Name | `geraet_id`, PIN-Hash `pin`, `letzte_sicherung`, `demo_aktiv` – nie in Sicherung oder Projekt |
| `projekt` | `einstellungen` | `farbschema`, `modus`, `schwaerzung_aktiv`, `schwaerzungs_grenze` (Cent, ≤ 0) |
| `mitglied` | `id` | `id`, `name`, `nickname`, `aktiv`, `guthaben` (Cent), `geschwaerzt` |
| `artikel` | `id` | `id`, `name`, `preis` (Cent), `reihenfolge`, `aktiv` |
| `buchung` | `id` (UUID) | `geraet_id`, `typ`, `mitglied_id`, `artikel_id`, `storno_von`, `menge`, `preis_pro_einheit`, `gesamtpreis`, `zeitstempel`; Indizes `mitglied_id` und `zeitstempel` |

- `geschwaerzt` ist ein Merker für die Schwärzung. Er ergibt sich immer aus dem Verlauf der gültigen Buchungen (`schwaerzungAusVerlauf()` in `js/regeln.js`: an unter der Grenze, aus erst bei Guthaben ≥ 0). So hebt ein Storno die Schwärzung auf, die die stornierte Buchung ausgelöst hat. Der Import prüft den Merker genau gegen diesen Verlauf.
- Buchungen werden nur angehängt. Ein Storno-Eintrag schaltet seine Originalbuchung um; „storniert“ wird abgeleitet.
- `mitglied.guthaben` wird in derselben Transaktion wie die Buchung nachgeführt und muss immer der Summe der nicht stornierten Buchungen entsprechen. Die E2E-Tests prüfen das nach jeder Aktion.
- Migrationen nur in `onupgradeneeded` (`migriere()` in `js/db.js`), vorher schlägt die App eine Sicherung vor.

## Release

Siehe [README](../README.md#release). Der Workflow schreibt `version.json` nur ins Artefakt; lokal fehlt sie, die App zeigt dann „Entwicklungsversion“ und verlinkt die Doku auf `main`.

## Handprüfung vor jedem Release

Playwright-WebKit ist nicht iOS Safari. Vor jedem Release auf einem echten iPhone (iOS 16.4 oder neuer) **und** einem Android-Gerät mit aktuellem Chrome prüfen:

1. **Installieren:** Seite öffnen, zum Homescreen hinzufügen, vom Homescreen starten. Version im Hinweis stimmt.
2. **Buchen:** Demo starten, ein Mitglied öffnen, zwei Artikel buchen, Startseite zeigt das neue Guthaben. Ein Storno und „Storno aufheben“.
3. **Offline neu laden:** Flugmodus ein, App schließen und neu öffnen, eine Buchung machen. Flugmodus aus.
4. **Sichern:** „Sicherung“ in der Kopfleiste, Datei landet in „Dateien“ bzw. „Downloads“.
5. **Laden:** Demo beenden, die Sicherung über „Sicherung/Projekt laden“ laden – erwartet wird die Ablehnung als Demo-Datei. Dann mit einer echten Sicherung wiederholen; Daten sind vollständig da.
6. **Update:** Nach dem Deploy erscheint auf der Startseite „Neue Version – jetzt laden“; nach dem Tippen zeigt der Hinweis die neue Version.

## Git-Regeln

- Autor und Committer nur `creo08 <285598642+creo08@users.noreply.github.com>`. Einzige Ausnahme: Merges über die GitHub-Oberfläche haben `GitHub <noreply@github.com>` als Committer; das lässt `scripts/cleanup.sh` zu. Pull Requests von Dependabot dürfen `dependabot[bot]` als Autor und Committer und dessen `Signed-off-by`-Zeile haben.
- Der Profilname bei GitHub muss `creo08` sein (oder leer), weil GitHub ihn bei Squash-Merges als Autor einträgt.
- Keine Mitautor-Zeilen, keine Sitzungs-Zeilen oder -Links, keine privaten Adressen, keine echten Namen.
- Nie direkt auf `main`; jede Änderung als Branch und Pull Request. Änderungen unter `.github/` in eigenen Pull Requests.
- `scripts/cleanup.sh` prüft das für alle Dateien und die gesamte Historie; `--fix` bereinigt nur Dateien, die Historie nie.
