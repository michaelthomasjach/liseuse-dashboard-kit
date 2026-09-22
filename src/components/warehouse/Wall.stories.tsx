import type { Meta, StoryObj } from "@storybook/react";
import { Wall } from "./Wall";
import { Floor } from "./Floor";
import { SemiTruck } from "./SemiTruck";
import { RackV2 } from "./RackV2";
import { Forklift } from "./Forklift";
import { Scene, layer, type SceneUnit } from "./sceneStory";

const meta: Meta<typeof Wall> = {
  title: "Warehouse/Mur",
  component: Wall,
};
export default meta;
type Story = StoryObj<typeof Wall>;

export const Plein: Story = {
  name: "Un mur",
  args: { length: 9, height: 3.2, thickness: 0.3, shadows: true, cellSize: 34 },
};

/** Les portes sont des **trous** : on voit l'épaisseur du mur dans leur tableau, et le linteau
 *  continue au-dessus. */
export const Portes: Story = {
  name: "Un mur à portes",
  args: {
    length: 12,
    height: 3.4,
    thickness: 0.35,
    shadows: true,
    cellSize: 30,
    openings: [
      { at: 1.2, width: 1.8, height: 2.6 },
      { at: 5.1, width: 1.8, height: 2.6 },
      { at: 9, width: 1.8, height: 2.6 },
    ],
  },
};

/** La coupe, à trois hauteurs. Entier, le mur cache la scène ; coupé, il la borde. */
export const Coupe: Story = {
  name: "Couper le mur pour voir dedans",
  render: () => (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-end", flexWrap: "wrap" }}>
      {[0, 1.1, 0.5].map((cut) => (
        <div key={cut} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Wall length={6} height={3.2} thickness={0.3} cut={cut} shadows cellSize={32} />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{cut === 0 ? "entier" : `coupé à ${cut}`}</span>
        </div>
      ))}
    </div>
  ),
};

/**
 * Un quai : la dalle, le mur à portes, et les remorques rangées dessous.
 *
 * Le mur est **coupé** : entier, il cacherait exactement ce qu'on veut montrer. Les portes, plus
 * hautes que la coupe, traversent alors tout ce qui reste du mur : c'est par là que la marchandise
 * passe, et une remorque est rangée devant chacune, portes arrière au quai.
 */
export const Quai: Story = {
  name: "Un quai de chargement",
  render: function Render() {
    const cellSize = 24;
    const wallY = 6.4;
    const bays = [1.6, 5.4, 9.2];
    const trailer = 4.4;
    // Une remorque se range **cul au quai** : tournée d'un demi-tour de plus, sa porte arrière
    // regarde le mur et sa cabine pointe vers l'extérieur. Le camion tourne autour du centre de son
    // emprise, d'où l'origine qui recentre chaque camion sur sa porte.
    const truckLength = trailer + 1.6;
    const truckAt = (bay: number) => ({ x: bay - truckLength / 2 + 0.65, y: wallY - 3.35 - 0.65 });
    const frame = { x: -0.8, y: -0.8, width: 14.6, depth: 11, height: 3.6 };
    const shared = { cellSize, frame, shadows: true };

    const units: SceneUnit[] = [
      ...bays.map((x, i) => ({
        key: `truck${i}`,
        x: x - 0.75,
        y: wallY - truckLength,
        width: 1.4,
        height: truckLength,
        shadow: (
          <div style={layer}>
            <SemiTruck {...shared} origin={truckAt(x)} rotation={270} trailerLength={trailer} parts="shadow" />
          </div>
        ),
        machine: (
          <div style={layer}>
            <SemiTruck {...shared} origin={truckAt(x)} rotation={270} trailerLength={trailer} parts="machine" />
          </div>
        ),
      })),
      {
        key: "wall",
        x: 0,
        y: wallY,
        width: 13,
        height: 0.4,
        shadow: (
          <div style={layer}>
            <Wall {...shared} origin={{ x: 0, y: wallY }} length={13} height={3.4} thickness={0.4} cut={1.4} openings={bays.map((x) => ({ at: x - 0.25, width: 1.9, height: 2.7 }))} parts="shadow" />
          </div>
        ),
        machine: (
          <div style={layer}>
            <Wall {...shared} origin={{ x: 0, y: wallY }} length={13} height={3.4} thickness={0.4} cut={1.4} openings={bays.map((x) => ({ at: x - 0.25, width: 1.9, height: 2.7 }))} parts="machine" />
          </div>
        ),
      },
      {
        key: "rack",
        x: 1,
        y: 7.6,
        width: 6,
        height: 1.6,
        shadow: (
          <div style={layer}>
            <RackV2 {...shared} origin={{ x: 1, y: 7.6 }} width={6} depth={1.6} height={1.3} countZ={2} slotsX={4} contents={["carton", "boite", null, "carton"]} posts braces feet parts="shadow" />
          </div>
        ),
        machine: (
          <div style={layer}>
            <RackV2 {...shared} origin={{ x: 1, y: 7.6 }} width={6} depth={1.6} height={1.3} countZ={2} slotsX={4} contents={["carton", "boite", null, "carton"]} posts braces feet parts="machine" />
          </div>
        ),
      },
      {
        key: "forklift",
        x: 8.6,
        y: 7.8,
        width: 2.7,
        height: 1,
        shadow: (
          <div style={layer}>
            <Forklift {...shared} origin={{ x: 8.6, y: 7.8 }} rotation={180} load="palette" lift={0.5} parts="shadow" />
          </div>
        ),
        machine: (
          <div style={layer}>
            <Forklift {...shared} origin={{ x: 8.6, y: 7.8 }} rotation={180} load="palette" lift={0.5} parts="machine" />
          </div>
        ),
      },
    ];

    return (
      <Scene
        frame={frame}
        cellSize={cellSize}
        units={units}
        padding={24}
        under={
          <div style={layer}>
            <Floor {...shared} origin={{ x: -0.4, y: -0.4 }} width={13.8} depth={10.2} />
          </div>
        }
      />
    );
  },
};
