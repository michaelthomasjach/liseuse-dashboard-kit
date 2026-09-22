import type { Meta, StoryObj } from "@storybook/react";
import { Parking } from "./Parking";

const meta: Meta<typeof Parking> = {
  title: "Warehouse/Parking",
  component: Parking,
};
export default meta;
type Story = StoryObj<typeof Parking>;

export const Rangs: Story = {
  name: "Deux rangs adossés",
  args: { bays: 7, rows: 2, fill: 0.72, seed: 3, shadows: true, cellSize: 30 },
};

/** Un seul rang : ce qu'on met le long d'une clôture ou d'un bâtiment. */
export const Rang: Story = {
  name: "Un rang le long d'un mur",
  args: { bays: 8, rows: 1, fill: 0.8, seed: 11, shadows: true, cellSize: 30 },
};

/** Le taux d'occupation : le parking reste un parking à vide, parce que ce sont les traces au sol
 *  qui le disent et non les voitures. */
export const Occupation: Story = {
  name: "Ce que le remplissage change",
  render: () => (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-end", flexWrap: "wrap" }}>
      {[0, 0.5, 1].map((fill) => (
        <div key={fill} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Parking bays={5} rows={1} fill={fill} seed={7} shadows cellSize={28} />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{Math.round(fill * 100)} %</span>
        </div>
      ))}
    </div>
  ),
};
