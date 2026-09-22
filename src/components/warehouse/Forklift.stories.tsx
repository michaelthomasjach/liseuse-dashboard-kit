import type { Meta, StoryObj } from "@storybook/react";
import { Forklift } from "./Forklift";

const meta: Meta<typeof Forklift> = {
  title: "Warehouse/Chariot élévateur",
  component: Forklift,
};
export default meta;
type Story = StoryObj<typeof Forklift>;

export const Chariot: Story = {
  name: "Le chariot",
  args: { lift: 0.9, mastHeight: 2.1, load: "carton", running: true, cycle: 5, shadows: true, cellSize: 60 },
  render: (args) => (
    <div style={{ padding: 40 }}>
      <Forklift {...args} />
    </div>
  ),
};

/** Quatre caps. L'ordre de peinture se lit sur les axes du chariot — contrepoids, poste, mât,
 *  fourches — et c'est `isoFacing` qui dit dans quel sens la caméra les voit : il tient donc à tout
 *  cap, y compris de biais. */
export const Caps: Story = {
  name: "Quatre caps, et un de biais",
  render: () => (
    <div style={{ display: "flex", gap: 32, alignItems: "flex-end", padding: 32, flexWrap: "wrap" }}>
      {[0, 90, 180, 270, 35].map((rotation) => (
        <div key={rotation} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Forklift rotation={rotation} lift={0.6} shadows cellSize={44} />
          <span style={{ fontSize: "0.72rem", fontVariantNumeric: "tabular-nums" }}>{rotation}°</span>
        </div>
      ))}
    </div>
  ),
};

/** Ce qu'il porte : une palette seule, une palette chargée, rien. */
export const Charges: Story = {
  name: "Ce qu'il porte",
  render: () => (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-end", padding: 32, flexWrap: "wrap" }}>
      {[
        { label: "Palette chargée", load: "carton" as const, lift: 1.4 },
        { label: "Palette seule", load: "palette" as const, lift: 0.4 },
        { label: "À vide", load: null, lift: 0.05 },
      ].map((it) => (
        <div key={it.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Forklift load={it.load} lift={it.lift} shadows cellSize={48} />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{it.label}</span>
        </div>
      ))}
    </div>
  ),
};
