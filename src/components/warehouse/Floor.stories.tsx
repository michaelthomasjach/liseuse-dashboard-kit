import type { Meta, StoryObj } from "@storybook/react";
import { Floor } from "./Floor";
import { SemiTruck } from "./SemiTruck";
import { RackV2 } from "./RackV2";
import { Forklift } from "./Forklift";
import { Scene, layer, type SceneUnit } from "./sceneStory";

const meta: Meta<typeof Floor> = {
  title: "Warehouse/Sol",
  component: Floor,
};
export default meta;
type Story = StoryObj<typeof Floor>;

export const Dalle: Story = {
  name: "Une dalle",
  args: { width: 10, depth: 7, thickness: 0.3, joints: 2.5, cellSize: 34 },
};

/**
 * Ce que la dalle change : une scène posée dessus a un sol qui **s'arrête quelque part**.
 *
 * Elle se peint avant tout le monde — y compris avant les ombres, qui sont au sol et doivent tomber
 * dessus — donc elle ne fait pas partie des groupes que la caméra range : elle est dessous, et le
 * restera à tous les caps.
 */
export const Posee: Story = {
  name: "Une scène posée dessus",
  render: function Render() {
    const cellSize = 30;
    const floor = { width: 13, depth: 8 };
    const frame = { x: -0.6, y: -0.6, width: floor.width + 1.2, depth: floor.depth + 1.2, height: 3 };
    const shared = { cellSize, frame, shadows: true };
    const rack = { x: 1.2, y: 1, width: 5, depth: 1.8 };
    const truck = { x: 1, y: 4.6 };

    const units: SceneUnit[] = [
      {
        key: "rack",
        x: rack.x,
        y: rack.y,
        width: rack.width,
        height: rack.depth,
        shadow: (
          <div style={layer}>
            <RackV2 {...shared} origin={{ x: rack.x, y: rack.y }} width={rack.width} depth={rack.depth} height={1.4} countZ={2} slotsX={3} contents={["carton", null, "boite"]} posts braces feet parts="shadow" />
          </div>
        ),
        machine: (
          <div style={layer}>
            <RackV2 {...shared} origin={{ x: rack.x, y: rack.y }} width={rack.width} depth={rack.depth} height={1.4} countZ={2} slotsX={3} contents={["carton", null, "boite"]} posts braces feet parts="machine" />
          </div>
        ),
      },
      {
        key: "forklift",
        x: 7.4,
        y: 1.2,
        width: 2.7,
        height: 1,
        shadow: (
          <div style={layer}>
            <Forklift {...shared} origin={{ x: 7.4, y: 1.2 }} rotation={180} load="palette" lift={0.9} parts="shadow" />
          </div>
        ),
        machine: (
          <div style={layer}>
            <Forklift {...shared} origin={{ x: 7.4, y: 1.2 }} rotation={180} load="palette" lift={0.9} parts="machine" />
          </div>
        ),
      },
      {
        key: "truck",
        x: truck.x,
        y: truck.y,
        width: 10.5,
        height: 1.3,
        shadow: (
          <div style={layer}>
            <SemiTruck {...shared} origin={truck} trailerLength={7} parts="shadow" />
          </div>
        ),
        machine: (
          <div style={layer}>
            <SemiTruck {...shared} origin={truck} trailerLength={7} parts="machine" />
          </div>
        ),
      },
    ];

    return (
      <Scene
        frame={frame}
        cellSize={cellSize}
        units={units}
        padding={28}
        under={
          <div style={layer}>
            <Floor {...shared} origin={{ x: 0, y: 0 }} width={floor.width} depth={floor.depth} joints={3} />
          </div>
        }
      />
    );
  },
};

/** L'épaisseur, de la tôle à la dalle de quai. C'est elle qu'on voit de la tranche, et c'est donc
 *  elle qui dit si le sol est un plancher ou un quai. */
export const Epaisseurs: Story = {
  name: "Ce que l'épaisseur change",
  render: () => (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-end", flexWrap: "wrap" }}>
      {[0.08, 0.3, 0.8].map((t) => (
        <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Floor width={5} depth={4} thickness={t} joints={2} cellSize={34} />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{t} case</span>
        </div>
      ))}
    </div>
  ),
};
