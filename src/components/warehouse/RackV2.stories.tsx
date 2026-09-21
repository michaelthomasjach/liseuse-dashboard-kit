import type { Meta, StoryObj } from "@storybook/react";
import { RackV2 } from "./RackV2";

const meta: Meta<typeof RackV2> = {
  title: "Warehouse/Étagère V2",
  component: RackV2,
};
export default meta;
type Story = StoryObj<typeof RackV2>;

export const Boite: Story = {
  name: "La boîte",
  args: { width: 8, depth: 2, height: 2.4, cellSize: 34 },
  render: (args) => (
    <div style={{ padding: 40 }}>
      <RackV2 {...args} />
    </div>
  ),
};

/** Trois proportions, pour vérifier que la boîte reste une boîte : longue et basse, cubique, haute
 *  et étroite — c'est dans le premier cas que les faces du haut et du bas se recouvrent le plus. */
export const Proportions: Story = {
  name: "Proportions",
  render: () => (
    <div style={{ display: "flex", gap: 48, alignItems: "flex-end", padding: 40, flexWrap: "wrap" }}>
      <RackV2 width={10} depth={2} height={1.5} cellSize={30} />
      <RackV2 width={4} depth={4} height={4} cellSize={30} />
      <RackV2 width={2} depth={2} height={6} cellSize={30} />
    </div>
  ),
};
