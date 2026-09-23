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
 * **Le bâtiment fermé** : quatre murs, et la dalle qu'ils entourent.
 *
 * C'est la planche, à l'échelle : 36 000 × 24 000 mm hors tout, des murs de 6 000 de haut en
 * panneaux préfabriqués, un poteau à chaque bout et à chaque joint. Seule la façade avant est un
 * quai — cinq portes, leur casquette, leurs butoirs et leurs poteaux de protection — et c'est ce
 * qui donne son sens au reste : les trois autres murs sont aveugles, parce qu'un entrepôt ne
 * s'ouvre que là où les camions se rangent.
 *
 * **La dalle est à 1 200 mm**, et c'est la cote qui commande tout. Un plancher de remorque est à
 * 1 180 du sol ; un quai n'existe que pour arriver à ce niveau-là, sans quoi le seuil des portes
 * ouvrirait sur le vide sous la remorque. Ce qu'on voit tout autour du bâtiment est la tranche de
 * cette dalle, et la **rampe** au bout de la façade est le seul moyen d'y monter autrement que par
 * une porte.
 *
 * Les quatre murs sont quatre exemplaires du même composant. Un mur couché le long des `y` est le
 * même, tourné d'un quart de tour : `place` ci-dessous ne fait que traduire l'emprise voulue en
 * origine, puisque la rotation se fait autour du centre du mur et non autour de son coin.
 */
export const Batiment: Story = {
  name: "Le bâtiment fermé",
  render: function Render() {
    const cellSize = 20;
    // Les cotes de la planche, en cases — une case vaut deux mètres.
    const W = 18;
    const P = 12;
    const D = 0.3;
    const H = 3;
    const DOCK = 0.6;
    const RAMP = 3;
    const RAMP_W = 2.2;

    /** L'emprise voulue, traduite en origine : un mur tourné pivote autour de son centre. */
    const place = (axis: "x" | "y", length: number, x: number, y: number) =>
      axis === "x"
        ? { origin: { x, y }, rotation: 0 }
        : { origin: { x: x + (D - length) / 2, y: y + (length - D) / 2 }, rotation: 90 };

    const bays = [2.6, 5.6, 8.6, 11.6, 14.6];
    const frame = { x: -RAMP - 1, y: -RAMP_W - 1, width: W + RAMP + 2, depth: P + RAMP_W + 2, height: H + 0.4 };
    const shared = { cellSize, frame, height: H, thickness: D, shadows: true, dockHeight: DOCK } as const;

    const side = (key: string, axis: "x" | "y", length: number, x: number, y: number, extra: object = {}) => {
      const pos = place(axis, length, x, y);
      const draw = (part: "shadow" | "machine") => (
        <div style={layer}>
          <Wall {...shared} {...pos} length={length} parts={part} {...extra} />
        </div>
      );
      return {
        key,
        x,
        y,
        width: axis === "x" ? length : D,
        height: axis === "x" ? D : length,
        shadow: draw("shadow"),
        machine: draw("machine"),
      };
    };

    const units: SceneUnit[] = [
      side("back", "x", W, 0, P - D),
      side("left", "y", P, 0, 0),
      side("right", "y", P, W - D, 0),
      side("dock", "x", W, 0, 0, {
        dockSide: "y0",
        ramp: "start",
        rampLength: RAMP,
        rampWidth: RAMP_W,
        openings: bays.map((x) => ({ at: x - 0.875, width: 1.75, height: 1.8, dock: true })),
      }),
    ];

    return (
      <Scene
        frame={frame}
        cellSize={cellSize}
        units={units}
        under={
          <div style={layer}>
            <Floor cellSize={cellSize} frame={frame} origin={{ x: 0, y: 0 }} width={W} depth={P} level={DOCK} />
          </div>
        }
      />
    );
  },
};
