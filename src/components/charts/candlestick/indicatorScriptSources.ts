import type { IndicatorKind } from "./interfaces/IndicatorKind.interface";

/** The script equivalent of each built-in indicator — what the "</>" button next to a row in the
 *  "Ajouter un indicateur" picker shows (see IndicatorModals.tsx), and what "Ouvrir dans l'éditeur"
 *  drops into a brand-new script tab. Deliberately separate from INDICATOR_DESCRIPTIONS (prose for
 *  the "i" button) and from indicators.ts itself (the real implementation, TypeScript over the whole
 *  `Candle[]` at once rather than one bar at a time): this file's job is to answer "how would I
 *  write this myself?", so every snippet is written against the sandbox's own API exactly as a user
 *  would type it, and must actually run.
 *
 *  Two rules keep these honest, since a snippet that quietly diverges from the built-in it claims to
 *  reproduce is worse than no snippet at all:
 *
 *  - Each entry reproduces its indicator's *own* computation, matching indicators.ts's own
 *    `compute*Values` step for step (same warm-up, same formula, same defaults as
 *    INDICATOR_CATALOG). Where the engine genuinely cannot reach something the built-in draws — a
 *    value read from a *future* bar, or a shape `plot.*` has no method for — the snippet says so in
 *    a comment rather than silently approximating it.
 *  - A kind with no faithful script version has no entry here at all, and its row simply gets no
 *    "</>" button (same convention `descriptionKind` already follows for a custom indicator's own
 *    missing description). That covers "zigzag"/"supportResistance"/"patternRecognition"/
 *    "candleRecognition" (each detects its own structure by scanning bars on *both* sides of a
 *    candidate pivot), "gaps" (a shaded rectangle whose end is the future bar that fills it — no
 *    `plot.*` method draws a rectangle, and the fill bar hasn't happened yet), "tpo" (a session
 *    profile, never indexed bar by bar), "correlation" (needs a second symbol's price series, which
 *    no script API exposes) and "custom" (a caller's own indicator, which this library never had the
 *    source of in the first place).
 *
 *  Every snippet uses INDICATOR_COLORS' own palette (see indicatorCatalog.ts) so a script pasted
 *  from here lands on the chart looking like the indicator it came from, not in whatever automatic
 *  colour `plot.*` would otherwise have picked. */
export const INDICATOR_SCRIPT_SOURCES: Partial<Record<IndicatorKind, string>> = {
  sma: `@description "///Moyenne mobile simple///
La moyenne des N dernières clôtures, recalculée à chaque bougie."

const PERIODE = new Variable("number", 20, { description: "Nombre de bougies moyennées.", min: 1, max: 500 });

// math.sma renvoie null tant qu'il n'y a pas PERIODE clôtures — c'est la période de chauffe,
// exactement celle de l'indicateur intégré, qui ne trace rien avant sa Nième bougie.
const sma = math.sma(market.series("close", PERIODE), PERIODE);

if (sma !== null) {
  plot.overlay("SMA").line("SMA " + PERIODE, sma, { color: "#e0a95c" });
}`,

  ema: `@description "///Moyenne mobile exponentielle///
Comme la SMA, mais chaque nouvelle clôture pèse plus lourd que les précédentes."

const PERIODE = new Variable("number", 20, { description: "Constante de lissage : k = 2 / (période + 1).", min: 1, max: 500 });

// L'EMA a besoin de bien plus que PERIODE bougies pour converger (elle s'amorce sur une SMA puis
// se propage) — on lui en donne 5x, comme le fait l'indicateur intégré en repartant de la bougie 0.
const ema = math.ema(market.series("close", PERIODE * 5), PERIODE);

if (ema !== null) {
  plot.overlay("EMA").line("EMA " + PERIODE, ema, { color: "#6c87c9" });
}`,

  wma: `@description "///Moyenne mobile pondérée///
Les N dernières clôtures, pondérées linéairement : la plus récente compte N fois, la plus ancienne une seule."

const PERIODE = new Variable("number", 20, { description: "Nombre de bougies pondérées.", min: 1, max: 500 });

const closes = market.series("close", PERIODE);

// math.* n'a pas de WMA — la formule tient en trois lignes : somme des valeurs pondérées par leur
// rang, divisée par 1+2+...+N.
let wma = null;
if (closes.length === PERIODE) {
  const denom = (PERIODE * (PERIODE + 1)) / 2;
  let pondere = 0;
  for (let j = 0; j < PERIODE; j++) pondere += closes[j] * (j + 1);
  wma = pondere / denom;
}

if (wma !== null) {
  plot.overlay("WMA").line("WMA " + PERIODE, wma, { color: "#7fb37f" });
}`,

  vwap: `@description "///VWAP///
Le prix moyen depuis le début de l'historique, pondéré par les volumes échangés."

// Le VWAP intégré est cumulatif (pas fenêtré) : il repart de la toute première bougie et n'a donc
// aucune période de chauffe. state.* mémorise les deux cumuls d'une bougie à l'autre — et comme le
// moteur rejoue tout l'historique depuis la bougie 0 à chaque exécution, ils sont toujours complets.
const typique = (market.high(0) + market.low(0) + market.close(0)) / 3;
const volume = market.volume(0) ?? 0;

const cumulPV = state.get("cumulPV", 0) + typique * volume;
const cumulV = state.get("cumulV", 0) + volume;
state.set("cumulPV", cumulPV);
state.set("cumulV", cumulV);

if (cumulV > 0) {
  plot.overlay("VWAP").line("VWAP", cumulPV / cumulV, { color: "#c96c8f" });
}`,

  bollinger: `@description "///Bandes de Bollinger///
Une moyenne mobile encadrée par deux bandes posées à N écarts-types de part et d'autre."

const PERIODE = new Variable("number", 20, { description: "Fenêtre de la moyenne et de l'écart-type.", min: 2, max: 500 });
const ECARTS = new Variable("number", 2, { description: "Largeur des bandes, en écarts-types.", min: 0.1, max: 10 });

const closes = market.series("close", PERIODE);
const moyenne = math.sma(closes, PERIODE);
const ecart = closes.length === PERIODE ? math.std(closes) : null;

// .band trace les deux bandes, la médiane, et remplit entre les deux — le rendu exact de
// l'indicateur intégré, en un seul appel.
if (moyenne !== null && ecart !== null) {
  plot.overlay("Bollinger").band("Bollinger", moyenne + ECARTS * ecart, moyenne - ECARTS * ecart, { color: "#6c87c9" });
}`,

  atr: `@description "///Average True Range///
L'amplitude moyenne d'une bougie, gaps compris — une mesure de volatilité, pas de direction."

const PERIODE = new Variable("number", 14, { description: "Fenêtre de lissage de Wilder.", min: 1, max: 500 });

// ta.atr prend les trois séries séparément. L'ATR se lisse sur toute l'histoire disponible, on lui
// en donne largement plus que PERIODE pour que le lissage ait convergé.
const n = PERIODE * 5;
const atr = ta.atr(market.series("high", n), market.series("low", n), market.series("close", n), PERIODE);

if (atr !== null) {
  plot.pane("ATR").line("ATR " + PERIODE, atr, { color: "#e0a95c" });
}`,

  chop: `@description "///Choppiness Index///
Proche de 100, le marché piétine ; proche de 0, il avance en ligne droite."

const PERIODE = new Variable("number", 14, { description: "Fenêtre d'observation.", min: 2, max: 500 });

// Il faut une bougie de plus que PERIODE : le True Range de la première bougie de la fenêtre se
// calcule contre la clôture de celle d'avant.
const highs = market.series("high", PERIODE + 1);
const lows = market.series("low", PERIODE + 1);
const closes = market.series("close", PERIODE + 1);

if (highs.length === PERIODE + 1) {
  let sommeTR = 0;
  let plusHaut = -Infinity;
  let plusBas = Infinity;
  for (let i = 1; i <= PERIODE; i++) {
    const clotureAvant = closes[i - 1];
    sommeTR += Math.max(highs[i] - lows[i], Math.abs(highs[i] - clotureAvant), Math.abs(lows[i] - clotureAvant));
    plusHaut = Math.max(plusHaut, highs[i]);
    plusBas = Math.min(plusBas, lows[i]);
  }
  // Le rapport "distance parcourue / distance nette" : une somme de TR bien plus grande que
  // l'amplitude totale de la fenêtre = beaucoup d'agitation pour peu de chemin.
  const amplitude = plusHaut - plusBas;
  if (amplitude > 0) {
    const chop = (100 * Math.log10(sommeTR / amplitude)) / Math.log10(PERIODE);
    plot.pane("CHOP").line("CHOP " + PERIODE, chop, { color: "#9a7fd1" });
  }
}`,

  rsi: `@description "///Relative Strength Index///
Le rapport entre la force des hausses et celle des baisses sur N bougies, ramené sur une échelle de 0 à 100."

const PERIODE = new Variable("number", 14, { description: "Fenêtre de lissage de Wilder.", min: 2, max: 500 });

// Le lissage de Wilder se propage depuis la première bougie : on donne à ta.rsi bien plus que
// PERIODE clôtures pour qu'il ait convergé, comme le fait l'indicateur intégré sur tout l'historique.
const rsi = ta.rsi(market.series("close", PERIODE * 5), PERIODE);

if (rsi !== null) {
  const pane = plot.pane("RSI");
  pane.line("RSI " + PERIODE, rsi, { color: "#9a7fd1" });
  // Les deux seuils classiques. plot.horizontal pose un trait sur la bougie courante — appelé à
  // chaque bougie, il dessine une ligne continue d'un bout à l'autre du panneau.
  plot.horizontal(70, { color: "#c96c8f" });
  plot.horizontal(30, { color: "#7fb37f" });
}`,

  macd: `@description "///MACD///
L'écart entre deux moyennes exponentielles, sa propre moyenne (le signal), et la différence des deux (l'histogramme)."

const RAPIDE = new Variable("number", 12, { description: "Période de l'EMA rapide.", min: 1, max: 500 });
const LENTE = new Variable("number", 26, { description: "Période de l'EMA lente.", min: 1, max: 500 });
const SIGNAL = new Variable("number", 9, { description: "Période de l'EMA du signal.", min: 1, max: 500 });

const macd = ta.macd(market.series("close", LENTE * 5), RAPIDE, LENTE, SIGNAL);

// Les trois séries partagent un même panneau, donc une même échelle verticale — c'est ce qui rend
// l'histogramme lisible sous les deux lignes plutôt que dans un panneau à part.
if (macd && macd.macd !== null && macd.signal !== null) {
  const pane = plot.pane("MACD");
  pane.line("MACD", macd.macd, { color: "#6c87c9" });
  pane.line("Signal", macd.signal, { color: "#e0a95c" });
  pane.histogram("Histogramme", macd.histogram ?? 0, { color: "#7fb37f" });
}`,

  adx: `@description "///Average Directional Index///
La force de la tendance (ADX), et les deux pressions qui la composent : +DI à l'achat, -DI à la vente."

const PERIODE = new Variable("number", 14, { description: "Fenêtre DMI/ADX de Wilder.", min: 2, max: 500 });

const n = PERIODE * 6;
const adx = ta.adx(market.series("high", n), market.series("low", n), market.series("close", n), PERIODE);

// L'ADX ne dit jamais dans quel SENS va la tendance — seulement à quel point elle est marquée.
// C'est le croisement de +DI et -DI qui donne le sens, d'où les trois courbes sur un même panneau.
if (adx && adx.adx !== null) {
  const pane = plot.pane("ADX");
  pane.line("ADX", adx.adx, { color: "#e0a95c", lineWidth: 2 });
  pane.line("+DI", adx.plusDI, { color: "#7fb37f" });
  pane.line("-DI", adx.minusDI, { color: "#c96c8f" });
  plot.horizontal(25, { color: "#9a7fd1" });
}`,

  supertrend: `@description "///Supertrend///
Une bande posée à N ATR du prix, qui se resserre tant que la tendance tient et bascule de l'autre côté quand elle casse."

const PERIODE = new Variable("number", 10, { description: "Période de l'ATR.", min: 1, max: 500 });
const MULTIPLE = new Variable("number", 3, { description: "Distance des bandes, en multiples d'ATR.", min: 0.1, max: 20 });

const n = PERIODE * 5;
const atr = ta.atr(market.series("high", n), market.series("low", n), market.series("close", n), PERIODE);

if (atr !== null) {
  const median = (market.high(0) + market.low(0)) / 2;
  const brutHaut = median + MULTIPLE * atr;
  const brutBas = median - MULTIPLE * atr;

  // Toute la logique tient dans ces deux lignes : une bande ne peut que se RAPPROCHER du prix,
  // jamais s'en éloigner — sauf si la clôture précédente l'a franchie, auquel cas elle repart de
  // sa valeur brute. C'est ce cliquet qui fait que le Supertrend "colle" au prix en tendance.
  const precHaut = state.get("finalHaut", null);
  const precBas = state.get("finalBas", null);
  const clotureAvant = market.close(1) ?? market.close(0);

  const finalHaut = precHaut === null || brutHaut < precHaut || clotureAvant > precHaut ? brutHaut : precHaut;
  const finalBas = precBas === null || brutBas > precBas || clotureAvant < precBas ? brutBas : precBas;

  // La tendance ne bascule que sur un vrai franchissement de la bande OPPOSÉE — sinon elle se
  // reconduit telle quelle d'une bougie à l'autre.
  const precTendance = state.get("tendance", "up");
  let tendance;
  if (precHaut === null) tendance = market.close(0) >= finalBas ? "up" : "down";
  else if (precTendance === "up" && market.close(0) < finalBas) tendance = "down";
  else if (precTendance === "down" && market.close(0) > finalHaut) tendance = "up";
  else tendance = precTendance;

  state.set("finalHaut", finalHaut);
  state.set("finalBas", finalBas);
  state.set("tendance", tendance);

  // Une seule bande est tracée à la fois : celle qui soutient la tendance en cours.
  plot.overlay("Supertrend").line("Supertrend", tendance === "up" ? finalBas : finalHaut, {
    color: tendance === "up" ? "#7fb37f" : "#c96c8f",
  });

  if (bar.isNew() && tendance !== precTendance) {
    plot.signal({ type: tendance === "up" ? "BUY" : "SELL", text: "Supertrend" });
  }
}`,

  chandelierExit: `@description "///Chandelier Exit///
Deux stops suiveurs posés à N ATR du plus haut (ou du plus bas) de la fenêtre — un seul est actif à la fois."

const LONGUEUR = new Variable("number", 22, { description: "Fenêtre du plus haut / plus bas, et période de l'ATR.", min: 1, max: 500 });
const MULTIPLE = new Variable("number", 3, { description: "Distance des stops, en multiples d'ATR.", min: 0.1, max: 20 });
const SUR_CLOTURE = new Variable("boolean", false);

const n = LONGUEUR * 5;
const highs = market.series("high", n);
const lows = market.series("low", n);
const closes = market.series("close", n);
const atrBrut = ta.atr(highs, lows, closes, LONGUEUR);

if (atrBrut !== null) {
  const atr = MULTIPLE * atrBrut;
  // Le plus haut / plus bas des LONGUEUR dernières bougies — sur les extrêmes, ou sur les
  // clôtures si SUR_CLOTURE est coché (les mèches sont alors ignorées).
  const fenetreHaut = highs.slice(-LONGUEUR);
  const fenetreBas = lows.slice(-LONGUEUR);
  const fenetreClose = closes.slice(-LONGUEUR);
  const brutLong = Math.max(...(SUR_CLOTURE ? fenetreClose : fenetreHaut)) - atr;
  const brutShort = Math.min(...(SUR_CLOTURE ? fenetreClose : fenetreBas)) + atr;

  // Même cliquet que le Supertrend, mais conditionné à la clôture PRÉCÉDENTE : tant qu'elle est
  // restée du bon côté du stop, celui-ci ne peut que se resserrer ; sinon il repart de zéro.
  const precLong = state.get("stopLong", null) ?? brutLong;
  const precShort = state.get("stopShort", null) ?? brutShort;
  const clotureAvant = market.close(1);

  const stopLong = clotureAvant !== null && clotureAvant > precLong ? Math.max(brutLong, precLong) : brutLong;
  const stopShort = clotureAvant !== null && clotureAvant < precShort ? Math.min(brutShort, precShort) : brutShort;

  // Le sens ne change que sur un franchissement du stop opposé, et se reconduit sinon.
  const precSens = state.get("sens", 1);
  const sens = market.close(0) > precShort ? 1 : market.close(0) < precLong ? -1 : precSens;

  state.set("stopLong", stopLong);
  state.set("stopShort", stopShort);
  state.set("sens", sens);

  plot.overlay("Chandelier Exit").line("Chandelier Exit", sens === 1 ? stopLong : stopShort, {
    color: sens === 1 ? "#7fb37f" : "#c96c8f",
  });

  if (bar.isNew() && sens !== precSens) {
    plot.signal({ type: sens === 1 ? "BUY" : "SELL", text: "Chandelier" });
  }
}`,

  parabolicSar: `@description "///Parabolic SAR///
Un point de retournement qui se rapproche du prix de plus en plus vite tant que la tendance se prolonge."

const PAS = new Variable("number", 0.02, { description: "Incrément du facteur d'accélération à chaque nouvel extrême.", min: 0.001, max: 1 });
const MAX = new Variable("number", 0.2, { description: "Plafond du facteur d'accélération.", min: 0.001, max: 1 });

const haut = market.high(0);
const bas = market.low(0);
const hautAvant = market.high(1);
const basAvant = market.low(1);

// La première bougie amorce simplement l'état ; le calcul commence à la deuxième.
if (hautAvant === null) {
  state.set("sar", bas);
  state.set("ep", haut);
  state.set("af", PAS);
  state.set("haussier", true);
} else {
  let sar = state.get("sar", bas);
  let ep = state.get("ep", haut);
  let af = state.get("af", PAS);
  let haussier = state.get("haussier", true);

  // Le SAR avance vers l'extrême atteint (ep), d'une fraction af de la distance qui l'en sépare.
  sar = sar + af * (ep - sar);
  // Il ne peut jamais entrer dans le range des deux bougies précédentes : sinon il se ferait
  // toucher par un mouvement déjà passé.
  if (haussier) sar = Math.min(sar, basAvant, bas);
  else sar = Math.max(sar, hautAvant, haut);

  if (haussier && bas < sar) {
    // Retournement : le SAR repart de l'extrême haut atteint, l'accélération est remise à zéro.
    haussier = false;
    sar = ep;
    ep = bas;
    af = PAS;
  } else if (!haussier && haut > sar) {
    haussier = true;
    sar = ep;
    ep = haut;
    af = PAS;
  } else if (haussier && haut > ep) {
    // Nouvel extrême dans le sens de la tendance : on accélère, jusqu'au plafond.
    ep = haut;
    af = Math.min(af + PAS, MAX);
  } else if (!haussier && bas < ep) {
    ep = bas;
    af = Math.min(af + PAS, MAX);
  }

  state.set("sar", sar);
  state.set("ep", ep);
  state.set("af", af);
  state.set("haussier", haussier);

  // Un point par bougie plutôt qu'une ligne : le SAR saute d'un côté à l'autre du prix, une
  // courbe continue relierait deux points qui n'ont rien à voir l'un avec l'autre.
  plot.point(sar, { color: haussier ? "#7fb37f" : "#c96c8f", shape: "pin" });
}`,

  ichimoku: `@description "///Ichimoku Kinko Hyo///
Quatre lignes construites sur des milieux de range, décalées dans le temps pour dessiner un « nuage »."

const CONVERSION = new Variable("number", 9, { description: "Fenêtre de la Tenkan-sen (ligne de conversion).", min: 1, max: 500 });
const BASE = new Variable("number", 26, { description: "Fenêtre de la Kijun-sen (ligne de base).", min: 1, max: 500 });
const SPAN = new Variable("number", 52, { description: "Fenêtre de la Senkou Span B.", min: 1, max: 500 });
const DECALAGE = new Variable("number", 26, { description: "Décalage des deux Senkou Span, en bougies.", min: 0, max: 200 });

// Le milieu du range sur une fenêtre : (plus haut + plus bas) / 2. Toutes les lignes d'Ichimoku
// sont bâties dessus — jamais sur les clôtures, contrairement à une moyenne mobile.
function milieu(fenetre, recul) {
  const highs = market.series("high", fenetre + recul);
  const lows = market.series("low", fenetre + recul);
  if (highs.length < fenetre + recul) return null;
  const jusqua = highs.length - recul;
  const h = highs.slice(jusqua - fenetre, jusqua);
  const b = lows.slice(jusqua - fenetre, jusqua);
  return (Math.max(...h) + Math.min(...b)) / 2;
}

const tenkan = milieu(CONVERSION, 0);
const kijun = milieu(BASE, 0);
// Les deux Senkou sont calculées DECALAGE bougies plus tôt : c'est ce décalage qui projette le
// nuage en avant du prix sur un graphe classique.
const tenkanPassee = milieu(CONVERSION, DECALAGE);
const kijunPassee = milieu(BASE, DECALAGE);
const spanA = tenkanPassee !== null && kijunPassee !== null ? (tenkanPassee + kijunPassee) / 2 : null;
const spanB = milieu(SPAN, DECALAGE);

const overlay = plot.overlay("Ichimoku");
if (tenkan !== null) overlay.line("Tenkan-sen", tenkan, { color: "#6c87c9" });
if (kijun !== null) overlay.line("Kijun-sen", kijun, { color: "#c96c8f" });
// .band remplit entre les deux Senkou : c'est le nuage (Kumo) lui-même.
if (spanA !== null && spanB !== null) overlay.band("Kumo", spanA, spanB, { color: "#7fb37f" });

// La cinquième ligne, la Chikou Span, est la clôture reportée DECALAGE bougies en ARRIÈRE — donc
// lue depuis le futur à l'endroit où elle se dessine. Aucun script ne peut la tracer : le moteur
// interdit structurellement de lire une bougie postérieure à la bougie courante.`,

  pivotPoints: `@description "///Points Pivots///
Un jeu de niveaux figés pour toute la période, calculés sur le haut, le bas et la clôture de la période précédente."

// Les niveaux d'une journée (ou semaine, ou mois) se déduisent entièrement de la période
// PRÉCÉDENTE, et ne bougent plus ensuite — d'où l'escalier caractéristique de cet indicateur.
const date = market.time(0);
const cle = date.getUTCFullYear() + "-" + date.getUTCMonth() + "-" + date.getUTCDate();
const clePrecedente = state.get("cle", null);

// Un changement de clé = on vient d'entrer dans une nouvelle période : la période qui vient de
// s'achever devient la référence, et ses extrêmes en cours de constitution repartent de zéro.
if (clePrecedente !== null && cle !== clePrecedente) {
  state.set("refHaut", state.get("haut", null));
  state.set("refBas", state.get("bas", null));
  state.set("refCloture", state.get("cloture", null));
  state.set("haut", market.high(0));
  state.set("bas", market.low(0));
} else {
  state.set("haut", Math.max(state.get("haut", market.high(0)), market.high(0)));
  state.set("bas", Math.min(state.get("bas", market.low(0)), market.low(0)));
}
state.set("cle", cle);
state.set("cloture", market.close(0));

const haut = state.get("refHaut", null);
const bas = state.get("refBas", null);
const cloture = state.get("refCloture", null);

// La toute première période n'a rien avant elle : elle reste vide, comme la période de chauffe
// d'une moyenne mobile.
if (haut !== null && bas !== null && cloture !== null) {
  const amplitude = haut - bas;
  const pp = (haut + bas + cloture) / 3;
  const overlay = plot.overlay("Points Pivots");
  overlay.line("PP", pp, { color: "#e0a95c", lineWidth: 2 });
  overlay.line("R1", 2 * pp - bas, { color: "#c96c8f" });
  overlay.line("R2", pp + amplitude, { color: "#c96c8f", lineStyle: "dashed" });
  overlay.line("R3", haut + 2 * (pp - bas), { color: "#c96c8f", lineStyle: "dotted" });
  overlay.line("S1", 2 * pp - haut, { color: "#7fb37f" });
  overlay.line("S2", pp - amplitude, { color: "#7fb37f", lineStyle: "dashed" });
  overlay.line("S3", bas - 2 * (haut - pp), { color: "#7fb37f", lineStyle: "dotted" });
}

// Ci-dessus, le type « classique » et la période « quotidienne ». Les trois autres types de
// l'indicateur intégré ne changent que ces formules — Fibonacci pose R1/R2/R3 à 0,382 / 0,618 / 1
// fois l'amplitude au-dessus du pivot ; Woodie pondère la clôture double dans le pivot ;
// Camarilla place ses niveaux à 1,1/12, 1,1/6 et 1,1/4 d'amplitude de part et d'autre de la
// clôture. Pour une période hebdomadaire ou mensuelle, changez seulement la clé ci-dessus.`,
};

/** The eight fundamental indicators are all the same one-line script — a single reported metric,
 *  read at the current bar through `company.*` and drawn in its own pane — so they're generated
 *  rather than written out eight times. `field` is exactly the `IndicatorKind`, which is also the
 *  key `company.value()` itself takes (see `useScriptEngine`'s own `fundamentalSeries`). */
const FUNDAMENTAL_SCRIPT_SOURCES: { kind: IndicatorKind; label: string; note: string }[] = [
  { kind: "freeCashFlow", label: "Free Cash Flow", note: "Ce qui reste de trésorerie une fois les investissements payés." },
  { kind: "netIncome", label: "Net Income", note: "Le résultat net publié, après impôts et charges." },
  { kind: "totalRevenue", label: "Total Revenue", note: "Le chiffre d'affaires publié." },
  { kind: "netMargin", label: "Net Margin", note: "Le résultat net rapporté au chiffre d'affaires, en pourcentage." },
  { kind: "grossMargin", label: "Gross Margin", note: "La marge brute rapportée au chiffre d'affaires, en pourcentage." },
  { kind: "peRatio", label: "Price/Earnings (PER)", note: "Le cours rapporté au bénéfice par action." },
  { kind: "eps", label: "Earnings Per Share (EPS)", note: "Le bénéfice par action publié." },
  { kind: "debtToEquity", label: "Debt/Equity", note: "La dette rapportée aux fonds propres." },
];

for (const { kind, label, note } of FUNDAMENTAL_SCRIPT_SOURCES) {
  INDICATOR_SCRIPT_SOURCES[kind] = `@description "///${label}///
${note}"

// Un chiffre publié ne change qu'aux dates de publication : entre deux rapports, company.value
// renvoie la dernière valeur connue — d'où l'escalier, identique à celui du panneau intégré.
// Avant le tout premier rapport, ou si l'hôte ne fournit pas cette métrique, la réponse est null.
const valeur = company.value("${kind}");

if (valeur !== null) {
  plot.pane("${label}").line("${label}", valeur, { color: "#e0a95c" });
}

// company.fields() liste les métriques réellement disponibles sur ce graphe — toutes les charts
// n'ont pas les mêmes, un indice n'en a aucune.`;
}
