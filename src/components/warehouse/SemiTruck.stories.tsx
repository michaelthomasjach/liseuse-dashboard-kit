import type { Meta, StoryObj } from "@storybook/react";
import { SemiTruck } from "./SemiTruck";

const meta: Meta<typeof SemiTruck> = {
  title: "Warehouse/Semi-remorque",
  component: SemiTruck,
};
export default meta;
type Story = StoryObj<typeof SemiTruck>;

export const Camion: Story = {
  name: "Le semi-remorque",
  args: { trailerLength: 7.6, rotation: 0, shadows: true, cellSize: 34 },
  render: (args) => (
    <div style={{ padding: 40 }}>
      <SemiTruck {...args} />
    </div>
  ),
};

/** Quatre caps. Ce qui est sous la caisse passe avant elle ; au-dessus, le camion se range le long
 *  de sa longueur, dans l'ordre où la caméra le voit — ce qui tient à tout cap. Les portes arrière ne
 *  sont tracées que quand leur face regarde la caméra. */
export const Caps: Story = {
  name: "Quatre caps",
  render: () => (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-end", padding: 32, flexWrap: "wrap" }}>
      {[0, 90, 180, 270].map((rotation) => (
        <div key={rotation} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <SemiTruck rotation={rotation} shadows cellSize={20} />
          <span style={{ fontSize: "0.72rem", fontVariantNumeric: "tabular-nums" }}>{rotation}°</span>
        </div>
      ))}
    </div>
  ),
};
