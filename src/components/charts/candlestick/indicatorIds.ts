import type { Indicator } from "./interfaces/Indicator.interface";

/** Suffixe court et aléatoire (base 36). `crypto.getRandomValues` quand il existe, sinon `Math.random`. */
function randomSuffix(length = 6): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes);
  else for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/** Id unique d'un indicateur ajouté au graphique : `sma-20-k3f9qa`, `custom-x81m2c`…
 *
 *  Le type et la période ne servent qu'à le rendre lisible ; c'est le suffixe aléatoire qui le rend unique. Avant, l'id
 *  était un compteur repartant de 0 à chaque montage du graphique (`indicator-0`, `indicator-1`…) : après un
 *  rechargement, le premier indicateur ajouté reprenait l'id d'un indicateur déjà enregistré, et supprimer l'un des deux
 *  supprimait les deux. `taken` : ids déjà présents, jamais redonnés (une collision du suffixe est improbable, pas
 *  impossible). */
export function newIndicatorId(kind?: string, period?: number, taken?: Iterable<string>): string {
  const used = taken ? new Set(taken) : null;
  const base = [kind, period && Number.isFinite(period) && period > 0 ? String(period) : null]
    .filter((part): part is string => Boolean(part))
    .join("-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .toLowerCase();
  for (;;) {
    const id = `${base || "indicator"}-${randomSuffix()}`;
    if (!used?.has(id)) return id;
  }
}

/** La même liste où chaque id n'apparaît qu'une fois : le premier garde le sien, les suivants deviennent `id-2`,
 *  `id-3`… (déterministe : une liste enregistrée relue deux fois donne les mêmes ids, même avant d'être réenregistrée).
 *  Répare les listes enregistrées avec l'ancien compteur, où deux indicateurs pouvaient partager un id. Renvoie la liste
 *  d'origine (même référence) quand il n'y a aucun doublon. */
export function dedupeIndicatorIds<T extends Pick<Indicator, "id">>(list: T[]): T[] {
  const ids = new Set<string>();
  let duplicated = false;
  for (const ind of list) {
    if (ids.has(ind.id)) {
      duplicated = true;
      break;
    }
    ids.add(ind.id);
  }
  if (!duplicated) return list;
  const all = new Set(list.map((ind) => ind.id));
  const seen = new Set<string>();
  return list.map((ind) => {
    if (!seen.has(ind.id)) {
      seen.add(ind.id);
      return ind;
    }
    let n = 2;
    while (all.has(`${ind.id}-${n}`) || seen.has(`${ind.id}-${n}`)) n++;
    const id = `${ind.id}-${n}`;
    seen.add(id);
    return { ...ind, id };
  });
}
