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

/** One selectable tutorial track — `ScriptInteractiveTutorial.tsx` shows a small tab strip above
 *  the step pills to switch between tracks, resetting to that track's own step 1 on switch. Each
 *  track is a fully independent narrative with its own step numbering (a track's own steps start
 *  back at "Étape 1"), not a continuation of the other. */
export interface ScriptTutorialTrack {
  id: string;
  title: string;
  steps: ScriptTutorialStep[];
}

const INDICATOR_TRACK_STEPS: ScriptTutorialStep[] = [
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
    id: "cell-mode",
    title: "Étape 7 — Le mode cellules (façon Jupyter)",
    paragraphs: [
      "Vous venez de construire cet indicateur pas à pas, une étape du tutoriel à la fois. Le même principe existe à l'intérieur d'un seul script, via le mode cellules : un commentaire // %% en début de ligne délimite une « cellule », et Maj+Entrée (ou le bouton « Exécuter la cellule ») exécute le script depuis le tout début jusqu'à la fin de la cellule où se trouve le curseur — pas le script entier, et pas non plus cette seule cellule isolée (ce moteur n'a pas de mémoire de variables entre deux exécutions, donc une cellule isolée qui lirait une variable définie plus haut échouerait aussitôt).",
      "Essayez : placez le curseur dans la Cellule 1 ci-contre et appuyez sur Maj+Entrée — seules les deux moyennes mobiles s'affichent. Curseur dans la Cellule 2, Maj+Entrée : rien de plus ne s'affiche (elle ne fait que mémoriser une valeur), mais le calcul a bien eu lieu. Curseur dans la Cellule 3, Maj+Entrée : le croisement est enfin détecté, les flèches BUY/SELL apparaissent — exactement le résultat de l'étape précédente, obtenu cette fois cellule par cellule à l'intérieur d'un seul script plutôt qu'étape par étape dans ce tutoriel.",
    ],
    code: `// %% Cellule 1 — les deux moyennes mobiles
const sma20 = math.sma(market.series("close", 20), 20);
const sma5 = math.sma(market.series("close", 5), 5);
plot.overlay("SMA 20", sma20 ?? market.close(0));
plot.overlay("SMA 5", sma5 ?? market.close(0));

// %% Cellule 2 — mémoriser la bougie précédente
const prevSma20 = state.get("prevSma20", null);
const prevSma5 = state.get("prevSma5", null);
state.set("prevSma20", sma20);
state.set("prevSma5", sma5);

// %% Cellule 3 — détecter le croisement
if (bar.isNew() && prevSma5 !== null && prevSma20 !== null && sma5 !== null && sma20 !== null) {
  if (prevSma5 <= prevSma20 && sma5 > sma20) plot.signal({ type: "BUY", text: "BUY" });
  if (prevSma5 >= prevSma20 && sma5 < sma20) plot.signal({ type: "SELL", text: "SELL" });
}
`,
  },
  {
    id: "save-and-more",
    title: "Étape 8 — Enregistrer votre script",
    paragraphs: [
      "Dans le vrai éditeur (pas cette démo), Ctrl+S (ou le bouton « Enregistrer ») sauvegarde le code. La toute première fois, ça demande un nom (Script 1, ça manque un peu de panache — appelez-le « Croisement SMA » par exemple) ; les fois suivantes, Ctrl+S enregistre directement sans redemander. « Enregistrer sous » permet de renommer/dupliquer à tout moment. Une fois enregistré, le script apparaît automatiquement dans le sélecteur d'indicateurs, sous « Mes scripts » — comme n'importe quel RSI ou MACD intégré.",
      "Vous savez maintenant écrire un indicateur complet à partir d'une seule chart. Passons à un exemple nettement plus avancé, qui combine tout ce que vous venez d'apprendre avec une capacité que vous n'avez pas encore vue : lire plusieurs timeframes à la fois, pour construire un vrai tableau de corrélation RSI multi-timeframe.",
    ],
  },
  {
    id: "resample",
    title: "Étape 9 — Lire un autre timeframe : market.resample",
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
    title: "Étape 10 — Répéter pour les cinq timeframes",
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
    title: "Étape 11 — Construire le tableau avec plot.table",
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
    title: "Étape 12 — Détecter la confluence et alerter",
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
    title: "Étape 13 — Pour aller plus loin",
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

const MATH_TRACK_STEPS: ScriptTutorialStep[] = [
  {
    id: "square",
    title: "Étape 1 — Une fonction simple : le carré",
    paragraphs: [
      "Un script peut tracer n'importe quelle fonction mathématique, pas seulement des indicateurs de trading — pratique pour comprendre comment une formule se comporte réellement, sans quitter la chart. Ici, t est simplement un compteur qui avance d'une unité à chaque bougie (state.*, déjà vu dans le premier tutoriel), remis à zéro tous les 40 pas pour rester lisible à l'écran.",
      "square est une lambda — une fonction fléchée (x) => expression, la façon la plus courte d'écrire une fonction en JavaScript. Le résultat tracé : une parabole, exactement la forme attendue de x².",
    ],
    code: `// Une lambda : une fonction fléchée, la façon la plus courte d'écrire une fonction en JS.
const square = (x) => x * x;

// t avance de 1 à chaque bougie, et repart de 0 tous les 40 pas pour rester lisible à l'écran.
const t = state.get("t", 0);
state.set("t", (t + 1) % 40);

plot.line("x²", square(t));
`,
  },
  {
    id: "affine",
    title: "Étape 2 — Fonction affine (y = ax + b)",
    paragraphs: [
      "Une fonction affine est une droite : a est la pente (à quelle vitesse ça monte), b l'ordonnée à l'origine (la valeur de départ, à x = 0). a et b sont ici des paramètres par défaut de la lambda — exactement comme n'importe quelle fonction JavaScript peut en avoir.",
    ],
    code: `const affine = (x, a = 0.5, b = 10) => a * x + b;

const t = state.get("t", 0);
state.set("t", (t + 1) % 40);

plot.line("Affine", affine(t));
`,
  },
  {
    id: "logarithm",
    title: "Étape 3 — Fonction logarithmique",
    paragraphs: [
      "math.log(x) est le logarithme népérien — croissance rapide au début, puis de plus en plus lente, jamais de valeur pour x ≤ 0 (d'où le +1, pour éviter log(0) au tout premier pas, quand t vaut encore 0).",
    ],
    code: `const logFn = (x) => math.log(x + 1) * 10;

const t = state.get("t", 0);
state.set("t", (t + 1) % 60);

plot.line("Log", logFn(t));
`,
  },
  {
    id: "gaussian",
    title: "Étape 4 — Courbe de Gauss (la cloche)",
    paragraphs: [
      "La formule de la loi normale : un pic centré sur mu, plus ou moins large selon sigma. Les deux sont eux-mêmes des paramètres par défaut de la lambda (x, mu = 20, sigma = 8) — même mécanique que a/b à l'étape affine.",
      "×100 uniquement pour agrandir l'échelle à l'écran (Math.exp(...) seul reste toujours entre 0 et 1) — un choix purement visuel, pas mathématique.",
    ],
    code: `const gaussian = (x, mu = 20, sigma = 8) => Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2));

const t = state.get("t", 0);
state.set("t", (t + 1) % 40);

plot.line("Cloche de Gauss", gaussian(t) * 100);
`,
  },
  {
    id: "derivative",
    title: "Étape 5 — La dérivée : la pente d'une courbe réelle",
    paragraphs: [
      "Assez de courbes abstraites — la dérivée numérique s'applique très concrètement au vrai prix : combien il a changé d'une bougie à l'autre, sa « vitesse ». Positive, le prix monte ; négative, il baisse ; proche de zéro, il stagne.",
      "C'est littéralement market.close(0) - market.close(1) — pas besoin d'une formule savante, la dérivée numérique la plus simple est juste une différence entre deux valeurs consécutives.",
    ],
    code: `const price = market.close(0);
const prevPrice = market.close(1);
const derivative = prevPrice !== null ? price - prevPrice : 0;

plot.line("Dérivée du prix", derivative);
`,
  },
  {
    id: "band",
    title: "Étape 6 — Remplir entre deux courbes : une enveloppe maison",
    paragraphs: [
      "Les briques déjà vues (lambdas, écart-type) suffisent à construire une vraie enveloppe de volatilité : moyenne mobile ± 2 écarts-types. plot.bandOverlay colore directement la surface entre les deux courbes — voir plot.* plus bas pour le détail complet de cette fonction.",
      "lineWidth: 3 épaissit aussi la moyenne mobile elle-même, pour bien la distinguer des bords de l'enveloppe.",
    ],
    code: `const closes = market.series("close", 20);
const sma = math.sma(closes, 20);
const std = math.std(closes);

const upper = sma !== null && std !== null ? sma + 2 * std : market.close(0);
const lower = sma !== null && std !== null ? sma - 2 * std : market.close(0);

plot.bandOverlay("Enveloppe", upper, lower, { color: "#3ea377" });
plot.overlay("Moyenne", sma ?? market.close(0), { lineWidth: 3 });
`,
  },
  {
    id: "matrix",
    title: "Étape 7 — Une matrice : corrélation du RSI entre timeframes",
    paragraphs: [
      "Une matrice, en JavaScript, c'est juste un tableau de tableaux — rien de plus exotique que ça. Ici : cinq séries de clôtures (une par timeframe, via market.resample déjà vu dans le tutoriel précédent), puis une matrice 5×5 où la case [i][j] est la corrélation entre la série i et la série j (toujours 1 sur la diagonale : une série est parfaitement corrélée à elle-même).",
      "math.correlation(a, b) fait tout le calcul ; deux .map() imbriqués (un pour les lignes, un pour les colonnes) suffisent à construire la matrice entière. plot.table affiche le résultat exactement comme un vrai tableau de nombres. 20 points par série (pas plus) : le timeframe le plus large (1J) n'en a pas beaucoup plus au total sur cette démo — math.correlation a besoin de deux séries de même longueur pour comparer les mêmes 20 points partout, sans quoi la comparaison n'aurait pas de sens.",
    ],
    code: `const timeframes = ["1d", "4h", "1h", "15m", "5m"];
const labels = ["1J", "4H", "1H", "15min", "5min"];

// Une série de clôtures par timeframe — market.resample déjà vu dans le tutoriel précédent.
// Même longueur (20) pour les cinq, sans quoi math.correlation comparerait des séries de tailles
// différentes et ne saurait pas quels points associer entre eux.
const closesByTf = timeframes.map((tf) => market.resample(tf).series("close", 20));

// La matrice : un tableau de tableaux — matrix[i][j] = corrélation entre la série i et la série j.
const matrix = closesByTf.map((seriesA) => closesByTf.map((seriesB) => math.correlation(seriesA, seriesB)));

const rows = matrix.map((row, i) => ({
  cells: [labels[i], ...row.map((c) => (c !== null ? c.toFixed(2) : "—"))],
}));

plot.table(rows, { title: "Corrélation RSI (matrice)", columns: ["", ...labels] });
`,
    data: SCRIPT_TUTORIAL_INTRADAY_DATA,
  },
  {
    id: "math-wrap-up",
    title: "Étape 8 — Pour aller plus loin",
    paragraphs: [
      "Ces sept fonctions (carré, affine, logarithme, gaussienne, dérivée, remplissage entre deux courbes, matrice) couvrent l'essentiel de ce dont un script mathématique a besoin — le reste n'est que des combinaisons des mêmes briques.",
    ],
    list: [
      "math.* (plus bas) couvre déjà l'écart-type, la variance, la covariance, le z-score, les percentiles — pas besoin de les réécrire à la main.",
      "Toute fonction JavaScript standard (Math.sin, Math.cos, Math.tan, Math.pow, Math.abs…) est utilisable telle quelle dans un script — Math lui-même n'est jamais neutralisé par le bac à sable (voir « Sécurité et limites » plus bas).",
      "Le premier parcours de ce tutoriel (« Construire un indicateur ») applique ces mêmes idées à des signaux de trading concrets, si ce n'est pas déjà fait.",
    ],
  },
];

export const SCRIPT_TUTORIAL_TRACKS: ScriptTutorialTrack[] = [
  { id: "indicator", title: "Construire un indicateur", steps: INDICATOR_TRACK_STEPS },
  { id: "math", title: "Fonctions mathématiques", steps: MATH_TRACK_STEPS },
];
