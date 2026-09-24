import type { Meta, StoryObj } from "@storybook/react";
import { Wall } from "./Wall";
import { DockWall, StandardWall, wallPlacement } from "./BuildingWalls";
import { Floor } from "./Floor";
import { SemiTruck } from "./SemiTruck";
import { RackV2 } from "./RackV2";
import { Forklift } from "./Forklift";
import { Scene, SceneBox, layer, type SceneUnit } from "./sceneStory";
import { useIsoCamera } from "./isoCamera";

/**
 * Le sol de la scène : la plateforme, ses deux retours, et **la cour, à plat, entre eux**.
 *
 * Quatre dalles plutôt qu'une, parce qu'une `Floor` est un pavé et que ce sol n'en est pas un. La
 * plateforme s'arrête au nu de la façade de quai, sauf à ses deux bouts où elle avance border
 * l'aire de manœuvre ; et entre ces deux retours, là où la plateforme manque, la cour est **de
 * niveau**, au sol du site, jusqu'au pied des portes.
 *
 * Les quatre sont jointifs et de la même épaisseur, donc ils se raccordent sans joint : les faces
 * qu'ils s'opposent sont confondues. Ce sont quatre emprises au sol disjointes, rangées par la
 * caméra comme n'importe quels modules — au demi-tour, ce sont les retours et la cour qui passent
 * devant.
 */
function Dalle({
  cellSize,
  frame,
  width,
  depth,
  skirt,
  yard,
  level,
}: {
  cellSize: number;
  frame: { x: number; y: number; width: number; depth: number; height: number };
  width: number;
  depth: number;
  skirt: number;
  yard: number;
  level: number;
}) {
  const pads: { key: string; x: number; y: number; width: number; height: number; level: number; slope?: number }[] = [
    { key: "dalle", x: -skirt, y: 0, width: width + 2 * skirt, height: depth + skirt, level },
    { key: "retour-gauche", x: -skirt, y: -yard, width: skirt, height: yard, level },
    { key: "retour-droit", x: width, y: -yard, width: skirt, height: yard, level },
    // La cour, entre les deux retours : à plat, au niveau du site.
    { key: "cour", x: 0, y: -yard, width, height: yard, level: 0 },
  ];
  // En 3D, les dalles se posent sans ordre : c'est la profondeur qui dit laquelle cache l'autre.
  return (
    <>
      {pads.map((pad) => (
        <Floor
          key={pad.key}
          cellSize={cellSize}
          frame={frame}
          origin={{ x: pad.x, y: pad.y }}
          width={pad.width}
          depth={pad.height}
          level={pad.level}
          slope={pad.slope}
        />
      ))}
    </>
  );
}

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
      { at: 1.2, width: 1.8, height: 2.6, dock: true },
      { at: 5.1, width: 1.8, height: 2.6, dock: true },
      { at: 9, width: 1.8, height: 2.6, dock: true },
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
    // Le quai face à la caméra : les équipements d'une porte — joint, butées, commande — sont du
    // côté des camions, et une scène qui les montre de dos ne montre qu'un mur.
    const wallY = 3.2;
    const bays = [1.6, 5.4, 9.2];
    const trailer = 4.4;
    const truckLength = trailer + 1.75;
    // Une remorque se range **cul au quai** : tournée d'un quart de tour, son arrière regarde le
    // mur et sa cabine pointe vers la cour. Le camion tourne autour du centre de son emprise, d'où
    // l'origine qui recentre chaque camion sur sa porte.
    const truckAt = (bay: number) => ({ x: bay - truckLength / 2, y: wallY + 0.5 + truckLength / 2 - 0.65 });
    const openings = bays.map((x) => ({ at: x - 0.95, width: 1.9, height: 2.7, dock: true }));
    const frame = { x: -0.8, y: -2.6, width: 14.6, depth: 13.4, height: 3.6 };
    const shared = { cellSize, frame, shadows: true };

    const wall = (part: "shadow" | "machine") => (
      <div style={layer}>
        <Wall
          {...shared}
          origin={{ x: 0, y: wallY }}
          length={13}
          height={3.4}
          thickness={0.4}
          cut={1.5}
          dockSide="y1"
          openings={openings}
          parts={part}
        />
      </div>
    );

    const units: SceneUnit[] = [
      {
        key: "rack",
        x: 1,
        y: -1.6,
        width: 6,
        height: 1.6,
        shadow: (
          <div style={layer}>
            <RackV2 {...shared} origin={{ x: 1, y: -1.6 }} width={6} depth={1.6} height={1.3} countZ={2} slotsX={4} contents={["carton", "boite", null, "carton"]} posts braces feet parts="shadow" />
          </div>
        ),
        machine: (
          <div style={layer}>
            <RackV2 {...shared} origin={{ x: 1, y: -1.6 }} width={6} depth={1.6} height={1.3} countZ={2} slotsX={4} contents={["carton", "boite", null, "carton"]} posts braces feet parts="machine" />
          </div>
        ),
      },
      {
        key: "forklift",
        x: 8.4,
        y: -0.4,
        width: 2.7,
        height: 1,
        shadow: (
          <div style={layer}>
            <Forklift {...shared} origin={{ x: 8.4, y: -0.4 }} rotation={90} load="palette" lift={0.5} parts="shadow" />
          </div>
        ),
        machine: (
          <div style={layer}>
            <Forklift {...shared} origin={{ x: 8.4, y: -0.4 }} rotation={90} load="palette" lift={0.5} parts="machine" />
          </div>
        ),
      },
      { key: "wall", x: 0, y: wallY, width: 13, height: 0.4, shadow: wall("shadow"), machine: wall("machine") },
      ...bays.map((x, i) => ({
        key: `truck${i}`,
        x: x - 0.75,
        y: wallY + 0.5,
        width: 1.4,
        height: truckLength,
        shadow: (
          <div style={layer}>
            <SemiTruck {...shared} origin={truckAt(x)} rotation={90} trailerLength={trailer} parts="shadow" />
          </div>
        ),
        machine: (
          <div style={layer}>
            <SemiTruck {...shared} origin={truckAt(x)} rotation={90} trailerLength={trailer} parts="machine" />
          </div>
        ),
      })),
    ];

    return (
      <Scene
        frame={frame}
        cellSize={cellSize}
        units={units}
        padding={24}
        under={
          <div style={layer}>
            <Floor {...shared} origin={{ x: -0.4, y: -2.2 }} width={13.8} depth={12.6} />
          </div>
        }
      />
    );
  },
};

/**
 * Le mur de quai, seul : la façade percée de ses portes, la plateforme et ses deux retours, et la
 * cour, à plat, devant les portes. Un composant qu'on pose où on veut — `origin`,
 * `rotation` — pour faire d'un côté quelconque du bâtiment son côté expédition.
 */
export const MurDeQuai: StoryObj<typeof DockWall> = {
  name: "Mur de quai (composant)",
  render: (args) => <DockWall {...args} />,
  args: { length: 18, doors: 5, height: 3, level: 0.6, yard: 4.8, returns: 1.2, open: 0, cellSize: 22 },
};

/** Le mur standard, seul : le pan plein, ses poteaux, et la bande de sol qui borde l'extérieur. */
export const MurStandard: StoryObj<typeof StandardWall> = {
  name: "Mur standard (composant)",
  render: (args) => <StandardWall {...args} />,
  args: { length: 12, height: 3, level: 0.6, skirt: 1.2, corners: true, piers: "spaced", cellSize: 26 },
};

/**
 * Le bâtiment fermé, **assemblé** : un mur de quai et trois murs standard autour d'un plancher.
 *
 * Aucune origine tournée n'est calculée à la main : `wallPlacement` dit où poser chaque mur pour
 * qu'il tienne sur un bord du rectangle, l'extérieur vers le dehors. Changer la façade de quai de
 * côté, c'est échanger deux noms. Le mur du fond couvre les deux angles arrière de sa bande de sol ;
 * devant, ce sont les retours du quai qui bordent la cour.
 */
export const Batiment: Story = {
  name: "Le bâtiment fermé",
  render: function Render() {
    const cellSize = 20;
    const W = 18;
    const P = 12;
    const D = 0.3;
    const LEVEL = 0.6;
    const rect = { x: 0, y: 0, width: W, depth: P };
    const frame = { x: -1.7, y: -5.3, width: W + 3.4, depth: P + 7, height: 3.4 };
    return (
      <SceneBox frame={frame} cellSize={cellSize}>
        {/* Le plancher, entre les murs : chaque mur apporte la dalle qui est sous lui. */}
        <Floor origin={{ x: D, y: D }} width={W - 2 * D} depth={P - 2 * D} level={LEVEL} />
        <DockWall {...wallPlacement("front", rect, D)} thickness={D} level={LEVEL} doors={5} />
        <StandardWall {...wallPlacement("back", rect, D)} thickness={D} level={LEVEL} corners />
        <StandardWall {...wallPlacement("left", rect, D)} thickness={D} level={LEVEL} />
        <StandardWall {...wallPlacement("right", rect, D)} thickness={D} level={LEVEL} />
      </SceneBox>
    );
  },
};
