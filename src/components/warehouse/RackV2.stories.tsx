import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { RackV2 } from "./RackV2";
import { NumberField } from "../forms";

const meta: Meta<typeof RackV2> = {
  title: "Warehouse/Étagère V2",
  component: RackV2,
};
export default meta;
type Story = StoryObj<typeof RackV2>;

export const Boite: Story = {
  name: "La boîte",
  args: { width: 8, depth: 2, height: 2.4, cellSize: 34, posts: true, postSize: 0.22, deckThickness: 0.2 },
  render: (args) => (
    <div style={{ padding: 40 }}>
      <RackV2 {...args} />
    </div>
  ),
};

/** Trois champs pour les dimensions d'une étagère, trois pour le nombre d'étagères sur chaque axe.
 *  Les étagères se touchent : une enfilade d'étagères, c'est des étagères poussées l'une contre
 *  l'autre, et un espace entre deux est quelque chose qu'on obtient en demandant deux blocs. */
export const Atelier: Story = {
  name: "Dimensionner et multiplier",
  render: function Render() {
    const [size, setSize] = useState({ x: 6, y: 2, z: 2.4 });
    const [count, setCount] = useState({ x: 2, y: 2, z: 2 });

    // Le dessin grandit avec ce qu'on lui demande ; la case rétrécit pour que le tout reste
    // regardable sans faire défiler à chaque frappe.
    const cellSize = Math.max(8, Math.min(40, 260 / Math.max(size.x * count.x, size.y * count.y)));

    const field = (
      label: string,
      value: number,
      onChange: (next: number) => void,
      { min, max, step }: { min: number; max: number; step: number }
    ) => (
      <NumberField
        label={label}
        size="small"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(next) => onChange(next === "" ? min : Math.max(min, Math.min(max, next)))}
      />
    );

    const dimension = { min: 1, max: 20, step: 0.5 };
    const quantity = { min: 1, max: 8, step: 1 };

    return (
      <div style={{ display: "flex", gap: 32, alignItems: "flex-start", padding: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, width: 220 }}>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <legend style={{ padding: 0, fontSize: "0.75rem", fontWeight: 700 }}>Dimensions d'une étagère</legend>
            {field("X — longueur", size.x, (x) => setSize((s) => ({ ...s, x })), dimension)}
            {field("Y — profondeur", size.y, (y) => setSize((s) => ({ ...s, y })), dimension)}
            {field("Z — hauteur", size.z, (z) => setSize((s) => ({ ...s, z })), dimension)}
          </fieldset>

          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <legend style={{ padding: 0, fontSize: "0.75rem", fontWeight: 700 }}>Nombre d'étagères</legend>
            {field("X — en enfilade", count.x, (x) => setCount((c) => ({ ...c, x })), quantity)}
            {field("Y — en rangées", count.y, (y) => setCount((c) => ({ ...c, y })), quantity)}
            {field("Z — empilées", count.z, (z) => setCount((c) => ({ ...c, z })), quantity)}
          </fieldset>

          <p style={{ margin: 0, fontSize: "0.68rem", color: "var(--lq-color-text-muted)" }}>
            {count.x * count.y * count.z} étagère{count.x * count.y * count.z > 1 ? "s" : ""} ·{" "}
            {(size.x * count.x).toFixed(1)} × {(size.y * count.y).toFixed(1)} × {(size.z * count.z).toFixed(1)} cases
          </p>
        </div>

        <div style={{ flex: "1 1 400px", minWidth: 0, overflow: "auto" }}>
          <RackV2
            width={size.x}
            depth={size.y}
            height={size.z}
            countX={count.x}
            countY={count.y}
            countZ={count.z}
            cellSize={cellSize}
            posts
          />
        </div>
      </div>
    );
  },
};

/** `posts` remplace les quatre arêtes verticales par de vrais poteaux — des colonnes carrées posées
 *  *vers l'intérieur* de leur coin, donc la silhouette de la boîte ne bouge pas d'un pixel : on
 *  change ce dont les montants sont faits, pas où est l'étagère. La section par défaut est celle
 *  d'un montant de palettier ramenée à l'échelle du plan, et elle est la même partout. */
export const Poteaux: Story = {
  name: "De vrais poteaux",
  render: () => (
    <div style={{ display: "flex", gap: 64, alignItems: "flex-end", padding: 40, flexWrap: "wrap" }}>
      <RackV2 width={6} depth={2} height={2.4} cellSize={40} posts />
      <RackV2 width={6} depth={2} height={2.4} cellSize={40} />
    </div>
  ),
};

/** Le plateau du bas porte un carton — une chose pleine dans une ossature ajourée. À côté, la même
 *  étagère vide : c'est la comparaison qui dit ce que le carton ajoute. */
export const AvecCarton: Story = {
  name: "Un carton sur le plateau",
  render: () => (
    <div style={{ display: "flex", gap: 64, alignItems: "flex-end", padding: 40, flexWrap: "wrap" }}>
      <RackV2 width={6} depth={2} height={2.4} cellSize={40} posts />
      <RackV2 width={6} depth={2} height={2.4} cellSize={40} posts carton={null} />
    </div>
  ),
};

/** Trois proportions, pour vérifier que la boîte reste une boîte : longue et basse, cubique, haute
 *  et étroite. Les poteaux gardent leur section d'une étagère à l'autre — c'est une pièce d'acier,
 *  pas une fraction de la boîte. */
export const Proportions: Story = {
  name: "Proportions",
  render: () => (
    <div style={{ display: "flex", gap: 48, alignItems: "flex-end", padding: 40, flexWrap: "wrap" }}>
      <RackV2 width={10} depth={2} height={1.5} cellSize={30} posts />
      <RackV2 width={4} depth={4} height={4} cellSize={30} posts carton={{ x: 0.6, y: 0.6, width: 2, depth: 2, height: 1.4 }} />
      <RackV2 width={2} depth={2} height={6} cellSize={30} posts carton={{ x: 0.3, y: 0.3, width: 1.4, depth: 1.4, height: 1.2 }} />
    </div>
  ),
};
