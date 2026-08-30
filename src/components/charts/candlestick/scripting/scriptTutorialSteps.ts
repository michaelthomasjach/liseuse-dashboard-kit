/** Steps for `ScriptInteractiveTutorial.tsx` — plain data, same "no JSX" convention as
 *  `scriptApiReference.ts` (see its own doc), migrated from that file's former static "tutorial"
 *  section (steps 2-9 of the original walkthrough; step 1, "open the editor", no longer applies once
 *  the tutorial embeds a working editor of its own). Each step with `code` set auto-runs that code
 *  the moment it becomes current (see `ScriptInteractiveTutorial.tsx`) — the reader sees the
 *  "expected" result before touching anything, then can edit and re-run freely. */
export interface ScriptTutorialStep {
  id: string;
  title: string;
  paragraphs: string[];
  /** Key into `SCRIPT_DIAGRAM_REGISTRY` (`scriptDiagramRegistry.ts`). */
  diagramKey?: string;
  /** Only the closing step — the "pour aller plus loin" pointers back into the full reference. */
  list?: string[];
  /** Absent = no runnable code for this step (only the closing step today) — the editor/preview
   *  column is hidden entirely rather than shown empty. */
  code?: string;
}

export const SCRIPT_TUTORIAL_STEPS: ScriptTutorialStep[] = [
  {
    id: "first-plot",
    title: "Étape 1 — Le tout premier tracé",
    paragraphs: [
      "Avant même de parler de prix ou d'indicateur, vérifions que le circuit complet fonctionne : écrire du code, l'exécuter, voir un résultat. plot.line trace une courbe — ici une droite plate à la valeur 1, juste pour voir apparaître quelque chose.",
      "Le code ci-contre s'est déjà exécuté automatiquement — regardez la chart : un nouveau panneau est apparu sous les bougies, avec une ligne plate nommée « Test ». C'est exactement ce que fait plot.line : ouvrir (ou mettre à jour) un panneau dédié, une valeur par bougie.",
    ],
    diagramKey: "plotOwnPane",
    code: `plot.line("Test", 1);\n`,
  },
  {
    id: "real-price",
    title: "Étape 2 — Remplacer la valeur fixe par un vrai prix",
    paragraphs: [
      "1, c'était pour tester — un indicateur digne de ce nom lit le prix réel. market.close(0) retourne le cours de clôture de la bougie courante (le 0 entre parenthèses veut dire « la bougie en cours »).",
      "La ligne plate est remplacée par une courbe qui suit fidèlement le prix de clôture, bougie après bougie — le script vient de rejouer tout l'historique visible, une bougie à la fois.",
    ],
    code: `plot.line("Clôture", market.close(0));\n`,
  },
  {
    id: "moving-average",
    title: "Étape 3 — Calculer une moyenne mobile",
    paragraphs: [
      "market.series(\"close\", 20) retourne un tableau des 20 dernières clôtures ; math.sma en fait la moyenne mobile simple. On passe aussi en plot.overlay plutôt que plot.line : une moyenne mobile est un prix, elle a donc du sens directement superposée aux bougies plutôt que dans son propre panneau.",
      "sma20 ?? market.close(0) : les 19 toutes premières bougies de l'historique n'ont pas encore 20 clôtures disponibles derrière elles, math.sma renvoie alors null plutôt qu'une valeur fausse — le ?? affiche le prix courant à la place le temps que la moyenne ait assez de recul, plutôt que de laisser un trou dans la courbe.",
    ],
    diagramKey: "plotOverlay",
    code: `const closes = market.series("close", 20);\nconst sma20 = math.sma(closes, 20);\nplot.overlay("SMA 20", sma20 ?? market.close(0));\n`,
  },
  {
    id: "second-average",
    title: "Étape 4 — Une seconde moyenne, plus rapide",
    paragraphs: [
      "Un indicateur à une seule moyenne ne dit pas grand-chose ; ajoutons-en une seconde, plus courte, donc plus réactive — le principe même d'un croisement de moyennes mobiles.",
      "Deux courbes se superposent maintenant au prix. Le signal qui nous intéresse : le moment précis où la courte (SMA 5) croise la longue (SMA 20).",
    ],
    code: `const closes = market.series("close", 20);\nconst sma20 = math.sma(closes, 20);\nconst sma5 = math.sma(market.series("close", 5), 5);\n\nplot.overlay("SMA 20", sma20 ?? market.close(0));\nplot.overlay("SMA 5", sma5 ?? market.close(0));\n`,
  },
  {
    id: "state-memory",
    title: "Étape 5 — Se souvenir de la bougie précédente",
    paragraphs: [
      "Détecter un croisement demande de comparer « où en étaient les deux moyennes à l'instant précédent » à « où elles en sont maintenant » — or, un script ne voit qu'une bougie à la fois. state.get/state.set servent exactement à ça : faire porter une valeur d'une bougie à la suivante.",
      "state.get(\"prevSma20\", null) lit la valeur mémorisée à la bougie précédente (null si elle n'a encore jamais été définie — la toute première bougie du rejeu). state.set écrit la valeur actuelle pour que la bougie suivante puisse à son tour la lire comme « prevSma20 ».",
    ],
    diagramKey: "stateMemory",
    code: `const sma20 = math.sma(market.series("close", 20), 20);\nconst sma5 = math.sma(market.series("close", 5), 5);\nconst prevSma20 = state.get("prevSma20", null);\nconst prevSma5 = state.get("prevSma5", null);\n\nplot.overlay("SMA 20", sma20 ?? market.close(0));\nplot.overlay("SMA 5", sma5 ?? market.close(0));\n\nstate.set("prevSma20", sma20);\nstate.set("prevSma5", sma5);\n`,
  },
  {
    id: "cross-signal",
    title: "Étape 6 — Détecter le croisement et signaler",
    paragraphs: [
      "Tout est en place pour comparer avant/après et agir au bon moment. bar.isNew() garantit qu'on ne déclenche le signal qu'une seule fois — sur la toute dernière bougie du rejeu — plutôt qu'à chaque relecture de tout l'historique.",
      "Une flèche verte apparaît à chaque croisement haussier, une flèche rouge à chaque croisement baissier, chacune avec son propre mot affiché juste à côté (text: \"BUY\"/\"SELL\"), et une alerte est enregistrée à chaque fois — c'est un indicateur complet, fonctionnel, écrit en une dizaine de lignes.",
    ],
    diagramKey: "plotSignal",
    code: `const sma20 = math.sma(market.series("close", 20), 20);\nconst sma5 = math.sma(market.series("close", 5), 5);\nconst prevSma20 = state.get("prevSma20", null);\nconst prevSma5 = state.get("prevSma5", null);\n\nplot.overlay("SMA 20", sma20 ?? market.close(0));\nplot.overlay("SMA 5", sma5 ?? market.close(0));\n\nif (bar.isNew() && prevSma5 !== null && prevSma20 !== null && sma5 !== null && sma20 !== null) {\n  if (prevSma5 <= prevSma20 && sma5 > sma20) {\n    plot.signal({ type: "BUY", text: "BUY" });\n    alert("Croisement haussier : SMA 5 dépasse SMA 20");\n  }\n  if (prevSma5 >= prevSma20 && sma5 < sma20) {\n    plot.signal({ type: "SELL", text: "SELL" });\n    alert("Croisement baissier : SMA 5 repasse sous SMA 20");\n  }\n}\n\nstate.set("prevSma20", sma20);\nstate.set("prevSma5", sma5);\n`,
  },
  {
    id: "save-and-more",
    title: "Étape 7 — Enregistrer, et pour aller plus loin",
    paragraphs: [
      "Dans le vrai éditeur (pas cette démo), Ctrl+S (ou le bouton « Enregistrer ») sauvegarde le code. La toute première fois, ça demande un nom (Script 1, ça manque un peu de panache — appelez-le « Croisement SMA » par exemple) ; les fois suivantes, Ctrl+S enregistre directement sans redemander. « Enregistrer sous » permet de renommer/dupliquer à tout moment. Une fois enregistré, le script apparaît automatiquement dans le sélecteur d'indicateurs, sous « Mes scripts » — comme n'importe quel RSI ou MACD intégré.",
      "Vous venez de construire un indicateur complet de A à Z. Pour aller plus loin :",
    ],
    list: [
      "chart.indicator(id) permet de lire un indicateur déjà présent sur la chart (un RSI, un MACD…) plutôt que de tout recalculer soi-même — voir chart.* plus bas.",
      "ta.* calcule des indicateurs techniques usuels (RSI, MACD, Bollinger, stochastique…) à la demande, sans avoir à les ajouter visuellement à la chart — voir ta.* plus bas.",
      "La section « Exemples » plus bas contient six scripts complets prêts à copier, chacun dans un style différent (score composite, rupture de bande, détecteur de volume…).",
      "Chaque section qui suit détaille exhaustivement une famille de fonctions (market.*, chart.*, plot.*, state.*, bar.*, math.*, ta.*) — c'est la référence complète, à consulter au fur et à mesure des besoins plutôt qu'à lire d'un bloc.",
    ],
  },
];
