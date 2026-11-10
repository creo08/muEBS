# Datensicherheit

*Art: Erklärung. Was µEBS schützt – und was nicht.*

## Datenschutzhinweis

Die Seite „Datenschutz“ (erreichbar von der Init-Seite und aus dem Admin-Bereich) fasst zusammen:

- Alle Daten bleiben am Gerät im Browser. Es gibt keinen Server und kein Konto.
- Die Daten sind am Gerät **nicht verschlüsselt**.
- GitHub protokolliert beim Laden der App die IP-Adresse.
- µEBS nutzt keine Analytics, kein Tracking und sendet keine Fehlerberichte.
- Der PIN ist nur ein Bedienschutz.
- Eine geschwärzte Kachel sehen alle an der Schank.

Der Hinweis ist keine Datenschutzerklärung und keine Vorlage dafür. Wer µEBS für eine Gruppe betreibt, klärt die Pflichten selbst.

## Wohin Daten fließen

µEBS lädt nur seine eigenen Dateien von GitHub Pages und fragt `version.json` ab, um Updates zu erkennen. Dabei sieht GitHub wie bei jeder Website die IP-Adresse und den Browser. Mitglieder, Buchungen oder Einstellungen verlassen das Gerät nie – außer in Dateien, die du selbst exportierst.

Es gibt keine Schriften, Skripte, Bilder oder Styles von fremden Servern.

## Der PIN ist nur Bedienschutz

Der PIN hält an der Schank davon ab, versehentlich oder neugierig in den Admin-Bereich zu gehen. Er schützt die Daten nicht:

- Wer das Gerät entsperrt in der Hand hat, kann die Daten über die Entwicklerwerkzeuge des Browsers lesen oder ändern.
- „Sicherung“ in der Kopfleiste geht immer ohne PIN.
- Der PIN liegt nur als Hash am Gerät, nie in Sicherung oder Projekt. Nach 5 Fehlversuchen gibt es 30 Sekunden Pause; ein Neuladen der Seite setzt den Zähler zurück. Wer die Daten selbst auslesen kann, probiert die 10.000 möglichen PINs trotzdem in Sekunden durch.

## Schwärzung ist sichtbar

Eine geschwärzte Kachel zeigt allen, die an der Schank stehen, dass jemand unter der Grenze liegt. Wer das nicht möchte, schaltet die Schwärzung in den [Einstellungen](einstellungen.md) aus.

## Content-Security-Policy und ihre Grenzen

`index.html` setzt eine Content-Security-Policy als `<meta>`-Tag. Sie erlaubt nur Ressourcen vom eigenen Ursprung, verbietet Inline-Skripte und -Styles und verlangt Trusted Types. Die einzige erlaubte Trusted-Types-Policy (`muebs-sw`) erzeugt nur die Adresse des Service Workers, weil Browser die Registrierung sonst blockieren.

Grenzen des Meta-Tags:

- Einige Direktiven wirken nur als HTTP-Header (z. B. `frame-ancestors`, Berichte). GitHub Pages erlaubt keine eigenen Header.
- Ältere Safari-Versionen kennen Trusted Types nicht und ignorieren diese Direktive. Darum gilt im Code zusätzlich: Texte nur über `textContent`, nie `innerHTML` – das prüfen `scripts/cleanup.sh` und die CI.
- Eine CSP schützt nicht vor Browser-Erweiterungen oder einem kompromittierten Gerät.

## Importierte Dateien

Jede geladene Datei gilt als nicht vertrauenswürdig: Größe höchstens 25 MB, feste Prüfung aller Felder, Ablehnung von `__proto__`, `constructor` und `prototype`, Kopie in neue Objekte, und erst nach vollständiger Prüfung wird in einem einzigen Schritt geschrieben.

## CSV-Exporte

Textfelder, die mit `=`, `+`, `-`, `@`, Tab oder CR beginnen, bekommen ein `'` vorangestellt, damit Tabellenprogramme sie nicht als Formel ausführen.

## Sicherheitslücken melden

Siehe [SECURITY.md](../SECURITY.md).
