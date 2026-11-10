// @ts-check
// Einstieg: Funktionsprüfung, Datenbank, Routen und die Seiten für den Tresen.
import { BUCHUNGEN_ANZEIGE, DB_DEMO, DB_ECHT, HOTLIST_TAGE, SCHEMEN, STANDARD_GRENZE } from './konstanten.js';
import { centText, euro, euroZuCent, saldoText } from './geld.js';
import { aufstellung, hotlist, istGeschwaerzt, kassiertagBeginn, gueltige, nachName, speicherFehlerText, stornierte } from './regeln.js';
import {
  alleArtikel, alleMitglieder, bucheBestellung, bucheBetrag, buchungenSeit, buchungenVon, ersetze,
  geraetId, geraetLesen, geraetSchreiben, ladeMitglied, ladeProjekt, loescheDb, oeffne, schalteStorno,
} from './db.js';
import { pruefeDatei, PruefFehler } from './schema.js';
import { bestaetige, el, fehlerZeile, hilfe, seite, statusZeile, zeitText } from './dom.js';
import { exportiereSicherung, importiere, vorherSichern } from './sicherung.js';
import { adminSeite, istEntsperrt, setzePin } from './admin.js';
import { datenschutzSeite } from './datenschutz.js';
import { db, zustand } from './zustand.js';

/** @typedef {import('./regeln.js').Projekt} Projekt */
/** @typedef {import('./regeln.js').Mitglied} Mitglied */
/** @typedef {import('./regeln.js').Buchung} Buchung */

/** Aufräumarbeiten der aktuellen Seite (z. B. resize-Listener). */
/** @type {Array<() => void>} */
let aufraeumen = [];

/** @param {string} id */
const knoten = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

// ---------- Start ----------

/** Fehlende Browser-Funktionen, ohne die µEBS nicht laufen kann. */
function fehlendeFunktionen() {
  /** @type {string[]} */
  const fehlt = [];
  if (!('indexedDB' in globalThis)) fehlt.push('IndexedDB');
  if (typeof globalThis.crypto?.randomUUID !== 'function') fehlt.push('crypto.randomUUID (braucht https)');
  if (typeof HTMLDialogElement !== 'function') fehlt.push('Dialoge (<dialog>)');
  return fehlt;
}

/** @param {string} text */
function zeigeFatal(text) {
  seite('µEBS kann nicht starten', el('p', { role: 'alert', class: 'fehler' }, text), el('p', {}, 'Bitte einen aktuellen Browser verwenden (iOS Safari ab 16.4 oder aktuelles Chrome).'));
}

/** @type {import('./db.js').Haken} */
const haken = {
  blockiert: () => zeigeFatal('Bitte andere µEBS-Fenster schließen'),
  // Die Sicherung liest aus der alten Datenbank, solange zustand.db noch nicht gesetzt ist
  vorMigration: async (alt) => {
    zustand.db = alt;
    return vorherSichern();
  },
};

async function start() {
  const fehlt = fehlendeFunktionen();
  if (fehlt.length) return zeigeFatal(`Diesem Browser fehlt: ${fehlt.join(', ')}.`);
  registriereServiceWorker().catch((f) => zeigeSwHinweis(`Offline-Betrieb nicht verfügbar: ${f instanceof Error ? f.message : String(f)}`));
  try {
    zustand.echt = await oeffne(DB_ECHT, haken);
    zustand.db = zustand.echt;
    if (await geraetLesen(zustand.echt, 'demo_aktiv')) zustand.db = await oeffne(DB_DEMO, haken);
    zustand.demo = zustand.db !== zustand.echt;
    zustand.geraet = await geraetId(db());
    zustand.projekt = (await ladeProjekt(db())) ?? null;
  } catch (f) {
    return zeigeFatal(`Die Daten können nicht geöffnet werden: ${f instanceof Error ? f.message : String(f)}`);
  }
  // nicht abwarten: ein Fehler hier darf den Start nie blockieren
  if (navigator.storage && typeof navigator.storage.persist === 'function') {
    navigator.storage.persisted().then((ja) => ja || navigator.storage.persist()).catch(() => undefined);
  }
  for (const ereignis of ['pointerdown', 'keydown', 'input']) document.addEventListener(ereignis, () => { zustand.letzteEingabe = Date.now(); }, { capture: true });
  // Sperre nach 5 Minuten ohne Eingabe auch ohne Seitenwechsel
  setInterval(() => {
    if (zustand.entsperrt && !istEntsperrt()) {
      zustand.entsperrt = false;
      if (location.hash.startsWith('#/admin')) zeige();
    }
  }, 5000);
  knoten('demo-beenden').addEventListener('click', beendeDemo);
  knoten('update-laden').addEventListener('click', ladeNeueVersion);
  window.addEventListener('hashchange', zeige);
  zeige();
}

// ---------- Routen ----------

function zeige() {
  for (const f of aufraeumen) f();
  aufraeumen = [];
  document.querySelectorAll('dialog').forEach((d) => d.close());
  const teile = location.hash.replace(/^#\/?/, '').split('/');
  knoten('demo-banner').hidden = !zustand.demo;
  document.documentElement.setAttribute('data-schema', zustand.projekt?.farbschema ?? 'violett');
  zeigeUpdateBanner();
  const weiter = zustand.projekt ? routeMitProjekt(teile) : routeOhneProjekt(teile);
  weiter.catch((f) => seite('Fehler', el('p', { role: 'alert', class: 'fehler' }, speicherFehlerText(f))));
}

/** @param {string[]} teile */
async function routeOhneProjekt(teile) {
  if (teile[0] === 'neu') return assistent();
  if (teile[0] === 'datenschutz') return datenschutzSeite('#/');
  if (location.hash && location.hash !== '#/') history.replaceState(null, '', '#/');
  return initSeite();
}

/** @param {string[]} teile */
async function routeMitProjekt(teile) {
  switch (teile[0]) {
    case '': return startseite();
    case 'buchen': return buchenSeite(Number(teile[1]));
    case 'kassierliste': return kassierliste();
    case 'datenschutz': return datenschutzSeite('#/');
    case 'admin': return adminSeite(teile[1] ?? '');
    default:
      location.hash = '#/';
  }
}

const aufStartseite = () => zustand.projekt !== null && (location.hash === '' || location.hash === '#/' || location.hash === '#');

// ---------- Startseite ----------

/**
 * @param {Mitglied} m
 * @param {Projekt} p
 */
function kachel(m, p) {
  const schwarz = istGeschwaerzt(p, m);
  return el('li', {}, el('a', { href: `#/buchen/${m.id}`, class: `kachel k${((m.id - 1) % 8) + 1}${schwarz ? ' geschwaerzt' : ''}` },
    el('span', { class: 'name' }, m.name),
    m.nickname && el('span', { class: 'nick' }, m.nickname),
    el('span', { class: 'saldo' }, saldoText(m.guthaben, p.modus)),
    schwarz && el('span', { class: 'sr' }, '(geschwärzt)'),
  ));
}

/** Wie viele Kacheln passen ohne Scrollen unter die Liste. */
/** @param {HTMLElement} liste */
function kachelPlatz(liste) {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const breite = 9 * rem, hoehe = 5.5 * rem, abstand = 0.5 * rem;
  const r = liste.getBoundingClientRect();
  const fuss = document.querySelector('footer')?.getBoundingClientRect().height ?? 0;
  const spalten = Math.max(1, Math.floor((r.width + abstand) / (breite + abstand)));
  const zeilen = Math.max(1, Math.floor((window.innerHeight - r.top - fuss + abstand) / (hoehe + abstand)));
  return spalten * zeilen;
}

async function startseite() {
  const p = /** @type {Projekt} */ (zustand.projekt);
  // Nur Mitglieder laden; für die Hotlist nur die Buchungen der letzten 14 Tage über den Index
  const [mitglieder, letzte] = await Promise.all([alleMitglieder(db()), buchungenSeit(db(), new Date(Date.now() - HOTLIST_TAGE * 86400000))]);
  const aktive = mitglieder.filter((m) => m.aktiv);
  const suche = el('input', { id: 'suche', type: 'search', autocomplete: 'off', placeholder: 'Name, Spitzname oder Betrag' });
  const liste = el('ul', { class: 'kacheln', 'aria-label': 'Mitglieder' });
  const leer = el('p', { role: 'status' });
  const status = statusZeile();
  const zeichne = () => {
    const q = suche.value.trim().toLowerCase();
    const treffer = q
      ? aktive.filter((m) => m.name.toLowerCase().includes(q) || m.nickname.toLowerCase().includes(q) || centText(m.guthaben).includes(q) || saldoText(m.guthaben, p.modus).toLowerCase().includes(q)).sort(nachName)
      : hotlist(letzte, mitglieder, kachelPlatz(liste));
    liste.replaceChildren(...treffer.map((m) => kachel(m, p)));
    leer.textContent = treffer.length ? '' : q ? 'Kein Mitglied gefunden.' : 'Mitglied suchen, um zu buchen.';
  };
  suche.addEventListener('input', zeichne);
  let geplant = 0;
  const neu = () => {
    cancelAnimationFrame(geplant);
    geplant = requestAnimationFrame(() => { if (!suche.value.trim()) zeichne(); });
  };
  window.addEventListener('resize', neu);
  aufraeumen.push(() => window.removeEventListener('resize', neu));
  seite(
    'µEBS',
    el('div', { class: 'leiste' },
      p.modus === 'deckel' && el('a', { class: 'knopf', href: '#/kassierliste' }, 'Kassierliste'),
      el('button', {
        type: 'button',
        class: 'zweit',
        onclick: async () => {
          try {
            await exportiereSicherung();
            status.textContent = 'Sicherung erstellt';
          } catch (f) {
            status.textContent = speicherFehlerText(f);
          }
        },
      }, 'Sicherung exportieren'),
      el('a', { class: 'knopf zweit', href: '#/admin' }, 'Admin-Bereich'),
    ),
    status,
    el('label', { for: 'suche' }, 'Mitglied suchen'),
    suche,
    leer,
    liste,
  );
  zeichne();
}

// ---------- Buchen ----------

/**
 * @param {Buchung} b
 * @param {Map<number, string>} namen
 */
function buchungText(b, namen) {
  if (b.typ === 'artikel') return `${b.menge} × ${namen.get(b.artikel_id ?? 0) ?? 'Artikel'}`;
  return { aufbuchung: 'Aufbuchung', zahlung: 'Zahlung', uebertrag: 'Übertrag', storno: 'Storno' }[b.typ];
}

/** @param {number} id */
async function buchenSeite(id) {
  const m = Number.isInteger(id) ? await ladeMitglied(db(), id) : undefined;
  if (!m || !m.aktiv) {
    location.hash = '#/';
    return;
  }
  const p = /** @type {Projekt} */ (zustand.projekt);
  const [alleA, buchungen] = await Promise.all([alleArtikel(db()), buchungenVon(db(), id)]);
  const artikel = alleA.filter((a) => a.aktiv).sort((a, b) => a.reihenfolge - b.reihenfolge || a.id - b.id);
  const namen = new Map(alleA.map((a) => [a.id, a.name]));
  const preise = new Map(alleA.map((a) => [a.id, a.preis]));
  const schwarz = istGeschwaerzt(p, m);
  /** @type {Map<number, number>} artikel_id → Stück, in Tipp-Reihenfolge */
  const bestellung = new Map();
  let laeuft = false;

  const fehler = fehlerZeile();
  const liste = el('ul', { class: 'zeilen', 'aria-label': 'Bestellung' });
  const knopf = el('button', { type: 'button', class: 'buchen-knopf', disabled: true });
  const summe = () => [...bestellung].reduce((s, [a, n]) => s + n * (preise.get(a) ?? 0), 0);
  const zeichneBestellung = () => {
    liste.replaceChildren(...[...bestellung].map(([a, n]) => el('li', {}, el('button', {
      type: 'button',
      class: 'zeile zweit',
      'aria-label': `Ein Stück ${namen.get(a)} entfernen, ${n} bestellt`,
      onclick: () => {
        if (laeuft) return;
        if (n <= 1) bestellung.delete(a);
        else bestellung.set(a, n - 1);
        zeichneBestellung();
      },
    }, el('span', {}, `${n} × ${namen.get(a)}`), el('span', {}, euro(n * (preise.get(a) ?? 0)))))));
    knopf.textContent = `Jetzt ${euro(summe())} buchen`;
    knopf.disabled = laeuft || bestellung.size === 0;
  };
  knopf.addEventListener('click', async () => {
    if (laeuft || bestellung.size === 0) return;
    laeuft = true;
    knopf.disabled = true;
    fehler.textContent = '';
    try {
      await bucheBestellung(db(), zustand.geraet, m.id, bestellung);
      location.hash = '#/';
    } catch (f) {
      // Seite bleibt offen, Bestellung bleibt erhalten
      fehler.textContent = speicherFehlerText(f);
      laeuft = false;
      zeichneBestellung();
    }
  });
  zeichneBestellung();

  const kacheln = el('ul', { class: 'kacheln', 'aria-label': 'Artikel' }, ...artikel.map((a, i) => el('li', {}, el('button', {
    type: 'button',
    class: `kachel k${(i % 8) + 1}`,
    disabled: schwarz,
    onclick: () => {
      if (laeuft) return;
      bestellung.set(a.id, (bestellung.get(a.id) ?? 0) + 1);
      zeichneBestellung();
    },
  }, el('span', { class: 'name' }, a.name), el('span', { class: 'saldo' }, euro(a.preis))))));

  seite(
    m.nickname ? `${m.name} (${m.nickname})` : m.name,
    el('p', { class: 'summe', id: 'saldo' }, saldoText(m.guthaben, p.modus) || 'Nichts offen'),
    schwarz && el('p', { class: 'fehler', role: 'alert' }, 'Geschwärzt: Artikel können erst nach einer Einzahlung wieder gebucht werden.'),
    el('div', { class: 'leiste' }, el('a', { class: 'knopf zweit', href: '#/' }, 'Zurück')),
    el('h2', {}, 'Artikel'),
    artikel.length ? kacheln : el('p', {}, 'Noch keine Artikel angelegt.'),
    el('h2', {}, 'Bestellung'),
    el('p', { class: 'sr' }, 'Tippen auf einen Artikel fügt ein Stück hinzu, Tippen auf eine Zeile entfernt eines.'),
    liste,
    knopf,
    fehler,
    p.modus === 'deckel' && kassieren(m, buchungen, namen),
    letzteBuchungen(m, buchungen, namen),
  );
}

/**
 * Kassieren im Deckel-Modus mit Aufstellung seit dem letzten Stand ≥ 0.
 * @param {Mitglied} m
 * @param {Buchung[]} buchungen
 * @param {Map<number, string>} namen
 */
function kassieren(m, buchungen, namen) {
  const a = aufstellung(buchungen, namen);
  const fehler = fehlerZeile();
  const betrag = el('input', { id: 'kassieren-betrag', inputmode: 'decimal', autocomplete: 'off', value: a.offen > 0 ? centText(a.offen) : '' });
  const knopf = el('button', { type: 'submit' });
  const aktualisiere = () => {
    const c = euroZuCent(betrag.value);
    knopf.disabled = c === null || c <= 0;
    knopf.textContent = c !== null && c > 0 ? `${euro(c)} kassiert` : 'Betrag eingeben';
  };
  betrag.addEventListener('input', aktualisiere);
  aktualisiere();
  let laeuft = false;
  return el('section', { 'aria-labelledby': 'kassieren-titel' },
    el('h2', { id: 'kassieren-titel' }, 'Kassieren'),
    el('ul', { class: 'zeilen', 'aria-label': 'Aufstellung' },
      ...a.posten.map((p) => el('li', {}, el('span', {}, `${p.menge} × ${p.name}`), el('span', {}, euro(p.summe)))),
      ...a.zahlungen.map((b) => el('li', {}, el('span', {}, `${buchungText(b, namen)} ${zeitText(b.zeitstempel)}`), el('span', {}, euro(b.gesamtpreis)))),
      el('li', { class: 'summe' }, el('span', {}, 'Offen'), el('span', {}, euro(a.offen))),
    ),
    el('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        const c = euroZuCent(betrag.value);
        if (laeuft || c === null || c <= 0) return;
        laeuft = true;
        knopf.disabled = true;
        try {
          await bucheBetrag(db(), zustand.geraet, m.id, 'zahlung', c);
          zeige();
        } catch (f) {
          fehler.textContent = speicherFehlerText(f);
          laeuft = false;
          aktualisiere();
        }
      },
    }, el('label', { for: betrag.id }, 'Betrag in Euro'), betrag, ' ', knopf),
    fehler,
    hilfe('stricheln-und-kassieren', 'Kassieren'),
  );
}

/**
 * Die letzten 10 Buchungen mit Storno bzw. Storno aufheben.
 * @param {Mitglied} m
 * @param {Buchung[]} buchungen
 * @param {Map<number, string>} namen
 */
function letzteBuchungen(m, buchungen, namen) {
  const storniert = stornierte(buchungen);
  const fehler = fehlerZeile();
  const zeilen = buchungen
    .filter((b) => b.typ !== 'storno')
    .sort((a, b) => (a.zeitstempel < b.zeitstempel ? 1 : a.zeitstempel > b.zeitstempel ? -1 : 0))
    .slice(0, BUCHUNGEN_ANZEIGE)
    .map((b) => {
      const ist = storniert.has(b.id);
      const text = `${zeitText(b.zeitstempel)} · ${buchungText(b, namen)} · ${euro(b.gesamtpreis)}`;
      return el('li', { class: ist ? 'storniert' : '' },
        el('span', { class: 'text' }, text),
        ist && el('span', { class: 'sr' }, '(storniert)'),
        el('button', {
          type: 'button',
          class: 'zweit',
          onclick: async () => {
            const frageText = ist ? `Storno aufheben? ${text}` : `Buchung stornieren? ${text}`;
            if (!(await bestaetige(frageText, ist ? 'Storno aufheben' : 'Stornieren'))) return;
            try {
              await schalteStorno(db(), zustand.geraet, b.id);
              await buchenSeite(m.id);
              /** @type {HTMLElement | null} */ (document.getElementById('letzte-titel'))?.focus();
            } catch (f) {
              fehler.textContent = speicherFehlerText(f);
            }
          },
        }, ist ? 'Storno aufheben' : 'Storno'),
      );
    });
  return el('section', { 'aria-labelledby': 'letzte-titel' },
    el('h2', { id: 'letzte-titel', tabindex: -1 }, 'Letzte Buchungen'),
    zeilen.length ? el('ul', { class: 'zeilen' }, ...zeilen) : el('p', {}, 'Noch keine Buchungen.'),
    fehler,
  );
}

// ---------- Kassierliste ----------

async function kassierliste() {
  const p = /** @type {Projekt} */ (zustand.projekt);
  const beginn = kassiertagBeginn(new Date());
  const [mitglieder, seit] = await Promise.all([alleMitglieder(db()), buchungenSeit(db(), beginn)]);
  const offen = mitglieder.filter((m) => m.guthaben < 0).sort(nachName);
  const kassiert = gueltige(seit).filter((b) => b.typ === 'zahlung' && b.zeitstempel >= beginn.toISOString()).reduce((s, b) => s + b.gesamtpreis, 0);
  const fehler = fehlerZeile();
  seite(
    'Kassierliste',
    el('p', { class: 'summe' }, `Summe offen: ${euro(-offen.reduce((s, m) => s + m.guthaben, 0))}`),
    el('p', { class: 'summe' }, `Kassiert seit ${zeitText(beginn.toISOString())}: ${euro(kassiert)}`),
    hilfe('stricheln-und-kassieren', 'Kassierliste'),
    fehler,
    offen.length
      ? el('ul', { class: 'zeilen' }, ...offen.map((m) => el('li', {},
        el('span', {}, `${m.name}${m.nickname ? ` (${m.nickname})` : ''} · ${saldoText(m.guthaben, p.modus)}`),
        el('button', {
          type: 'button',
          onclick: async () => {
            if (!(await bestaetige(`${euro(-m.guthaben)} von ${m.name} als bezahlt buchen?`, 'Bezahlt'))) return;
            try {
              await bucheBetrag(db(), zustand.geraet, m.id, 'zahlung', -m.guthaben);
              await kassierliste();
            } catch (f) {
              fehler.textContent = speicherFehlerText(f);
            }
          },
        }, 'bezahlt'),
      )))
      : el('p', {}, 'Niemand hat etwas offen.'),
    el('p', {}, el('a', { class: 'knopf zweit', href: '#/' }, 'Zurück')),
  );
}

// ---------- Init-Seite und Assistent ----------

function initSeite() {
  const fehler = fehlerZeile();
  const datei = el('input', { id: 'init-datei', type: 'file', accept: '.json,application/json' });
  seite(
    'Willkommen bei µEBS',
    el('p', {}, 'Auf diesem Gerät gibt es noch keine Daten. Wie möchtest du beginnen?'),
    el('div', { class: 'leiste' }, el('a', { class: 'knopf', href: '#/neu' }, 'Neues Projekt'), el('button', { type: 'button', class: 'zweit', onclick: starteDemo }, 'Demo ansehen')),
    el('form', {
      'aria-label': 'Sicherung/Projekt laden',
      onsubmit: async (e) => {
        e.preventDefault();
        fehler.textContent = '';
        const f = datei.files?.[0];
        if (!f) return void (fehler.textContent = 'Bitte eine Datei wählen');
        try {
          if (await importiere(f)) {
            location.hash = '#/';
            zeige();
          }
        } catch (x) {
          fehler.textContent = x instanceof PruefFehler ? x.message : speicherFehlerText(x);
        }
      },
    }, el('label', { for: datei.id }, 'Sicherung/Projekt laden (.json)'), datei, ' ', el('button', { type: 'submit' }, 'Laden')),
    fehler,
    el('p', {}, hilfe('erste-schritte', 'Erste Schritte'), ' · ', el('a', { href: '#/datenschutz' }, 'Datenschutz')),
  );
}

/** Entwurf des neuen Projekts, nur im Speicher. */
const entwurf = { schritt: 0, modus: /** @type {'vorauszahlung' | 'deckel'} */ ('vorauszahlung'), farbschema: 'violett', schwaerzung: true, grenze: STANDARD_GRENZE, pin: '' };

function assistent() {
  const fehler = fehlerZeile();
  /** @type {Array<{titel: string, doku: string, inhalt: () => Node[], lies: () => string | null}>} */
  const schritte = [
    {
      titel: 'Modus',
      doku: 'stricheln-und-kassieren',
      inhalt: () => [
        el('label', { class: 'inline' }, el('input', { type: 'radio', name: 'modus', value: 'vorauszahlung', checked: entwurf.modus === 'vorauszahlung' }), 'Vorauszahlung: erst aufbuchen, dann stricheln'),
        el('label', { class: 'inline' }, el('input', { type: 'radio', name: 'modus', value: 'deckel', checked: entwurf.modus === 'deckel' }), 'Deckel: stricheln, dann zahlen'),
      ],
      lies: () => {
        const neu = /** @type {HTMLInputElement | null} */ (document.querySelector('input[name="modus"]:checked'))?.value === 'deckel' ? 'deckel' : 'vorauszahlung';
        // Im Deckel-Modus ist die Schwärzung standardmäßig aus
        if (neu !== entwurf.modus) entwurf.schwaerzung = neu === 'vorauszahlung';
        entwurf.modus = neu;
        return null;
      },
    },
    {
      titel: 'Farbschema',
      doku: 'einstellungen',
      inhalt: () => {
        const s = el('select', { id: 'schema' }, ...SCHEMEN.map((x) => el('option', { value: x.wert, selected: x.wert === entwurf.farbschema }, x.name)));
        s.addEventListener('change', () => document.documentElement.setAttribute('data-schema', s.value));
        return [el('label', { for: 'schema' }, 'Farbschema'), s];
      },
      lies: () => {
        entwurf.farbschema = /** @type {HTMLSelectElement} */ (document.getElementById('schema')).value;
        return null;
      },
    },
    {
      titel: 'Schwärzung',
      doku: 'einstellungen',
      inhalt: () => [
        el('p', {}, 'Ist die Schwärzung ein, wird die Kachel schwarz, sobald das Guthaben unter die Grenze fällt. Geschwärzte Mitglieder können keine Artikel buchen, bis ihr Guthaben wieder bei 0 oder darüber liegt.'),
        el('label', { class: 'inline', for: 'schwaerzung' }, el('input', { id: 'schwaerzung', type: 'checkbox', checked: entwurf.schwaerzung }), 'Schwärzung ein'),
        el('label', { for: 'grenze' }, 'Schwärzungsgrenze in Euro (0 oder negativ)'),
        el('input', { id: 'grenze', inputmode: 'decimal', autocomplete: 'off', value: centText(entwurf.grenze) }),
      ],
      lies: () => {
        const g = euroZuCent(/** @type {HTMLInputElement} */ (document.getElementById('grenze')).value);
        if (g === null || g > 0) return 'Schwärzungsgrenze muss 0 oder negativ sein, z. B. -20,00';
        entwurf.grenze = g;
        entwurf.schwaerzung = /** @type {HTMLInputElement} */ (document.getElementById('schwaerzung')).checked;
        return null;
      },
    },
    {
      titel: 'PIN (optional)',
      doku: 'datensicherheit',
      inhalt: () => [
        el('p', {}, 'Ein 4-stelliger PIN sperrt den Admin-Bereich. Er ist nur ein Bedienschutz. Leer lassen für keinen PIN.'),
        el('label', { for: 'pin-neu' }, 'PIN (4 Ziffern)'),
        el('input', { id: 'pin-neu', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 4 }),
        el('label', { for: 'pin-wdh' }, 'PIN wiederholen'),
        el('input', { id: 'pin-wdh', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 4 }),
      ],
      lies: () => {
        const a = /** @type {HTMLInputElement} */ (document.getElementById('pin-neu')).value;
        const b = /** @type {HTMLInputElement} */ (document.getElementById('pin-wdh')).value;
        if (a !== b) return 'Die beiden PINs stimmen nicht überein';
        if (a && !/^\d{4}$/.test(a)) return 'Der PIN muss genau 4 Ziffern haben';
        entwurf.pin = a;
        return null;
      },
    },
  ];
  const s = schritte[entwurf.schritt];
  if (!s) return; // Schritt liegt immer im Bereich, die Prüfung ist für den Typ
  const letzter = entwurf.schritt === schritte.length - 1;
  seite(
    `Neues Projekt – Schritt ${entwurf.schritt + 1} von ${schritte.length}`,
    el('form', {
      onsubmit: async (e) => {
        e.preventDefault();
        const f = s.lies();
        if (f) return void (fehler.textContent = f);
        if (!letzter) {
          entwurf.schritt++;
          return assistent();
        }
        try {
          await legeProjektAn();
        } catch (x) {
          fehler.textContent = speicherFehlerText(x);
        }
      },
    },
    el('fieldset', {}, el('legend', {}, s.titel), ...s.inhalt()),
    hilfe(s.doku, s.titel),
    el('div', { class: 'leiste' },
      entwurf.schritt > 0 && el('button', { type: 'button', class: 'zweit', onclick: () => { s.lies(); entwurf.schritt--; assistent(); } }, 'Zurück'),
      entwurf.schritt === 0 && el('a', { class: 'knopf zweit', href: '#/' }, 'Abbrechen'),
      el('button', { type: 'submit' }, letzter ? 'Projekt anlegen' : 'Weiter'),
    )),
    fehler,
  );
}

async function legeProjektAn() {
  /** @type {Projekt} */
  const projekt = { farbschema: entwurf.farbschema, modus: entwurf.modus, schwaerzung_aktiv: entwurf.schwaerzung, schwaerzungs_grenze: entwurf.grenze };
  if (entwurf.pin) await setzePin(entwurf.pin);
  await ersetze(db(), { projekt, mitglieder: [], artikel: [], buchungen: [] });
  zustand.projekt = projekt;
  zustand.entsperrt = true;
  zustand.letzteEingabe = Date.now();
  entwurf.schritt = 0;
  location.hash = '#/admin/einrichtung';
}

// ---------- Demo ----------

async function starteDemo() {
  try {
    const antwort = await fetch('demo/demo.json');
    if (!antwort.ok) throw new Error('Demo-Daten nicht gefunden');
    const datei = pruefeDatei(await antwort.json(), { echt: false });
    // Zeitstempel relativ zu jetzt verschieben, damit die Hotlist gefüllt ist
    const juengste = Math.max(...datei.buchungen.map((b) => Date.parse(b.zeitstempel)));
    const versatz = Date.now() - 60000 - juengste;
    for (const b of datei.buchungen) b.zeitstempel = new Date(Date.parse(b.zeitstempel) + versatz).toISOString();
    const demo = await oeffne(DB_DEMO, haken);
    await ersetze(demo, datei);
    // Merker erst nach erfolgreichem Schreiben, sonst landet ein echtes Projekt in der Demo
    await geraetSchreiben(/** @type {IDBDatabase} */ (zustand.echt), 'demo_aktiv', true);
    zustand.db = demo;
    zustand.demo = true;
    zustand.geraet = await geraetId(demo);
    zustand.projekt = datei.projekt;
    location.hash = '#/';
    zeige();
  } catch (f) {
    seite('Demo', el('p', { role: 'alert', class: 'fehler' }, `Demo kann nicht starten: ${f instanceof Error ? f.message : String(f)}`), el('p', {}, el('a', { href: '#/' }, 'Zurück')));
  }
}

async function beendeDemo() {
  const echt = /** @type {IDBDatabase} */ (zustand.echt);
  zustand.db?.close();
  await loescheDb(DB_DEMO);
  await geraetSchreiben(echt, 'demo_aktiv', undefined);
  zustand.db = echt;
  zustand.demo = false;
  zustand.entsperrt = false;
  zustand.geraet = await geraetId(echt);
  zustand.projekt = (await ladeProjekt(echt)) ?? null;
  location.hash = '#/';
  zeige();
}

// ---------- Service Worker und Updates ----------

/** @param {string} text */
function zeigeSwHinweis(text) {
  const h = knoten('sw-hinweis');
  h.textContent = text;
  h.hidden = false;
}

/** @param {{version: string, sha: string}} v */
function setzeVersion(v) {
  zustand.version = v;
  knoten('version').textContent = v.version === 'dev' ? 'Entwicklungsversion' : `v${v.version} (${v.sha})`;
}

/** @param {unknown} roh */
function leseVersion(roh) {
  const o = /** @type {Record<string, unknown>} */ (roh ?? {});
  const version = typeof o.version === 'string' && /^\d+\.\d+\.\d+$/.test(o.version) ? o.version : 'dev';
  const sha = typeof o.sha === 'string' && /^[0-9a-f]{4,40}$/.test(o.sha) ? o.sha : 'dev';
  return { version, sha };
}

/**
 * @typedef {object} TrustedTypesFabrik
 * @property {(name: string, regeln: {createScriptURL: (url: string) => string}) => {createScriptURL: (url: string) => unknown}} createPolicy
 */

/**
 * Die CSP verlangt Trusted Types; die einzige Policy erlaubt nur die URL des Service Workers.
 * @param {string} url
 * @returns {string}
 */
function swUrl(url) {
  const tt = /** @type {{trustedTypes?: TrustedTypesFabrik}} */ (/** @type {unknown} */ (window)).trustedTypes;
  if (!tt) return url;
  const policy = tt.createPolicy('muebs-sw', {
    createScriptURL: (u) => {
      if (!/^sw\.js\?v=[\w.]+&sha=\w+$/.test(u)) throw new TypeError('Unzulässige Service-Worker-URL');
      return u;
    },
  });
  return /** @type {string} */ (policy.createScriptURL(url));
}

async function registriereServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    zeigeSwHinweis('Offline-Betrieb ist in diesem Browser nicht verfügbar.');
    return;
  }
  const sw = navigator.serviceWorker;
  const aktiv = sw.controller?.scriptURL;
  if (aktiv) {
    const q = new URL(aktiv).searchParams;
    setzeVersion(leseVersion({ version: q.get('v'), sha: q.get('sha') }));
  }
  /** @type {{version: string, sha: string}} */
  let v;
  try {
    const antwort = await fetch('version.json', { cache: 'no-store' });
    v = leseVersion(antwort.ok ? await antwort.json() : null);
  } catch {
    return; // offline: der vorhandene Service Worker arbeitet weiter
  }
  if (!aktiv) setzeVersion(v);
  const reg = await sw.register(swUrl(`sw.js?v=${v.version}&sha=${v.sha}`));
  const pruefe = () => {
    if (reg.waiting && sw.controller) {
      zustand.wartend = reg.waiting;
      zeigeUpdateBanner();
    }
  };
  reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', pruefe));
  pruefe();
}

/** Das Update-Banner erscheint nur auf der Startseite. */
function zeigeUpdateBanner() {
  knoten('update-banner').hidden = !(zustand.wartend && aufStartseite());
}

let neuLaden = false;

function ladeNeueVersion() {
  // Nur auf der Startseite; dort gibt es keine offene Bestellung
  if (!zustand.wartend || !aufStartseite()) return;
  if (!neuLaden) {
    neuLaden = true;
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
  }
  zustand.wartend.postMessage('skipWaiting');
}

start();
