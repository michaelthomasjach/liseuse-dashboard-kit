import type { Meta, StoryObj } from "@storybook/react";
import { BuildPlot } from "./BuildPlot";
import { PLOT_SHAPES, generatePlot, plotArea } from "./plot";

/**
 * Le terrain à bâtir, tiré d'une graine : sa forme, ses rues, ses voisins, sa circulation. Changer
 * la graine, c'est changer de partie.
 */
const meta: Meta<typeof BuildPlot> = {
  title: "Warehouse/Terrain",
  component: BuildPlot,
  argTypes: {
    seed: { control: { type: "number", min: 1, max: 999 } },
    shape: { control: "select", options: [undefined, ...PLOT_SHAPES] },
  },
};
export default meta;
type Story = StoryObj<typeof BuildPlot>;

export const Graine: Story = {
  name: "Un terrain, une graine",
  args: { seed: 7, cellSize: 9 },
  render: (args) => {
    const plot = generatePlot(args.seed ?? 1, { shape: args.shape });
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>
          Graine {plot.seed} — terrain {plot.shape}, {plot.width} × {plot.depth} cases, {plotArea(plot)} cases constructibles
        </span>
        <BuildPlot {...args} layout={plot} />
      </div>
    );
  },
};

export const Formes: Story = {
  name: "Les cinq formes",
  render: () => (
    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
      {PLOT_SHAPES.map((shape, i) => (
        <div key={shape} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <BuildPlot seed={11 + i} shape={shape} cellSize={4.5} />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{shape}</span>
        </div>
      ))}
    </div>
  ),
};
