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
];
