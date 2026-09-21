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
  args: { width: 8, depth: 2, height: 2.4, cellSize: 34, posts: true, postSize: 0.22, deckThickness: 0.2 },
  render: (args) => (
    <div style={{ padding: 40 }}>
      <RackV2 {...args} />
    </div>
  ),
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
