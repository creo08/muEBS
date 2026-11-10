import { test, expect } from './fixtures.js';
import { randomUUID } from 'node:crypto';

/** 500 Mitglieder, 50.000 Buchungen über ein Jahr verteilt, stimmig. */
function grossesProjekt() {
  const jetzt = Date.now();
  const mitglieder = Array.from({ length: 500 }, (_, i) => ({ id: i + 1, name: `Mitglied ${String(i + 1).padStart(3, '0')}`, nickname: '', aktiv: true, guthaben: 0, geschwaerzt: false }));
  const artikel = [{ id: 1, name: 'Bier', preis: 350, reihenfolge: 1, aktiv: true }];
  const geraet = randomUUID();
  const buchungen = Array.from({ length: 50000 }, (_, i) => {
    const m = mitglieder[i % 500];
    m.guthaben -= 350;
    return { id: randomUUID(), geraet_id: geraet, typ: 'artikel', mitglied_id: m.id, artikel_id: 1, storno_von: null, menge: 1, preis_pro_einheit: 350, gesamtpreis: -350, zeitstempel: new Date(jetzt - (50000 - i) * 630000).toISOString() };
  });
  for (const m of mitglieder) m.geschwaerzt = m.guthaben < -2000;
  return { format: 1, typ: 'sicherung', erstellt: new Date(jetzt).toISOString(), projekt: { farbschema: 'violett', modus: 'deckel', schwaerzung_aktiv: false, schwaerzungs_grenze: -2000 }, mitglieder, artikel, buchungen };
}

test('Startseite und Buchen-Seite mit 500 Mitgliedern und 50.000 Buchungen', async ({ page, basis }) => {
  test.slow();
  await page.goto(basis);
  await page.getByLabel('Sicherung/Projekt laden (.json)').setInputFiles({ name: 'gross.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(grossesProjekt())) });
  await page.getByRole('button', { name: 'Laden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'µEBS', exact: true })).toBeVisible({ timeout: 60000 });
  /** @param {string} ziel @param {string} merkmal */
  const miss = (ziel, merkmal) => page.evaluate(([z, s]) => new Promise((ok) => {
    location.hash = '#/kassierliste';
    setTimeout(() => {
      const t0 = performance.now();
      location.hash = z;
      const warte = () => (document.querySelector(s) ? ok(performance.now() - t0) : requestAnimationFrame(warte));
      warte();
    }, 300);
  }), [ziel, merkmal]);
  const start = await miss('#/', '.kachel');
  const buchen = await miss('#/buchen/1', '#saldo');
  console.log(`Startseite ${start.toFixed(0)} ms, Buchen-Seite ${buchen.toFixed(0)} ms`);
  // Desktop-Grenze; Ziel am Mittelklasse-Handy sind 200 ms (Handprüfung in docs/entwicklung.md)
  expect(start).toBeLessThan(200);
  expect(buchen).toBeLessThan(200);
});
