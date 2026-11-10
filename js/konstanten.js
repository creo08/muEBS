// @ts-check
// Alle festen Werte an einer Stelle.

export const DB_ECHT = 'muebs';
export const DB_DEMO = 'muebs_demo';
export const DB_VERSION = 2;

/** Höchste Formatversion von Sicherung und Projekt, die diese App kennt. */
export const FORMAT = 1;
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

export const HOTLIST_TAGE = 14;
export const SPERRE_NACH_MS = 5 * 60 * 1000;
/** Danach zeigt der Start eine Meldung statt weiter „wird geladen“. */
export const START_WARTEN_MS = 10000;
export const KASSIERTAG_STUNDE = 6;
export const BUCHUNGEN_ANZEIGE = 10;

export const STANDARD_GRENZE = -2000;
export const MAX_PREIS = 100000;
/** Obergrenze für einzelne Beträge und Salden, damit Cent sicher ganzzahlig bleiben. */
export const MAX_BETRAG = 100000000;

/** @type {ReadonlyArray<{wert: string, name: string}>} */
export const SCHEMEN = [
  { wert: 'violett', name: 'Violett' },
  { wert: 'blau', name: 'Blau' },
  { wert: 'tuerkis', name: 'Türkis' },
  { wert: 'gruen', name: 'Grün' },
  { wert: 'gelb', name: 'Gelb' },
  { wert: 'orange', name: 'Orange' },
  { wert: 'rot', name: 'Rot' },
  { wert: 'grau', name: 'Grau' },
];

export const REPO_URL = 'https://github.com/creo08/muEBS';
export const VOLLSYSTEM_URL = 'https://github.com/relaxin101/barsystem';
