/** The script the cinema section types out, in the order it appears.
 *
 *  Split into steps rather than typed as one blob because each step is *run* the moment it
 *  finishes: every cumulative prefix here has to be valid, complete JavaScript on its own, or the
 *  engine would report a syntax error halfway through a sentence. Read as a whole they make one
 *  ordinary `@indicator` script, and it is genuinely what draws on the chart beside it. */
export interface CinemaStep {
  /** Text appended at this step. */
  code: string;
  /** What the chart gains once this step runs, shown as a caption under the panel. */
  caption: string;
}

export const CINEMA_STEPS: CinemaStep[] = [
  {
    code: `@indicator
// Une moyenne mobile, tracée par-dessus le prix.
const prix = market.close(0);
const sma20 = math.sma(market.series("close", 20), 20);

plot.overlay("SMA 20").line("SMA 20", sma20 ?? prix);
`,
    caption: "La SMA 20 apparaît sur le prix",
  },
  {
    code: `
// Une deuxième, plus lente.
const sma50 = math.sma(market.series("close", 50), 50);

plot.overlay("SMA 50").line("SMA 50", sma50 ?? prix);
`,
    caption: "La SMA 50 la rejoint",
  },
  {
    code: `
// Un RSI, dans son propre panneau sous le prix.
const rsi = ta.rsi(market.series("close", 60), 14);

plot.pane("RSI").line("RSI", rsi ?? 50);
`,
    caption: "Le RSI ouvre son panneau",
  },
  {
    code: `
// Un signal quand la courte repasse au-dessus de la longue.
if (bar.isNew() && sma20 !== null && sma50 !== null) {
  if (sma20 > sma50 && rsi !== null && rsi > 50) plot.signal("BUY");
}
`,
    caption: "Les signaux se posent sur les bougies",
  },
];

/** The whole script, and where each step ends inside it. */
export const CINEMA_CODE = CINEMA_STEPS.map((s) => s.code).join("");

export const CINEMA_STEP_ENDS: number[] = CINEMA_STEPS.reduce<number[]>((acc, step) => {
  acc.push((acc[acc.length - 1] ?? 0) + step.code.length);
  return acc;
}, []);

/** A whole strategy as blocks, which is all the no-code canvas reads: the graph is derived from
 *  the code (see `parseScriptGraph`), never stored beside it.
 *
 *  Laid out on a strict grid — columns 350 apart, rows 160 — because a node is a fixed 230x92 and
 *  anything tighter overlaps. Placing them by eye is what put two of them on top of each other; a
 *  grid cannot. The columns are the stages of the reasoning, left to right: the data, the three
 *  families of indicator read from it, what each family concludes, the score they blend into, and
 *  what the chart finally draws. That shape is the point of showing it as a graph at all — the
 *  same script as text is a top-to-bottom list in which none of those stages are visible. */
export const NOCODE_CODE = `@indicator

@block(prix at 40 200) Prix et series
const prix = market.close(0);
const closes = market.series("close", 220);
const hauts = market.series("high", 220);
const bas = market.series("low", 220);

@block(tendance at 390 40 after prix) Tendance
const sma20 = math.sma(closes, 20);
const sma50 = math.sma(closes, 50);
const sma200 = math.sma(closes, 200);
const ecart = sma20 !== null && sma50 !== null ? sma20 - sma50 : 0;

@block(volatilite at 390 200 after prix) Volatilite
const atr = ta.atr(hauts, bas, closes, 14);
const bandes = ta.bollinger(closes, 20, 2);
const largeur = atr !== null && prix ? atr / prix : 0;

@block(momentum at 390 360 after prix) Momentum
const rsi = ta.rsi(closes, 14);
const macd = ta.macd(closes, 12, 26, 9);
const stoch = ta.stochastic(hauts, bas, closes, 14, 3);

@block(regime at 740 120 after tendance volatilite) Regime
const haussier = ecart > 0 && (sma200 === null || prix > sma200);
const calme = largeur < 0.02;
const regime = haussier ? (calme ? "hausse posee" : "hausse nerveuse") : calme ? "repli pose" : "repli nerveux";

@block(force at 740 360 after momentum) Force
const force = rsi ?? 50;
const impulsion = macd && macd.histogram !== null ? macd.histogram : 0;
const tension = stoch && stoch.k !== null ? stoch.k : 50;

@block(score at 1090 240 after regime force) Score composite
const base = haussier ? 62 : 38;
const brut = base + (force - 50) * 0.6 + (impulsion > 0 ? 8 : -8) - (calme ? 0 : 5);
const score = Math.max(0, Math.min(100, Math.round(brut)));

@block(moyennes at 1440 40 after tendance) Tracer les moyennes
const overlay = plot.overlay("Moyennes");
overlay.line("SMA 20", sma20 ?? prix, { color: "#2f6fb2" });
overlay.line("SMA 50", sma50 ?? prix, { color: "#c47f2a" });

@block(canal at 1440 200 after volatilite) Tracer le canal
if (bandes) {
  plot.overlay("Bollinger").band("Canal", bandes.upper, bandes.lower, { color: "#8a8f98" });
}

@block(panneau at 1440 360 after score) Panneau de score
const pane = plot.pane("Score composite");
pane.line("Score", score, { color: "#2f6fb2" });
pane.line("Neutre", 50, { color: "#8a8f98", lineStyle: "dashed" });

@block(signal at 1790 120 after score) Signal
if (bar.isNew()) {
  if (score >= 70) plot.signal({ type: "BUY", price: prix });
  else if (score <= 30) plot.signal({ type: "SELL", price: prix });
}

@block(etiquette at 1790 360 after regime score tension) Etiquette de regime
console.log(regime + " - score " + score + " - tension " + Math.round(tension));
`;
