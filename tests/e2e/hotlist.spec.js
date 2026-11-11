// Hotlist: Bildschirm immer gefüllt. Wer hineinkommt, bestimmt die Stückzahl der letzten 14 Tage;
// freie Plätze füllen die übrigen aktiven Mitglieder alphabetisch auf. Angezeigt wird alles alphabetisch.
import { test, expect } from './fixtures.js';

/** @param {import('@playwright/test').Page} page */
async function kacheln(page) {
  return page.locator('.kacheln[aria-label="Mitglieder"] .kachel').evaluateAll((els) => {
    const fuss = document.querySelector('footer')?.getBoundingClientRect().top ?? innerHeight;
    return els.map((e) => {
      const r = e.getBoundingClientRect();
      return { name: e.querySelector('.name')?.textContent ?? '', unten: r.bottom, hoehe: r.height, fuss };
    });
  });
}

test('Hotlist füllt den Bildschirm, Stückzahl vor Auffüllen, alphabetisch', async ({ page, basis }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto(basis);
  await page.getByRole('button', { name: 'Demo ansehen' }).click();
  await expect(page.locator('.kachel').first()).toBeVisible();
  const klein = await kacheln(page);
  // Demo: 11 aktive Mitglieder, davon 10 mit Buchungen in den letzten 14 Tagen
  expect(klein.length).toBeGreaterThan(0);
  expect(klein.length).toBeLessThan(11);
  // alle ganz sichtbar, und darunter passt keine weitere Reihe mehr: der Bildschirm ist gefüllt
  for (const k of klein) expect(k.unten).toBeLessThanOrEqual(k.fuss);
  const letzte = Math.max(...klein.map((k) => k.unten));
  expect(klein[0].fuss - letzte).toBeLessThan(klein[0].hoehe + 16);
  const namen = klein.map((k) => k.name);
  expect(namen).toEqual([...namen].sort((a, b) => a.localeCompare(b, 'de')));
  // wenig Platz: wer Stück hat, verdrängt Mitglieder ohne Buchungen
  expect(namen).not.toContain('Kim Schablone');
  // viel Platz: alle 11 aktiven, auch ohne Buchungen, nie die inaktive Lou
  await page.setViewportSize({ width: 1280, height: 1000 });
  await expect.poll(async () => (await kacheln(page)).length).toBe(11);
  const gross = (await kacheln(page)).map((k) => k.name);
  expect(gross).toContain('Kim Schablone');
  expect(gross).not.toContain('Lou Entwurf');
  expect(gross).toEqual([...gross].sort((a, b) => a.localeCompare(b, 'de')));
  // Suche findet trotzdem alle
  await page.setViewportSize({ width: 390, height: 700 });
  await page.getByLabel('Mitglied suchen').fill('e');
  await expect.poll(async () => (await kacheln(page)).length).toBeGreaterThan(klein.length);
});
