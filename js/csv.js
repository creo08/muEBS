// @ts-check
// CSV-Erzeugung mit Schutz gegen Formel-Injection.
import { centText } from './geld.js';
import { gueltige } from './regeln.js';

/** @typedef {import('./regeln.js').Mitglied} Mitglied */
/** @typedef {import('./regeln.js').Buchung} Buchung */

/**
 * Textfeld: in Anführungszeichen, " verdoppelt, gefährlicher Anfang mit ' entschärft.
 * @param {string} wert
 */
export function textFeld(wert) {
  const sicher = /^[=+\-@\t\r]/.test(wert) ? "'" + wert : wert;
  return '"' + sicher.replaceAll('"', '""') + '"';
}

/**
 * Ganze Datei: UTF-8 mit BOM, Semikolon, CRLF. Zahlenfelder erzeugt nur der Code, sie bleiben unmaskiert.
 * @param {string[]} kopf
 * @param {string[][]} zeilen bereits fertige Felder (textFeld() oder Zahl als Text)
 */
export function csvDatei(kopf, zeilen) {
  return '\uFEFF' + [kopf.map(textFeld), ...zeilen].map((z) => z.join(';') + '\r\n').join('');
}

/**
 * abrechnung_v1.csv beim leeren Projekt mit Guthaben auf 0.
 * @param {Mitglied[]} mitglieder
 * @param {Buchung[]} buchungen
 */
export function abrechnungCsv(mitglieder, buchungen) {
  /** @type {Map<number, number>} */
  const bezahlt = new Map();
  for (const b of gueltige(buchungen)) if (b.typ === 'zahlung') bezahlt.set(b.mitglied_id, (bezahlt.get(b.mitglied_id) ?? 0) + b.gesamtpreis);
  return csvDatei(
    ['id', 'name', 'nickname', 'guthaben', 'offen', 'bezahlt'],
    mitglieder.map((m) => [
      String(m.id),
      textFeld(m.name),
      textFeld(m.nickname),
      centText(m.guthaben),
      centText(Math.max(0, -m.guthaben)),
      centText(bezahlt.get(m.id) ?? 0),
    ]),
  );
}
