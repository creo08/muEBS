// @ts-check
// IndexedDB-Zugriff. Jede schreibende Aktion läuft in genau einer Transaktion
// und gilt erst nach oncomplete als gespeichert.
import { DB_VERSION, MAX_BETRAG, MAX_PREIS } from './konstanten.js';
import { gesamtpreis, istGeschwaerzt, schwaerzungAusVerlauf, stornierte, textFehler } from './regeln.js';

/** @typedef {import('./regeln.js').Projekt} Projekt */
/** @typedef {import('./regeln.js').Mitglied} Mitglied */
/** @typedef {import('./regeln.js').Artikel} Artikel */
/** @typedef {import('./regeln.js').Buchung} Buchung */
/** @typedef {import('./schema.js').Daten} Daten */

const DATEN_STORES = ['projekt', 'mitglied', 'artikel', 'buchung'];

/**
 * @param {IDBRequest} r
 * @returns {Promise<any>}
 */
export function anfrage(r) {
  return new Promise((ok, nein) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => nein(r.error);
  });
}

/**
 * Führt arbeit in einer Transaktion aus; erfüllt erst nach oncomplete.
 * @template T
 * @param {IDBDatabase} db
 * @param {string[]} stores
 * @param {IDBTransactionMode} modus
 * @param {(tx: IDBTransaction) => Promise<T>} arbeit
 * @returns {Promise<T>}
 */
function transaktion(db, stores, modus, arbeit) {
  return new Promise((ok, nein) => {
    const tx = db.transaction(stores, modus);
    let ergebnis = /** @type {T | undefined} */ (undefined);
    tx.oncomplete = () => ok(/** @type {T} */ (ergebnis));
    tx.onabort = () => nein(tx.error ?? new Error('Speichern abgebrochen'));
    arbeit(tx).then(
      (e) => {
        ergebnis = e;
      },
      (fehler) => {
        nein(fehler);
        try {
          tx.abort();
        } catch {
          // bereits beendet
        }
      },
    );
  });
}

/**
 * Schema-Migration, nur hier und nur in onupgradeneeded. Jeder Schritt läuft nur bis zur Zielversion,
 * denn eine neue Datenbank wird zuerst ohne Versionsangabe (also als Version 1) angelegt.
 * @param {IDBDatabase} db
 * @param {number} alt
 * @param {number} neu
 */
function migriere(db, alt, neu) {
  if (alt < 1 && neu >= 1) {
    db.createObjectStore('geraet');
    db.createObjectStore('projekt');
    db.createObjectStore('mitglied', { keyPath: 'id' });
    db.createObjectStore('artikel', { keyPath: 'id' });
    const buchung = db.createObjectStore('buchung', { keyPath: 'id' });
    buchung.createIndex('mitglied_id', 'mitglied_id');
    buchung.createIndex('zeitstempel', 'zeitstempel');
  }
  // Spätere Versionen: if (alt < 2 && neu >= 2) { … }
}

/**
 * @typedef {object} Haken
 * @property {() => void} blockiert andere Fenster halten die Datenbank offen
 * @property {(db: IDBDatabase) => Promise<boolean>} vorMigration false bricht ab
 */

/**
 * @param {string} name
 * @param {number | undefined} version
 * @param {Haken} haken
 * @returns {Promise<{db: IDBDatabase, neu: boolean}>} neu = gerade erst angelegt
 */
function oeffneRoh(name, version, haken) {
  return new Promise((ok, nein) => {
    let neu = false;
    const r = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version);
    r.onupgradeneeded = (e) => {
      neu = e.oldVersion === 0;
      migriere(r.result, e.oldVersion, e.newVersion ?? 1);
    };
    r.onblocked = haken.blockiert;
    r.onerror = () => nein(r.error);
    r.onsuccess = () => {
      const db = r.result;
      db.onversionchange = () => {
        db.close();
        location.reload();
      };
      ok({ db, neu });
    };
  });
}

/**
 * Öffnet die Datenbank. Steht eine Migration an, wird vorher gefragt (Sicherung vorschlagen).
 * @param {string} name
 * @param {Haken} haken
 */
export async function oeffne(name, haken) {
  // Ohne Versionsangabe öffnen, um die gespeicherte Version zu sehen.
  const { db, neu } = await oeffneRoh(name, undefined, haken);
  if (db.version === DB_VERSION) return db;
  if (db.version > DB_VERSION) {
    db.close();
    throw new Error('Die Daten stammen aus einer neueren µEBS-Version.');
  }
  // Eine gerade angelegte Datenbank ist leer: nichts zu sichern
  if (!neu && !(await haken.vorMigration(db))) {
    db.close();
    throw new Error('Aktualisierung der Daten abgebrochen.');
  }
  db.close();
  return (await oeffneRoh(name, DB_VERSION, haken)).db;
}

/**
 * @param {string} name
 * @returns {Promise<void>}
 */
export function loescheDb(name) {
  return new Promise((ok, nein) => {
    const r = indexedDB.deleteDatabase(name);
    r.onsuccess = () => ok();
    r.onerror = () => nein(r.error);
  });
}

// ---------- Gerät ----------

/**
 * @param {IDBDatabase} db
 * @param {string} schluessel
 */
export function geraetLesen(db, schluessel) {
  return transaktion(db, ['geraet'], 'readonly', (tx) => anfrage(tx.objectStore('geraet').get(schluessel)));
}

/**
 * @param {IDBDatabase} db
 * @param {string} schluessel
 * @param {unknown} wert undefined löscht den Eintrag
 */
export function geraetSchreiben(db, schluessel, wert) {
  return transaktion(db, ['geraet'], 'readwrite', async (tx) => {
    const s = tx.objectStore('geraet');
    if (wert === undefined) s.delete(schluessel);
    else s.put(wert, schluessel);
  });
}

/**
 * geraet_id lesen oder beim ersten Start erzeugen.
 * @param {IDBDatabase} db
 * @returns {Promise<string>}
 */
export function geraetId(db) {
  return transaktion(db, ['geraet'], 'readwrite', async (tx) => {
    const s = tx.objectStore('geraet');
    const vorhanden = await anfrage(s.get('geraet_id'));
    if (typeof vorhanden === 'string') return vorhanden;
    const neu = crypto.randomUUID();
    s.put(neu, 'geraet_id');
    return neu;
  });
}

// ---------- Lesen ----------

/**
 * @param {IDBDatabase} db
 * @returns {Promise<Projekt | undefined>}
 */
export function ladeProjekt(db) {
  return transaktion(db, ['projekt'], 'readonly', (tx) => anfrage(tx.objectStore('projekt').get('einstellungen')));
}

/**
 * @param {IDBDatabase} db
 * @returns {Promise<Mitglied[]>}
 */
export function alleMitglieder(db) {
  return transaktion(db, ['mitglied'], 'readonly', (tx) => anfrage(tx.objectStore('mitglied').getAll()));
}

/**
 * @param {IDBDatabase} db
 * @param {number} id
 * @returns {Promise<Mitglied | undefined>}
 */
export function ladeMitglied(db, id) {
  return transaktion(db, ['mitglied'], 'readonly', (tx) => anfrage(tx.objectStore('mitglied').get(id)));
}

/**
 * @param {IDBDatabase} db
 * @returns {Promise<Artikel[]>}
 */
export function alleArtikel(db) {
  return transaktion(db, ['artikel'], 'readonly', (tx) => anfrage(tx.objectStore('artikel').getAll()));
}

/**
 * Nur die Buchungen eines Mitglieds, über den Index.
 * @param {IDBDatabase} db
 * @param {number} mitgliedId
 * @returns {Promise<Buchung[]>}
 */
export function buchungenVon(db, mitgliedId) {
  return transaktion(db, ['buchung'], 'readonly', (tx) => anfrage(tx.objectStore('buchung').index('mitglied_id').getAll(mitgliedId)));
}

/**
 * Buchungen ab einem Zeitpunkt, über den Index.
 * @param {IDBDatabase} db
 * @param {Date} ab
 * @returns {Promise<Buchung[]>}
 */
export function buchungenSeit(db, ab) {
  return transaktion(db, ['buchung'], 'readonly', (tx) =>
    anfrage(tx.objectStore('buchung').index('zeitstempel').getAll(IDBKeyRange.lowerBound(ab.toISOString()))),
  );
}

/**
 * Alles für Sicherung und Exporte, in einer Lese-Transaktion.
 * @param {IDBDatabase} db
 * @returns {Promise<Daten>}
 */
export function alleDaten(db) {
  return transaktion(db, DATEN_STORES, 'readonly', async (tx) => {
    const [projekt, mitglieder, artikel, buchungen] = await Promise.all([
      anfrage(tx.objectStore('projekt').get('einstellungen')),
      anfrage(tx.objectStore('mitglied').getAll()),
      anfrage(tx.objectStore('artikel').getAll()),
      anfrage(tx.objectStore('buchung').getAll()),
    ]);
    return { projekt, mitglieder, artikel, buchungen };
  });
}

// ---------- Schreiben ----------

/**
 * Nächste id: höchste vorhandene + 1. Es wird nie gelöscht, also nie neu vergeben.
 * @param {IDBObjectStore} store
 * @returns {Promise<number>}
 */
async function naechsteId(store) {
  const zeiger = await anfrage(store.openKeyCursor(null, 'prev'));
  return zeiger ? Number(zeiger.key) + 1 : 1;
}

/**
 * @param {string} wert
 * @param {string} feld
 * @param {number} min
 * @param {number} max
 */
function pruefeText(wert, feld, min, max) {
  const f = textFehler(wert, min, max);
  if (f) throw new Error(`${feld} ${f}`);
}

/**
 * Guthaben ändern und den Schwärzungs-Merker aus dem ganzen Verlauf neu bestimmen.
 * @param {IDBTransaction} tx
 * @param {Mitglied} m
 * @param {number} betrag
 * @param {Buchung[]} neue in dieser Transaktion angehängte Buchungen
 */
async function bucheAuf(tx, m, betrag, neue) {
  const projekt = /** @type {Projekt} */ (await anfrage(tx.objectStore('projekt').get('einstellungen')));
  const bisher = /** @type {Buchung[]} */ (await anfrage(tx.objectStore('buchung').index('mitglied_id').getAll(m.id)));
  const ids = new Set(bisher.map((b) => b.id));
  m.guthaben += betrag;
  m.geschwaerzt = schwaerzungAusVerlauf([...bisher, ...neue.filter((b) => !ids.has(b.id))], projekt.schwaerzungs_grenze);
  tx.objectStore('mitglied').put(m);
}

/**
 * Projekt speichern. Ändern sich Grenze oder Schwärzung, wird der Merker neu berechnet.
 * @param {IDBDatabase} db
 * @param {Projekt} projekt
 */
export function speichereProjekt(db, projekt) {
  return transaktion(db, ['projekt', 'mitglied', 'buchung'], 'readwrite', async (tx) => {
    const alt = /** @type {Projekt | undefined} */ (await anfrage(tx.objectStore('projekt').get('einstellungen')));
    tx.objectStore('projekt').put(projekt, 'einstellungen');
    if (alt && alt.schwaerzungs_grenze === projekt.schwaerzungs_grenze) return;
    // neue Grenze: Merker für alle aus dem Verlauf neu bestimmen (selten, darf alle Buchungen lesen)
    /** @type {Map<number, Buchung[]>} */
    const jeMitglied = new Map();
    for (const b of /** @type {Buchung[]} */ (await anfrage(tx.objectStore('buchung').getAll()))) {
      const liste = jeMitglied.get(b.mitglied_id) ?? [];
      liste.push(b);
      jeMitglied.set(b.mitglied_id, liste);
    }
    const s = tx.objectStore('mitglied');
    for (const m of /** @type {Mitglied[]} */ (await anfrage(s.getAll()))) {
      const neu = schwaerzungAusVerlauf(jeMitglied.get(m.id) ?? [], projekt.schwaerzungs_grenze);
      if (neu !== m.geschwaerzt) s.put({ ...m, geschwaerzt: neu });
    }
  });
}

/**
 * @param {IDBDatabase} db
 * @param {string} name
 * @param {string} nickname
 * @returns {Promise<number>}
 */
export function neuesMitglied(db, name, nickname) {
  pruefeText(name, 'Name', 1, 60);
  pruefeText(nickname, 'Spitzname', 0, 40);
  return transaktion(db, ['mitglied'], 'readwrite', async (tx) => {
    const s = tx.objectStore('mitglied');
    const id = await naechsteId(s);
    s.add({ id, name, nickname, aktiv: true, guthaben: 0, geschwaerzt: false });
    return id;
  });
}

/**
 * Name, Spitzname und aktiv ändern; das Guthaben nie.
 * @param {IDBDatabase} db
 * @param {number} id
 * @param {{name: string, nickname: string, aktiv: boolean}} werte
 */
export function aendereMitglied(db, id, werte) {
  pruefeText(werte.name, 'Name', 1, 60);
  pruefeText(werte.nickname, 'Spitzname', 0, 40);
  return transaktion(db, ['mitglied'], 'readwrite', async (tx) => {
    const s = tx.objectStore('mitglied');
    const m = /** @type {Mitglied | undefined} */ (await anfrage(s.get(id)));
    if (!m) throw new Error('Mitglied nicht gefunden');
    s.put({ ...m, name: werte.name, nickname: werte.nickname, aktiv: werte.aktiv });
  });
}

/**
 * @param {{name: string, preis: number, reihenfolge: number}} werte
 */
function pruefeArtikel(werte) {
  pruefeText(werte.name, 'Name', 1, 40);
  if (!Number.isInteger(werte.preis) || werte.preis < 1 || werte.preis > MAX_PREIS) throw new Error('Preis muss zwischen 0,01 € und 1000,00 € liegen');
  if (!Number.isInteger(werte.reihenfolge)) throw new Error('Reihenfolge muss eine ganze Zahl sein');
}

/**
 * @param {IDBDatabase} db
 * @param {{name: string, preis: number, reihenfolge: number}} werte
 * @returns {Promise<number>}
 */
export function neuerArtikel(db, werte) {
  pruefeArtikel(werte);
  return transaktion(db, ['artikel'], 'readwrite', async (tx) => {
    const s = tx.objectStore('artikel');
    const id = await naechsteId(s);
    s.add({ id, name: werte.name, preis: werte.preis, reihenfolge: werte.reihenfolge, aktiv: true });
    return id;
  });
}

/**
 * @param {IDBDatabase} db
 * @param {number} id
 * @param {{name: string, preis: number, reihenfolge: number, aktiv: boolean}} werte
 */
export function aendereArtikel(db, id, werte) {
  pruefeArtikel(werte);
  return transaktion(db, ['artikel'], 'readwrite', async (tx) => {
    const s = tx.objectStore('artikel');
    if (!(await anfrage(s.get(id)))) throw new Error('Artikel nicht gefunden');
    s.put({ id, name: werte.name, preis: werte.preis, reihenfolge: werte.reihenfolge, aktiv: werte.aktiv });
  });
}

/**
 * @param {string} geraet
 * @param {Partial<Buchung> & Pick<Buchung, 'typ' | 'mitglied_id' | 'menge' | 'preis_pro_einheit'>} teil
 * @param {string} zeit
 * @returns {Buchung}
 */
function buchung(geraet, teil, zeit) {
  return {
    id: crypto.randomUUID(),
    geraet_id: geraet,
    typ: teil.typ,
    mitglied_id: teil.mitglied_id,
    artikel_id: teil.artikel_id ?? null,
    storno_von: teil.storno_von ?? null,
    menge: teil.menge,
    preis_pro_einheit: teil.preis_pro_einheit,
    gesamtpreis: gesamtpreis(teil.typ, teil.menge, teil.preis_pro_einheit),
    zeitstempel: zeit,
  };
}

/**
 * Eine Bestellung aus mehreren Artikeln in genau einer Transaktion. Preise kommen aus der Datenbank.
 * @param {IDBDatabase} db
 * @param {string} geraet
 * @param {number} mitgliedId
 * @param {Map<number, number>} posten artikel_id → Menge
 */
export function bucheBestellung(db, geraet, mitgliedId, posten) {
  if (posten.size === 0) return Promise.reject(new Error('Bestellung ist leer'));
  return transaktion(db, ['projekt', 'mitglied', 'artikel', 'buchung'], 'readwrite', async (tx) => {
    const projekt = /** @type {Projekt} */ (await anfrage(tx.objectStore('projekt').get('einstellungen')));
    const m = /** @type {Mitglied | undefined} */ (await anfrage(tx.objectStore('mitglied').get(mitgliedId)));
    if (!m || !m.aktiv) throw new Error('Mitglied nicht gefunden');
    if (istGeschwaerzt(projekt, m)) throw new Error('Geschwärzt: Artikel können nicht gebucht werden');
    const zeit = new Date().toISOString();
    /** @type {Buchung[]} */
    const neue = [];
    let summe = 0;
    for (const [artikelId, menge] of posten) {
      const a = /** @type {Artikel | undefined} */ (await anfrage(tx.objectStore('artikel').get(artikelId)));
      if (!a || !a.aktiv) throw new Error('Artikel nicht verfügbar');
      if (!Number.isInteger(menge) || menge < 1 || menge > 1000) throw new Error('Ungültige Menge');
      const b = buchung(geraet, { typ: 'artikel', mitglied_id: m.id, artikel_id: a.id, menge, preis_pro_einheit: a.preis }, zeit);
      summe += b.gesamtpreis;
      neue.push(b);
      tx.objectStore('buchung').add(b);
    }
    await bucheAuf(tx, m, summe, neue);
  });
}

/**
 * Aufbuchung (Einzahlung) oder Zahlung (Kassieren); auch für geschwärzte Mitglieder.
 * @param {IDBDatabase} db
 * @param {string} geraet
 * @param {number} mitgliedId
 * @param {'aufbuchung' | 'zahlung'} typ
 * @param {number} betrag Cent > 0
 */
export function bucheBetrag(db, geraet, mitgliedId, typ, betrag) {
  if (!Number.isInteger(betrag) || betrag < 1 || betrag > MAX_BETRAG) return Promise.reject(new Error('Ungültiger Betrag'));
  return transaktion(db, ['projekt', 'mitglied', 'buchung'], 'readwrite', async (tx) => {
    const m = /** @type {Mitglied | undefined} */ (await anfrage(tx.objectStore('mitglied').get(mitgliedId)));
    if (!m) throw new Error('Mitglied nicht gefunden');
    const b = buchung(geraet, { typ, mitglied_id: m.id, menge: 1, preis_pro_einheit: betrag }, new Date().toISOString());
    tx.objectStore('buchung').add(b);
    await bucheAuf(tx, m, b.gesamtpreis, [b]);
  });
}

/**
 * Storno-Eintrag anhängen: schaltet die Originalbuchung um. Gibt zurück, ob sie jetzt storniert ist.
 * @param {IDBDatabase} db
 * @param {string} geraet
 * @param {string} buchungId
 * @returns {Promise<boolean>}
 */
export function schalteStorno(db, geraet, buchungId) {
  return transaktion(db, ['projekt', 'mitglied', 'buchung'], 'readwrite', async (tx) => {
    const bs = tx.objectStore('buchung');
    const original = /** @type {Buchung | undefined} */ (await anfrage(bs.get(buchungId)));
    if (!original) throw new Error('Buchung nicht gefunden');
    if (original.typ === 'storno') throw new Error('Ein Storno-Eintrag kann nicht storniert werden');
    const m = /** @type {Mitglied} */ (await anfrage(tx.objectStore('mitglied').get(original.mitglied_id)));
    const alle = /** @type {Buchung[]} */ (await anfrage(bs.index('mitglied_id').getAll(original.mitglied_id)));
    const jetztStorniert = !stornierte(alle).has(original.id);
    const storno = buchung(geraet, { typ: 'storno', mitglied_id: m.id, storno_von: original.id, menge: 1, preis_pro_einheit: 0 }, new Date().toISOString());
    bs.add(storno);
    await bucheAuf(tx, m, jetztStorniert ? -original.gesamtpreis : original.gesamtpreis, [storno]);
    return jetztStorniert;
  });
}

/**
 * Alle Daten ersetzen (Import, neues Projekt), in einer einzigen Transaktion.
 * Bei einem Fehler bleibt der alte Zustand vollständig erhalten. Der Store „geraet“ bleibt unberührt.
 * @param {IDBDatabase} db
 * @param {Daten} daten
 */
export function ersetze(db, daten) {
  return transaktion(db, DATEN_STORES, 'readwrite', async (tx) => {
    for (const s of DATEN_STORES) tx.objectStore(s).clear();
    tx.objectStore('projekt').put(daten.projekt, 'einstellungen');
    for (const m of daten.mitglieder) tx.objectStore('mitglied').add(m);
    for (const a of daten.artikel) tx.objectStore('artikel').add(a);
    for (const b of daten.buchungen) tx.objectStore('buchung').add(b);
  });
}
