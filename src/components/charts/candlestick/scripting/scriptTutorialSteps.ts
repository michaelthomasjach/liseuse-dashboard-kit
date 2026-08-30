import type { Candle } from "../interfaces/Candle.interface";
import { SCRIPT_TUTORIAL_INTRADAY_DATA } from "./scriptTutorialIntradaySampleData";

/** Steps for `ScriptInteractiveTutorial.tsx` — plain data, same "no JSX" convention as
 *  `scriptApiReference.ts` (see its own doc), migrated from that file's former static "tutorial"
 *  section (steps 2-9 of the original walkthrough; step 1, "open the editor", no longer applies once
 *  the tutorial embeds a working editor of its own). Each step with `code` set auto-runs that code
 *  the moment it becomes current (see `ScriptInteractiveTutorial.tsx`) — the reader sees the
 *  "expected" result before touching anything, then can edit and re-run freely.
 *
 *  Two parts: steps 1-6 build a simple SMA-crossover indicator against the daily-spaced
 *  `SCRIPT_TUTORIAL_DATA`; steps 8-11 build a genuinely more advanced one (a multi-timeframe RSI
 *  confluence table, exercising `market.resample`/`plot.table`) against the finer intraday
 *  `SCRIPT_TUTORIAL_INTRADAY_DATA` (see `data` below) — step 7 bridges the two, step 12 closes. */
export interface ScriptTutorialStep {
  id: string;
  title: string;
  paragraphs: string[];
  /** Key into `SCRIPT_DIAGRAM_REGISTRY` (`scriptDiagramRegistry.ts`). */
  diagramKey?: string;
  /** Only the closing step — the "pour aller plus loin" pointers back into the full reference. */
  list?: string[];
  /** Absent = no runnable code for this step (the transition and closing steps) — the editor/
   *  preview column is hidden entirely rather than shown empty. */
  code?: string;
  /** Overrides `SCRIPT_TUTORIAL_DATA` as this step's own preview dataset — the multi-timeframe
   *  steps need real intraday bars (`SCRIPT_TUTORIAL_INTRADAY_DATA`) for `market.resample(...)` to
   *  have anything to aggregate; every other step keeps using the default daily-spaced one. */
  data?: Candle[];
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
    title: "Étape 7 — Enregistrer votre script",
    paragraphs: [
      "Dans le vrai éditeur (pas cette démo), Ctrl+S (ou le bouton « Enregistrer ») sauvegarde le code. La toute première fois, ça demande un nom (Script 1, ça manque un peu de panache — appelez-le « Croisement SMA » par exemple) ; les fois suivantes, Ctrl+S enregistre directement sans redemander. « Enregistrer sous » permet de renommer/dupliquer à tout moment. Une fois enregistré, le script apparaît automatiquement dans le sélecteur d'indicateurs, sous « Mes scripts » — comme n'importe quel RSI ou MACD intégré.",
      "Vous savez maintenant écrire un indicateur complet à partir d'une seule chart. Passons à un exemple nettement plus avancé, qui combine tout ce que vous venez d'apprendre avec une capacité que vous n'avez pas encore vue : lire plusieurs timeframes à la fois, pour construire un vrai tableau de corrélation RSI multi-timeframe.",
    ],
  },
  {
    id: "resample",
    title: "Étape 8 — Lire un autre timeframe : market.resample",
    paragraphs: [
      "Jusqu'ici, market.* n'a jamais lu que les bougies affichées sur la chart (ici, des bougies de 5 minutes). market.resample(interval) regroupe ces mêmes bougies en bougies plus larges — 15 minutes, 1 heure, 4 heures, 1 jour — et retourne un objet avec exactement les mêmes fonctions que market.* lui-même (close, series, …), mais lues sur ce timeframe agrégé.",
      "Ce n'est pas une nouvelle source de données : cette bibliothèque ne va rien chercher ailleurs, elle recalcule simplement des bougies plus larges à partir de celles déjà là — exactement ce qui se passerait si vous changiez l'intervalle de la chart elle-même.",
    ],
    diagramKey: "resample",
    code: `const h4 = market.resample("4h");\nplot.line("Clôture 4H", h4.close(0));\n`,
    data: SCRIPT_TUTORIAL_INTRADAY_DATA,
  },
  {
    id: "resample-loop",
    title: "Étape 9 — Répéter pour les cinq timeframes",
    paragraphs: [
      "L'objectif : le RSI de 1J, 4H, 1H, 15min et 5min, tous à la fois. Plutôt que d'écrire cinq fois le même calcul, un tableau de timeframes et .map() : pour chacun, market.resample(tf.interval) donne les bougies de ce timeframe, ta.rsi(...) calcule son RSI.",
      "rows est maintenant un tableau de cinq { label, rsi } — un par timeframe, prêt à être affiché à l'étape suivante.",
    ],
    code: `// label : ce qui s'affichera dans le tableau. interval : ce que market.resample() attend.
const timeframes = [
  { label: "1J", interval: "1d" },
  { label: "4H", interval: "4h" },
  { label: "1H", interval: "1h" },
  { label: "15min", interval: "15m" },
  { label: "5min", interval: "5m" },
];

const rows = timeframes.map((tf) => {
  const tfMarket = market.resample(tf.interval);
  const rsi = ta.rsi(tfMarket.series("close", 60), 14);
  return { label: tf.label, rsi };
});

// Juste pour vérifier au passage : le RSI du plus grand timeframe (1J), dans son propre panneau.
plot.line("RSI 1J (contrôle)", rows[0].rsi ?? 50);
`,
    data: SCRIPT_TUTORIAL_INTRADAY_DATA,
  },
  {
    id: "plot-table",
    title: "Étape 10 — Construire le tableau avec plot.table",
    paragraphs: [
      "Pour chaque ligne, un signal simple selon des seuils : RSI ≥ 60 → \"BUY\" (survendu... non, sur-acheté, momentum haussier), RSI ≤ 40 → \"SELL\", entre les deux → \"WAIT\". La couleur de la ligne suit le même signal, pour un coup d'œil immédiat.",
      "plot.table(rows, options) affiche ensuite tout ça ancré en haut à droite de la chart — appelé sans condition à chaque bougie (pas de bar.isNew() ici), puisque seul le dernier appel compte : la chart affiche toujours la version la plus récente, jamais un historique de tableaux empilés.",
    ],
    diagramKey: "plotTable",
    code: `const timeframes = [
  { label: "1J", interval: "1d" },
  { label: "4H", interval: "4h" },
  { label: "1H", interval: "1h" },
  { label: "15min", interval: "15m" },
  { label: "5min", interval: "5m" },
];

const rows = timeframes.map((tf) => {
  const tfMarket = market.resample(tf.interval);
  const rsi = ta.rsi(tfMarket.series("close", 60), 14);

  // Seuils simples : au-dessus de 60 on penche haussier, en dessous de 40 baissier, sinon on attend.
  let signal = "WAIT";
  if (rsi !== null) {
    if (rsi >= 60) signal = "BUY";
    else if (rsi <= 40) signal = "SELL";
  }
  const color = signal === "BUY" ? "#3ea377" : signal === "SELL" ? "#e8391c" : undefined;

  return { cells: [tf.label, rsi !== null ? rsi.toFixed(1) : "—", signal], color };
});

plot.table(rows, { title: "RSI multi-timeframe", columns: ["Timeframe", "RSI", "Signal"] });
`,
    data: SCRIPT_TUTORIAL_INTRADAY_DATA,
  },
  {
    id: "confluence",
    title: "Étape 11 — Détecter la confluence et alerter",
    paragraphs: [
      "Dernière pièce : si les cinq timeframes suggèrent tous BUY (ou tous SELL), c'est une vraie confluence — bien plus fiable qu'un seul timeframe isolé. .every(...) vérifie que toutes les lignes sont d'accord ; le titre du tableau reflète ce verdict global, et un signal + une alerte se déclenchent une seule fois (bar.isNew()) au moment où la confluence apparaît.",
      "C'est un indicateur multi-timeframe complet : cinq RSI calculés sur cinq timeframes différents à partir d'une seule chart, affichés en tableau, avec une détection de confluence — le tout en une trentaine de lignes commentées.",
    ],
    code: `const timeframes = [
  { label: "1J", interval: "1d" },
  { label: "4H", interval: "4h" },
  { label: "1H", interval: "1h" },
  { label: "15min", interval: "15m" },
  { label: "5min", interval: "5m" },
];

const rows = timeframes.map((tf) => {
  const tfMarket = market.resample(tf.interval);
  const rsi = ta.rsi(tfMarket.series("close", 60), 14);
  let signal = "WAIT";
  if (rsi !== null) {
    if (rsi >= 60) signal = "BUY";
    else if (rsi <= 40) signal = "SELL";
  }
  const color = signal === "BUY" ? "#3ea377" : signal === "SELL" ? "#e8391c" : undefined;
  return { cells: [tf.label, rsi !== null ? rsi.toFixed(1) : "—", signal], color };
});

// Confluence = les CINQ timeframes d'accord entre eux, pas juste la majorité.
const allBuy = rows.every((r) => r.cells[2] === "BUY");
const allSell = rows.every((r) => r.cells[2] === "SELL");
const overall = allBuy ? "BUY" : allSell ? "SELL" : "WAIT";

// Le titre du tableau affiche toujours le verdict global, même quand il vaut WAIT.
plot.table(rows, { title: "RSI multi-timeframe — " + overall, columns: ["Timeframe", "RSI", "Signal"] });

// Un seul signal + une seule alerte au moment précis où la confluence apparaît, pas à chaque
// bougie où elle reste vraie.
if (bar.isNew() && overall !== "WAIT") {
  plot.signal({ type: overall, text: overall });
  alert("Confluence RSI multi-timeframe : " + overall);
}
`,
    data: SCRIPT_TUTORIAL_INTRADAY_DATA,
  },
  {
    id: "wrap-up",
    title: "Étape 12 — Pour aller plus loin",
    paragraphs: [
      "Vous venez de construire deux indicateurs complets : un croisement de moyennes mobiles, puis un tableau de confluence RSI multi-timeframe — les deux s'appuient sur exactement les mêmes briques (market.*, ta.*, state.*, plot.*, bar.isNew()), combinées différemment. C'est tout ce dont la plupart des indicateurs ont besoin.",
    ],
    list: [
      "chart.indicator(id) permet de lire un indicateur déjà présent sur la chart (un RSI, un MACD…) plutôt que de tout recalculer soi-même — voir chart.* plus bas.",
      "ta.* calcule des indicateurs techniques usuels (RSI, MACD, Bollinger, stochastique…) à la demande, sans avoir à les ajouter visuellement à la chart — voir ta.* plus bas.",
      "La section « Exemples » plus bas contient six scripts complets prêts à copier, chacun dans un style différent (score composite, rupture de bande, détecteur de volume…).",
      "Chaque section qui suit détaille exhaustivement une famille de fonctions (market.*, chart.*, plot.*, state.*, bar.*, math.*, ta.*) — c'est la référence complète, à consulter au fur et à mesure des besoins plutôt qu'à lire d'un bloc.",
    ],
  },
];
