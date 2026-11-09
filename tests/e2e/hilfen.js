// Hilfsfunktionen für die E2E-Tests.
import { expect } from '@playwright/test';

/**
 * Kleines Projekt im Sicherungsformat.
 * @param {Partial<{modus: string, schwaerzung_aktiv: boolean, schwaerzungs_grenze: number}>} [projekt]
 */
export function projektDatei(projekt = {}) {
  return {
    format: 1,
    typ: 'projekt',
    erstellt: '2026-01-01T10:00:00.000Z',
    projekt: { farbschema: 'violett', modus: 'vorauszahlung', schwaerzung_aktiv: true, schwaerzungs_grenze: -2000, ...projekt },
    mitglieder: [
      { id: 1, name: 'Alex Beispiel', nickname: 'Lexi', aktiv: true, guthaben: 0, geschwaerzt: false },
      { id: 2, name: 'Bente Muster', nickname: '', aktiv: true, guthaben: 0, geschwaerzt: false },
    ],
    artikel: [
      { id: 1, name: 'Bier', preis: 350, reihenfolge: 1, aktiv: true },
      { id: 2, name: 'Limo', preis: 250, reihenfolge: 2, aktiv: true },
    ],
    buchungen: [],
  };
}

/**
 * Datei auf der Init-Seite laden.
 * @param {import('@playwright/test').Page} page
 * @param {string} basis
 * @param {object} daten
 */
export async function starteMit(page, basis, daten) {
  await page.goto(basis);
  await page.getByLabel('Sicherung/Projekt laden (.json)').setInputFiles({ name: 'projekt.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(daten)) });
  await page.getByRole('button', { name: 'Laden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'µEBS', exact: true })).toBeVisible();
}

/**
 * Liest die Datenbank und prüft: mitglied.guthaben = Summe der nicht stornierten Buchungen.
 * @param {import('@playwright/test').Page} page
 * @param {string} [name]
 * @returns {Promise<{mitglieder: any[], buchungen: any[], geraet: Record<string, unknown>}>}
 */
export async function datenbank(page, name = 'muebs') {
  const daten = await page.evaluate(async (dbName) => {
    const db = await new Promise((ok, nein) => {
      const r = indexedDB.open(dbName);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => nein(r.error);
    });
    /** @param {string} s */
    const alle = (s) => new Promise((ok) => { const r = db.transaction(s).objectStore(s).getAll(); r.onsuccess = () => ok(r.result); });
    const geraet = await new Promise((ok) => {
      const s = db.transaction('geraet').objectStore('geraet');
      /** @type {Record<string, unknown>} */
      const o = {};
      const c = s.openCursor();
      c.onsuccess = () => { const z = c.result; if (z) { o[String(z.key)] = z.value; z.continue(); } else ok(o); };
    });
    const ergebnis = { mitglieder: await alle('mitglied'), buchungen: await alle('buchung'), geraet };
    db.close();
    return ergebnis;
  }, name);
  const { salden } = await import('../../js/regeln.js');
  const s = salden(daten.buchungen);
  for (const m of daten.mitglieder) expect(m.guthaben, `Guthaben von ${m.name}`).toBe(s.get(m.id) ?? 0);
  return daten;
}

/**
 * Download abwarten und Inhalt als Text liefern.
 * @param {import('@playwright/test').Page} page
 * @param {() => Promise<unknown>} ausloeser
 */
export async function download(page, ausloeser) {
  const [d] = await Promise.all([page.waitForEvent('download'), ausloeser()]);
  const pfad = await d.path();
  const { readFile } = await import('node:fs/promises');
  return { name: d.suggestedFilename(), text: await readFile(pfad, 'utf8') };
}
