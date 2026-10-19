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

/** Fourchette de scénarios : trajectoire centrale, bande pessimiste / optimiste, trajectoire avant le choc en pointillés, axe Y masqué. */
export const ScenarioBand: Story = {
  render: () => {
    const before = Array.from({ length: 36 }, (_, i) => ({ x: i, y: 100 + Math.sin(i / 2) * 2 }));
    const after = before.map((p) => (p.x < 10 ? p : { x: p.x, y: 100 + Math.min(20, (p.x - 10) * 4) + Math.sin(p.x) * 1.5 }));
    const band = after.filter((p) => p.x >= 10).map((p) => ({ x: p.x, low: p.y - (p.x - 10) * 0.6, high: p.y + (p.x - 10) * 0.7 }));
    return (
      <LineAreaChart
        height={320}
        xType="linear"
        showYAxis={false}
        margin={{ left: 12 }}
        series={[
          { id: "before", label: "Avant le choc", data: before, dashed: true, color: "#8a93a6" },
          { id: "after", label: "Après le choc", data: after, band, color: "#f2a33a", strokeWidth: 2.5 },
        ]}
      />
    );
  },
};

