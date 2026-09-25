import { useState } from "react";
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

/**
 * Un parking d'employés qui vit : `fill` suit le nombre de personnes présentes — l'équipe du matin
 * arrive, celle de nuit est réduite. Les voitures entrent en roulant (elles longent l'allée puis
 * reculent dans leur place) et sortent de même ; monter `fill` n'ajoute que des voitures, celles
 * qui sont là restent, et le même `seed` donne toujours les mêmes places.
 */
export const Dynamique: Story = {
  name: "Qui se remplit selon les présents",
  render: function Render() {
    const [present, setPresent] = useState(6);
    const staff = 16;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
        <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          Employés présents : <strong>{present}</strong> / {staff}
          <input type="range" min={0} max={staff} value={present} onChange={(e) => setPresent(Number(e.target.value))} />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setPresent(14)}>Journée</button>
          <button type="button" onClick={() => setPresent(3)}>Nuit</button>
        </div>
        <Parking bays={8} rows={2} fill={present / staff} seed={5} shadows cellSize={34} />
      </div>
    );
  },
};
