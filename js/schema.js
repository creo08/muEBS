// @ts-check
// Prüfung von Sicherung und Projekt. Jede Datei ist nicht vertrauenswürdig.
import { FORMAT, SCHEMEN, MAX_PREIS, MAX_BETRAG } from './konstanten.js';
import { textFehler, salden, schwaerzung } from './regeln.js';

/** @typedef {import('./regeln.js').Projekt} Projekt */
/** @typedef {import('./regeln.js').Mitglied} Mitglied */
/** @typedef {import('./regeln.js').Artikel} Artikel */
/** @typedef {import('./regeln.js').Buchung} Buchung */
/** @typedef {import('./regeln.js').BuchungsTyp} BuchungsTyp */
/**
 * @typedef {object} Daten
 * @property {Projekt} projekt
 * @property {Mitglied[]} mitglieder
 * @property {Artikel[]} artikel
 * @property {Buchung[]} buchungen
 */
/**
 * @typedef {object} Datei
 * @property {number} format
 * @property {'sicherung' | 'projekt'} typ
 * @property {boolean} [demo]
 * @property {string} erstellt
 * @property {Projekt} projekt
 * @property {Mitglied[]} mitglieder
 * @property {Artikel[]} artikel
 * @property {Buchung[]} buchungen
 */

export const MELDUNG_NEUER = 'Datei aus neuerer Version';
export const MELDUNG_UNSTIMMIG = 'Sicherung ist in sich nicht stimmig';
export const MELDUNG_DEMO = 'Demo-Daten können nicht als echte Daten geladen werden';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ZEIT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const VERBOTEN = new Set(['__proto__', 'constructor', 'prototype']);
const TYPEN = ['artikel', 'aufbuchung', 'zahlung', 'uebertrag', 'storno'];

export class PruefFehler extends Error {}

/** @param {string} text @returns {never} */
function fehler(text) {
  throw new PruefFehler(text);
}

/** Fremden Text für Meldungen kürzen. @param {string} text */
const kurz = (text) => (text.length > 40 ? text.slice(0, 40) + '…' : text);

/**
 * Lehnt verbotene Schlüssel an jeder Stelle ab und begrenzt die Tiefe
 * (das Format ist höchstens 3 Ebenen tief; tiefer würde nur den Stack erschöpfen).
 * @param {unknown} wert
 * @param {number} [tiefe]
 */
function pruefeSchluessel(wert, tiefe = 0) {
  if (wert === null || typeof wert !== 'object') return;
  if (tiefe > 8) fehler('Datei ist zu tief verschachtelt');
  if (Array.isArray(wert)) {
    for (const w of wert) pruefeSchluessel(w, tiefe + 1);
    return;
  }
  for (const k of Object.keys(wert)) {
    if (VERBOTEN.has(k)) fehler(`Unzulässiger Schlüssel „${k}“`);
    pruefeSchluessel(/** @type {Record<string, unknown>} */ (wert)[k], tiefe + 1);
  }
}

/**
 * Objekt mit genau diesen Feldern (optionale dürfen fehlen).
 * @param {unknown} wert
 * @param {string} ort
 * @param {string[]} felder
 * @param {string[]} [optional]
 * @returns {Record<string, unknown>}
 */
function objekt(wert, ort, felder, optional = []) {
  if (wert === null || typeof wert !== 'object' || Array.isArray(wert)) fehler(`${ort}: Objekt erwartet`);
  const o = /** @type {Record<string, unknown>} */ (wert);
  for (const k of Object.keys(o)) if (!felder.includes(k) && !optional.includes(k)) fehler(`${ort}: unbekanntes Feld „${kurz(k)}“`);
  for (const k of felder) if (!Object.hasOwn(o, k)) fehler(`${ort}: Feld „${k}“ fehlt`);
  return o;
}

/**
 * @param {unknown} wert
 * @param {string} ort
 * @param {number} min
 * @param {number} max
 */
function ganz(wert, ort, min, max) {
  if (typeof wert !== 'number' || !Number.isInteger(wert) || wert < min || wert > max) fehler(`${ort}: ganze Zahl von ${min} bis ${max} erwartet`);
  return wert;
}

/** @param {unknown} wert @param {string} ort */
function bool(wert, ort) {
  if (typeof wert !== 'boolean') fehler(`${ort}: true oder false erwartet`);
  return wert;
}

/** @param {unknown} wert @param {string} ort @param {number} min @param {number} max */
function text(wert, ort, min, max) {
  if (typeof wert !== 'string') fehler(`${ort}: Text erwartet`);
  const f = textFehler(wert, min, max);
  if (f) fehler(`${ort} ${f}`);
  return wert;
}

/** @param {unknown} wert @param {string} ort */
function uuid(wert, ort) {
  if (typeof wert !== 'string' || !UUID.test(wert)) fehler(`${ort}: UUID erwartet`);
  return wert;
}

/** @param {unknown} wert @param {string} ort */
function zeit(wert, ort) {
  if (typeof wert !== 'string' || !ZEIT.test(wert) || Number.isNaN(Date.parse(wert))) fehler(`${ort}: Zeitstempel (ISO 8601 UTC) erwartet`);
  return wert;
}

/** @param {unknown} wert @param {string} ort @returns {unknown[]} */
function liste(wert, ort) {
  if (!Array.isArray(wert)) fehler(`${ort}: Liste erwartet`);
  return wert;
}

/** @param {unknown} wert @returns {Projekt} */
function pruefeProjekt(wert) {
  const o = objekt(wert, 'Projekt', ['farbschema', 'modus', 'schwaerzung_aktiv', 'schwaerzungs_grenze']);
  if (!SCHEMEN.some((s) => s.wert === o.farbschema)) fehler('Projekt: unbekanntes Farbschema');
  if (o.modus !== 'vorauszahlung' && o.modus !== 'deckel') fehler('Projekt: unbekannter Modus');
  return {
    farbschema: /** @type {string} */ (o.farbschema),
    modus: o.modus,
    schwaerzung_aktiv: bool(o.schwaerzung_aktiv, 'Projekt schwaerzung_aktiv'),
    schwaerzungs_grenze: ganz(o.schwaerzungs_grenze, 'Projekt schwaerzungs_grenze', -MAX_BETRAG, 0),
  };
}

/**
 * Prüft eine eingelesene Datei vollständig und gibt neue, saubere Objekte zurück.
 * Wirft PruefFehler mit verständlicher Meldung.
 * @param {unknown} roh Ergebnis von JSON.parse
 * @param {{echt: boolean}} ziel echt = Import in die echte Datenbank
 * @returns {Datei}
 */
export function pruefeDatei(roh, ziel) {
  pruefeSchluessel(roh);
  if (roh === null || typeof roh !== 'object' || Array.isArray(roh)) fehler('Keine µEBS-Datei');
  const format = /** @type {Record<string, unknown>} */ (roh).format;
  if (typeof format !== 'number' || !Number.isInteger(format) || format < 1 || format > FORMAT) fehler(MELDUNG_NEUER);
  const o = objekt(roh, 'Datei', ['format', 'typ', 'erstellt', 'projekt', 'mitglieder', 'artikel', 'buchungen'], ['demo']);
  const demo = o.demo === undefined ? false : bool(o.demo, 'demo');
  if (demo && ziel.echt) fehler(MELDUNG_DEMO);
  if (o.typ !== 'sicherung' && o.typ !== 'projekt') fehler('Datei: typ muss sicherung oder projekt sein');
  const erstellt = zeit(o.erstellt, 'erstellt');
  const projekt = pruefeProjekt(o.projekt);

  /** @type {Map<number, Mitglied>} */
  const mitglieder = new Map();
  liste(o.mitglieder, 'mitglieder').forEach((w, i) => {
    const ort = `Mitglied ${i + 1}`;
    const m = objekt(w, ort, ['id', 'name', 'nickname', 'aktiv', 'guthaben', 'geschwaerzt']);
    const id = ganz(m.id, ort + ' id', 1, Number.MAX_SAFE_INTEGER);
    if (mitglieder.has(id)) fehler(`${ort}: id ${id} doppelt`);
    mitglieder.set(id, {
      id,
      name: text(m.name, ort + ' Name', 1, 60),
      nickname: text(m.nickname, ort + ' Spitzname', 0, 40),
      aktiv: bool(m.aktiv, ort + ' aktiv'),
      guthaben: ganz(m.guthaben, ort + ' guthaben', -MAX_BETRAG, MAX_BETRAG),
      geschwaerzt: bool(m.geschwaerzt, ort + ' geschwaerzt'),
    });
  });

  /** @type {Map<number, Artikel>} */
  const artikel = new Map();
  liste(o.artikel, 'artikel').forEach((w, i) => {
    const ort = `Artikel ${i + 1}`;
    const a = objekt(w, ort, ['id', 'name', 'preis', 'reihenfolge', 'aktiv']);
    const id = ganz(a.id, ort + ' id', 1, Number.MAX_SAFE_INTEGER);
    if (artikel.has(id)) fehler(`${ort}: id ${id} doppelt`);
    artikel.set(id, {
      id,
      name: text(a.name, ort + ' Name', 1, 40),
      preis: ganz(a.preis, ort + ' preis', 1, MAX_PREIS),
      reihenfolge: ganz(a.reihenfolge, ort + ' reihenfolge', -MAX_BETRAG, MAX_BETRAG),
      aktiv: bool(a.aktiv, ort + ' aktiv'),
    });
  });

  /** @type {Map<string, Buchung>} */
  const buchungen = new Map();
  const roheBuchungen = liste(o.buchungen, 'buchungen');
  roheBuchungen.forEach((w, i) => {
    const ort = `Buchung ${i + 1}`;
    const b = objekt(w, ort, ['id', 'geraet_id', 'typ', 'mitglied_id', 'artikel_id', 'storno_von', 'menge', 'preis_pro_einheit', 'gesamtpreis', 'zeitstempel']);
    const id = uuid(b.id, ort + ' id');
    if (buchungen.has(id)) fehler(`${ort}: id doppelt`);
    if (typeof b.typ !== 'string' || !TYPEN.includes(b.typ)) fehler(`${ort}: unbekannter typ`);
    const typ = /** @type {BuchungsTyp} */ (b.typ);
    const mitgliedId = ganz(b.mitglied_id, ort + ' mitglied_id', 1, Number.MAX_SAFE_INTEGER);
    if (!mitglieder.has(mitgliedId)) fehler(`${ort}: mitglied_id ${mitgliedId} gibt es nicht`);
    const menge = ganz(b.menge, ort + ' menge', 1, 1000);
    const ppe = ganz(b.preis_pro_einheit, ort + ' preis_pro_einheit', -MAX_BETRAG, MAX_BETRAG);
    const gp = ganz(b.gesamtpreis, ort + ' gesamtpreis', -MAX_BETRAG, MAX_BETRAG);
    /** @type {number | null} */
    let artikelId = null;
    if (typ === 'artikel') {
      artikelId = ganz(b.artikel_id, ort + ' artikel_id', 1, Number.MAX_SAFE_INTEGER);
      if (!artikel.has(artikelId)) fehler(`${ort}: artikel_id ${artikelId} gibt es nicht`);
      if (ppe < 1 || ppe > MAX_PREIS || gp !== -menge * ppe) fehler(`${ort}: Betrag passt nicht zu Menge und Preis`);
    } else {
      if (b.artikel_id !== null) fehler(`${ort}: artikel_id muss null sein`);
      if (menge !== 1) fehler(`${ort}: menge muss 1 sein`);
      const passt = typ === 'storno' ? ppe === 0 && gp === 0 : typ === 'uebertrag' ? gp !== 0 && ppe === gp : gp > 0 && ppe === gp;
      if (!passt) fehler(`${ort}: Betrag passt nicht zum typ`);
    }
    if (typ === 'storno') uuid(b.storno_von, ort + ' storno_von');
    else if (b.storno_von !== null) fehler(`${ort}: storno_von muss null sein`);
    buchungen.set(id, {
      id,
      geraet_id: uuid(b.geraet_id, ort + ' geraet_id'),
      typ,
      mitglied_id: mitgliedId,
      artikel_id: artikelId,
      storno_von: /** @type {string | null} */ (b.storno_von),
      menge,
      preis_pro_einheit: ppe,
      gesamtpreis: gp,
      zeitstempel: zeit(b.zeitstempel, ort + ' zeitstempel'),
    });
  });

  for (const b of buchungen.values()) {
    if (b.storno_von === null) continue;
    const original = buchungen.get(b.storno_von);
    if (!original) fehler('Storno verweist auf eine Buchung, die es nicht gibt');
    if (original.typ === 'storno') fehler('Storno darf nicht auf einen Storno-Eintrag verweisen');
    if (original.mitglied_id !== b.mitglied_id) fehler('Storno gehört zu einem anderen Mitglied');
  }

  const saldo = salden([...buchungen.values()]);
  for (const m of mitglieder.values()) {
    if ((saldo.get(m.id) ?? 0) !== m.guthaben) fehler(MELDUNG_UNSTIMMIG);
    // Merker muss zur Hysterese passen
    if (schwaerzung(m.geschwaerzt, m.guthaben, projekt.schwaerzungs_grenze) !== m.geschwaerzt) fehler(MELDUNG_UNSTIMMIG);
  }

  /** @type {Datei} */
  const datei = { format, typ: o.typ, erstellt, projekt, mitglieder: [...mitglieder.values()], artikel: [...artikel.values()], buchungen: [...buchungen.values()] };
  if (demo) datei.demo = true;
  return datei;
}
