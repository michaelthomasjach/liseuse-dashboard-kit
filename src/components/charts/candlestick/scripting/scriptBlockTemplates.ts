/** The no-code palette: the blocks you can drag onto the canvas (see `ScriptGraphEditor.tsx`).
 *
 *  Every one of these is a real, runnable fragment of the scripting language — not a pseudo-code
 *  placeholder to be filled in later. That is the point of the whole no-code view: dropping four
 *  blocks and joining them has to produce a script that runs, or the diagram is a drawing rather
 *  than a program. Each body is written to stand on the variables the blocks before it declare,
 *  which is why the names (`prix`, `rapide`, `lente`, `signalAchat`) are deliberately boring and
 *  consistent across templates.
 *
 *  Grouped only for the palette's own headings; the groups mean nothing to the engine. */
export interface ScriptBlockTemplate {
  /** Palette id, not the block's own — a dropped block gets an id derived from its title. */
  key: string;
  group: string;
  /** The block's own title, which becomes the node's label on the canvas. */
  title: string;
  /** One line under the palette entry, saying what it does. */
  hint: string;
  /** The code the block starts with. */
  body: string;
}

export const SCRIPT_BLOCK_TEMPLATES: ScriptBlockTemplate[] = [
  {
    key: "price",
    group: "Données",
    title: "Prix",
    hint: "Le cours de clôture de la bougie courante.",
    body: `// Le prix de clôture de la bougie en cours.\nconst prix = market.close(0);`,
  },
  {
    key: "series",
    group: "Données",
    title: "Historique",
    hint: "Les N dernières clôtures, pour un calcul sur fenêtre.",
    body: `// Les 50 dernières clôtures, la plus récente en premier.\nconst historique = market.series("close", 50);`,
  },
  {
    key: "chart-indicator",
    group: "Données",
    title: "Indicateur de la chart",
    hint: "Lit un indicateur déjà posé sur le graphique.",
    body: `// Lit un indicateur déjà présent sur la chart plutôt que de le recalculer.\n// L'identifiant exact se trouve dans « Indicateurs disponibles ».\nconst rsi = chart.indicator("rsi").value(0);`,
  },
  {
    key: "sma",
    group: "Calculs",
    title: "Moyenne mobile",
    hint: "Une moyenne simple sur les N dernières bougies.",
    body: `// Deux moyennes : une rapide et une lente.\nconst rapide = ta.sma(market.series("close", 60), 9);\nconst lente = ta.sma(market.series("close", 60), 30);`,
  },
  {
    key: "rsi",
    group: "Calculs",
    title: "RSI",
    hint: "L'indice de force relative, calculé ici.",
    body: `// RSI sur 14 périodes, calculé à partir des clôtures.\nconst rsi = ta.rsi(market.series("close", 100), 14);`,
  },
  {
    key: "custom",
    group: "Calculs",
    title: "Calcul libre",
    hint: "Un bloc vide, à écrire entièrement.",
    body: `// À vous d'écrire.\n`,
  },
  {
    key: "condition",
    group: "Décisions",
    title: "Condition",
    hint: "Vrai ou faux, à partir de ce qui précède.",
    body: `// Vrai quand la moyenne rapide passe au-dessus de la lente.\nconst achat = rapide !== null && lente !== null && rapide > lente;`,
  },
  {
    key: "threshold",
    group: "Décisions",
    title: "Seuil",
    hint: "Compare une valeur à un niveau réglable.",
    body: `// Le seuil est un paramètre : il apparaît dans le panneau « Paramètres ».\nconst seuil = new Variable("number", 30);\nconst survendu = rsi !== null && rsi < seuil;`,
  },
  {
    key: "signal",
    group: "Sorties",
    title: "Signal d'achat / vente",
    hint: "Pose une flèche BUY ou SELL sur la chart.",
    body: `// Un seul signal par bougie close — sans bar.isNew(), il serait reposé à chaque tick.\nif (bar.isNew() && achat) plot.signal("BUY");\nif (bar.isNew() && !achat) plot.signal("SELL");`,
  },
  {
    key: "overlay",
    group: "Sorties",
    title: "Courbe sur le prix",
    hint: "Superpose une courbe au graphique des prix.",
    body: `plot.overlay("Moyennes").line("Rapide", rapide);\nplot.overlay("Moyennes").line("Lente", lente);`,
  },
  {
    key: "pane",
    group: "Sorties",
    title: "Panneau séparé",
    hint: "Trace une courbe dans son propre panneau, sous le prix.",
    body: `plot.pane("RSI").line("RSI", rsi);`,
  },
  {
    key: "alert",
    group: "Sorties",
    title: "Alerte",
    hint: "Déclenche une alerte quand la condition passe.",
    body: `if (bar.isNew() && achat) alert("Croisement haussier");`,
  },
];

/** Palette groups in the order they render. Derived from the templates rather than listed twice,
 *  so adding a template with a new group cannot forget to declare it. */
export function scriptBlockTemplateGroups(): { group: string; templates: ScriptBlockTemplate[] }[] {
  const groups: { group: string; templates: ScriptBlockTemplate[] }[] = [];
  for (const template of SCRIPT_BLOCK_TEMPLATES) {
    const existing = groups.find((g) => g.group === template.group);
    if (existing) existing.templates.push(template);
    else groups.push({ group: template.group, templates: [template] });
  }
  return groups;
}
