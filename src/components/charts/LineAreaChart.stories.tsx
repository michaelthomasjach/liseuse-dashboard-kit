import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { LineAreaChart } from "./LineAreaChart";
import { generateSeries } from "../../test-data/financeSampleData";

const meta: Meta<typeof LineAreaChart> = {
  title: "Charts/LineAreaChart",
  component: LineAreaChart,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof LineAreaChart>;

const formatEUR = (v: number) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`;
const formatDate = (x: Date | number) => (x as Date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });

// No wrapper width constraint: the chart fills 100% of its container by
// default, so the story container's own width (here, the full viewport
// minus padding) is what determines the rendered size.
export const PortfolioValue: Story = {
  render: () => (
    <div style={{ padding: 24 }}>
      <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
        Molette/pincement pour zoomer, glisser dans le graphe pour naviguer. Glisser sur l'axe vertical rescale les prix,
        glisser sur l'axe horizontal rescale le temps.
      </p>
      <LineAreaChart
        series={[{ id: "portfolio", label: "Portefeuille", data: generateSeries(180, 42000, 7) }]}
        area
        formatY={formatEUR}
        formatX={formatDate}
      />
    </div>
  ),
};

export const MultiSeriesComparison: Story = {
  name: "Multi-séries + légende",
  render: () => (
    <div style={{ padding: 24 }}>
      <LineAreaChart
        series={[
          { id: "portfolio", label: "Mon portefeuille", data: generateSeries(120, 10000, 3) },
          { id: "benchmark", label: "S&P 500", data: generateSeries(120, 10000, 9) },
        ]}
        formatY={formatEUR}
        formatX={formatDate}
      />
    </div>
  ),
};

export const InANarrowCard: Story = {
  name: "Dans une carte étroite (toujours 100% du conteneur)",
  render: () => (
    <div style={{ padding: 24, maxWidth: 420 }}>
      <LineAreaChart series={[{ id: "p", data: generateSeries(60, 1000, 4) }]} area height={220} showLegend={false} />
    </div>
  ),
};

function SyncedDemo() {
  const [x, setX] = useState<Date | number | null>(null);
  const a = generateSeries(120, 100);
  const b = generateSeries(120, 50);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: 16 }}>
      <LineAreaChart series={[{ id: "a", label: "Série A", data: a }]} height={220} onHoverChange={setX} syncedHoverX={x} />
      <LineAreaChart series={[{ id: "b", label: "Série B", data: b }]} height={220} onHoverChange={setX} syncedHoverX={x} />
    </div>
  );
}

/** Survol synchronisé : survoler un graphique affiche la même date et ses valeurs sur l'autre. */
export const SyncedHover: Story = { render: () => <SyncedDemo /> };
