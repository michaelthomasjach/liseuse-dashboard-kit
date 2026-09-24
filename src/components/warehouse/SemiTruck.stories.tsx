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

/** Le tracteur seul, dételé.
 *
 *  Ce n'est pas un cadrage plus serré du semi : c'est l'autre moitié de l'attelage, celle qui roule
 *  et qui s'en va chercher une autre remorque. On voit ce que la remorque cache le reste du temps —
 *  la sellette, le bas de caisse continu du pare-chocs à l'essieu moteur, le dos de la cabine. */
export const Tracteur: Story = {
  name: "Le tracteur seul",
  args: { vehicle: "tractor", rotation: 0, shadows: true, cellSize: 60 },
  render: (args) => (
    <div style={{ padding: 40 }}>
      <SemiTruck {...args} />
    </div>
  ),
};

/** La remorque seule, posée sur ses béquilles.
 *
 *  Une semi-remorque n'a pas d'essieu avant : dételée, elle tient debout sur son tridem et sur les
 *  deux béquilles qu'on descend à la manivelle. C'est ce qui se voit ici, et qui explique la
 *  sellette d'en face. */
export const Remorque: Story = {
  name: "La remorque seule",
  args: { vehicle: "trailer", trailerLength: 7.6, rotation: 0, shadows: true, cellSize: 40 },
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

/** Diesel et électrique côte à côte : la cheminée d'échappement d'un côté ; de l'autre, les
 *  batteries, le liseré vert d'eau et la trappe de recharge. */
export const Electrique: Story = {
  name: "Diesel et électrique",
  render: () => (
    <div style={{ padding: 40, display: "flex", gap: 40, flexWrap: "wrap" }}>
      <SemiTruck trailerLength={7.6} cellSize={30} variant="diesel" />
      <SemiTruck trailerLength={7.6} cellSize={30} variant="electric" />
    </div>
  ),
};
