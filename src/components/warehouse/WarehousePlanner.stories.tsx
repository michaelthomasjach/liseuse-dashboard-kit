import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { WarehousePlanner } from "./WarehousePlanner";
import { generatePlot } from "./plot";
import type { PlannerItem } from "./plannerModel";

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
        { id: "dock", kind: "dock", x0, y0, x1, y1: y0 },
        { id: "east", kind: "wall", x0: x1, y0, x1, y1 },
        { id: "north", kind: "wall", x0: x1, y0: y1, x1: x0, y1 },
        { id: "west", kind: "wall", x0, y0: y1, x1: x0, y1: y0 },
      ];
      for (let i = 0; i < 3; i += 1) out.push({ id: `rack${i}`, kind: "palletRack", x0: x0 + 2, y0: y1 - 2 - i * 3, x1: x0 + 13, y1: y1 - 2 - i * 3 });
      out.push({ id: "belt", kind: "conveyor", x0: x1 - 3, y0: y0 + 3, x1: x1 - 3, y1: y1 - 2 });
      out.push({ id: "fk", kind: "forklift", x: x0 + 8, y: y0 + 3, rotation: 0 });
      out.push({ id: "amr", kind: "amr", x: x0 + 15, y: y0 + 4, rotation: 90 });
      out.push({ id: "w1", kind: "worker", x: x0 + 17, y: y0 + 3, rotation: 180 });
      out.push({ id: "c1", kind: "container", x: plot.width - 5, y: 3, rotation: 90 });
      out.push({ id: "t1", kind: "tree", x: 2, y: 2, rotation: 0 }, { id: "t2", kind: "tree", x: 2, y: plot.depth - 2, rotation: 0 });
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
