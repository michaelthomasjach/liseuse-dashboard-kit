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

/** The same idea written with `@block` headers, which is all the no-code canvas reads: the graph
 *  is derived from the code (see `parseScriptGraph`), never stored beside it. */
export const NOCODE_CODE = `@indicator

@block(prix at 40 60) Charger le prix
const prix = market.close(0);
const closes = market.series("close", 60);

@block(moyennes at 330 40 after prix) Moyennes mobiles
const sma20 = math.sma(closes, 20);
const sma50 = math.sma(closes, 50);
plot.overlay("SMA 20").line("SMA 20", sma20 ?? prix);
plot.overlay("SMA 50").line("SMA 50", sma50 ?? prix);

@block(rsi at 330 250 after prix) Oscillateur
const rsi = ta.rsi(closes, 14);
plot.pane("RSI").line("RSI", rsi ?? 50);

@block(signal at 640 140 after moyennes rsi) Signal d'achat
if (bar.isNew() && sma20 !== null && sma50 !== null) {
  if (sma20 > sma50 && rsi !== null && rsi > 50) plot.signal("BUY");
}
`;
