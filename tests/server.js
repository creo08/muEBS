// Kleiner statischer Server für die E2E-Tests. version.json ist pro Test steuerbar.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = fileURLToPath(new URL('..', import.meta.url));
const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const ERLAUBT = /^\/(index\.html|sw\.js|manifest\.webmanifest|(css|js|icons|demo)\/[\w.-]+)$/;

/** @returns {Promise<{url: string, setzeVersion: (v: object | null) => void, schliessen: () => Promise<void>}>} */
export function starteServer() {
  /** @type {object | null} */
  let version = { version: '1.0.0', sha: 'abc1234' };
  const server = createServer(async (anfrage, antwort) => {
    const pfad = normalize(new URL(anfrage.url ?? '/', 'http://x').pathname);
    if (pfad === '/version.json') {
      if (!version) return antwort.writeHead(404).end();
      return antwort.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(version));
    }
    const datei = pfad === '/' ? '/index.html' : pfad;
    if (!ERLAUBT.test(datei)) return antwort.writeHead(404).end();
    try {
      const inhalt = await readFile(join(WURZEL, datei));
      antwort.writeHead(200, { 'content-type': TYPEN[extname(datei)] ?? 'application/octet-stream', 'cache-control': 'no-cache' }).end(inhalt);
    } catch {
      antwort.writeHead(404).end();
    }
  });
  return new Promise((ok) => {
    server.listen(0, '127.0.0.1', () => {
      const adresse = /** @type {import('node:net').AddressInfo} */ (server.address());
      ok({
        url: `http://localhost:${adresse.port}/`,
        setzeVersion: (v) => { version = v; },
        schliessen: () => new Promise((fertig) => server.close(() => fertig())),
      });
    });
  });
}
