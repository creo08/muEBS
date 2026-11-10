// @ts-check
// Umstieg ins Vollsystem (Ergo Bibamus, geprüft gegen Commit 6ef739e).
// Alle Dateinamen, Spaltennamen und Regeln des Umstiegs stehen nur in dieser Datei.
import { centText } from './geld.js';
import { csvDatei, textFeld } from './csv.js';

/** @typedef {import('./regeln.js').Mitglied} Mitglied */
/** @typedef {import('./regeln.js').Artikel} Artikel */
/** @typedef {import('./regeln.js').Projekt} Projekt */

export const MITGLIEDER_DATEI = 'mitglieder_v1.csv';
export const ARTIKEL_DATEI = 'artikel_v1.csv';
export const GUTHABEN_DATEI = 'guthaben_v1.csv';

export const MITGLIEDER_SPALTEN = ['id', 'name', 'nickname', 'aktiv', 'schwaerzungs_grenze'];
export const ARTIKEL_SPALTEN = ['id', 'reihenfolge', 'name', 'preis', 'aktiv', 'typ'];
export const GUTHABEN_SPALTEN = ['id', 'betrag'];

/**
 * Das Vollsystem verlangt eindeutige Artikelnamen (Artikel.name unique); ein doppelter Name lässt dort den
 * ganzen Artikel-Import scheitern. Gibt die doppelten Namen mit ihren Nummern zurück.
 * @param {Artikel[]} artikel
 * @returns {Array<{name: string, ids: number[]}>}
 */
export function doppelteArtikelnamen(artikel) {
  /** @type {Map<string, number[]>} */
  const je = new Map();
  for (const a of artikel) je.set(a.name, [...(je.get(a.name) ?? []), a.id]);
  return [...je].filter(([, ids]) => ids.length > 1).map(([name, ids]) => ({ name, ids }));
}

/** @param {boolean} wert */
const aktiv = (wert) => (wert ? '1' : '0');

/**
 * Grenze global in Euro, wenn Schwärzung ein; leer heißt im Vollsystem „Kein Limit“.
 * @param {Mitglied[]} mitglieder
 * @param {Projekt} projekt
 */
export function mitgliederCsv(mitglieder, projekt) {
  const grenze = projekt.schwaerzung_aktiv ? centText(projekt.schwaerzungs_grenze) : '';
  return csvDatei(MITGLIEDER_SPALTEN, mitglieder.map((m) => [String(m.id), textFeld(m.name), textFeld(m.nickname), aktiv(m.aktiv), grenze]));
}

/** @param {Artikel[]} artikel */
export function artikelCsv(artikel) {
  return csvDatei(ARTIKEL_SPALTEN, artikel.map((a) => [String(a.id), String(a.reihenfolge), textFeld(a.name), centText(a.preis), aktiv(a.aktiv), textFeld('stueck')]));
}

/**
 * Nur Salden ≠ 0, auch negative; das Vollsystem bucht den Betrag summativ auf.
 * @param {Mitglied[]} mitglieder
 */
export function guthabenCsv(mitglieder) {
  return csvDatei(GUTHABEN_SPALTEN, mitglieder.filter((m) => m.guthaben !== 0).map((m) => [String(m.id), centText(m.guthaben)]));
}
