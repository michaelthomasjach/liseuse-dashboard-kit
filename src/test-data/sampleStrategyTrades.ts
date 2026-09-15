import type { StrategyTrade } from "../components/charts/candlestick/interfaces/StrategyResult.interface";

/** The shape a fixture is built to show. Each one exists because some reading of the excursion and
 *  distribution charts is only visible on data that has that property:
 *
 *  - `mixed`   — an ordinary run, winners and losers, nothing staged.
 *  - `clean`   — exits that take most of what the trade offered.
 *  - `gaveBack`— every trade ran far into profit and closed near nothing. The pathology MAE/MFE
 *                exists to expose, and the one a total P&L or a win rate cannot show. */
export type SampleTradeShape = "mixed" | "gaveBack" | "clean";

/** Synthetic trades with a deliberate shape, so a chart story shows the reading it is *for* rather
 *  than a plausible-looking cloud. `seed` makes them repeatable — a chart story that reshuffles on
 *  every reload is one nobody can review against a previous screenshot.
 *
 *  Shared between story files rather than copied into each: two copies of a fixture drift, and a
 *  chart compared against "the same 200 trades" in two places has to actually be. */
export function makeSampleTrades(count: number, seed: number, shape: SampleTradeShape): StrategyTrade[] {
  let state = seed;
  const random = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  const day = 24 * 60 * 60 * 1000;
  // A real date rather than epoch zero, so anything formatting these reads as a run and not as
  // January 1970.
  const start = Date.UTC(2025, 0, 6);
  return Array.from({ length: count }, (_, i) => {
    // The excursions come first and the result is drawn from *inside* them, never the other way
    // round: a trade cannot end beyond the best or worst it ever reached, and a fixture that lets it
    // teaches a reading of the chart that its real data can never produce. (Real trades can sit a
    // hair outside, by the commission — the excursions are gross price moves and the result is net —
    // which is a genuine and small effect, not the large one an unconstrained fixture invents.)
    const win = random() > (shape === "clean" ? 0.35 : 0.55);
    // "gaveBack": every trade ran far in profit before closing near nothing — the shape the
    // excursion chart exists to make obvious.
    const favourable = shape === "gaveBack" ? 90 + random() * 180 : win ? 40 + random() * 130 : random() * 45;
    const adverse = shape === "gaveBack" ? random() * 30 : win ? random() * 40 : 30 + random() * 110;
    const profit = win ? favourable * (shape === "gaveBack" ? 0.05 + random() * 0.2 : 0.55 + random() * 0.4) : -adverse * (0.6 + random() * 0.4);
    return {
      id: `t${i}`,
      direction: random() > 0.5 ? "long" : "short",
      entryTime: start + i * 3 * day,
      entryPrice: 100 + random() * 10,
      exitTime: start + (i * 3 + 2) * day,
      exitPrice: 100 + random() * 10,
      quantity: 1,
      profit,
      profitPercent: profit / 20,
      commission: 1.2,
      maxAdverse: adverse,
      maxFavorable: favourable,
    };
  });
}
