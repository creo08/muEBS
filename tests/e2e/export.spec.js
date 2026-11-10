// Phase 2: leeres Projekt, Abrechnung, Umstieg ins Vollsystem.
import { test, expect } from './fixtures.js';
import { readFile } from 'node:fs/promises';
import { datenbank, projektDatei, starteMit } from './hilfen.js';

const FIXTURES = new URL('../fixtures/umstieg/', import.meta.url);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Projekt mit Anführungszeichen und Semikolon in Texten, einem inaktiven Mitglied mit Saldo,
 * einem inaktiven Artikel und einer stornierten Zahlung.
 * Alex −7,00 €, Bente +5,00 € (Zahlung), Chris (inaktiv) −2,50 €.
 */
function daten() {
  const p = projektDatei();
  p.typ = 'sicherung';
  p.mitglieder[0].nickname = 'Lexi "Chef"';
  p.mitglieder[1].nickname = 'Bente; @home';
  p.mitglieder.push({ id: 3, name: 'Chris Probe', nickname: '', aktiv: false, guthaben: 0, geschwaerzt: false });
  p.artikel[0].name = 'Bier "Hell"';
  p.artikel.push({ id: 3, name: 'Saft', preis: 199, reihenfolge: 3, aktiv: false });
  p.mitglieder[0].guthaben = -700;
  p.mitglieder[1].guthaben = 500;
  p.mitglieder[2].guthaben = -250;
  const g = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
  const b = { geraet_id: g, storno_von: null, menge: 1, artikel_id: null };
  p.buchungen = [
    { ...b, id: 'a0000000-0000-4000-8000-000000000001', typ: 'artikel', mitglied_id: 1, artikel_id: 1, menge: 2, preis_pro_einheit: 350, gesamtpreis: -700, zeitstempel: '2026-01-01T10:00:00.000Z' },
    { ...b, id: 'a0000000-0000-4000-8000-000000000002', typ: 'zahlung', mitglied_id: 2, preis_pro_einheit: 500, gesamtpreis: 500, zeitstempel: '2026-01-01T11:00:00.000Z' },
    { ...b, id: 'a0000000-0000-4000-8000-000000000003', typ: 'artikel', mitglied_id: 3, artikel_id: 2, preis_pro_einheit: 250, gesamtpreis: -250, zeitstempel: '2026-01-01T11:30:00.000Z' },
    // stornierte Zahlung: zählt weder zum Saldo noch zu „bezahlt“
    { ...b, id: 'a0000000-0000-4000-8000-000000000004', typ: 'zahlung', mitglied_id: 1, preis_pro_einheit: 300, gesamtpreis: 300, zeitstempel: '2026-01-01T12:00:00.000Z' },
    { ...b, id: 'a0000000-0000-4000-8000-000000000005', typ: 'storno', mitglied_id: 1, storno_von: 'a0000000-0000-4000-8000-000000000004', preis_pro_einheit: 0, gesamtpreis: 0, zeitstempel: '2026-01-01T13:00:00.000Z' },
  ];
  return p;
}

/**
 * Download abwarten und Rohbytes liefern.
 * @param {import('@playwright/test').Page} page
 * @param {() => Promise<unknown>} ausloeser
 */
async function rohDownload(page, ausloeser) {
  const [d] = await Promise.all([page.waitForEvent('download'), ausloeser()]);
  return { name: d.suggestedFilename(), bytes: await readFile(await d.path()) };
}

/** @param {import('@playwright/test').Page} page @param {string} basis @param {string} name @param {Buffer} inhalt */
async function lade(page, basis, name, inhalt) {
  await page.goto(basis + '#/admin/laden');
  await page.getByLabel('Datei (.json)').setInputFiles({ name, mimeType: 'application/json', buffer: inhalt });
  await page.getByRole('button', { name: 'Laden', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ohne Sicherung weiter' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Ersetzen' }).click();
  await expect(page.getByText('Daten geladen')).toBeVisible();
}

/**
 * Unabhängige Neuberechnung der Abrechnung aus den Buchungen (ohne App-Code).
 * @param {any[]} mitglieder
 * @param {any[]} buchungen
 */
function erwarteteAbrechnung(mitglieder, buchungen) {
  /** @type {Map<string, number>} */
  const stornos = new Map();
  for (const b of buchungen) if (b.typ === 'storno') stornos.set(b.storno_von, (stornos.get(b.storno_von) ?? 0) + 1);
  const gueltig = buchungen.filter((b) => b.typ !== 'storno' && (stornos.get(b.id) ?? 0) % 2 === 0);
  /** @param {number} c */
  const eur = (c) => `${c < 0 ? '-' : ''}${Math.floor(Math.abs(c) / 100)},${String(Math.abs(c) % 100).padStart(2, '0')}`;
  /** @param {string} t */
  const txt = (t) => `"${t.replaceAll('"', '""')}"`;
  const zeilen = mitglieder.map((m) => {
    const saldo = gueltig.filter((b) => b.mitglied_id === m.id).reduce((s, b) => s + b.gesamtpreis, 0);
    const bezahlt = gueltig.filter((b) => b.mitglied_id === m.id && b.typ === 'zahlung').reduce((s, b) => s + b.gesamtpreis, 0);
    return [String(m.id), txt(m.name), txt(m.nickname), eur(saldo), eur(saldo < 0 ? -saldo : 0), eur(bezahlt)].join(';');
  });
  return '\uFEFF' + ['"id";"name";"nickname";"guthaben";"offen";"bezahlt"', ...zeilen].map((z) => z + '\r\n').join('');
}

test('Umstiegs-CSV Byte für Byte wie erwartet: alle Mitglieder und Artikel, auch inaktive', async ({ page, basis }) => {
  await starteMit(page, basis, daten());
  await page.goto(basis + '#/admin/exporte');
  await expect(page.getByRole('link', { name: 'https://github.com/relaxin101/barsystem' })).toHaveAttribute('href', 'https://github.com/relaxin101/barsystem');
  for (const datei of ['mitglieder_v1.csv', 'artikel_v1.csv', 'guthaben_v1.csv']) {
    const d = await rohDownload(page, () => page.getByRole('button', { name: datei }).click());
    expect(d.name).toBe(datei);
    expect(d.bytes.equals(await readFile(new URL(datei, FIXTURES))), datei).toBe(true);
  }
});

test('Umstieg bei Schwärzung aus: Spalte schwaerzungs_grenze leer', async ({ page, basis }) => {
  const d = daten();
  d.projekt.schwaerzung_aktiv = false;
  await starteMit(page, basis, d);
  await page.goto(basis + '#/admin/exporte');
  const m = await rohDownload(page, () => page.getByRole('button', { name: 'mitglieder_v1.csv' }).click());
  expect(m.bytes.equals(await readFile(new URL('mitglieder_v1_ohne_grenze.csv', FIXTURES)))).toBe(true);
});

test('Leeres Projekt „Guthaben auf 0“: erst Abrechnung, dann Projekt; Gerät unverändert; Datei ladbar', async ({ page, basis }) => {
  await starteMit(page, basis, daten());
  const vorher = await datenbank(page);
  await page.goto(basis + '#/admin/exporte');
  await expect(page.getByLabel('Guthaben auf 0 setzen (mit Abrechnung)')).toBeChecked();
  const projektKnopf = page.getByRole('button', { name: 'Projekt speichern' });
  await expect(projektKnopf).toBeDisabled();
  const abrechnung = await rohDownload(page, () => page.getByRole('button', { name: 'Abrechnung speichern' }).click());
  expect(abrechnung.name).toBe('abrechnung_v1.csv');
  // gegen eine unabhängige Neuberechnung aus den Buchungen am Gerät
  expect(abrechnung.bytes.toString('utf8')).toBe(erwarteteAbrechnung(vorher.mitglieder, vorher.buchungen));
  expect(abrechnung.bytes.toString('utf8')).toContain('1;"Alex Beispiel";"Lexi ""Chef""";-7,00;7,00;0,00\r\n');
  expect(abrechnung.bytes.toString('utf8')).toContain('2;"Bente Muster";"Bente; @home";5,00;0,00;5,00\r\n');
  await expect(projektKnopf).toBeEnabled();
  const projekt = await rohDownload(page, () => projektKnopf.click());
  expect(projekt.name).toMatch(/^muebs_projekt_\d{4}-\d{2}-\d{2}_\d{4}\.json$/);
  const p = JSON.parse(projekt.bytes.toString('utf8'));
  expect(p).toMatchObject({ format: 1, typ: 'projekt' });
  expect(p.buchungen).toEqual([]);
  expect(p.mitglieder.map((/** @type {any} */ m) => m.guthaben)).toEqual([0, 0, 0]);
  expect(p.artikel.map((/** @type {any} */ a) => [a.id, a.aktiv])).toEqual([[1, true], [2, true], [3, false]]);
  expect(p.projekt).toEqual({ farbschema: 'violett', modus: 'vorauszahlung', schwaerzung_aktiv: true, schwaerzungs_grenze: -2000 });
  // nur ein Export: die Daten am Gerät sind unverändert
  const nachExport = await datenbank(page);
  expect(nachExport.mitglieder).toEqual(vorher.mitglieder);
  expect(nachExport.buchungen).toEqual(vorher.buchungen);
  await lade(page, basis, projekt.name, projekt.bytes);
  const geladen = await datenbank(page);
  expect(geladen.mitglieder.map((m) => [m.id, m.guthaben, m.aktiv])).toEqual([[1, 0, true], [2, 0, true], [3, 0, false]]);
  expect(geladen.buchungen).toEqual([]);
});

test('Wechsel der Variante sperrt „Projekt speichern“ wieder, bis die Abrechnung neu gespeichert ist', async ({ page, basis }) => {
  await starteMit(page, basis, daten());
  await page.goto(basis + '#/admin/exporte');
  await rohDownload(page, () => page.getByRole('button', { name: 'Abrechnung speichern' }).click());
  await expect(page.getByRole('button', { name: 'Projekt speichern' })).toBeEnabled();
  await page.getByLabel('Guthaben übernehmen (je Mitglied ein Übertrag)').check();
  await page.getByLabel('Guthaben auf 0 setzen (mit Abrechnung)').check();
  await expect(page.getByRole('button', { name: 'Projekt speichern' })).toBeDisabled();
});

test('Leeres Projekt „Übernehmen“: je Saldo ≠ 0 ein Übertrag, Guthaben stimmen, Datei ladbar', async ({ page, basis }) => {
  await starteMit(page, basis, daten());
  const vorher = await datenbank(page);
  await page.goto(basis + '#/admin/exporte');
  await page.getByLabel('Guthaben übernehmen (je Mitglied ein Übertrag)').check();
  await expect(page.getByRole('button', { name: 'Abrechnung speichern' })).toBeHidden();
  const projekt = await rohDownload(page, () => page.getByRole('button', { name: 'Projekt speichern' }).click());
  const p = JSON.parse(projekt.bytes.toString('utf8'));
  const jetzt = Date.now();
  expect(p.buchungen).toHaveLength(3);
  for (const b of p.buchungen) {
    const m = vorher.mitglieder.find((x) => x.id === b.mitglied_id);
    expect(b).toMatchObject({ typ: 'uebertrag', menge: 1, artikel_id: null, storno_von: null, geraet_id: vorher.geraet.geraet_id, preis_pro_einheit: m.guthaben, gesamtpreis: m.guthaben });
    expect(b.id).toMatch(UUID);
    expect(Math.abs(Date.parse(b.zeitstempel) - jetzt)).toBeLessThan(60000);
  }
  expect(p.mitglieder.map((/** @type {any} */ m) => m.guthaben)).toEqual(vorher.mitglieder.map((m) => m.guthaben));
  expect((await datenbank(page)).buchungen).toEqual(vorher.buchungen);
  await lade(page, basis, projekt.name, projekt.bytes);
  const geladen = await datenbank(page);
  expect(geladen.mitglieder.map((m) => m.guthaben)).toEqual([-700, 500, -250]);
  // Übertrag ist stornierbar wie jede Buchung
  await page.goto(basis + '#/buchen/1');
  await page.getByRole('button', { name: 'Storno', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Stornieren' }).click();
  await expect(page.locator('#saldo')).toHaveText('0,00 €');
  await datenbank(page);
});

test('Demo: Dateinamen mit muebs_demo_ und "demo": true im Projekt', async ({ page, basis }) => {
  await page.goto(basis);
  await page.getByRole('button', { name: 'Demo ansehen' }).click();
  await expect(page.locator('#demo-banner')).toBeVisible();
  await page.goto(basis + '#/admin/exporte');
  const a = await rohDownload(page, () => page.getByRole('button', { name: 'Abrechnung speichern' }).click());
  expect(a.name).toBe('muebs_demo_abrechnung_v1.csv');
  const p = await rohDownload(page, () => page.getByRole('button', { name: 'Projekt speichern' }).click());
  expect(p.name).toMatch(/^muebs_demo_projekt_\d{4}-\d{2}-\d{2}_\d{4}\.json$/);
  expect(JSON.parse(p.bytes.toString('utf8')).demo).toBe(true);
  for (const datei of ['mitglieder_v1.csv', 'artikel_v1.csv', 'guthaben_v1.csv']) {
    const d = await rohDownload(page, () => page.getByRole('button', { name: datei }).click());
    expect(d.name).toBe(`muebs_demo_${datei}`);
  }
});
