/**
 * Minimal digit-mask engine: `#` in the pattern is a digit slot, any other
 * character is a literal that's inserted automatically. Unfilled slots are
 * rendered as `maskChar` so the full pattern is always visible
 * (e.g. mask "## ## ## ## ##" + maskChar "_" → "06 __ __ __ __").
 */

export function countSlots(mask: string): number {
  let n = 0;
  for (const c of mask) if (c === "#") n++;
  return n;
}

export function digitsOnly(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

/**
 * Les chiffres **saisis** d'un texte édité dans un champ masqué — sans les chiffres que le motif
 * écrit lui-même. `digitsOnly` relisait le « 33 » de « +33 ## … » comme une saisie, et chaque
 * frappe repoussait l'indicatif dans les cases. On aligne donc le texte sur le motif, caractère par
 * caractère : un caractère égal au littéral attendu à cet endroit est ce littéral ; un chiffre
 * ailleurs occupe la case suivante ; un caractère de remplissage (`maskChar`) est une case vide.
 * L'alignement résiste à une insertion ou une suppression au milieu, puisqu'il ne dépend que de
 * l'ordre des caractères, pas de leurs positions.
 */
export function slotDigits(typed: string, mask: string, maskChar: string, maxLength: number): string {
  let out = "";
  let mi = 0;
  for (const c of typed) {
    if (mi < mask.length && mask[mi] !== "#" && c === mask[mi]) {
      mi++;
      continue;
    }
    if (c >= "0" && c <= "9") {
      out += c;
      const next = mask.indexOf("#", mi);
      mi = next === -1 ? mask.length : next + 1;
    } else if (c === maskChar && mi < mask.length && mask[mi] === "#") {
      mi++;
    }
  }
  return out.slice(0, maxLength);
}

export function applyMask(digits: string, mask: string, maskChar: string): string {
  let out = "";
  let di = 0;
  for (const m of mask) {
    if (m === "#") {
      out += di < digits.length ? digits[di++] : maskChar;
    } else {
      out += m;
    }
  }
  return out;
}

/** Caret index right after the `count`-th digit slot (or the first slot if count is 0). */
export function caretIndexForDigitCount(mask: string, count: number): number {
  if (count <= 0) {
    const first = mask.indexOf("#");
    return first === -1 ? 0 : first;
  }
  let seen = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === "#") {
      seen++;
      if (seen === count) return i + 1;
    }
  }
  return mask.length;
}
