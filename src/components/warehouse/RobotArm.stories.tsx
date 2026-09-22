import type { Meta, StoryObj } from "@storybook/react";
import { RobotArm } from "./RobotArm";
import { Conveyor } from "./Conveyor";
import { Scene, layer, type SceneUnit } from "./sceneStory";

const meta: Meta<typeof RobotArm> = {
  title: "Warehouse/Bras robotisé",
  component: RobotArm,
};
export default meta;
type Story = StoryObj<typeof RobotArm>;

export const Bras: Story = {
  name: "Le bras",
  args: { shoulder: 52, elbow: 74, reach: 1.7, holding: true, shadows: true, cellSize: 60 },
};

/** Trois poses. Les angles sont ceux de la machine — l'épaule depuis l'horizontale, le coude depuis
 *  le bras — donc replier le coude ne défait pas la levée de l'épaule. */
export const Poses: Story = {
  name: "Trois poses",
  render: () => (
    <div style={{ display: "flex", gap: 30, alignItems: "flex-end", flexWrap: "wrap" }}>
      {[
        { shoulder: 78, elbow: 30, label: "Levé" },
        { shoulder: 52, elbow: 74, label: "En prise" },
        { shoulder: 24, elbow: 96, label: "Posé bas" },
      ].map((p) => (
        <div key={p.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <RobotArm shoulder={p.shoulder} elbow={p.elbow} shadows cellSize={48} />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{p.label}</span>
        </div>
      ))}
    </div>
  ),
};

/**
 * Ce pour quoi un bras existe : **prendre sur un tapis**.
 *
 * Les deux modules partagent un cadre, donc un seul repère : le bras est posé par l'axe de son
 * embase, à côté de la ligne, et la caméra range les deux.
 */
export const SurLigne: Story = {
  name: "Au bord d'une ligne",
  render: function Render() {
    const cellSize = 40;
    const L = 6;
    const W = 1.6;
    const frame = { x: -0.8, y: -1.6, width: L + 1.6, depth: W + 3.2, height: 2.6 };
    const shared = { cellSize, frame, shadows: true };
    const arms = [1.5, 4.1];

    const units: SceneUnit[] = [
      {
        key: "belt",
        x: 0,
        y: 0,
        width: L,
        height: W,
        shadow: (
          <div style={layer}>
            <Conveyor {...shared} kind="straight" length={L} width={W} legHeight={0.8} load="carton" loadCount={2} speed={0.9} parts="shadow" />
          </div>
        ),
        machine: (
          <div style={layer}>
            <Conveyor {...shared} kind="straight" length={L} width={W} legHeight={0.8} load="carton" loadCount={2} speed={0.9} parts="machine" />
          </div>
        ),
        load: (
          <div style={layer}>
            <Conveyor {...shared} kind="straight" length={L} width={W} legHeight={0.8} load="carton" loadCount={2} speed={0.9} parts="load" />
          </div>
        ),
      },
      ...arms.map((x, i) => ({
        key: `arm${i}`,
        x: x - 0.4,
        y: W + 0.6,
        width: 0.8,
        height: 0.8,
        shadow: (
          <div style={layer}>
            <RobotArm {...shared} origin={{ x, y: W + 1 }} rotation={270} shoulder={i === 0 ? 60 : 44} elbow={i === 0 ? 86 : 70} parts="shadow" />
          </div>
        ),
        machine: (
          <div style={layer}>
            <RobotArm {...shared} origin={{ x, y: W + 1 }} rotation={270} shoulder={i === 0 ? 60 : 44} elbow={i === 0 ? 86 : 70} parts="machine" />
          </div>
        ),
      })),
    ];

    return <Scene frame={frame} cellSize={cellSize} units={units} padding={28} />;
  },
};
