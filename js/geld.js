// @ts-check
// Geldbeträge sind immer ganze Cent. Umrechnung ohne Gleitkomma.

/**
 * "12,50", "12.5", "-3" → Cent. Ungültig oder mehr als 2 Nachkommastellen → null.
 * @param {string} text
 * @returns {number | null}
 */
export function euroZuCent(text) {
  const m = /^([-−]?)(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!m) return null;
  const cent = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0'));
  return m[1] && cent !== 0 ? -cent : cent;
}

/**
 * Cent → "12,50" bzw. "-3,00" (ohne Währungszeichen, auch für CSV).
 * @param {number} cent
 */
export function centText(cent) {
  const betrag = Math.abs(cent);
  const rest = String(betrag % 100).padStart(2, '0');
  return (cent < 0 ? '-' : '') + String(Math.floor(betrag / 100)) + ',' + rest;
}

/** @param {number} cent */
export function euro(cent) {
  // echtes Minuszeichen für die Anzeige; CSV nutzt centText() mit Bindestrich
  return (cent < 0 ? '\u2212' : '') + centText(Math.abs(cent)) + ' €';
}

/**
 * Anzeige des Saldos je nach Modus.
 * @param {number} guthaben
 * @param {'vorauszahlung' | 'deckel'} modus
 */
export function saldoText(guthaben, modus) {
  if (modus === 'vorauszahlung') return euro(guthaben);
  if (guthaben < 0) return 'offen ' + euro(-guthaben);
  if (guthaben > 0) return 'Guthaben ' + euro(guthaben);
  return '';
}
