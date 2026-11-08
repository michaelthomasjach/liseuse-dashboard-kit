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

export const HiddenYAxisLine: Story = {
  name: "Sans ligne d'axe Y, axe X prolongé (hideYAxisLine)",
  args: { hideYAxisLine: true },
  argTypes: { hideYAxisLine: { control: "boolean" } },
  render: (args) => (
    <LineAreaChart {...args} series={[{ id: "portfolio", label: "Portefeuille", data: generateSeries(180, 42000, 7) }]} area formatY={formatEUR} formatX={formatDate} />
  ),
};

const AXIS_CONTROLS = { showYAxisLine: { control: "boolean" }, extendXAxisLine: { control: "boolean" }, hideYAxisLine: { control: "boolean" } } as const;

/** Ligne de l'axe Y masquée, valeurs et grille gardées ; l'axe X n'est pas prolongé. */
export const YAxisLineOnlyHidden: Story = {
  name: "Ligne d'axe Y masquée seule (showYAxisLine={false})",
  args: { showYAxisLine: false },
  argTypes: AXIS_CONTROLS,
  render: HiddenYAxisLine.render,
};

/** Axe Y gardé, ligne de l'axe X prolongée sous ses valeurs jusqu'au bord gauche. */
export const ExtendedXAxisLine: Story = {
  name: "Axe X prolongé à gauche (extendXAxisLine)",
  args: { extendXAxisLine: true },
  argTypes: AXIS_CONTROLS,
  render: HiddenYAxisLine.render,
};

/** Deux unités sur un même graphique : l'or en dollars (axe de gauche), le taux réel en % sur un second axe, inversé (axe de droite). */
export const SecondaryYAxis: Story = {
  name: "Second axe Y (yAxis: \"secondary\", secondaryYAxis)",
  args: { secondaryYAxis: { inverted: true, formatY: (v: number) => `${v.toFixed(1).replace(".", ",")} %` } },
  render: (args) => {
    const start = Date.UTC(2024, 0, 1);
    const weeks = Array.from({ length: 104 }, (_, i) => new Date(start + i * 7 * 86_400_000));
    const real = weeks.map((x, i) => ({ x, y: 2.2 - i * 0.012 + Math.sin(i / 6) * 0.25 }));
    const gold = weeks.map((x, i) => ({ x, y: 2050 + i * 9 + Math.sin(i / 6) * 60 }));
    return (
      <LineAreaChart
        {...args}
        height={320}
        formatX={formatDate}
        formatY={(v) => `${Math.round(v).toLocaleString("fr-FR")} $`}
        series={[
          { id: "gold", label: "Or ($ l'once)", data: gold, color: "#b8952b" },
          { id: "real", label: "Taux réel 10 ans (%, échelle de droite inversée)", data: real, color: "#2f9e72", yAxis: "secondary" },
        ]}
      />
    );
  },
};

/** Historique puis projection : au survol, chaque série n'est lue que sur ses propres dates (hoverWithinRange), et la
 *  projection pas à son point de départ, qui ne fait que reprendre le dernier cours (hoverAfter). */
export const HoverWithinRange: Story = {
  name: "Lecture au survol bornée aux dates de la série (hoverWithinRange, hoverAfter)",
  render: (args) => {
    const start = Date.UTC(2025, 0, 1);
    const week = 7 * 86_400_000;
    const history = Array.from({ length: 60 }, (_, i) => ({ x: new Date(start + i * week), y: 2600 + i * 22 + Math.sin(i / 5) * 80 }));
    const last = history[history.length - 1]!;
    const projection = Array.from({ length: 27 }, (_, i) => ({ x: new Date(+last.x + i * 2 * week), y: last.y * (1 - 0.0006 * i) }));
    return (
      <LineAreaChart
        {...args}
        height={300}
        formatX={formatDate}
        formatY={(v) => `${Math.round(v).toLocaleString("fr-FR")} $`}
        series={[
          { id: "gold", label: "Or", data: history, color: "#b8952b", hoverWithinRange: true },
          { id: "proj", label: "Projection", data: projection, color: "#b8952b", dashed: true, hoverWithinRange: true, hoverAfter: last.x },
        ]}
      />
    );
  },
};

/** Écart entre deux courbes coloré à part (bandColor) : courbe des taux et courbe d'inflation, l'écart en rouge. */
export const BandColor: Story = {
  name: "Bande d'écart colorée (bandColor)",
  render: (args) => {
    const years = [0, 2, 5, 10, 30];
    const nominal = [3.9, 3.6, 3.8, 4.1, 4.7];
    const inflation = [2.9, 2.6, 2.3, 2.25, 2.25];
    return (
      <LineAreaChart
        {...args}
        height={240}
        xType="linear"
        area={false}
        formatY={(v) => `${v.toFixed(2).replace(".", ",")} %`}
        series={[
          {
            id: "nominal",
            label: "Taux nominaux",
            color: "#7c6cf0",
            data: years.map((x, i) => ({ x, y: nominal[i]! })),
            band: years.map((x, i) => ({ x, low: Math.min(nominal[i]!, inflation[i]!), high: Math.max(nominal[i]!, inflation[i]!) })),
            bandColor: "#d9573f",
            bandOpacity: 0.22,
          },
          { id: "inflation", label: "Inflation", color: "#d9a03f", data: years.map((x, i) => ({ x, y: inflation[i]! })) },
        ]}
      />
    );
  },
};
