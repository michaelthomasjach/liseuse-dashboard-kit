import type { Meta, StoryObj } from "@storybook/react";
import type { StrategyTrade } from "../interfaces/StrategyResult.interface";
import { StrategyDistributionChart } from "./StrategyDistributionChart";
import { StrategyEquityChart } from "./StrategyEquityChart";
import { StrategyExcursionChart } from "./StrategyExcursionChart";
import "./ChartStrategyPanel.css";

/** Synthetic trades with a deliberate shape, so each story shows the reading its chart is *for*
 *  rather than a plausible-looking cloud. `seed` makes them repeatable — a chart story that
 *  reshuffles on every reload is one nobody can review against a previous screenshot. */
function makeTrades(count: number, seed: number, shape: "mixed" | "gaveBack" | "clean"): StrategyTrade[] {
  let state = seed;
  const random = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
  const day = 24 * 60 * 60 * 1000;
  return Array.from({ length: count }, (_, i) => {
    // The excursions come first and the result is drawn from *inside* them, never the other way
    // round: a trade cannot end beyond the best or worst it ever reached, and a fixture that lets it
    // teaches a reading of the chart that its real data can never produce. (Real trades can sit a
    // hair outside, by the commission — the excursions are gross price moves and the result is net —
    // which is a genuine and small effect, not the large one an unconstrained fixture invents.)
    const win = random() > (shape === "clean" ? 0.35 : 0.55);
    // "gaveBack": every trade ran far in profit before closing near nothing — the shape the
    // excursion chart exists to make obvious.
    const favourable = shape === "gaveBack" ? 90 + random() * 180 : (win ? 40 + random() * 130 : random() * 45);
    const adverse = shape === "gaveBack" ? random() * 30 : (win ? random() * 40 : 30 + random() * 110);
    const profit = win ? favourable * (shape === "gaveBack" ? 0.05 + random() * 0.2 : 0.55 + random() * 0.4) : -adverse * (0.6 + random() * 0.4);
    return {
      id: `t${i}`,
      direction: random() > 0.5 ? "long" : "short",
      entryTime: i * 3 * day,
      entryPrice: 100 + random() * 10,
      exitTime: (i * 3 + 2) * day,
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

const meta: Meta = {
  title: "Charts/Stratégie/Graphiques",
  parameters: {
    docs: {
      description: {
        component:
          "Les trois graphiques du testeur de stratégie, isolés de la chart pour pouvoir être lus et ajustés seuls. Les données sont synthétiques mais construites pour montrer la lecture que chaque graphique rend possible.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const frame = (children: React.ReactNode, note: string) => (
  <div style={{ maxWidth: 900, background: "var(--lq-color-panel)", padding: 16, borderRadius: 8 }}>
    <p className="lq-strategy__hint">{note}</p>
    {children}
  </div>
);

/** The excursion chart on trades that mostly worked. Dots sit near the right end of their own span:
 *  what the trade offered was largely taken. */
export const ExcursionsSaines: Story = {
  name: "MAE / MFE — sorties bien placées",
  render: () =>
    frame(
      <StrategyExcursionChart trades={makeTrades(30, 7, "clean")} currency="EUR" width={860} />,
      "Chaque ligne est un trade : à gauche jusqu'où il est allé contre vous (MAE), à droite jusqu'où il est allé pour vous (MFE), et le point où vous êtes sorti. Ici les points sont proches du bout droit de leur segment — les sorties prennent l'essentiel de ce que le trade offrait.",
    ),
};

/** The same chart on the pathological case it is meant to expose: long right arms, dots back at
 *  zero. Every trade was in profit and gave it back. */
export const ExcursionsGainsRendus: Story = {
  name: "MAE / MFE — gains rendus",
  render: () =>
    frame(
      <StrategyExcursionChart trades={makeTrades(30, 11, "gaveBack")} currency="EUR" width={860} />,
      "Le cas que ce graphique sert à rendre évident : de longs bras droits, et des points revenus près de zéro. Chaque trade a été largement en gain avant de le rendre — un problème de règle de sortie, invisible dans un P&L total ou un taux de réussite.",
    ),
};

/** Density at scale: rows compress rather than scroll, because at this count the shape is what
 *  carries. */
export const ExcursionsBeaucoupDeTrades: Story = {
  name: "MAE / MFE — 200 trades",
  render: () =>
    frame(
      <StrategyExcursionChart trades={makeTrades(200, 3, "mixed")} currency="EUR" width={860} />,
      "À deux cents trades les lignes se compressent au lieu de défiler : ce n'est plus deux cents lignes lisibles mais une forme, et la forme est ce qui porte l'information à ce volume.",
    ),
};

export const Distribution: Story = {
  name: "Distribution des résultats",
  render: () =>
    frame(
      <StrategyDistributionChart trades={makeTrades(120, 5, "mixed")} width={860} height={200} />,
      "Les perdants à gauche du zéro, les gagnants à droite. Les bornes des classes sont calées pour qu'une d'elles tombe exactement sur zéro — sans ça une seule classe chevauche l'axe et mélange petits gagnants et petits perdants, précisément la frontière que le graphique existe pour montrer. Les deux traits pointillés sont la moyenne et la médiane.",
    ),
};

export const CourbeDEquite: Story = {
  name: "Courbe de P&L cumulé",
  render: () => {
    const trades = makeTrades(80, 13, "mixed");
    let running = 10000;
    let peak = running;
    const equity = trades.map((t) => {
      running += t.profit;
      peak = Math.max(peak, running);
      return { time: t.exitTime, equity: running, peak };
    });
    return frame(
      <StrategyEquityChart
        equity={equity}
        trades={trades}
        initialCapital={10000}
        currency="EUR"
        width={860}
        height={200}
        formatDate={(d) => d.toLocaleDateString("fr-FR")}
      />,
      "Tracée en P&L cumulé plutôt qu'en valeur du compte : la question à laquelle un backtest répond est « combien ça a rapporté », et une courbe qui part de 0 y répond directement. Le pic courant est en pointillé derrière — l'écart entre les deux est le drawdown.",
    );
  },
};
