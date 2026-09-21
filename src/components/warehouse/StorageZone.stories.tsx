import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { StorageZone } from "./StorageZone";
import { NumberField } from "../forms";

const meta: Meta<typeof StorageZone> = {
  title: "Warehouse/Zone de stockage",
  component: StorageZone,
};
export default meta;
type Story = StoryObj<typeof StorageZone>;

export const Zone: Story = {
  name: "Une zone",
  args: { columns: 5, rows: 4, fill: 3, palletSize: 1.2, gap: 0.35, unitHeight: 0.62, shadows: true, cellSize: 30 },
  render: (args) => (
    <div style={{ padding: 40 }}>
      <StorageZone {...args} />
    </div>
  ),
};

/** `stacks` donne la hauteur de chaque emplacement en ordre de lecture, et zéro le laisse vide.
 *  Un magasin plein n'est pas un magasin, c'est un magasin qu'on ne peut plus remplir : c'est le
 *  relief des piles qui dit où il reste de la place. */
export const Relief: Story = {
  name: "Un relief de piles",
  render: () => (
    <div style={{ padding: 40 }}>
      <StorageZone
        columns={6}
        rows={4}
        // prettier-ignore
        stacks={[
          3, 3, 2, 0, 1, 3,
          3, 2, 0, 0, 2, 3,
          2, 3, 3, 1, 3, 2,
          0, 1, 3, 3, 2, 0,
        ]}
        shadows
        cellSize={28}
      />
    </div>
  ),
};

/** Le jeu entre deux emplacements n'est pas décoratif : c'est ce qui permet de distinguer deux
 *  piles voisines de même hauteur, qui sans lui formeraient un seul pavé. À zéro, une zone pleine
 *  redevient un bloc — et c'est parfois ce qu'on veut dire. */
export const Jeu: Story = {
  name: "Le jeu entre les piles",
  render: () => (
    <div style={{ display: "flex", gap: 48, alignItems: "flex-end", padding: 40, flexWrap: "wrap" }}>
      {[0, 0.2, 0.5].map((gap) => (
        <div key={gap} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <StorageZone columns={3} rows={3} fill={2} gap={gap} shadows cellSize={30} />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>jeu {gap}</span>
        </div>
      ))}
    </div>
  ),
};

/** Les mêmes réglages, à la main. */
export const Atelier: Story = {
  name: "Régler la zone",
  render: function Render() {
    const [z, setZ] = useState({ columns: 5, rows: 4, fill: 3, gap: 0.35, rotation: 0 });
    const field = (label: string, key: keyof typeof z, min: number, max: number, step: number) => (
      <NumberField
        label={label}
        size="small"
        value={z[key]}
        min={min}
        max={max}
        step={step}
        onChange={(next) => setZ((s) => ({ ...s, [key]: next === "" ? min : Math.max(min, Math.min(max, next)) }))}
      />
    );
    return (
      <div style={{ display: "flex", gap: 32, alignItems: "flex-start", padding: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 200 }}>
          {field("Emplacements X", "columns", 1, 12, 1)}
          {field("Emplacements Y", "rows", 1, 12, 1)}
          {field("Hauteur des piles", "fill", 0, 6, 1)}
          {field("Jeu", "gap", 0, 1.5, 0.05)}
          {field("Rotation °", "rotation", 0, 360, 45)}
        </div>
        <div style={{ flex: "1 1 320px", minWidth: 0, overflow: "auto" }}>
          <StorageZone {...z} shadows cellSize={28} />
        </div>
      </div>
    );
  },
};
