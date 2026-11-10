// Gemeinsame Fixtures: eigener Server je Worker, Aufzeichnung fremder Anfragen und CSP-Verstöße.
import { test as basis, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { starteServer } from '../server.js';

export { expect };

export const DEMO = JSON.parse(readFileSync(new URL('../../demo/demo.json', import.meta.url), 'utf8'));

/**
 * @typedef {object} Fixtures
 * @property {string} basis
 * @property {(v: object | null) => void} setzeVersion
 * @property {void} waechter
 */

export const test = basis.extend(/** @type {any} */ ({
  server: [async ({}, use) => {
    const s = await starteServer();
    await use(s);
    await s.schliessen();
  }, { scope: 'worker' }],
  basis: async ({ server }, use) => {
    server.setzeVersion({ version: '1.0.0', sha: 'abc1234' });
    await use(server.url);
  },
  setzeVersion: async ({ server }, use) => use(server.setzeVersion),
  // Jede Anfrage an einen fremden Ursprung und jeder CSP-Verstoß lässt den Test scheitern
  waechter: [async ({ context, server }, use) => {
    const ursprung = new URL(server.url).origin;
    /** @type {string[]} */
    const fremd = [];
    /** @type {string[]} */
    const csp = [];
    context.on('request', (r) => {
      const u = r.url();
      if (!u.startsWith(ursprung) && !u.startsWith('blob:') && !u.startsWith('data:')) fremd.push(u);
    });
    await context.exposeBinding('__cspVerstoss', (_q, text) => { csp.push(text); });
    await context.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => {
        /** @type {any} */ (window).__cspVerstoss(`${e.violatedDirective} ${e.blockedURI}`);
      });
    });
    await use();
    expect(fremd, 'Anfragen an fremde Ursprünge').toEqual([]);
    expect(csp, 'CSP-Verstöße').toEqual([]);
  }, { auto: true }],
}));
