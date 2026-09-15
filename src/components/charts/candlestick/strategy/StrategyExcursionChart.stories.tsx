import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { StrategyTrade } from "../interfaces/StrategyResult.interface";
import { makeSampleTrades } from "../../../../test-data/sampleStrategyTrades";
import { StrategyExcursionChart, StrategyExcursionLegend } from "./StrategyExcursionChart";
import "./ChartStrategyPanel.css";

const meta: Meta<typeof StrategyExcursionChart> = {
  title: "Charts/MAE — MFE",
  component: StrategyExcursionChart,
  parameters: {
    docs: {
      description: {
        component:
          "Le graphique des excursions maximales, isolé du testeur de stratégie. Une ligne par trade, mesurée depuis son prix d'entrée : à gauche jusqu'où il est descendu contre vous (MAE), à droite le meilleur gain qu'il a affiché (MFE), et le point où vous êtes réellement sorti.\n\nC'est la seule vue qui montre le *trajet* d'un trade. Le prix d'entrée et le prix de sortie ne disent que ses deux bouts : un trade clôturé à +50 après être descendu de 400 et un trade monté tout droit ont le même résultat et ne sont pas le même trade.\n\nLes données sont synthétiques mais construites pour montrer la lecture que chaque story rend possible ; un résultat n'y sort jamais des excursions qui l'encadrent, comme dans la réalité.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof StrategyExcursionChart>;

const CHART_WIDTH = 860;

function money(value: number): string {
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}

function Frame({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div style={{ maxWidth: 900, background: "var(--lq-color-panel)", padding: 16, borderRadius: 8 }}>
      <StrategyExcursionLegend defaultOpen />
      {children}
      {note !== undefined && <p className="lq-strategy__hint" style={{ margin: "12px 0 0" }}>{note}</p>}
    </div>
  );
}

/** The readout the panel would normally get from the price chart, shown here as the story's own
 *  payload: hovering a row reports that trade through `onHoverTrades`, and this is what a host does
 *  with it. Idle it shows the run's own averages, so the box is never empty and the hovered figures
 *  always have something to be compared against. */
function Readout({ trades, hovered }: { trades: StrategyTrade[]; hovered: StrategyTrade | null }) {
  const count = trades.length;
  const averageAdverse = trades.reduce((sum, t) => sum + t.maxAdverse, 0) / count;
  const averageFavorable = trades.reduce((sum, t) => sum + t.maxFavorable, 0) / count;
  const averageProfit = trades.reduce((sum, t) => sum + t.profit, 0) / count;
  const adverse = hovered?.maxAdverse ?? averageAdverse;
  const favorable = hovered?.maxFavorable ?? averageFavorable;
  const profit = hovered?.profit ?? averageProfit;
  // What share of the best moment was actually taken — the number the chart is really about, and
  // the one no metrics grid usually carries.
  const kept = favorable === 0 ? null : (profit / favorable) * 100;
  const index = hovered === null ? -1 : trades.indexOf(hovered);
  return (
    <div style={{ marginTop: 12 }}>
      <p className="lq-strategy__hint" style={{ marginBottom: 6 }}>
        {hovered === null ? `Moyennes sur ${count} trades — survolez une ligne pour lire le trade.` : `Trade ${index + 1} · ${hovered.direction === "long" ? "long" : "short"}`}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        <div className="lq-strategy__metric">
          <span className="lq-strategy__metric-label">Contre vous (MAE)</span>
          <span className="lq-strategy__metric-value">{money(adverse)}</span>
        </div>
        <div className="lq-strategy__metric">
          <span className="lq-strategy__metric-label">Pour vous (MFE)</span>
          <span className="lq-strategy__metric-value">{money(favorable)}</span>
        </div>
        <div className="lq-strategy__metric">
          <span className="lq-strategy__metric-label">Sortie</span>
          <span className={`lq-strategy__metric-value lq-strategy__metric-value--${profit >= 0 ? "up" : "down"}`}>
            {profit >= 0 ? "+" : "−"}
            {money(Math.abs(profit))}
          </span>
        </div>
        <div className="lq-strategy__metric">
          <span className="lq-strategy__metric-label">Part du MFE conservée</span>
          <span className="lq-strategy__metric-value">{kept === null ? "—" : `${kept.toFixed(0)} %`}</span>
          <span className="lq-strategy__metric-hint">ce que la sortie a gardé de ce que le trade offrait</span>
        </div>
      </div>
    </div>
  );
}

function Interactive({ trades, height, note }: { trades: StrategyTrade[]; height: number; note?: string }) {
  const [hovered, setHovered] = useState<StrategyTrade | null>(null);
  return (
    <Frame note={note}>
      <StrategyExcursionChart
        trades={trades}
        currency="EUR"
        width={CHART_WIDTH}
        height={height}
        onHoverTrades={(t) => setHovered(t === null ? null : (t[0] ?? null))}
      />
      <Readout trades={trades} hovered={hovered} />
    </Frame>
  );
}

/** The chart on trades that mostly worked, with the hover readout wired up — the default reading. */
export const Lecture: Story = {
  name: "Lecture — sorties bien placées",
  render: () => (
    <Interactive
      trades={makeSampleTrades(30, 7, "clean")}
      height={320}
      note="Ici les points sont proches du bout droit de leur segment : les sorties prennent l'essentiel de ce que le trade offrait. Survolez le graphique — la ligne visée s'allume, le trait vertical donne la distance en euros, et les quatre cases se mettent à jour."
    />
  ),
};

/** The pathological case the chart exists to expose. */
export const GainsRendus: Story = {
  name: "Gains rendus",
  render: () => (
    <Interactive
      trades={makeSampleTrades(30, 11, "gaveBack")}
      height={320}
      note="De longs bras droits, des points revenus près de zéro : chaque trade a été largement en gain avant de le rendre. Regardez « Part du MFE conservée » en survolant — c'est un problème de règle de sortie, invisible dans un P&L total ou un taux de réussite."
    />
  ),
};

/** Density: the case the pointer was rebuilt for. */
export const BeaucoupDeTrades: Story = {
  name: "200 trades",
  render: () => (
    <Interactive
      trades={makeSampleTrades(200, 3, "mixed")}
      height={360}
      note="À deux cents trades les lignes se compressent au lieu de défiler : ce n'est plus deux cents lignes lisibles mais une forme, et la forme est ce qui porte l'information à ce volume. Le pointeur reste utilisable pour autant — la ligne visée est calculée, pas cliquée, et sa surbrillance garde une hauteur minimale même quand la ligne fait moins d'un pixel."
    />
  ),
};

/** The reverse link: a trade designated from outside marks its own row. */
export const LienAvecLaChart: Story = {
  name: "Lien avec la chart",
  render: () => {
    const trades = makeSampleTrades(24, 19, "mixed");
    return <MarkedDemo trades={trades} />;
  },
};

function MarkedDemo({ trades }: { trades: StrategyTrade[] }) {
  const [marked, setMarked] = useState<number | null>(null);
  return (
    <Frame note="Dans le testeur, `markedTime` vient de la chart des prix : survoler une exécution là-haut allume sa ligne ici. Les boutons ci-dessous tiennent ce rôle. La marque est une bande sur la ligne du trade, pas un trait vertical — un trait vertical traverserait tous les trades et n'en désignerait aucun.">
      <StrategyExcursionChart trades={trades} currency="EUR" width={CHART_WIDTH} height={300} markedTime={marked} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 12 }}>
        {trades.map((trade, i) => (
          <button
            key={trade.id}
            type="button"
            className="lq-strategy__tab"
            onMouseEnter={() => setMarked(trade.exitTime)}
            onMouseLeave={() => setMarked(null)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </Frame>
  );
}
