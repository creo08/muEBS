import { test, expect, DEMO } from './fixtures.js';
import { datenbank, download, projektDatei, starteMit } from './hilfen.js';

/** @param {import('@playwright/test').Page} page @param {string} name @param {string | Buffer} inhalt */
async function lade(page, name, inhalt) {
  await page.goto(page.url().split('#')[0] + '#/admin/laden');
  await page.getByLabel('Datei (.json)').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.isBuffer(inhalt) ? inhalt : Buffer.from(inhalt) });
  await page.getByRole('button', { name: 'Laden', exact: true }).click();
}

test('Gerät zurücksetzen: Sicherungsvorschlag, doppelte Rückfrage, alles weg, neue geraet_id', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei());
  await page.goto(basis + '#/admin/einstellungen');
  await page.getByLabel('PIN (4 Ziffern)').fill('1111');
  await page.getByLabel('PIN wiederholen').fill('1111');
  await page.getByRole('button', { name: 'PIN setzen' }).click();
  await expect(page.getByText('PIN gespeichert')).toBeVisible();
  const vorher = (await datenbank(page)).geraet.geraet_id;
  await page.goto(basis + '#/admin/zuruecksetzen');
  await page.getByRole('button', { name: 'Gerät zurücksetzen' }).click();
  await expect(page.getByRole('dialog')).toContainText('Vorher sichern?');
  const s = await download(page, () => page.getByRole('dialog').getByRole('button', { name: 'Sicherung herunterladen' }).click());
  expect(s.name).toMatch(/^muebs_sicherung_/);
  await page.getByRole('dialog').getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Endgültig löschen' }).click();
  await expect(page.getByRole('heading', { name: 'Willkommen bei µEBS' })).toBeVisible();
  const d = await datenbank(page);
  expect(d.mitglieder).toEqual([]);
  expect(d.geraet.pin).toBeUndefined();
  expect(d.geraet.geraet_id).toBeTruthy();
  expect(d.geraet.geraet_id).not.toBe(vorher);
});

test('ids von Mitgliedern und Artikeln werden nach Deaktivieren nie neu vergeben', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei());
  await page.goto(basis + '#/admin/mitglieder');
  await page.getByRole('link', { name: 'Bente Muster' }).click();
  await page.getByLabel(/^aktiv/).uncheck();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Bente Muster gespeichert')).toBeVisible();
  await page.getByRole('link', { name: 'Zur Liste' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Bente Muster' })).toContainText('inaktiv');
  await page.getByRole('link', { name: 'Neues Mitglied' }).click();
  await page.locator('#neu-name').fill('Chris Probe');
  await page.getByRole('button', { name: 'Mitglied anlegen' }).click();
  await expect(page.getByText('Chris Probe angelegt (Nr. 3)')).toBeVisible();
  await page.goto(basis + '#/admin/artikel');
  await page.getByRole('link', { name: 'Limo' }).click();
  await page.getByLabel(/^aktiv/).uncheck();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Limo gespeichert')).toBeVisible();
  await page.goto(basis + '#/admin/artikel/neu');
  await page.locator('#neu-artikel').fill('Saft');
  await page.locator('#neu-preis').fill('2');
  await page.getByRole('button', { name: 'Artikel anlegen' }).click();
  await expect(page.getByText('Saft angelegt (Nr. 3)')).toBeVisible();
  // inaktive erscheinen nicht mehr
  await page.goto(basis + '#/buchen/1');
  await expect(page.getByRole('button', { name: 'Limo 2,50 €' })).toHaveCount(0);
  await page.goto(basis + '#/buchen/2');
  await expect(page).toHaveURL(/#\/$/);
});

test('Export/Import-Roundtrip mit Formatversion', async ({ page, basis }) => {
  await page.goto(basis);
  await page.getByRole('button', { name: 'Demo ansehen' }).click();
  await expect(page.locator('#demo-banner')).toBeVisible();
  const original = await datenbank(page, 'muebs_demo');
  await page.goto(basis + '#/admin/exporte');
  const s = await download(page, () => page.getByRole('button', { name: 'Sicherung exportieren' }).click());
  const datei = JSON.parse(s.text);
  expect(datei.format).toBe(1);
  expect(datei.typ).toBe('sicherung');
  await page.goto(basis + '#/');
  await page.getByRole('button', { name: 'Demo beenden' }).click();
  // als echte Daten laden: ohne demo-Kennzeichen
  delete datei.demo;
  await page.getByLabel('Sicherung/Projekt laden (.json)').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(datei)) });
  await page.getByRole('button', { name: 'Laden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'µEBS', exact: true })).toBeVisible();
  const echt = await datenbank(page);
  expect(echt.mitglieder).toEqual(original.mitglieder);
  expect(echt.buchungen.sort((a, b) => a.id.localeCompare(b.id))).toEqual(original.buchungen.sort((a, b) => a.id.localeCompare(b.id)));
  // erneuter Import über den Admin-Bereich: Vorher sichern? und Rückfrage
  await lade(page, 'x.json', JSON.stringify(datei));
  await expect(page.getByRole('dialog')).toContainText('Vorher sichern?');
  await page.getByRole('dialog').getByRole('button', { name: 'Ohne Sicherung weiter' }).click();
  await expect(page.getByRole('dialog')).toContainText('Alle Daten am Gerät werden ersetzt');
  await page.getByRole('dialog').getByRole('button', { name: 'Ersetzen' }).click();
  await expect(page.getByText('Daten geladen')).toBeVisible();
});

test('Import bösartiger Dateien wird abgelehnt, ohne Teil-Schreiben', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei());
  const vorher = await datenbank(page);
  const gut = () => JSON.parse(JSON.stringify(DEMO));
  /** @type {Array<[string, string | Buffer, RegExp]>} */
  const faelle = [];
  const ohneDemo = () => { const d = gut(); delete d.demo; return d; };
  faelle.push(['zu groß', Buffer.alloc(25 * 1024 * 1024 + 1, 32), /größer als 25 MB/]);
  faelle.push(['kein JSON', '{', /kein gültiges JSON/]);
  faelle.push(['__proto__', JSON.stringify(ohneDemo()).replace('"projekt":{', '"projekt":{"__proto__":{"x":1},'), /Unzulässiger Schlüssel „__proto__“/]);
  faelle.push(['constructor', JSON.stringify({ ...ohneDemo(), mitglieder: [{ constructor: 1 }] }), /Unzulässiger Schlüssel/]);
  const typ = ohneDemo(); typ.mitglieder[0].guthaben = '0'; faelle.push(['falscher Typ', JSON.stringify(typ), /guthaben: ganze Zahl/]);
  const komma = ohneDemo(); komma.artikel[0].preis = 3.5; faelle.push(['Cent mit Komma', JSON.stringify(komma), /preis: ganze Zahl/]);
  faelle.push(['höheres format', JSON.stringify({ ...ohneDemo(), format: 2 }), /^Datei aus neuerer Version$/]);
  faelle.push(['format fehlt', JSON.stringify({ ...ohneDemo(), format: undefined }), /^Datei aus neuerer Version$/]);
  const leer = ohneDemo(); leer.buchungen[0].mitglied_id = 999; faelle.push(['Verweis ins Leere', JSON.stringify(leer), /mitglied_id 999 gibt es nicht/]);
  const art = ohneDemo(); const ab = art.buchungen.find((b) => b.typ === 'artikel'); ab.artikel_id = 99; faelle.push(['artikel_id ins Leere', JSON.stringify(art), /artikel_id 99 gibt es nicht/]);
  const st = ohneDemo(); const s1 = st.buchungen.find((b) => b.typ === 'storno'); st.buchungen.push({ ...s1, id: '11111111-2222-4333-8444-555555555555', storno_von: s1.id }); faelle.push(['storno_von auf Storno', JSON.stringify(st), /nicht auf einen Storno-Eintrag/]);
  const un = ohneDemo(); un.mitglieder[0].guthaben += 1; faelle.push(['unstimmig', JSON.stringify(un), /^Sicherung ist in sich nicht stimmig$/]);
  const feld = ohneDemo(); feld.mitglieder[0].email = 'x'; faelle.push(['unbekanntes Feld', JSON.stringify(feld), /unbekanntes Feld „email“/]);
  const uu = ohneDemo(); uu.buchungen[0].id = 'keine-uuid'; faelle.push(['keine UUID', JSON.stringify(uu), /UUID erwartet/]);
  const formel = ohneDemo(); formel.mitglieder[0].name = '=1+1'; faelle.push(['Formel im Namen', JSON.stringify(formel), /darf nicht mit = \+ - @ beginnen/]);
  faelle.push(['Demo-Datei', JSON.stringify(gut()), /Demo-Daten können nicht/]);
  for (const [name, inhalt, meldung] of faelle) {
    await lade(page, `${name}.json`, inhalt);
    await expect(page.getByRole('alert'), name).toHaveText(meldung);
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const nachher = await datenbank(page);
  expect(nachher.mitglieder).toEqual(vorher.mitglieder);
  expect(nachher.buchungen).toEqual(vorher.buchungen);
});

test('Fehler beim Schreiben lässt den alten Zustand vollständig erhalten', async ({ page, basis }) => {
  await starteMit(page, basis, projektDatei());
  const ergebnis = await page.evaluate(async () => {
    const db = await import('./js/db.js');
    const d = await db.oeffne('muebs', { blockiert: () => {}, vorMigration: async () => true });
    const alt = await db.alleDaten(d);
    // doppelte id lässt add() mitten in der Transaktion scheitern
    const kaputt = { ...alt, mitglieder: [...alt.mitglieder, { ...alt.mitglieder[0] }] };
    try {
      await db.ersetze(d, kaputt);
      return 'geschrieben';
    } catch {
      return (await db.alleMitglieder(d)).length;
    } finally {
      d.close();
    }
  });
  expect(ergebnis).toBe(2);
});
