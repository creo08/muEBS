// @ts-check
// Laufzeit-Zustand der App (nur im Speicher).

/**
 * @typedef {object} Zustand
 * @property {IDBDatabase | null} echt Datenbank muebs
 * @property {IDBDatabase | null} db aktive Datenbank (echt oder Demo)
 * @property {boolean} demo
 * @property {string} geraet geraet_id der aktiven Datenbank
 * @property {import('./regeln.js').Projekt | null} projekt
 * @property {{version: string, sha: string} | null} version
 * @property {ServiceWorker | null} wartend
 * @property {boolean} entsperrt
 * @property {number} letzteEingabe
 */

/** @type {Zustand} */
export const zustand = {
  echt: null,
  db: null,
  demo: false,
  geraet: '',
  projekt: null,
  version: null,
  wartend: null,
  entsperrt: false,
  letzteEingabe: 0,
};

/** Aktive Datenbank; vor dem Start der Oberfläche immer gesetzt. */
export function db() {
  if (!zustand.db) throw new Error('Datenbank nicht geöffnet');
  return zustand.db;
}
