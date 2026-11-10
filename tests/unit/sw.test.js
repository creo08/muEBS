// Der Service Worker muss jede App-Datei vorhalten, sonst fehlt sie offline oder die Installation scheitert.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const wurzel = new URL('../../', import.meta.url);
const sw = readFileSync(new URL('sw.js', wurzel), 'utf8');
const liste = sw.slice(sw.indexOf('const DATEIEN = ['), sw.indexOf('];', sw.indexOf('const DATEIEN = [')));
const imCache = new Set([...liste.matchAll(/'([^']+)'/g)].map((m) => m[1]));

test('Service-Worker-Cache enthält genau die App-Dateien', () => {
  const app = ['index.html', 'manifest.webmanifest'];
  for (const ordner of ['js', 'css', 'icons', 'demo']) for (const f of readdirSync(new URL(`${ordner}/`, wurzel))) app.push(`${ordner}/${f}`);
  for (const f of app) assert.ok(imCache.has(f), `${f} fehlt in sw.js`);
  for (const f of imCache) if (f !== './') assert.ok(app.includes(f), `${f} in sw.js, aber nicht im Repo`);
});

test('Release-Artefakt enthält dieselben Ordner', () => {
  const release = readFileSync(new URL('.github/workflows/release.yml', wurzel), 'utf8');
  assert.match(release, /cp -r index\.html sw\.js manifest\.webmanifest css js icons demo _site\//);
});
