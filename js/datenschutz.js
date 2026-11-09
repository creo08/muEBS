// @ts-check
// Datenschutzhinweis (nur Hinweis, keine Vorlage).
import { el, hilfe, seite } from './dom.js';

/** @param {string} zurueck Ziel des Zurück-Links */
export function datenschutzSeite(zurueck) {
  seite(
    'Datenschutz',
    el('ul', {},
      el('li', {}, 'Alle Daten bleiben auf diesem Gerät im Browser. Es gibt keinen Server und kein Konto.'),
      el('li', {}, 'Die Daten sind am Gerät nicht verschlüsselt. Wer das Gerät entsperrt benutzen kann, kann sie lesen.'),
      el('li', {}, 'Die App liegt auf GitHub Pages. GitHub protokolliert beim Laden der App die IP-Adresse.'),
      el('li', {}, 'µEBS nutzt keine Analytics, kein Tracking und sendet keine Fehlerberichte.'),
      el('li', {}, 'Der PIN ist nur ein Bedienschutz, kein Schutz der Daten.'),
      el('li', {}, 'Eine geschwärzte Kachel sehen alle, die am Tresen stehen.'),
    ),
    hilfe('datensicherheit', 'Datensicherheit'),
    el('p', {}, el('a', { href: zurueck }, 'Zurück')),
  );
}
