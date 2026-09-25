import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { WarehousePlanner } from "./WarehousePlanner";
import type { PlannerItem } from "./plannerModel";

/**
 * Bâtir **en hauteur** : des étages sur un entrepôt, et des conteneurs empilés dans la cour.
 */
const meta: Meta<typeof WarehousePlanner> = {
  title: "Warehouse/Étages et piles",
  component: WarehousePlanner,
  parameters: { layout: "fullscreen", isoCamera: false },
};
export default meta;
type Story = StoryObj<typeof WarehousePlanner>;

const frame = { height: "calc(100dvh - 64px)" };

const BUILDING: PlannerItem[] = [
  // Le rez-de-chaussée : quatre murs, un escalier et un monte-charge qui montent au premier.
  { id: "s0", kind: "wall", level: 2, x0: 10, y0: 10, x1: 30, y1: 10 },
  { id: "e0", kind: "wall", level: 2, x0: 30, y0: 10, x1: 30, y1: 24 },
  { id: "n0", kind: "wall", level: 2, x0: 30, y0: 24, x1: 10, y1: 24 },
  { id: "w0", kind: "wall", level: 2, x0: 10, y0: 24, x1: 10, y1: 10 },
  { id: "rk0", kind: "palletRack", level: 2, x0: 13, y0: 19, x1: 25, y1: 19 },
  { id: "st0", kind: "stairs", level: 1, x: 27, y: 12.2, rotation: 90 },
  { id: "lift0", kind: "freightLift", level: 1, x: 12.5, y: 12.5, rotation: 0 },
  // Le premier étage : une dalle posée sur les murs du rez-de-chaussée, ses propres murs, des étagères.
  { id: "slab1", kind: "floorSlab", level: 2, x: 20, y: 17, rotation: 0, size: { length: 20, width: 14 }, floor: 1 },
  { id: "s1", kind: "wall", level: 2, x0: 10, y0: 10, x1: 22, y1: 10, floor: 1 },
  { id: "e1", kind: "wall", level: 2, x0: 22, y0: 10, x1: 22, y1: 24, floor: 1 },
  { id: "n1", kind: "wall", level: 2, x0: 22, y0: 24, x1: 10, y1: 24, floor: 1 },
  { id: "w1", kind: "wall", level: 2, x0: 10, y0: 24, x1: 10, y1: 10, floor: 1 },
  { id: "sh1", kind: "shelf", level: 2, x: 16, y: 20, rotation: 0, floor: 1 },
  { id: "sh2", kind: "shelf", level: 2, x: 16, y: 15, rotation: 0, floor: 1 },
  // La toiture coiffe le dernier étage.
  { id: "roof1", kind: "roof", level: 1, x: 16, y: 17, rotation: 0, size: { length: 12, width: 14 }, floor: 1 },
];

/**
 * Un entrepôt à deux niveaux. Le sélecteur d'étage (dans la barre d'outils) choisit ce qu'on édite :
 * au rez-de-chaussée, le premier étage est masqué ; au premier, tout est posé sur sa dalle, qui
 * repose sur les murs du dessous. « +2 » ouvre l'étage suivant : une dalle d'étage s'y trace comme
 * une toiture, sur les murs du premier. L'escalier et le monte-charge relient les niveaux.
 */
export const Etages: Story = {
  name: "Étages d'un entrepôt",
  render: function Render() {
    const [items, setItems] = useState<PlannerItem[]>(BUILDING);
    const [floor, setFloor] = useState(1);
    const [roofs, setRoofs] = useState(false);
    return (
      <div style={{ ...frame, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 13 }} data-testid="floor-readout">
          Étage édité : <strong>{floor === 0 ? "rez-de-chaussée" : `étage ${floor}`}</strong>
        </div>
        <WarehousePlanner
          seed={6}
          shape="rect"
          plotSize={{ width: 40, depth: 34 }}
          items={items}
          onItemsChange={setItems}
          activeFloor={floor}
          onActiveFloorChange={setFloor}
          roofs={roofs}
          onRoofsChange={setRoofs}
          groundStyle="clean"
          scenery={{ traffic: false }}
          defaultView="3d"
          defaultOrbit={{ yaw: 30, tilt: 38 }}
          defaultZoom={2}
          height="100%"
        />
      </div>
    );
  },
};

const YARD: PlannerItem[] = [
  // Des piles de conteneurs : 1, 2, 3 et 4 de haut, en 40 et en 20 pieds.
  ...[0, 1, 2, 3].map((k): PlannerItem => ({ id: `a${k}`, kind: "container", level: 2, x: 14, y: 12, rotation: 0, stackLevel: k })),
  ...[0, 1, 2].map((k): PlannerItem => ({ id: `b${k}`, kind: "container", level: 2, x: 14, y: 14.8, rotation: 0, stackLevel: k })),
  ...[0, 1].map((k): PlannerItem => ({ id: `c${k}`, kind: "container", level: 1, x: 24, y: 12, rotation: 0, stackLevel: k })),
  { id: "d0", kind: "container", level: 1, x: 24, y: 14.8, rotation: 0 },
];

/**
 * Stocker dehors, en hauteur : des conteneurs posés les uns sur les autres. Un conteneur lâché sur
 * une pile se cale dessus (« Niveau 3/4 ») ; au-delà de quatre, la pile est pleine ; un 40 pieds ne
 * se pose pas sur un 20 pieds. Retirer un conteneur emporte ceux qui sont dessus.
 */
export const Conteneurs: Story = {
  name: "Conteneurs empilés",
  render: function Render() {
    const [items, setItems] = useState<PlannerItem[]>(YARD);
    return (
      <div style={frame}>
        <WarehousePlanner
          seed={8}
          shape="rect"
          plotSize={{ width: 36, depth: 26 }}
          items={items}
          onItemsChange={setItems}
          groundStyle="clean"
          scenery={{ traffic: false }}
          defaultView="3d"
          defaultOrbit={{ yaw: 30, tilt: 34 }}
          defaultZoom={2.4}
          height="100%"
        />
      </div>
    );
  },
};
