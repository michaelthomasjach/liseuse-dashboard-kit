import type { Meta, StoryObj } from "@storybook/react";
import { makeSampleTrades } from "../../../../test-data/sampleStrategyTrades";
import { StrategyDistributionChart } from "./StrategyDistributionChart";
import { StrategyEquityChart } from "./StrategyEquityChart";
import "./ChartStrategyPanel.css";

const meta: Meta = {
  title: "Charts/Stratégie/Graphiques",
  parameters: {
    docs: {
      description: {
        component:
          "Les graphiques du testeur de stratégie, isolés de la chart pour pouvoir être lus et ajustés seuls. Les données sont synthétiques mais construites pour montrer la lecture que chaque graphique rend possible. Le graphique MAE / MFE a sa propre entrée, « Charts/MAE — MFE ».",
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

export const Distribution: Story = {
  name: "Distribution des résultats",
  render: () =>
    frame(
      <StrategyDistributionChart trades={makeSampleTrades(120, 5, "mixed")} width={860} height={200} />,
      "Les perdants à gauche du zéro, les gagnants à droite. Les bornes des classes sont calées pour qu'une d'elles tombe exactement sur zéro — sans ça une seule classe chevauche l'axe et mélange petits gagnants et petits perdants, précisément la frontière que le graphique existe pour montrer. Les deux traits pointillés sont la moyenne et la médiane.",
    ),
};

export const CourbeDEquite: Story = {
  name: "Courbe de P&L cumulé",
  render: () => {
    const trades = makeSampleTrades(80, 13, "mixed");
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
      "Tracée en P&L cumulé plutôt qu'en valeur du compte : la question à laquelle un backtest répond est « combien ça a rapporté », et une courbe qui part de 0 y répond directement. Un point par trade marque l'endroit où ce trade est arrivé sur le compte — vert s'il a gagné, rouge sinon. Le pic courant est en pointillé derrière : l'écart entre les deux est le drawdown.",
    );
  },
};
