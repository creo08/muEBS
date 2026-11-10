// @ts-check
// Sicherung exportieren, „Vorher sichern?“ und Import (Sicherung oder leeres Projekt).
import { FORMAT, MAX_IMPORT_BYTES } from './konstanten.js';
import { alleDaten, ersetze, geraetSchreiben } from './db.js';
import { pruefeDatei, PruefFehler } from './schema.js';
import { bestaetige, dateiname, frage, herunterladen } from './dom.js';
import { db, zustand } from './zustand.js';

/** @typedef {import('./schema.js').Daten} Daten */

/**
 * Dateiinhalt im Sicherungsformat.
 * @param {'sicherung' | 'projekt'} typ
 * @param {Daten} daten
 */
export function dateiInhalt(typ, daten) {
  const datei = {
    format: FORMAT,
    typ,
    ...(zustand.demo ? { demo: true } : {}),
    erstellt: new Date().toISOString(),
    projekt: daten.projekt,
    mitglieder: daten.mitglieder,
    artikel: daten.artikel,
    buchungen: daten.buchungen,
  };
  return JSON.stringify(datei, null, 1);
}

/** Sicherung herunterladen und Zeitpunkt merken. Geht immer ohne PIN. */
export async function exportiereSicherung() {
  const daten = await alleDaten(db());
  herunterladen(dateiname('sicherung'), dateiInhalt('sicherung', daten), 'application/json');
  await geraetSchreiben(db(), 'letzte_sicherung', new Date().toISOString());
}

/** „Vorher sichern?“ – false heißt abbrechen. */
export async function vorherSichern() {
  const wahl = await frage('Vorher sichern?', [
    ['sichern', 'Sicherung herunterladen'],
    ['weiter', 'Ohne Sicherung weiter'],
    ['abbrechen', 'Abbrechen'],
  ]);
  if (wahl === 'sichern') await exportiereSicherung();
  return wahl !== 'abbrechen';
}

/**
 * Datei prüfen und alle Daten ersetzen. Gibt false zurück, wenn abgebrochen wurde.
 * Wirft PruefFehler bei ungültiger Datei; dann wurde nichts geschrieben.
 * @param {File} datei
 */
export async function importiere(datei) {
  if (datei.size > MAX_IMPORT_BYTES) throw new PruefFehler('Datei ist größer als 25 MB');
  /** @type {unknown} */
  let roh;
  try {
    roh = JSON.parse(await datei.text());
  } catch {
    throw new PruefFehler('Datei ist kein gültiges JSON');
  }
  const geprueft = pruefeDatei(roh, { echt: !zustand.demo });
  if (zustand.projekt) {
    if (!(await vorherSichern())) return false;
    if (!(await bestaetige('Alle Daten am Gerät werden ersetzt', 'Ersetzen'))) return false;
  }
  await ersetze(db(), geprueft);
  zustand.projekt = geprueft.projekt;
  return true;
}
