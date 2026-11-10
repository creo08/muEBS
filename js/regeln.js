// @ts-check
// Reine Fachregeln ohne DOM und ohne Datenbank, mit node --test geprüft.
import { KASSIERTAG_STUNDE } from './konstanten.js';

/** @typedef {'vorauszahlung' | 'deckel'} Modus */
/**
 * @typedef {object} Projekt
 * @property {string} farbschema
 * @property {Modus} modus
 * @property {boolean} schwaerzung_aktiv
 * @property {number} schwaerzungs_grenze Cent, ganze Zahl ≤ 0
 */
/**
 * @typedef {object} Mitglied
 * @property {number} id
 * @property {string} name
 * @property {string} nickname
 * @property {boolean} aktiv
 * @property {number} guthaben Cent
 * @property {boolean} geschwaerzt Merker für die Schwärzung (Hysterese bis guthaben >= 0)
 */
/**
 * @typedef {object} Artikel
 * @property {number} id
 * @property {string} name
 * @property {number} preis Cent
 * @property {number} reihenfolge
 * @property {boolean} aktiv
 */
/** @typedef {'artikel' | 'aufbuchung' | 'zahlung' | 'uebertrag' | 'storno'} BuchungsTyp */
/**
 * @typedef {object} Buchung
 * @property {string} id
 * @property {string} geraet_id
 * @property {BuchungsTyp} typ
 * @property {number} mitglied_id
 * @property {number | null} artikel_id
 * @property {string | null} storno_von
 * @property {number} menge
 * @property {number} preis_pro_einheit
 * @property {number} gesamtpreis Cent mit Vorzeichen
 * @property {string} zeitstempel ISO 8601 UTC
 */

/**
 * Prüft Name, Spitzname und Artikelname. Gibt eine Fehlermeldung oder null zurück.
 * @param {string} wert
 * @param {number} min
 * @param {number} max
 * @returns {string | null}
 */
export function textFehler(wert, min, max) {
  if (wert.length < min) return min === 1 ? 'darf nicht leer sein' : `braucht mindestens ${min} Zeichen`;
  if (wert.length > max) return `darf höchstens ${max} Zeichen haben`;
  // Schutz gegen Formel-Injection in Tabellenprogrammen
  if (/^[=+\-@\t\r]/.test(wert)) return 'darf nicht mit = + - @ beginnen';
  if (/[\u0000-\u001f\u007f-\u009f]/.test(wert)) return 'darf keine Steuerzeichen enthalten';
  return null;
}

/**
 * Menge der stornierten Buchungs-ids: ungerade Anzahl Storno-Einträge = storniert.
 * @param {Iterable<Buchung>} buchungen
 * @returns {Set<string>}
 */
export function stornierte(buchungen) {
  const ergebnis = new Set();
  for (const b of buchungen) {
    if (b.typ !== 'storno' || b.storno_von === null) continue;
    if (ergebnis.has(b.storno_von)) ergebnis.delete(b.storno_von);
    else ergebnis.add(b.storno_von);
  }
  return ergebnis;
}

/**
 * Gültige Buchungen (nicht storniert, keine Storno-Einträge), nach Zeit sortiert.
 * @param {Buchung[]} buchungen
 */
export function gueltige(buchungen) {
  const storniert = stornierte(buchungen);
  return buchungen
    .filter((b) => b.typ !== 'storno' && !storniert.has(b.id))
    .sort((a, b) => (a.zeitstempel < b.zeitstempel ? -1 : a.zeitstempel > b.zeitstempel ? 1 : 0));
}

/**
 * Saldo je Mitglied = Summe der gesamtpreis aller nicht stornierten Buchungen.
 * @param {Buchung[]} buchungen
 * @returns {Map<number, number>}
 */
export function salden(buchungen) {
  const ergebnis = new Map();
  for (const b of gueltige(buchungen)) ergebnis.set(b.mitglied_id, (ergebnis.get(b.mitglied_id) ?? 0) + b.gesamtpreis);
  return ergebnis;
}

/**
 * gesamtpreis einer Buchung nach Typ: Artikel negativ, Einzahlungen positiv, Storno 0.
 * @param {BuchungsTyp} typ
 * @param {number} menge
 * @param {number} preisProEinheit
 */
export function gesamtpreis(typ, menge, preisProEinheit) {
  if (typ === 'storno') return 0;
  if (typ === 'artikel') return -menge * preisProEinheit;
  return menge * preisProEinheit;
}

/**
 * Neuer Schwärzungs-Merker: geschwärzt unter der Grenze, aufgehoben erst bei guthaben >= 0.
 * @param {boolean} bisher
 * @param {number} guthaben
 * @param {number} grenze
 */
export function schwaerzung(bisher, guthaben, grenze) {
  if (guthaben < grenze) return true;
  if (guthaben >= 0) return false;
  return bisher;
}

/**
 * @param {Projekt} projekt
 * @param {Mitglied} mitglied
 */
export function istGeschwaerzt(projekt, mitglied) {
  return projekt.schwaerzung_aktiv && mitglied.geschwaerzt;
}

/**
 * Beginn des Kassiertags (06:00 Ortszeit) für einen Zeitpunkt.
 * @param {Date} jetzt
 */
export function kassiertagBeginn(jetzt) {
  const beginn = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate(), KASSIERTAG_STUNDE);
  if (jetzt < beginn) beginn.setDate(beginn.getDate() - 1);
  return beginn;
}

/**
 * Aufstellung fürs Kassieren: alle gültigen Buchungen seit dem letzten Zeitpunkt mit guthaben >= 0.
 * @param {Buchung[]} buchungen Buchungen eines Mitglieds
 * @param {Map<number, string>} artikelNamen
 */
export function aufstellung(buchungen, artikelNamen) {
  const liste = gueltige(buchungen);
  let stand = 0;
  let start = 0;
  liste.forEach((b, i) => {
    stand += b.gesamtpreis;
    if (stand >= 0) start = i + 1;
  });
  /** @type {Map<number, {name: string, menge: number, summe: number}>} */
  const posten = new Map();
  /** @type {Buchung[]} */
  const zahlungen = [];
  for (const b of liste.slice(start)) {
    if (b.typ === 'artikel' && b.artikel_id !== null) {
      const p = posten.get(b.artikel_id) ?? { name: artikelNamen.get(b.artikel_id) ?? `Artikel ${b.artikel_id}`, menge: 0, summe: 0 };
      p.menge += b.menge;
      p.summe += -b.gesamtpreis;
      posten.set(b.artikel_id, p);
    } else {
      zahlungen.push(b);
    }
  }
  return { posten: [...posten.values()], zahlungen, offen: Math.max(0, -stand) };
}

/**
 * Hotlist: aktive Mitglieder mit gültigen Artikel-Buchungen im Zeitraum, die mit der höchsten
 * Stückzahl zuerst gewählt, angezeigt alphabetisch.
 * @param {Buchung[]} buchungenImZeitraum inklusive späterer Storno-Einträge
 * @param {Mitglied[]} mitglieder
 * @param {number} anzahl
 */
export function hotlist(buchungenImZeitraum, mitglieder, anzahl) {
  /** @type {Map<number, number>} */
  const stueck = new Map();
  for (const b of gueltige(buchungenImZeitraum)) {
    if (b.typ === 'artikel') stueck.set(b.mitglied_id, (stueck.get(b.mitglied_id) ?? 0) + b.menge);
  }
  return mitglieder
    .filter((m) => m.aktiv && stueck.has(m.id))
    .sort((a, b) => (stueck.get(b.id) ?? 0) - (stueck.get(a.id) ?? 0) || a.id - b.id)
    .slice(0, anzahl)
    .sort(nachName);
}

/**
 * @param {Mitglied} a
 * @param {Mitglied} b
 */
export function nachName(a, b) {
  return a.name.localeCompare(b.name, 'de') || a.id - b.id;
}

/**
 * Meldung für einen fehlgeschlagenen Speichervorgang.
 * @param {unknown} fehler
 */
export function speicherFehlerText(fehler) {
  // DOMException ist nicht in jedem Browser instanceof Error, daher nur name/message lesen
  const f = /** @type {{name?: unknown, message?: unknown}} */ (fehler ?? {});
  if (f.name === 'QuotaExceededError') return 'Speicher voll – bitte sichern';
  return 'Speichern fehlgeschlagen: ' + String(f.message ?? fehler);
}
