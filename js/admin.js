// @ts-check
// Admin-Bereich: Navigation in Gruppen, Mitglieder und Artikel als Tabelle mit eigener Bearbeiten-Seite,
// Aufbuchung mit Mitgliedersuche, Einstellungen, Laden, Exporte, Datenschutz, Zurücksetzen.
import { DB_DEMO, DB_ECHT, SCHEMEN, SPERRE_NACH_MS, VOLLSYSTEM_URL } from './konstanten.js';
import { centText, euro, euroZuCent, saldoText } from './geld.js';
import { istGeschwaerzt, nachName, textFehler, speicherFehlerText } from './regeln.js';
import {
  aendereArtikel, aendereMitglied, alleArtikel, alleDaten, alleMitglieder, bucheBetrag,
  geraetLesen, geraetSchreiben, ladeMitglied, loescheDb, neuerArtikel, neuesMitglied, speichereProjekt,
} from './db.js';
import { leeresProjekt } from './projekt.js';
import { abrechnungCsv } from './csv.js';
import { datenschutzInhalt } from './datenschutz.js';
import { ARTIKEL_DATEI, GUTHABEN_DATEI, MITGLIEDER_DATEI, artikelCsv, guthabenCsv, mitgliederCsv } from './umstieg.js';
import { bestaetige, csvName, dateiname, el, fehlerZeile, frage, herunterladen, hilfe, seiteMit, statusZeile, zeitText } from './dom.js';
import { exportiereSicherung, dateiInhalt, importiere, vorherSichern } from './sicherung.js';
import { PruefFehler } from './schema.js';
import { db, zustand } from './zustand.js';

/** @typedef {import('./regeln.js').Projekt} Projekt */
/** @typedef {import('./regeln.js').Mitglied} Mitglied */
/** @typedef {import('./regeln.js').Artikel} Artikel */
/** @typedef {import('./dom.js').Kind} Kind */

// ---------- PIN (nur Bedienschutz) ----------

/**
 * @param {string} pin
 * @param {string} salz
 */
async function pinHash(pin, salz) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salz}:${pin}`));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** PIN-Hash liegt nur im Store „geraet“, nie in Projekt oder Export. */
async function pinGesetzt() {
  return Boolean(await geraetLesen(db(), 'pin'));
}

/** @param {string} pin */
export async function setzePin(pin) {
  if (!/^\d{4}$/.test(pin)) throw new Error('Der PIN muss genau 4 Ziffern haben');
  if (!globalThis.crypto?.subtle) throw new Error('PIN braucht eine sichere Verbindung (https)');
  const salz = crypto.randomUUID();
  await geraetSchreiben(db(), 'pin', { salz, hash: await pinHash(pin, salz) });
  // Wer den PIN setzt, ist gerade im Admin-Bereich und bleibt entsperrt
  zustand.entsperrt = true;
  zustand.letzteEingabe = Date.now();
}

/** @param {string} pin */
async function pinStimmt(pin) {
  const gespeichert = /** @type {{salz: string, hash: string} | undefined} */ (await geraetLesen(db(), 'pin'));
  return Boolean(gespeichert) && (await pinHash(pin, gespeichert?.salz ?? '')) === gespeichert?.hash;
}

// shortcut: Zähler nur im Speicher, ein Neuladen setzt ihn zurück; reicht für einen Bedienschutz an der Schank
let fehlversuche = 0;
let pinGesperrtBis = 0;
const MAX_FEHLVERSUCHE = 5;
const PIN_PAUSE_MS = 30000;

/** Entsperrt bis „Sperren“ oder 5 Minuten ohne Eingabe. */
export function istEntsperrt() {
  return zustand.entsperrt && Date.now() - zustand.letzteEingabe < SPERRE_NACH_MS;
}

/** @param {() => void} weiter */
function pinSeite(weiter) {
  const fehler = fehlerZeile();
  const pin = el('input', { id: 'pin', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 4, pattern: '\\d{4}', required: true });
  seiteMit(
    { titel: 'Admin-Bereich gesperrt', art: 'schmal' },
    el('form', {
      class: 'zeile-formular',
      onsubmit: async (e) => {
        e.preventDefault();
        fehler.textContent = '';
        const warten = Math.ceil((pinGesperrtBis - Date.now()) / 1000);
        if (warten > 0) {
          fehler.textContent = `Zu viele Fehlversuche. Bitte in ${warten} s erneut versuchen.`;
          return;
        }
        if (await pinStimmt(pin.value)) {
          fehlversuche = 0;
          zustand.entsperrt = true;
          zustand.letzteEingabe = Date.now();
          weiter();
        } else {
          // nach 5 Fehlversuchen 30 s Pause, danach nach jedem weiteren Fehlversuch erneut
          if (++fehlversuche >= MAX_FEHLVERSUCHE) pinGesperrtBis = Date.now() + PIN_PAUSE_MS;
          fehler.textContent = fehlversuche >= MAX_FEHLVERSUCHE ? `PIN falsch. Bitte in ${PIN_PAUSE_MS / 1000} s erneut versuchen.` : 'PIN falsch';
          pin.value = '';
          pin.focus();
        }
      },
    }, el('div', { class: 'feld' }, el('label', { for: 'pin' }, 'PIN'), pin), el('button', { type: 'submit' }, 'Entsperren')),
    fehler,
    el('div', { class: 'leiste' }, el('a', { class: 'knopf zweit', href: '#/' }, 'Zurück zur Startseite')),
  );
  pin.focus();
}

// ---------- Bausteine ----------

/**
 * @param {string} text
 * @param {HTMLInputElement | HTMLSelectElement} feld
 */
function feld(text, feld) {
  return el('div', { class: 'feld' }, el('label', { for: feld.id }, text), feld);
}

/** @param {unknown} f */
const meldung = (f) => (f instanceof PruefFehler ? f.message : speicherFehlerText(f));

/** Navigation in Gruppen; ab Tablet-Breite als Seitenleiste. */
const GRUPPEN = /** @type {Array<[string, Array<[string, string]>]>} */ ([
  ['An der Schank', [['aufbuchung', 'Aufbuchung (Einzahlung)']]],
  ['Stammdaten', [['mitglieder', 'Mitglieder'], ['artikel', 'Artikel']]],
  ['Projekt', [['einstellungen', 'Einstellungen'], ['exporte', 'Exporte'], ['laden', 'Sicherung laden']]],
  ['Gerät', [['datenschutz', 'Datenschutz'], ['zuruecksetzen', 'Gerät zurücksetzen']]],
]);

/**
 * Seite im Admin-Rahmen: Navigation links (bzw. auf dem Handy nur auf der Übersicht), Inhalt rechts.
 * @param {string} aktiv Unterseite ('' = Übersicht)
 * @param {string} titel
 * @param {...Kind} inhalt
 */
async function rahmen(aktiv, titel, ...inhalt) {
  const gesperrt = await pinGesetzt();
  const nav = el('nav', { class: 'admin-nav', 'aria-label': 'Admin-Bereich' },
    ...GRUPPEN.map(([gruppe, punkte], i) => el('div', { class: 'nav-gruppe' },
      el('p', { class: 'nav-titel', id: `gruppe-${i}` }, gruppe),
      el('ul', { 'aria-labelledby': `gruppe-${i}` }, ...punkte.map(([ziel, text]) => el('li', {},
        el('a', { href: `#/admin/${ziel}`, ...(ziel === aktiv ? { 'aria-current': 'page' } : {}) }, text)))),
    )),
    gesperrt && el('button', { type: 'button', class: 'zweit', onclick: () => { zustand.entsperrt = false; location.hash = '#/'; } }, 'Sperren'),
  );
  seiteMit(
    { titel, art: `admin${aktiv ? ' admin-unterseite' : ''}` },
    el('div', { class: 'admin-raster' },
      nav,
      el('div', { class: 'admin-inhalt' },
        aktiv && el('a', { class: 'nur-schmal zurueck-admin', href: '#/admin' }, 'Zurück zum Admin-Bereich'),
        ...inhalt,
      ),
    ),
  );
}

/**
 * Formular-Wache für ungespeicherte Änderungen: vergleicht den Stand der Felder mit dem gespeicherten.
 * @param {HTMLElement[]} bereiche
 * @param {() => Promise<boolean>} speichern
 */
function bewache(bereiche, speichern) {
  const stand = () => bereiche.flatMap((b) => [...b.querySelectorAll('input, select')]).map((f) => {
    const e = /** @type {HTMLInputElement} */ (f);
    return e.type === 'checkbox' || e.type === 'radio' ? String(e.checked) : e.value;
  }).join('\u0000');
  let gespeichert = stand();
  zustand.wache = {
    ungespeichert: () => stand() !== gespeichert,
    speichern: async () => {
      const ok = await speichern();
      if (ok) gespeichert = stand();
      return ok;
    },
  };
  return { merken: () => { gespeichert = stand(); } };
}

// ---------- Einstieg ----------

/**
 * Einstieg: prüft die Sperre und zeigt die Unterseite.
 * @param {string} teil
 * @param {string} id Mitglied oder Artikel (Zahl) bzw. 'neu'
 */
export async function adminSeite(teil, id) {
  if (!istEntsperrt()) {
    zustand.entsperrt = false;
    if (await pinGesetzt()) return pinSeite(() => adminSeite(teil, id));
  }
  switch (teil) {
    case 'aufbuchung': return aufbuchung(Number(id));
    case 'mitglieder': return id === 'neu' ? rahmen('mitglieder', 'Neues Mitglied', neuesMitgliedFormular(true)) : id ? mitgliedBearbeiten(Number(id)) : mitgliederListe();
    case 'artikel': return id === 'neu' ? rahmen('artikel', 'Neuer Artikel', await neuerArtikelFormular(true)) : id ? artikelBearbeiten(Number(id)) : artikelListe();
    case 'einstellungen': return einstellungen();
    case 'laden': return laden();
    case 'exporte': return exporte();
    case 'datenschutz': return rahmen('datenschutz', 'Datenschutz', ...datenschutzInhalt());
    case 'zuruecksetzen': return zuruecksetzen();
    case 'einrichtung': return einrichtung();
    default: return uebersicht();
  }
}

async function uebersicht() {
  const [letzte, mitglieder, artikel] = await Promise.all([
    /** @type {Promise<string | undefined>} */ (geraetLesen(db(), 'letzte_sicherung')),
    alleMitglieder(db()),
    alleArtikel(db()),
  ]);
  const p = /** @type {Projekt} */ (zustand.projekt);
  /** @param {string} name @param {string} wert @param {string} [id] */
  const zahl = (name, wert, id) => el('div', {}, el('dt', {}, name), el('dd', id ? { id } : {}, wert));
  await rahmen('', 'Admin-Bereich',
    el('dl', { class: 'kennzahlen' },
      zahl('Letzte Sicherung', letzte ? zeitText(letzte) : 'noch nie', 'letzte-sicherung'),
      zahl('Modus', p.modus === 'deckel' ? 'Deckel' : 'Vorauszahlung'),
      zahl('Mitglieder aktiv', `${mitglieder.filter((m) => m.aktiv).length} von ${mitglieder.length}`),
      zahl('Artikel aktiv', `${artikel.filter((a) => a.aktiv).length} von ${artikel.length}`),
    ),
    el('div', { class: 'leiste' }, el('button', { type: 'button', class: 'zweit', onclick: async () => { await exportiereSicherung(); await uebersicht(); } }, 'Jetzt sichern')),
  );
}

// ---------- Aufbuchung mit Mitgliedersuche ----------

/**
 * Suche über alle aktiven Mitglieder; wahl wird mit dem angetippten Mitglied aufgerufen.
 * @param {Mitglied[]} mitglieder
 * @param {(m: Mitglied) => void} wahl
 */
function mitgliedSuche(mitglieder, wahl) {
  const eingabe = el('input', { id: 'auf-suche', type: 'search', autocomplete: 'off', enterkeyhint: 'search', placeholder: 'Name oder Spitzname' });
  const treffer = el('ul', { class: 'treffer', 'aria-label': 'Treffer' });
  const hinweis = el('p', { class: 'leer', role: 'status' });
  const zeichne = () => {
    const q = eingabe.value.trim().toLowerCase();
    const liste = q ? mitglieder.filter((m) => m.name.toLowerCase().includes(q) || m.nickname.toLowerCase().includes(q)).sort(nachName).slice(0, 8) : [];
    treffer.replaceChildren(...liste.map((m) => el('li', {}, el('button', { type: 'button', class: 'treffer-knopf', onclick: () => wahl(m) },
      el('span', {}, m.nickname ? `${m.name} (${m.nickname})` : m.name),
      el('span', { class: 'num leise' }, saldoText(m.guthaben, /** @type {Projekt} */ (zustand.projekt).modus) || '0,00 €')))));
    hinweis.textContent = q && !liste.length ? 'Kein aktives Mitglied gefunden.' : '';
  };
  eingabe.addEventListener('input', zeichne);
  return { knoten: el('div', { class: 'mitglied-suche' }, feld('Mitglied suchen', eingabe), hinweis, treffer), eingabe };
}

/** @param {number} vorwahl */
async function aufbuchung(vorwahl) {
  const mitglieder = (await alleMitglieder(db())).filter((m) => m.aktiv);
  const fehler = fehlerZeile();
  const status = statusZeile();
  const bereich = el('div', {});
  /** @param {Mitglied | undefined} m */
  const zeichne = (m) => {
    if (!m) {
      const s = mitgliedSuche(mitglieder, zeichne);
      bereich.replaceChildren(s.knoten);
      s.eingabe.focus();
      return;
    }
    const betrag = el('input', { id: 'auf-betrag', inputmode: 'decimal', autocomplete: 'off', placeholder: '20,00', required: true });
    const knopf = el('button', { type: 'submit' }, 'Aufbuchen');
    bereich.replaceChildren(
      el('div', { class: 'auswahl' },
        el('div', {}, el('p', { class: 'auswahl-name' }, m.nickname ? `${m.name} (${m.nickname})` : m.name),
          el('p', { class: 'num leise' }, `Stand: ${saldoText(m.guthaben, /** @type {Projekt} */ (zustand.projekt).modus) || '0,00 €'}`)),
        el('button', { type: 'button', class: 'zweit', onclick: () => zeichne(undefined) }, 'Anderes Mitglied'),
      ),
      el('form', {
        class: 'zeile-formular',
        onsubmit: async (e) => {
          e.preventDefault();
          fehler.textContent = status.textContent = '';
          const cent = euroZuCent(betrag.value);
          if (cent === null || cent <= 0) return void (fehler.textContent = 'Bitte einen Betrag über 0 mit höchstens 2 Nachkommastellen eingeben');
          knopf.disabled = true;
          try {
            await bucheBetrag(db(), zustand.geraet, m.id, 'aufbuchung', cent);
            status.textContent = `${euro(cent)} für ${m.name} aufgebucht`;
            const neu = await ladeMitglied(db(), m.id);
            const i = mitglieder.findIndex((x) => x.id === m.id);
            if (neu && i >= 0) mitglieder[i] = neu;
            zeichne(undefined);
          } catch (f) {
            fehler.textContent = speicherFehlerText(f);
            knopf.disabled = false;
          }
        },
      }, feld('Betrag in Euro', betrag), knopf),
    );
    betrag.focus();
  };
  await rahmen('aufbuchung', 'Aufbuchung', el('p', { class: 'einleitung' }, 'Einzahlung auf das Guthaben eines Mitglieds.'), bereich, fehler, status);
  zeichne(mitglieder.find((m) => m.id === vorwahl));
}

// ---------- Mitglieder ----------

/**
 * Tabelle mit Suchfeld; Zeilen werden nur ein-/ausgeblendet.
 * @param {string} name
 * @param {string[]} kopf
 * @param {Array<{suchtext: string, zellen: Kind[], klassen: string[]}>} zeilen
 */
function suchTabelle(name, kopf, zeilen) {
  const suche = el('input', { id: 'tabelle-suche', type: 'search', autocomplete: 'off', placeholder: 'Suchen' });
  const trs = zeilen.map((z) => ({ z, tr: el('tr', {}, ...z.zellen.map((c, i) => el('td', { class: z.klassen[i] ?? '' }, c))) }));
  suche.addEventListener('input', () => {
    const q = suche.value.trim().toLowerCase();
    for (const { z, tr } of trs) tr.hidden = Boolean(q) && !z.suchtext.includes(q);
  });
  return [
    feld(`${name} durchsuchen`, suche),
    zeilen.length
      ? el('table', { class: 'tabelle stamm' },
        el('thead', {}, el('tr', {}, ...kopf.map((k, i) => el('th', { scope: 'col', class: zeilen[0]?.klassen[i] ?? '' }, k)))),
        el('tbody', {}, ...trs.map((t) => t.tr)))
      : el('p', { class: 'leer' }, 'Noch keine Einträge.'),
  ];
}

async function mitgliederListe() {
  const p = /** @type {Projekt} */ (zustand.projekt);
  const mitglieder = (await alleMitglieder(db())).sort(nachName);
  await rahmen('mitglieder', 'Mitglieder',
    el('div', { class: 'leiste' }, el('a', { class: 'knopf', href: '#/admin/mitglieder/neu' }, 'Neues Mitglied')),
    ...suchTabelle('Mitglieder', ['Nr.', 'Name', 'Spitzname', 'Stand', 'Status'], mitglieder.map((m) => ({
      suchtext: `${m.name} ${m.nickname}`.toLowerCase(),
      zellen: [String(m.id), el('a', { href: `#/admin/mitglieder/${m.id}` }, m.name), m.nickname, saldoText(m.guthaben, p.modus) || '0,00 €', m.aktiv ? (istGeschwaerzt(p, m) ? 'geschwärzt' : 'aktiv') : 'inaktiv'],
      klassen: ['t-nr num', 't-name', 't-nick', 't-betrag num', 't-status'],
    }))),
  );
}

/**
 * Formular für neue Mitglieder; bleibt nach dem Anlegen für das nächste offen.
 * @param {boolean} bewacht mit Rückfrage bei ungespeicherter Eingabe
 */
function neuesMitgliedFormular(bewacht) {
  const fehler = fehlerZeile();
  const status = statusZeile();
  const name = el('input', { id: 'neu-name', autocomplete: 'off', maxlength: 60, required: true });
  const nick = el('input', { id: 'neu-nick', autocomplete: 'off', maxlength: 40 });
  const liste = el('ul', { class: 'angelegt', 'aria-label': 'Gerade angelegt' });
  const anlegen = async () => {
    fehler.textContent = status.textContent = '';
    const n = name.value.trim();
    const s = nick.value.trim();
    const f = textFehler(n, 1, 60) ? `Name ${textFehler(n, 1, 60)}` : textFehler(s, 0, 40) ? `Spitzname ${textFehler(s, 0, 40)}` : null;
    if (f) {
      fehler.textContent = f;
      name.focus();
      return false;
    }
    try {
      const id = await neuesMitglied(db(), n, s);
      status.textContent = `${n} angelegt (Nr. ${id})`;
      liste.prepend(el('li', {}, el('a', { href: `#/admin/mitglieder/${id}` }, s ? `${n} (${s})` : n)));
      name.value = nick.value = '';
      name.focus();
      return true;
    } catch (x) {
      fehler.textContent = meldung(x);
      return false;
    }
  };
  const form = el('form', {
    class: 'formular',
    'aria-label': 'Neues Mitglied',
    onsubmit: async (e) => {
      e.preventDefault();
      await anlegen();
    },
  }, feld('Name', name), feld('Spitzname (optional)', nick), el('div', { class: 'leiste' }, el('button', { type: 'submit' }, 'Mitglied anlegen')));
  if (bewacht) zustand.wache = { ungespeichert: () => Boolean(name.value.trim() || nick.value.trim()), speichern: anlegen };
  return el('section', { class: 'tafel', 'aria-label': 'Mitglied anlegen' }, form, fehler, status, liste);
}

/** @param {number} id */
async function mitgliedBearbeiten(id) {
  const m = Number.isInteger(id) ? await ladeMitglied(db(), id) : undefined;
  if (!m) {
    location.hash = '#/admin/mitglieder';
    return;
  }
  const p = /** @type {Projekt} */ (zustand.projekt);
  const fehler = fehlerZeile();
  const status = statusZeile();
  const name = el('input', { id: 'm-name', value: m.name, maxlength: 60, autocomplete: 'off', required: true });
  const nick = el('input', { id: 'm-nick', value: m.nickname, maxlength: 40, autocomplete: 'off' });
  const aktiv = el('input', { id: 'm-aktiv', type: 'checkbox', checked: m.aktiv });
  const speichern = async () => {
    fehler.textContent = status.textContent = '';
    const n = name.value.trim();
    const s = nick.value.trim();
    const f = textFehler(n, 1, 60) ? `Name ${textFehler(n, 1, 60)}` : textFehler(s, 0, 40) ? `Spitzname ${textFehler(s, 0, 40)}` : null;
    if (f) {
      fehler.textContent = f;
      return false;
    }
    try {
      await aendereMitglied(db(), m.id, { name: n, nickname: s, aktiv: aktiv.checked });
      status.textContent = `${n} gespeichert`;
      return true;
    } catch (x) {
      fehler.textContent = meldung(x);
      return false;
    }
  };
  const form = el('form', { class: 'formular' },
    feld('Name', name), feld('Spitzname', nick),
    el('label', { class: 'wahl-zeile', for: aktiv.id }, aktiv, 'aktiv (inaktive erscheinen nicht an der Schank; die Nr. wird nie neu vergeben)'),
    el('div', { class: 'leiste' }, el('button', { type: 'submit' }, 'Speichern'), el('a', { class: 'knopf zweit', href: '#/admin/mitglieder' }, 'Zur Liste')));
  const wache = bewache([form], speichern);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await speichern()) wache.merken();
  });
  await rahmen('mitglieder', m.name,
    el('dl', { class: 'kennzahlen' },
      el('div', {}, el('dt', {}, 'Nr.'), el('dd', { class: 'num' }, String(m.id))),
      el('div', {}, el('dt', {}, 'Stand'), el('dd', { class: 'num' }, saldoText(m.guthaben, p.modus) || '0,00 €')),
      el('div', {}, el('dt', {}, 'Status'), el('dd', {}, m.aktiv ? (istGeschwaerzt(p, m) ? 'geschwärzt' : 'aktiv') : 'inaktiv')),
    ),
    el('section', { class: 'tafel', 'aria-label': 'Mitglied bearbeiten' }, form, fehler, status),
    el('div', { class: 'leiste' },
      el('a', { class: 'knopf zweit', href: `#/admin/aufbuchung/${m.id}` }, 'Aufbuchen'),
      m.aktiv && el('a', { class: 'knopf zweit', href: `#/buchen/${m.id}` }, 'Zur Buchen-Seite'),
    ),
  );
}

// ---------- Artikel ----------

/**
 * @param {string} name
 * @param {string} preis
 * @param {string} reihenfolge
 */
function lies(name, preis, reihenfolge) {
  const n = name.trim();
  const p = euroZuCent(preis);
  const r = Number(reihenfolge);
  const tf = textFehler(n, 1, 40);
  if (tf) return `Name ${tf}`;
  if (p === null || p < 1 || p > 100000) return 'Preis muss zwischen 0,01 € und 1000,00 € liegen (höchstens 2 Nachkommastellen)';
  if (!Number.isInteger(r)) return 'Reihenfolge muss eine ganze Zahl sein';
  return { name: n, preis: p, reihenfolge: r };
}

async function artikelListe() {
  const artikel = (await alleArtikel(db())).sort((a, b) => a.reihenfolge - b.reihenfolge || a.id - b.id);
  await rahmen('artikel', 'Artikel',
    el('div', { class: 'leiste' }, el('a', { class: 'knopf', href: '#/admin/artikel/neu' }, 'Neuer Artikel')),
    ...suchTabelle('Artikel', ['Nr.', 'Name', 'Reihenfolge', 'Preis', 'Status'], artikel.map((a) => ({
      suchtext: a.name.toLowerCase(),
      zellen: [String(a.id), el('a', { href: `#/admin/artikel/${a.id}` }, a.name), String(a.reihenfolge), euro(a.preis), a.aktiv ? 'aktiv' : 'inaktiv'],
      klassen: ['t-nr num', 't-name', 't-nick num', 't-betrag num', 't-status'],
    }))),
  );
}

/** @param {boolean} bewacht */
async function neuerArtikelFormular(bewacht) {
  const vorhanden = await alleArtikel(db());
  let naechste = vorhanden.reduce((m, a) => Math.max(m, a.reihenfolge), 0) + 1;
  const fehler = fehlerZeile();
  const status = statusZeile();
  const name = el('input', { id: 'neu-artikel', autocomplete: 'off', maxlength: 40, required: true });
  const preis = el('input', { id: 'neu-preis', inputmode: 'decimal', autocomplete: 'off', placeholder: '2,50', required: true });
  const reihe = el('input', { id: 'neu-reihe', type: 'number', step: 1, value: naechste });
  const liste = el('ul', { class: 'angelegt', 'aria-label': 'Gerade angelegt' });
  const anlegen = async () => {
    fehler.textContent = status.textContent = '';
    const w = lies(name.value, preis.value, reihe.value);
    if (typeof w === 'string') {
      fehler.textContent = w;
      return false;
    }
    try {
      const id = await neuerArtikel(db(), w);
      status.textContent = `${w.name} angelegt (Nr. ${id})`;
      liste.prepend(el('li', {}, el('a', { href: `#/admin/artikel/${id}` }, `${w.name} ${euro(w.preis)}`)));
      naechste = Math.max(naechste, w.reihenfolge) + 1;
      name.value = preis.value = '';
      reihe.value = String(naechste);
      name.focus();
      return true;
    } catch (x) {
      fehler.textContent = meldung(x);
      return false;
    }
  };
  const form = el('form', {
    class: 'formular',
    'aria-label': 'Neuer Artikel',
    onsubmit: async (e) => {
      e.preventDefault();
      await anlegen();
    },
  }, feld('Name', name), feld('Preis in Euro', preis), feld('Reihenfolge', reihe), el('div', { class: 'leiste' }, el('button', { type: 'submit' }, 'Artikel anlegen')));
  // die vorgeschlagene Reihenfolge allein ist keine ungespeicherte Eingabe
  if (bewacht) zustand.wache = { ungespeichert: () => Boolean(name.value.trim() || preis.value.trim()), speichern: anlegen };
  return el('section', { class: 'tafel', 'aria-label': 'Artikel anlegen' }, form, fehler, status, liste);
}

/** @param {number} id */
async function artikelBearbeiten(id) {
  const a = Number.isInteger(id) ? (await alleArtikel(db())).find((x) => x.id === id) : undefined;
  if (!a) {
    location.hash = '#/admin/artikel';
    return;
  }
  const fehler = fehlerZeile();
  const status = statusZeile();
  const name = el('input', { id: 'a-name', value: a.name, maxlength: 40, autocomplete: 'off', required: true });
  const preis = el('input', { id: 'a-preis', value: centText(a.preis), inputmode: 'decimal', autocomplete: 'off', required: true });
  const reihe = el('input', { id: 'a-reihe', type: 'number', step: 1, value: a.reihenfolge });
  const aktiv = el('input', { id: 'a-aktiv', type: 'checkbox', checked: a.aktiv });
  const speichern = async () => {
    fehler.textContent = status.textContent = '';
    const w = lies(name.value, preis.value, reihe.value);
    if (typeof w === 'string') {
      fehler.textContent = w;
      return false;
    }
    try {
      await aendereArtikel(db(), a.id, { ...w, aktiv: aktiv.checked });
      status.textContent = `${w.name} gespeichert`;
      return true;
    } catch (x) {
      fehler.textContent = meldung(x);
      return false;
    }
  };
  const form = el('form', { class: 'formular' },
    feld('Name', name), feld('Preis in Euro', preis), feld('Reihenfolge', reihe),
    el('label', { class: 'wahl-zeile', for: aktiv.id }, aktiv, 'aktiv (inaktive erscheinen nicht an der Schank; die Nr. wird nie neu vergeben)'),
    el('div', { class: 'leiste' }, el('button', { type: 'submit' }, 'Speichern'), el('a', { class: 'knopf zweit', href: '#/admin/artikel' }, 'Zur Liste')));
  const wache = bewache([form], speichern);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await speichern()) wache.merken();
  });
  await rahmen('artikel', a.name, el('section', { class: 'tafel', 'aria-label': 'Artikel bearbeiten' }, form, fehler, status));
}

async function einrichtung() {
  seiteMit(
    { titel: 'Mitglieder und Artikel anlegen', art: 'einrichtung' },
    el('p', { class: 'einleitung' }, 'Lege jetzt Mitglieder und Artikel an. Alles lässt sich später im Admin-Bereich ändern.'),
    hilfe('erste-schritte', 'Erste Schritte'),
    el('div', { class: 'zwei-spalten' },
      el('div', {}, el('h2', {}, 'Mitglieder'), neuesMitgliedFormular(false)),
      el('div', {}, el('h2', {}, 'Artikel'), await neuerArtikelFormular(false)),
    ),
    el('div', { class: 'leiste' }, el('a', { class: 'knopf gross', href: '#/' }, 'Fertig')),
  );
}

// ---------- Einstellungen ----------

async function einstellungen() {
  const p = /** @type {Projekt} */ (zustand.projekt);
  const fehler = fehlerZeile();
  const status = statusZeile();
  const schema = el('select', { id: 'schema' }, ...SCHEMEN.map((s) => el('option', { value: s.wert, selected: s.wert === p.farbschema }, s.name)));
  schema.addEventListener('change', () => document.documentElement.setAttribute('data-schema', schema.value));
  /** @param {'vorauszahlung' | 'deckel'} wert @param {string} text */
  const modusFeld = (wert, text) => el('label', { class: 'wahl-zeile' }, el('input', { type: 'radio', name: 'modus', value: wert, checked: p.modus === wert }), text);
  const schwaerzung = el('input', { id: 'schwaerzung', type: 'checkbox', checked: p.schwaerzung_aktiv });
  const grenze = el('input', { id: 'grenze', inputmode: 'decimal', autocomplete: 'off', value: centText(p.schwaerzungs_grenze) });
  const speichern = async () => {
    fehler.textContent = status.textContent = '';
    const g = euroZuCent(grenze.value);
    if (g === null || g > 0) {
      fehler.textContent = 'Schwärzungsgrenze muss 0 oder negativ sein, z. B. -20,00';
      grenze.focus();
      return false;
    }
    const modus = /** @type {HTMLInputElement | null} */ (formular.querySelector('input[name="modus"]:checked'))?.value === 'deckel' ? 'deckel' : 'vorauszahlung';
    /** @type {Projekt} */
    const neu = { farbschema: schema.value, modus, schwaerzung_aktiv: schwaerzung.checked, schwaerzungs_grenze: g };
    try {
      await speichereProjekt(db(), neu);
      zustand.projekt = neu;
      status.textContent = 'Einstellungen gespeichert';
      return true;
    } catch (x) {
      fehler.textContent = speicherFehlerText(x);
      return false;
    }
  };
  const formular = el('form', { class: 'formular' },
    el('fieldset', {}, el('legend', {}, 'Darstellung'), feld('Farbschema', schema), hilfe('einstellungen', 'Farbschema')),
    el('fieldset', {}, el('legend', {}, 'Modus'), modusFeld('vorauszahlung', 'Vorauszahlung (erst aufbuchen, dann stricheln)'), modusFeld('deckel', 'Deckel (stricheln, dann zahlen)'), hilfe('stricheln-und-kassieren', 'Modus')),
    el('fieldset', {}, el('legend', {}, 'Schwärzung'), el('label', { class: 'wahl-zeile', for: 'schwaerzung' }, schwaerzung, 'Schwärzung ein'), feld('Schwärzungsgrenze in Euro (0 oder negativ)', grenze), hilfe('einstellungen', 'Schwärzung')),
    el('div', { class: 'leiste' }, el('button', { type: 'submit' }, 'Einstellungen speichern')),
    fehler,
    status,
  );
  const pin = await pinBereich();
  const wache = bewache([formular, pin.knoten], async () => (await speichern()) && (await pin.speichern()));
  formular.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (await speichern()) wache.merken();
  });
  // nach dem Speichern des PINs ist der PIN-Bereich neu gezeichnet und leer: neuen Stand merken
  pin.nachSpeichern(() => wache.merken());
  await rahmen('einstellungen', 'Einstellungen', formular, pin.knoten, await speicherBereich());
}

async function pinBereich() {
  const bereich = el('section', { class: 'tafel', 'aria-labelledby': 'pin-titel' });
  const fehler = fehlerZeile();
  const status = statusZeile();
  /** @type {() => void} */
  let gemerkt = () => undefined;
  /** @type {() => Promise<boolean>} */
  let speichern = async () => true;
  const zeichne = async () => {
    const gesetzt = await pinGesetzt();
    const pin1 = el('input', { id: 'pin-neu', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 4 });
    const pin2 = el('input', { id: 'pin-wdh', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 4 });
    speichern = async () => {
      if (!pin1.value && !pin2.value) return true;
      fehler.textContent = status.textContent = '';
      if (pin1.value !== pin2.value) {
        fehler.textContent = 'Die beiden PINs stimmen nicht überein';
        return false;
      }
      try {
        await setzePin(pin1.value);
        await zeichne();
        status.textContent = 'PIN gespeichert';
        gemerkt();
        return true;
      } catch (x) {
        fehler.textContent = speicherFehlerText(x).replace('Speichern fehlgeschlagen: ', '');
        return false;
      }
    };
    bereich.replaceChildren(
      el('h2', { id: 'pin-titel' }, 'PIN'),
      el('p', {}, gesetzt ? 'Ein PIN sperrt den Admin-Bereich.' : 'Kein PIN gesetzt.', ' Der PIN ist nur ein Bedienschutz.'),
      el('form', {
        class: 'formular',
        onsubmit: async (e) => {
          e.preventDefault();
          await speichern();
        },
      }, feld(gesetzt ? 'Neuer PIN (4 Ziffern)' : 'PIN (4 Ziffern)', pin1), feld('PIN wiederholen', pin2),
      el('div', { class: 'leiste' },
        el('button', { type: 'submit' }, gesetzt ? 'PIN ändern' : 'PIN setzen'),
        gesetzt ? el('button', {
          type: 'button',
          class: 'zweit',
          onclick: async () => {
            if (!(await bestaetige('PIN entfernen? Der Admin-Bereich ist dann ohne PIN erreichbar.', 'PIN entfernen'))) return;
            await geraetSchreiben(db(), 'pin', undefined);
            await zeichne();
            status.textContent = 'PIN entfernt';
          },
        }, 'PIN entfernen') : '')),
      fehler,
      status,
      hilfe('datensicherheit', 'PIN'),
    );
  };
  await zeichne();
  return {
    knoten: bereich,
    speichern: () => speichern(),
    /** @param {() => void} f */
    nachSpeichern: (f) => { gemerkt = f; },
  };
}

async function speicherBereich() {
  const s = navigator.storage;
  let text = 'Dieser Browser kann dauerhaften Speicher nicht melden.';
  if (s && typeof s.persisted === 'function') {
    text = (await s.persisted().catch(() => false)) ? 'Dauerhafter Speicher ist gewährt: Der Browser löscht die Daten nicht von selbst.' : 'Dauerhafter Speicher ist nicht gewährt: Der Browser kann die Daten bei Speichermangel löschen. Regelmäßig sichern.';
  }
  return el('section', { class: 'tafel', 'aria-labelledby': 'speicher-titel' }, el('h2', { id: 'speicher-titel' }, 'Speicher'), el('p', { id: 'speicher-status' }, text), hilfe('sicherung-und-projekt', 'Datenerhalt'));
}

// ---------- Daten ----------

async function laden() {
  const fehler = fehlerZeile();
  const status = statusZeile();
  const datei = el('input', { id: 'datei', type: 'file', accept: '.json,application/json' });
  const knopf = el('button', { type: 'submit' }, 'Laden');
  await rahmen('laden', 'Sicherung laden',
    el('p', { class: 'einleitung' }, 'Lädt eine Sicherung oder ein leeres Projekt. Alle Daten am Gerät werden ersetzt.'),
    el('form', {
      class: 'formular tafel',
      onsubmit: async (e) => {
        e.preventDefault();
        fehler.textContent = status.textContent = '';
        const f = datei.files?.[0];
        if (!f) return void (fehler.textContent = 'Bitte eine Datei wählen');
        knopf.disabled = true;
        try {
          if (await importiere(f)) {
            document.documentElement.setAttribute('data-schema', zustand.projekt?.farbschema ?? 'violett');
            status.textContent = 'Daten geladen';
          }
        } catch (x) {
          fehler.textContent = meldung(x);
        }
        knopf.disabled = false;
      },
    }, feld('Datei (.json)', datei), el('div', { class: 'leiste' }, knopf)),
    fehler,
    status,
    hilfe('sicherung-und-projekt', 'Sicherung laden'),
  );
}

async function exporte() {
  const fehler = fehlerZeile();
  const status = statusZeile();
  /** @param {() => Promise<void>} aktion */
  const sicher = (aktion) => async () => {
    fehler.textContent = status.textContent = '';
    try {
      await aktion();
      status.textContent = 'Export erstellt';
    } catch (x) {
      fehler.textContent = meldung(x);
    }
  };
  /** @param {string} titel @param {string} text @param {...Kind} teile */
  const block = (titel, text, ...teile) => el('section', { class: 'tafel' }, el('h2', {}, titel), el('p', {}, text), ...teile);
  await rahmen('exporte', 'Exporte',
    block('Sicherung', 'Alle Daten außer PIN und Geräte-Kennung. Mit „Sicherung laden“ wird der Zustand wiederhergestellt.',
      el('div', { class: 'leiste' }, el('button', { type: 'button', onclick: sicher(exportiereSicherung) }, 'Sicherung herunterladen'), hilfe('sicherung-und-projekt', 'Sicherung'))),
    block('Leeres Projekt', 'Mitglieder, Artikel und Einstellungen ohne Buchungen, z. B. für ein neues Semester.',
      el('div', { class: 'leiste' }, el('button', {
        type: 'button',
        class: 'zweit',
        onclick: sicher(async () => {
          const wahl = await frage('Guthaben im neuen Projekt?', [['null', 'Guthaben auf 0 setzen'], ['uebernehmen', 'Guthaben übernehmen'], ['abbrechen', 'Abbrechen']]);
          if (wahl === 'abbrechen') throw new PruefFehler('Abgebrochen');
          const daten = await alleDaten(db());
          herunterladen(dateiname('projekt'), dateiInhalt('projekt', leeresProjekt(daten, wahl === 'uebernehmen', zustand.geraet)), 'application/json');
          if (wahl === 'null') herunterladen(csvName('abrechnung_v1.csv'), abrechnungCsv(daten.mitglieder, daten.buchungen), 'text/csv');
        }),
      }, 'Leeres Projekt exportieren'), hilfe('sicherung-und-projekt', 'Leeres Projekt'))),
    block('Umstieg ins Vollsystem', 'Drei CSV-Dateien für den Import in ein leeres Ergo-Bibamus-Vollsystem.',
      el('p', {}, 'Vollsystem: ', el('a', { href: VOLLSYSTEM_URL, rel: 'noopener noreferrer' }, VOLLSYSTEM_URL)),
      el('div', { class: 'leiste' },
        el('button', { type: 'button', class: 'zweit', onclick: sicher(async () => herunterladen(csvName(MITGLIEDER_DATEI), mitgliederCsv((await alleDaten(db())).mitglieder, /** @type {Projekt} */ (zustand.projekt)), 'text/csv')) }, MITGLIEDER_DATEI),
        el('button', { type: 'button', class: 'zweit', onclick: sicher(async () => herunterladen(csvName(ARTIKEL_DATEI), artikelCsv((await alleDaten(db())).artikel), 'text/csv')) }, ARTIKEL_DATEI),
        el('button', { type: 'button', class: 'zweit', onclick: sicher(async () => herunterladen(csvName(GUTHABEN_DATEI), guthabenCsv((await alleDaten(db())).mitglieder), 'text/csv')) }, GUTHABEN_DATEI),
      ),
      hilfe('umstieg-ins-vollsystem', 'Umstieg')),
    fehler,
    status,
  );
}

async function zuruecksetzen() {
  const fehler = fehlerZeile();
  await rahmen('zuruecksetzen', 'Gerät zurücksetzen',
    el('section', { class: 'tafel' },
      el('p', {}, 'Löscht alle Daten dieses Geräts, auch den PIN und die Demo. Danach startet µEBS wie beim ersten Mal.'),
      el('div', { class: 'leiste' }, el('button', {
        type: 'button',
        class: 'gefahr',
        onclick: async () => {
          try {
            if (!(await vorherSichern())) return;
            if (!(await bestaetige('Alle Daten und der PIN werden gelöscht.', 'Weiter'))) return;
            if (!(await bestaetige('Wirklich endgültig löschen? Das lässt sich nicht rückgängig machen.', 'Endgültig löschen'))) return;
            zustand.db?.close();
            zustand.echt?.close();
            const blockiert = () => { fehler.textContent = 'Bitte andere µEBS-Fenster und Browser-Tabs schließen. Das Zurücksetzen geht danach von selbst weiter.'; };
            await loescheDb(DB_DEMO, blockiert);
            await loescheDb(DB_ECHT, blockiert);
            // ohne Hash neu laden: kein Zeichnen mehr mit der geschlossenen Datenbank
            location.replace(location.pathname + location.search);
          } catch (x) {
            fehler.textContent = speicherFehlerText(x);
          }
        },
      }, 'Gerät zurücksetzen'))),
    fehler,
  );
}
