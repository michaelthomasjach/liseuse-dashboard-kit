import type { Meta, StoryObj } from "@storybook/react";
import { Amr } from "./Amr";

const meta: Meta<typeof Amr> = {
  title: "Warehouse/Robot autonome",
  component: Amr,
};
export default meta;
type Story = StoryObj<typeof Amr>;

export const Robot: Story = {
  name: "Le robot",
  args: { load: "palette", shadows: true, cellSize: 60 },
};

/** Ce qu'il porte. Le plateau nu est la moitié du métier : un robot qui revient à vide est un robot
 *  qui va chercher. */
export const Charges: Story = {
  name: "Ce qu'il porte",
  render: () => (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-end", flexWrap: "wrap" }}>
      {[
        { load: "carton" as const, label: "Palette chargée" },
        { load: "palette" as const, label: "Palette seule" },
        { load: null, label: "À vide" },
      ].map((it) => (
        <div key={it.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Amr load={it.load} shadows cellSize={48} />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{it.label}</span>
        </div>
      ))}
    </div>
  ),
};

/** Quatre caps. Le bandeau fait le tour, donc il se voit sous tous : c'est ce qu'on lui demande. */
export const Caps: Story = {
  name: "Quatre caps",
  render: () => (
    <div style={{ display: "flex", gap: 36, alignItems: "flex-end", flexWrap: "wrap" }}>
      {[0, 90, 180, 270].map((r) => (
        <div key={r} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Amr rotation={r} load="carton" shadows cellSize={44} />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{r}°</span>
        </div>
      ))}
    </div>
  ),
};
