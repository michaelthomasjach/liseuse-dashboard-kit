import type { Indicator } from "../interfaces/Indicator.interface";

export interface ScriptExample {
  id: string;
  title: string;
  description: string;
  code: string;
  /** Indicators the live preview chart carries so `chart.indicator(id)` inside `code` resolves to
   *  something real instead of the all-`null` "unknown id" handle — see `useScriptEngine`'s own
   *  `indicators` argument doc. Only the "Quant Score" example needs this (it reads an existing
   *  RSI/MACD off the chart rather than computing them itself via `ta.*`); every other example
   *  computes everything on demand and needs none. */
  indicators?: Indicator[];
}

/** The "Exemples" section's own six complete, runnable scripts — migrated out of
 *  `scriptApiReference.ts`'s former static `h()`/`t()`/`c()` blocks (same "plain data, no JSX"
 *  convention as `scriptTutorialSteps.ts`) so `ScriptExampleRunner.tsx` can give each one a real
 *  "Exécuter" button and a live chart underneath instead of just syntax-highlighted text — exigence
 *  : « je veux pouvoir exécuter les scripts d'exemples... et avoir la chart qui apparaît sous les
 *  scripts respectifs ». Every example's own code is unchanged from the original static text. */
export const SCRIPT_EXAMPLES: ScriptExample[] = [
  {
    id: "quant-score",
    title: "Quant Score — RSI + MACD + moyenne mobile",
    description:
      "Combine RSI, MACD et une moyenne mobile en un score de 0 à 3, tracé dans son propre panneau, avec un signal d'achat quand les trois conditions sont réunies :",
    indicators: [
      { id: "example-rsi", kind: "rsi", period: 14 },
      { id: "example-macd", kind: "macd", period: 0, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    ],
    code: `// Lit un RSI et un MACD déjà présents sur la chart plutôt que de les recalculer ici —
// voir "Indicateurs disponibles" dans l'éditeur pour les identifiants réels de votre chart.
const rsi = chart.indicator("rsi").value(0);
const macdHist = chart.indicator("macd").histogram(0);
const price = market.close(0);
const sma20 = math.sma(market.series("close", 20), 20);

// Un point par condition remplie : 0 à 3, jamais négatif.
let score = 0;
if (rsi !== null && rsi > 50) score += 1;          // momentum haussier
if (macdHist !== null && macdHist > 0) score += 1; // MACD au-dessus de son signal
if (sma20 !== null && price > sma20) score += 1;   // prix au-dessus de sa moyenne 20

// Le score dans son propre panneau, la moyenne mobile superposée au prix.
plot.pane("Quant Score").line("Quant Score", score);
plot.overlay("SMA 20").line("SMA 20", sma20 ?? price);

// Un seul signal par bougie (bar.isNew()), uniquement quand les trois conditions sont réunies.
if (bar.isNew() && score === 3) {
  plot.signal("BUY");
  alert("Quant Score au maximum (3/3)");
}`,
  },
  {
    id: "golden-death-cross",
    title: "Croisement de moyennes mobiles (Golden / Death Cross)",
    description:
      "SMA 50 et SMA 200 tracées en superposition, avec un signal et une alerte au moment exact où la courte croise la longue — la valeur précédente de chaque moyenne est mémorisée via state.* pour détecter le croisement, pas recalculée à côté.",
    code: `const shortMA = math.sma(market.series("close", 50), 50);
const longMA = math.sma(market.series("close", 200), 200);
// La valeur des deux moyennes à la bougie PRÉCÉDENTE — nécessaire pour détecter le moment exact
// du croisement (avant/après), pas juste "laquelle est au-dessus en ce moment".
const prevShort = state.get("prevShort", null);
const prevLong = state.get("prevLong", null);

plot.overlay("SMA 50").line("SMA 50", shortMA ?? market.close(0));
plot.overlay("SMA 200").line("SMA 200", longMA ?? market.close(0));

// Croisement = la courte était en dessous (ou égale) avant, et est au-dessus maintenant (ou l'inverse).
if (bar.isNew() && prevShort !== null && prevLong !== null && shortMA !== null && longMA !== null) {
  if (prevShort <= prevLong && shortMA > longMA) {
    plot.signal("BUY");
    alert("Golden Cross : SMA 50 croise SMA 200 à la hausse");
  }
  if (prevShort >= prevLong && shortMA < longMA) {
    plot.signal("SELL");
    alert("Death Cross : SMA 50 croise SMA 200 à la baisse");
  }
}

// Mémorise la valeur de cette bougie pour que la PROCHAINE puisse à son tour la lire comme "prev*".
state.set("prevShort", shortMA);
state.set("prevLong", longMA);`,
  },
  {
    id: "bollinger-breakout",
    title: "Rupture des bandes de Bollinger",
    description: "Bandes tracées en superposition ; signal quand le prix clôture au-delà de l'une des deux bandes :",
    code: `// Calculé "à la volée" via ta.* — pas besoin d'avoir ajouté de Bollinger à la chart.
const bb = ta.bollinger(market.series("close", 60), 20, 2);
const price = market.close(0);

// null tant qu'il n'y a pas encore 20 clôtures d'historique (période de chauffe) — on ne trace
// et ne signale rien avant que le calcul ait un sens.
if (bb) {
  plot.overlay("Bollinger").band("Bollinger", bb.upper, bb.lower);

  // Rupture = clôture strictement au-delà d'une des deux bandes.
  if (bar.isNew() && price > bb.upper) {
    plot.signal("SELL");
    alert("Prix au-dessus de la bande de Bollinger supérieure");
  }
  if (bar.isNew() && price < bb.lower) {
    plot.signal("BUY");
    alert("Prix en dessous de la bande de Bollinger inférieure");
  }
}`,
  },
  {
    id: "volume-spike",
    title: "Détecteur de pic de volume",
    description: "Marque la bougie courante quand son volume dépasse la moyenne + 2 écarts-types des 20 dernières bougies :",
    code: `const volumes = market.series("volume", 20);
const avgVolume = math.mean(volumes);
const stdVolume = math.std(volumes);
const currentVolume = market.volume(0);

// Seuil statistique plutôt qu'un chiffre fixe : "anormalement haut" dépend de l'instrument
// (un volume de 1M peut être énorme pour l'un, minuscule pour un autre).
if (bar.isNew() && avgVolume !== null && stdVolume !== null && currentVolume !== null) {
  if (currentVolume > avgVolume + 2 * stdVolume) {
    plot.point(market.close(0), { color: "#e8391c", shape: "pin" });
    alert("Pic de volume détecté (> moyenne + 2 écarts-types)");
  }
}`,
  },
  {
    id: "momentum-score",
    title: "Score de momentum (RSI + Stochastique)",
    description: "Une deuxième variante de score composite, indépendante du Quant Score ci-dessus — combine RSI et l'oscillateur stochastique plutôt que MACD :",
    code: `const closes = market.series("close", 60);
const highs = market.series("high", 60);
const lows = market.series("low", 60);

const rsi = ta.rsi(closes, 14);
const stoch = ta.stochastic(highs, lows, closes, 14, 3);

// Même principe de score que le Quant Score plus haut, mais avec deux indicateurs différents —
// preuve que le score composite n'est pas lié à une combinaison précise d'indicateurs.
let score = 0;
if (rsi !== null && rsi > 55) score += 1;                  // RSI franchement au-dessus du milieu
if (stoch !== null && stoch.k > stoch.d) score += 1;        // %K au-dessus de sa ligne de signal
if (stoch !== null && stoch.k < 80) score += 1;             // évite la zone de surachat extrême

plot.pane("Momentum Score").line("Momentum Score", score);

if (bar.isNew() && score === 3) {
  alert("Score de momentum au maximum (3/3)");
}`,
  },
  {
    id: "donchian-channel",
    title: "Canal de rupture",
    description: "Un canal de type Donchian — plus haut et plus bas glissants — avec un signal quand le prix clôture hors du canal :",
    code: `const period = 20;
// Le plus haut plus haut et le plus bas plus bas des 20 dernières bougies — le canal lui-même.
const upperChannel = math.max(market.series("high", period));
const lowerChannel = math.min(market.series("low", period));
const price = market.close(0);

plot.overlay("Canal").band("Canal", upperChannel ?? price, lowerChannel ?? price);

// Rupture = clôture qui égale ou dépasse une borne du canal (>= / <=, pas > / < : toucher la
// borne compte déjà comme une rupture, pas seulement la dépasser).
if (bar.isNew() && upperChannel !== null && price >= upperChannel) {
  plot.signal("BUY");
  alert("Rupture du canal des " + period + " dernières bougies (plus haut)");
}
if (bar.isNew() && lowerChannel !== null && price <= lowerChannel) {
  plot.signal("SELL");
  alert("Rupture du canal des " + period + " dernières bougies (plus bas)");
}`,
  },
  {
    id: "kde-support-resistance",
    title: "Niveaux de support/résistance (KDE gaussienne)",
    description:
      "Un profil de marché lissé par noyau gaussien (bandwidth adapté à l'ATR), dont les pics deviennent des niveaux de support/résistance affichés dans une pane ancrée à droite (plot.pane(..., { dock: \"right\" })) — recalculé tous les RECALC_EVERY bougies pour rester sous le budget d'exécution, avec un signal au moment exact où le prix franchit un niveau. Les dix constantes de la cellule 1 sont déclarées avec new Variable(type, défaut) : elles apparaissent dans la fenêtre de réglages (celle de l'éditeur comme celle de la pane), se règlent sans toucher au code, et toute tentative de les réaffecter ailleurs dans le script est signalée comme une erreur. Le détail pas-à-pas de cette construction est dans le tutoriel « Niveaux de support/résistance (KDE) » plus haut :",
    code: `@description "///Niveaux de support/résistance///
Un **profil de marché** lissé par un noyau gaussien. Plutôt que de compter combien de fois le prix
a visité chaque palier, chaque clôture est étalée en une petite cloche, et toutes les cloches sont
additionnées : le profil obtenu est *continu* au lieu d'être en escalier.

//Ce que le script affiche//
Le profil lui-même est dessiné dans la pane de droite, **tourné d'un quart de tour** : les prix en
vertical, alignés sur ceux du graphe principal, et la densité qui s'étend horizontalement. Chaque
bosse est donc à la hauteur exacte du prix qu'elle désigne.

Les pics de ce profil sont les niveaux de __support et de résistance__ : une flèche BUY/SELL se
pose dès qu'une clôture en franchit un.

//Les réglages qui comptent//
**ATR_MULT** élargit ou resserre les cloches : plus haut, moins de niveaux, mais plus robustes.

**PROM_THRESH** écarte les pics trop plats.

**RECALC_EVERY** espace les recalculs — le profil complet coûte cher, et les niveaux ne bougent
--pratiquement jamais-- d'une bougie à l'autre.
"

// %% Cellule 1 — paramètres réglables et détection de pics
// new Variable(type, défaut, { description }) expose la constante dans la fenêtre de réglages :
// on peut la régler sans rouvrir le code, et le script se relance tout seul à chaque changement.
// La description s'affiche sous le champ correspondant.
const WINDOW = new Variable("number", 60, {
  description: "Nombre de bougies (les plus récentes) utilisées pour construire le profil — la fenêtre glissante sur laquelle tout le reste du calcul travaille.",
  min: 10,
});
const GRID = new Variable("number", 60, {
  description:
    "Nombre de niveaux de prix échantillonnés entre le plus bas et le plus haut de la fenêtre. C'est le réglage qui pèse le plus sur la forme du profil : bas (quelques dizaines) donne un profil grossier à peu de pics larges, haut (une centaine ou plus) un profil fin capable de distinguer des pics rapprochés — deux profils avec les mêmes ATR_MULT/PROM_THRESH mais des GRID très différents n'auront pas du tout la même allure.",
  min: 5,
});
const FIRST_W = new Variable("number", 0.2, {
  description: "Poids de la bougie la plus ancienne de la fenêtre par rapport à la plus récente. Plus bas = le profil privilégie les prix récents.",
  min: 0,
  max: 1,
});
const ATR_MULT = new Variable("number", 0.3, {
  description:
    "Largeur du noyau gaussien posé sur chaque clôture, en multiples de l'ATR. Bas = noyaux étroits, profil détaillé à beaucoup de pics ; haut = noyaux larges, profil lissé à peu de pics mais plus robustes.",
  min: 0.05,
});
const GRID_PAD = new Variable("number", 2, {
  description:
    "Marge ajoutée de part et d'autre de la grille de prix, en multiples de la largeur du noyau — sans elle la densité resterait élevée jusqu'au bord et le profil ne redescendrait jamais vers zéro.",
  min: 0,
});
const PROM_THRESH = new Variable("number", 0.12, {
  description:
    "Hauteur minimale qu'un pic doit dépasser au-dessus de ses vallées voisines pour devenir un niveau, en fraction du pic le plus haut du profil. Bas = plus de niveaux détectés, y compris des pics mineurs ; haut = seuls les pics les plus marqués sont gardés.",
  min: 0,
  max: 1,
});
const RECALC_EVERY = new Variable("number", 1, {
  description: "Recalculer le profil toutes les N bougies plutôt qu'à chaque bougie. 1 = à chaque bougie ; plus haut = moins de calcul, mais le profil reste figé entre deux recalculs.",
  min: 1,
});
const PROFIL_COULEUR = new Variable("color", "#c47f2a", { description: "Couleur de la courbe du profil affichée dans la pane de droite." });
const AFFICHER_FLECHES = new Variable("boolean", true, { description: "Affiche les flèches BUY/SELL sur le graphique quand un niveau est franchi." });
// DEBOUNCE_MS est le seul nom que le moteur lit lui-même plutôt que de se contenter de le
// substituer dans le code compilé (voir la doc de useScriptEngine) : il règle le délai d'anti-
// rafale avant un recalcul déclenché par un tick de marché en direct qui ne fait que mettre à jour
// la bougie encore en formation. Sans effet sur le replay ou l'arrivée d'une nouvelle bougie, qui
// relancent toujours le script immédiatement, quelle que soit cette valeur.
const DEBOUNCE_MS = new Variable("number", 0, {
  description:
    "Délai (ms) avant de relancer le script suite à un tick de marché en direct sur la bougie déjà en formation. 0 = aucun anti-rafale, le script se relance à chaque tick.",
  min: 0,
});

function findPeaks(values, minProminence) {
  const peaks = [];
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] <= values[i - 1] || values[i] < values[i + 1]) continue;
    let leftMin = values[i];
    for (let j = i - 1; j >= 0 && values[j] <= values[i]; j--) leftMin = Math.min(leftMin, values[j]);
    let rightMin = values[i];
    for (let j = i + 1; j < values.length && values[j] <= values[i]; j++) rightMin = Math.min(rightMin, values[j]);
    if (values[i] - Math.max(leftMin, rightMin) >= minProminence) peaks.push(i);
  }
  return peaks;
}

// %% Cellule 2 — ne recalculer que tous les RECALC_EVERY bougies
const barIndex = state.get("barIndex", 0);
state.set("barIndex", barIndex + 1);

if (barIndex >= WINDOW && barIndex % RECALC_EVERY === 0) {
  const closes = market.series("close", WINDOW);
  const highs = market.series("high", WINDOW);
  const lows = market.series("low", WINDOW);
  const minP = Math.min(...closes);
  const maxP = Math.max(...closes);
  if (maxP > minP) {
    const atr = ta.atr(highs, lows, closes, 14);
    const bandwidth = (atr ?? 1) * ATR_MULT;
    const weights = closes.map((_, i) => FIRST_W + (i / closes.length) * (1 - FIRST_W));

    // La grille déborde de GRID_PAD largeurs de noyau de chaque côté des prix observés. Sans cette
    // marge elle s'arrête pile sur le dernier prix, là où la densité est encore élevée : le profil
    // ne redescend jamais vers zéro et la courbe reste décollée de l'axe.
    const pad = bandwidth * GRID_PAD;
    const gridLow = minP - pad;
    const gridHigh = maxP + pad;
    const step = (gridHigh - gridLow) / GRID;
    const priceGrid = [];
    for (let p = gridLow; p < gridHigh; p += step) priceGrid.push(p);

    const density = priceGrid.map((p) => {
      let sum = 0;
      for (let i = 0; i < closes.length; i++) {
        const z = (p - closes[i]) / bandwidth;
        sum += weights[i] * Math.exp(-0.5 * z * z);
      }
      return sum;
    });

    const peakIdx = findPeaks(density, Math.max(...density) * PROM_THRESH);
    state.set("levels", peakIdx.map((i) => priceGrid[i]));
    // Le profil complet est mémorisé lui aussi, pas seulement ses pics : c'est lui qu'on affiche.
    state.set("density", density);
    state.set("priceGrid", priceGrid);
  }
}

// %% Cellule 3 — afficher le profil, tourné, dans une pane ancrée à droite
// pane.profile(nom, valeurs, prix) prend les deux tableaux d'un coup, comme plot.xy : un profil
// n'est pas une série temporelle. Il est dessiné transposé — prix en vertical, densité en
// horizontal — sur l'échelle de prix du graphe principal, donc chaque bosse est exactement à la
// hauteur du prix qu'elle désigne.
const profilDensite = state.get("density", []);
const profilPrix = state.get("priceGrid", []);
plot.pane("Niveaux", { dock: "right" }).profile("Densité", profilDensite, profilPrix, { color: PROFIL_COULEUR });

// %% Cellule 4 — détecter un franchissement et signaler
// Les niveaux (les pics du profil) sont relus ici : la cellule 3 dessine le profil, celle-ci
// surveille les franchissements.
const levels = state.get("levels", []);
const prevClose = market.close(1);
const currClose = market.close(0);
if (prevClose !== null && currClose !== null) {
  let sig = state.get("sig", 0);
  const prevSig = sig;
  for (const level of levels) {
    if (currClose > level && prevClose <= level) sig = 1;
    else if (currClose < level && prevClose >= level) sig = -1;
  }
  if (sig !== prevSig && AFFICHER_FLECHES) {
    plot.signal({ type: sig > 0 ? "BUY" : "SELL", price: currClose });
  }
  state.set("sig", sig);
}`,
  },
];
