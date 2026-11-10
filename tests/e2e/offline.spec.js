import { test, expect } from './fixtures.js';
import { projektDatei, starteMit } from './hilfen.js';

/** Warten, bis der Service Worker die Seite steuert. */
/** @param {import('@playwright/test').Page} page */
async function gesteuert(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((ok) => navigator.serviceWorker.addEventListener('controllerchange', ok, { once: true }));
  });
}

test('Offline-Reload zeigt die App mit den Daten', async ({ page, basis, context }) => {
  await starteMit(page, basis, projektDatei());
  await gesteuert(page);
  await expect(page.locator('#version')).toHaveText('v1.0.0 (abc1234)');
  await context.setOffline(true);
  await page.reload();
  await page.getByLabel('Mitglied suchen').fill('Alex');
  await expect(page.locator('.kachel')).toHaveText(/Alex Beispiel/);
  await expect(page.locator('#version')).toHaveText('v1.0.0 (abc1234)');
  await page.goto(basis + '#/buchen/1');
  await page.getByRole('button', { name: 'Bier 3,50 €' }).click();
  await page.getByRole('button', { name: 'Jetzt 3,50 € buchen' }).click();
  await expect(page.getByRole('heading', { name: 'µEBS', exact: true })).toBeVisible();
  await context.setOffline(false);
});

test('Update-Banner nur auf der Startseite, neue Version erst nach Klick', async ({ page, basis, setzeVersion }) => {
  await starteMit(page, basis, projektDatei());
  await gesteuert(page);
  await expect(page.locator('#update-banner')).toBeHidden();
  setzeVersion({ version: '1.1.0', sha: 'def5678' });
  await page.reload();
  const banner = page.getByRole('button', { name: 'Neue Version – jetzt laden' });
  await expect(banner).toBeVisible({ timeout: 15000 });
  // läuft noch die alte Version
  await expect(page.locator('#version')).toHaveText('v1.0.0 (abc1234)');
  await page.goto(basis + '#/buchen/1');
  await expect(banner).toBeHidden();
  await page.getByRole('link', { name: 'Zurück' }).click();
  await expect(banner).toBeVisible();
  await banner.click();
  await expect(page.locator('#version')).toHaveText('v1.1.0 (def5678)', { timeout: 15000 });
  await expect(page.locator('#update-banner')).toBeHidden();
  const caches = await page.evaluate(() => caches.keys());
  expect(caches).toEqual(['muebs-1.1.0-def5678']);
});

test('Sicherheits-Header im HTML: CSP als erstes Element im head und no-referrer', async ({ page, basis }) => {
  await page.goto(basis);
  const erstes = await page.evaluate(() => {
    const e = document.head.firstElementChild;
    return e ? [e.getAttribute('http-equiv'), e.getAttribute('content')] : null;
  });
  expect(erstes).toEqual(['Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; require-trusted-types-for 'script'; trusted-types muebs-sw"]);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
  // innerHTML wird von Trusted Types blockiert
  const blockiert = await page.evaluate(() => {
    try {
      document.body.innerHTML = '<b>x</b>';
      return false;
    } catch {
      return true;
    }
  });
  expect(blockiert).toBe(true);
});
