import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { WarehousePlanner } from "./WarehousePlanner";
import { generatePlot } from "./plot";
import type { PlannerItem } from "./plannerModel";
import { semiTruckGeometry } from "./SemiTruck";
import { dockDoorCenters } from "./BuildingWalls";

/**
 * Le plan de l'entrepôt : un terrain tiré d'une graine, une palette d'éléments 3D, et la vue de
 * dessus où l'on construit. Les murs s'étirent par leurs deux bouts et se déplacent par leur
 * milieu.
 */
const meta: Meta<typeof WarehousePlanner> = {
  title: "Warehouse/Plan d'entrepôt",
  component: WarehousePlanner,
  // La caméra est celle de l'éditeur — vue de dessus — et non celle du gizmo de la planche.
  parameters: { layout: "fullscreen", isoCamera: false },
};
export default meta;
type Story = StoryObj<typeof WarehousePlanner>;

// La planche entoure chaque story d'une marge de 32 px : l'éditeur remplit ce qui reste.
const frame = { height: "calc(100dvh - 64px)" };

export const Construire: Story = {
  name: "Construire sur un terrain",
  render: function Render() {
    const [seed, setSeed] = useState(7);
    const [items, setItems] = useState<PlannerItem[]>([]);
    return (
      <div style={frame}>
        <WarehousePlanner seed={seed} onSeedChange={setSeed} items={items} onItemsChange={setItems} height="100%" />
      </div>
    );
  },
};

/** Un entrepôt déjà commencé : un bâtiment fermé — un mur de quai et trois murs —, des racks, un
 *  tapis, des engins. Tout reste modifiable. */
export const EnCours: Story = {
  name: "Un entrepôt en cours",
  render: function Render() {
    const plot = useMemo(() => generatePlot(21, { shape: "rect" }), []);
    const initial = useMemo<PlannerItem[]>(() => {
      const x0 = 4;
      const y0 = 7;
      const x1 = Math.min(plot.width - 4, 28);
      const y1 = Math.min(plot.depth - 2, 20);
      const out: PlannerItem[] = [
        { id: "dock", kind: "dock", level: 2, x0, y0, x1, y1: y0 },
        { id: "east", kind: "wall", level: 2, x0: x1, y0, x1, y1 },
        { id: "north", kind: "wall", level: 2, x0: x1, y0: y1, x1: x0, y1 },
        { id: "west", kind: "wall", level: 2, x0, y0: y1, x1: x0, y1: y0 },
      ];
      for (let i = 0; i < 3; i += 1) out.push({ id: `rack${i}`, kind: "palletRack", level: 2, x0: x0 + 2, y0: y1 - 2 - i * 3, x1: x0 + 13, y1: y1 - 2 - i * 3 });
      out.push({ id: "belt", kind: "conveyor", level: 2, x0: x1 - 3, y0: y0 + 3, x1: x1 - 3, y1: y1 - 2 });
      out.push({ id: "fk", kind: "forklift", x: x0 + 8, y: y0 + 3, rotation: 0 });
      out.push({ id: "amr", kind: "amr", level: 2, x: x0 + 15, y: y0 + 4, rotation: 90 });
      out.push({ id: "w1", kind: "worker", x: x0 + 17, y: y0 + 3, rotation: 180 });
      out.push({ id: "c1", kind: "container", level: 2, x: plot.width - 5, y: 3, rotation: 90 });
      out.push({ id: "t1", kind: "tree", level: 2, x: 2, y: 2, rotation: 0 }, { id: "t2", kind: "tree", level: 2, x: 2, y: plot.depth - 2, rotation: 0 });
      return out;
    }, [plot]);
    const [items, setItems] = useState<PlannerItem[]>(initial);
    return (
      <div style={frame}>
        <WarehousePlanner seed={21} shape="rect" items={items} onItemsChange={setItems} height="100%" />
      </div>
    );
  },
};

/** Un terrain en L : une partie du rectangle est au voisin, derrière sa clôture. */
export const TerrainEnL: Story = {
  name: "Un terrain en L",
  render: () => (
    <div style={frame}>
      <WarehousePlanner defaultSeed={4} shape="L" height="100%" />
    </div>
  ),
};

/**
 * La démo : un centre de distribution complet, tous les éléments de la palette réunis.
 *
 * Un bâtiment de 88 × 56 m fermé par quatre murs, dont une façade de quai à sept portes — trois
 * semi-remorques à quai. Dedans : trois rangées de racks à palettes, des étagères, deux zones de
 * stockage au sol derrière les quais, une ligne de tapis (droits, un angle, un T qui dérive vers un
 * second tapis), un picker sur son rail qui tourne au bout de la travée, un bras robotisé en bout de
 * ligne, des chariots, un robot autonome, des opérateurs. Dehors : des conteneurs, des mâts
 * d'éclairage, des arbres, une clôture.
 *
 * Elle s'ouvre en vue 3D ; tout y reste modifiable — et « Dessus » ramène à la vue de plan.
 */
export const Demo: Story = {
  name: "Démo : un entrepôt complet",
  render: function Render() {
    const initial = useMemo<PlannerItem[]>(() => {
      const X0 = 6;
      const X1 = 50;
      const Y0 = 12;
      const Y1 = 40;
      const DOCK = 24;
      const truck = semiTruckGeometry().length;
      const doors = dockDoorCenters(DOCK, Math.floor((DOCK - 1) / 3), 3, 1.75);
      const list: PlannerItem[] = [
        // Le bâtiment : la façade de quai, puis les murs, tournés pour que leur dehors soit dehors.
        { id: "dock", kind: "dock", level: 2, x0: X0, y0: Y0, x1: X0 + DOCK, y1: Y0 },
        { id: "front", kind: "wall", level: 3, x0: X0 + DOCK, y0: Y0, x1: X1, y1: Y0 },
        { id: "east", kind: "wall", level: 2, x0: X1, y0: Y0, x1: X1, y1: Y1 },
        { id: "north", kind: "wall", level: 2, x0: X1, y0: Y1, x1: X0, y1: Y1 },
        { id: "west", kind: "wall", level: 2, x0: X0, y0: Y1, x1: X0, y1: Y0 },
      ];
      // Trois camions à quai, arrière contre la porte.
      for (const i of [0, 2, 4]) list.push({ id: `truck${i}`, kind: "truck", level: 2, x: X0 + doors[i], y: Y0 - 0.35 - truck / 2, rotation: -90 });
      // Le stockage lourd : trois rangées de racks, au fond.
      for (const [i, y] of [30, 33.5, 37].entries()) list.push({ id: `rack${i}`, kind: "palletRack", level: 2, x0: X0 + 3, y0: y, x1: X0 + 21, y1: y });
      // Derrière les quais, la réception : deux zones au sol, et les chariots qui les desservent.
      list.push({ id: "zone1", kind: "zone", level: 3, x: X0 + 6, y: Y0 + 4, rotation: 0 }, { id: "zone2", kind: "zone", level: 2, x: X0 + 13, y: Y0 + 4, rotation: 0 });
      list.push({ id: "fork1", kind: "forklift", x: X0 + 9, y: Y0 + 10, rotation: 90 }, { id: "fork2", kind: "forklift", level: 2, x: X0 + 17, y: Y0 + 21, rotation: 180 });
      // La ligne de tapis : un droit, un angle, un droit qui monte, un T qui dérive vers la gauche.
      list.push(
        { id: "belt1", kind: "conveyor", level: 3, x0: 30, y0: 18, x1: 40, y1: 18 },
        { id: "corner1", kind: "conveyorCorner", level: 2, x: 40.8, y: 18, rotation: 0 },
        { id: "belt2", kind: "conveyor", level: 2, x0: 40.8, y0: 18.8, x1: 40.8, y1: 26 },
        { id: "tee1", kind: "conveyorTee", level: 2, x: 40.8, y: 26.8, rotation: 90 },
        { id: "belt3", kind: "conveyor", level: 2, x0: 40.8, y0: 27.6, x1: 40.8, y1: 31 },
        { id: "belt4", kind: "conveyor", level: 2, x0: 40, y0: 26.8, x1: 33, y1: 26.8 }
      );
      list.push({ id: "arm1", kind: "arm", level: 2, x: 43.2, y: 30.5, rotation: 180 });
      // Le picker et sa voie : la travée, puis un rail d'angle et un rail qui remonte.
      list.push(
        { id: "picker1", kind: "picker", x0: 30, y0: 34, x1: 46, y1: 34 },
        { id: "railC", kind: "railCorner", x: 47.35, y: 34.45, rotation: 0 },
        { id: "rail1", kind: "rail", x0: 47.8, y0: 35.8, x1: 47.8, y1: 39 }
      );
      list.push({ id: "decks1", kind: "shelf", level: 2, x: 34, y: 37.5, rotation: 0 }, { id: "decks2", kind: "shelf", level: 2, x: 39, y: 37.5, rotation: 0 });
      list.push({ id: "shelf1", kind: "shelf", x: 47.5, y: 22, rotation: 90 }, { id: "shelf2", kind: "shelf", x: 47.5, y: 27, rotation: 90 });
      list.push({ id: "amr1", kind: "amr", level: 2, x: 34, y: 22, rotation: 0 });
      list.push({ id: "w1", kind: "worker", x: 28.5, y: 20, rotation: 180 }, { id: "w2", kind: "worker", x: 37, y: 30, rotation: 90 }, { id: "w3", kind: "worker", x: 12, y: 16.5, rotation: 0 });
      // Dehors.
      list.push({ id: "cont1", kind: "container", level: 2, x: 54, y: 20, rotation: 90 }, { id: "cont2", kind: "container", level: 3, x: 56, y: 20, rotation: 90 });
      list.push({ id: "light1", kind: "light", level: 3, x: 3, y: 8, rotation: 0 }, { id: "light2", kind: "light", level: 3, x: 34, y: 7, rotation: 0 });
      // L'énergie : un parking solaire, un petit champ de panneaux, la ligne qui alimente le site.
      list.push({ id: "parking1", kind: "parking", level: 3, x: 55.5, y: 33, rotation: 90 });
      list.push({ id: "solar1", kind: "solar", level: 1, x: 3, y: 30, rotation: 90 });
      list.push({ id: "line1", kind: "powerLine", level: 2, x0: 2, y0: 43, x1: 58, y1: 43 });
      for (const [i, [x, y]] of [
        [2, 2],
        [57, 3],
        [2, 41],
        [57, 41],
      ].entries())
        list.push({ id: `tree${i}`, kind: "tree", level: 3, x, y, rotation: 0 });
      // Des équipements : le poste qui alimente le site, des parterres devant les bureaux, une
      // barrière sur l'accès, des fenêtres et une porte sur le mur arrière.
      list.push({ id: "transfo", kind: "transformer", level: 2, x: 20, y: 41.3, rotation: 0 });
      list.push({ id: "flowers1", kind: "flowerBed", level: 2, x: 40, y: 6, rotation: 0 }, { id: "flowers2", kind: "flowerBed", level: 3, x: 47, y: 6, rotation: 0 });
      list.push({ id: "door1", kind: "door", x: 44, y: 12, rotation: 0 }, { id: "win1", kind: "window", x: 38, y: 12, rotation: 0 }, { id: "bay1", kind: "bay", level: 2, x: 31.5 + 2.5, y: 40, rotation: 180 });
      list.push({ id: "fence1", kind: "fence", level: 2, x0: 52, y0: 26, x1: 52, y1: 42 });
      return list;
    }, []);
    const [items, setItems] = useState<PlannerItem[]>(initial);
    return (
      <div style={frame}>
        <WarehousePlanner seed={12} shape="rect" plotSize={{ width: 60, depth: 44 }} items={items} onItemsChange={setItems} defaultView="3d" defaultOrbit={{ yaw: 210, tilt: 36 }} defaultZoom={1.9} height="100%" />
      </div>
    );
  },
};
