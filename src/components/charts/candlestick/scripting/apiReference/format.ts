import { fns, t, type ScriptReferenceSection } from "./blocks";

/** `format.*` — écrire un nombre comme le graphique l'écrit (voir `worker/formatLib.ts`). */
export const FORMAT_SECTION: ScriptReferenceSection = {
  id: "format",
  title: "format.*",
  group: "Fonctions utilitaires",
  blocks: [
    t(
      "Écrire un nombre dans un texte — un label, une cellule de plot.table, un message d'alerte, un console.log — avec les mêmes règles que les axes et les légendes du graphique : le nombre tel quel sous 10 000, puis k (milliers), M (millions), B (milliards, jamais G), T (milliers de milliards), à trois chiffres significatifs au plus, sans zéros inutiles. 100 → 100 · 1000 → 1000 · 10000 → 10k · 100000 → 100k · 1000000 → 1M · 1000000000 → 1B · 10100000000 → 10.1B · −200000000 → −200M."
    ),
    t(
      "Ces fonctions renvoient du texte et ne dessinent rien. Pour choisir le format des valeurs d'un panneau entier (son axe, ses badges, sa légende), c'est l'option format de plot.pane."
    ),
    ...fns([
      {
        signature: "format.compact(value, decimals?)",
        keywords: ["format.compact"],
        purpose: "La notation compacte du graphique : le nombre tel quel sous 10 000, k / M / B / T au-delà.",
        params: ["value — le nombre à écrire.", "decimals — décimales des nombres sous 10 000 (2 par défaut) ; sans effet sur 12.3k ou 1.5B."],
        returns: "un texte : « 54.30 », « 12.3k », « 1.95B », « −200M ».",
        example: `const vol = market.volume(0);
plot.table([{ cells: ["Volume", format.compact(vol, 0)] }]);`,
      },
      {
        signature: "format.integer(value)",
        keywords: ["format.integer"],
        purpose: "Comme format.compact, sans décimales sous 10 000 : la bonne écriture d'un volume ou d'un nombre de transactions.",
        params: ["value — le nombre à écrire."],
        returns: "un texte : « 1235 », « 160M ».",
      },
      {
        signature: "format.percent(value, decimals?)",
        keywords: ["format.percent"],
        purpose: "Une valeur déjà exprimée en pourcentage, suivie de « % ». Ne multiplie pas par 100 : passez 21.5 pour 21,5 %.",
        params: ["value — le pourcentage.", "decimals — décimales (2 par défaut)."],
        returns: "un texte : « 21.46% », « −3.10% ».",
      },
      {
        signature: "format.number(value, format?)",
        keywords: ["format.number"],
        purpose: "Avec n'importe quel format accepté par plot.pane(nom, { format }) : \"auto\", \"integer\", \"percent\", \"raw\" ou { decimals, compact, prefix, suffix }.",
        params: ["value — le nombre à écrire.", "format — le format ; absent : \"auto\"."],
        returns: "un texte : format.number(1.2e9, { prefix: \"$\" }) → « $1.2B » ; format.number(3562067169, \"raw\") → « 3562067169 ».",
      },
    ]),
  ],
};
