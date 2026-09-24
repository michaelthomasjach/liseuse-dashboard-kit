import type { Meta, StoryObj } from "@storybook/react";
import { BUILDING_KINDS, BUILDING_LABEL, Building, Buildings, lotSize, type BuildingSpec } from "./Building";

/**
 * Les bâtiments du voisinage : ce qui entoure le terrain et qu'on n'exploite pas. Chacun tiré
 * d'une graine — deux voisins ne se ressemblent pas, un bâtiment garde son allure.
 */
const meta: Meta<typeof Building> = {
  title: "Warehouse/Bâtiment non interactif",
  component: Building,
};
export default meta;
type Story = StoryObj<typeof Building>;

export const Catalogue: Story = {
  name: "Les six sortes",
  render: () => (
    <div style={{ display: "flex", gap: 32, alignItems: "flex-end", flexWrap: "wrap", padding: 24 }}>
      {BUILDING_KINDS.map((kind) => (
        <div key={kind} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Building kind={kind} seed={3} rotation={180} cellSize={20} />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{BUILDING_LABEL[kind]}</span>
        </div>
      ))}
    </div>
  ),
};

export const Un: Story = {
  name: "Un bâtiment",
  args: { kind: "pavilion", seed: 1, rotation: 180, cellSize: 26 },
  argTypes: { kind: { control: "select", options: BUILDING_KINDS }, seed: { control: { type: "number", min: 1, max: 99 } } },
};

/** Une rue : les graines varient d'une parcelle à l'autre, et la rue a l'air d'une rue. */
export const Rue: Story = {
  name: "Une rue de voisins",
  render: () => {
    const kinds: BuildingSpec["kind"][] = ["house", "house", "shop", "house", "pavilion", "apartment", "office", "workshop"];
    let x = 0;
    const buildings: BuildingSpec[] = kinds.map((kind, i) => {
      const spec = { kind, seed: i + 2, origin: { x, y: 0 } };
      x += lotSize(kind).width + 0.3;
      return spec;
    });
    return <Buildings buildings={buildings} cellSize={12} />;
  },
};
