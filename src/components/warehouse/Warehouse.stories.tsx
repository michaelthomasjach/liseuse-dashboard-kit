import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { WarehouseCanvas } from "./WarehouseCanvas";
import { advanceRobots, type WarehouseItem, type WarehouseRail } from "./warehouseModel";
import { WAREHOUSE_ITEMS, WAREHOUSE_RAILS, WAREHOUSE_ROBOTS } from "./warehouseSampleData";

const meta: Meta<typeof WarehouseCanvas> = {
  title: "Warehouse/Plan d'entrepôt",
  component: WarehouseCanvas,
  // Pas de gizmo de rotation ici : le plan est du DOM tourné par une transformation CSS fixe, pas
  // des pièces isométriques qui lisent `IsoCamera` — le gizmo n'y ferait rien.
  parameters: { layout: "fullscreen", isoCamera: false },
};
export default meta;
type Story = StoryObj<typeof WarehouseCanvas>;

/** Le composant ne fait tourner aucune horloge — voir sa doc. Ici c'est la story qui joue le rôle
 *  du flux temps réel, avec `advanceRobots`, exporté pour exactement ce cas. */
function useMovingRobots(running: boolean) {
  const [robots, setRobots] = useState(WAREHOUSE_ROBOTS);
  useEffect(() => {
    if (!running) return;
    const step = 1 / 20;
    const id = setInterval(() => setRobots((current) => advanceRobots(current, step)), step * 1000);
    return () => clearInterval(id);
  }, [running]);
  return robots;
}

export const Vivant: Story = {
  name: "Plan animé",
  render: function Render() {
    const [items, setItems] = useState<WarehouseItem[]>(WAREHOUSE_ITEMS);
    const [rails, setRails] = useState<WarehouseRail[]>(WAREHOUSE_RAILS);
    const [selected, setSelected] = useState<string | null>(null);
    const robots = useMovingRobots(true);

    return (
      <div style={{ height: "100dvh", padding: 12, boxSizing: "border-box" }}>
        <WarehouseCanvas
          items={items}
          rails={rails}
          robots={robots}
          onItemsChange={setItems}
          onRailsChange={setRails}
          selectedId={selected}
          onSelectedIdChange={setSelected}
          height="100%"
        />
      </div>
    );
  },
};

/** Ce qu'un exploitant regarde : pas de palette, pas de geste d'édition, seulement le plan qui
 *  tourne. `readOnly` ne retire que l'édition — le déplacement et le zoom restent. */
export const Supervision: Story = {
  name: "Supervision (lecture seule)",
  render: function Render() {
    const robots = useMovingRobots(true);
    return (
      <div style={{ height: "100dvh", padding: 12, boxSizing: "border-box" }}>
        <WarehouseCanvas items={WAREHOUSE_ITEMS} rails={WAREHOUSE_RAILS} robots={robots} readOnly height="100%" />
      </div>
    );
  },
};

/** Un plan vide : tout se construit à la main. Glisser depuis la palette, puis « Tracer un rail »
 *  pour poser les points (Entrée ou double-clic pour terminer, Échap pour annuler). */
export const PlanVierge: Story = {
  name: "Plan vierge",
  render: function Render() {
    const [items, setItems] = useState<WarehouseItem[]>([]);
    const [rails, setRails] = useState<WarehouseRail[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    return (
      <div style={{ height: "100dvh", padding: 12, boxSizing: "border-box" }}>
        <WarehouseCanvas
          items={items}
          rails={rails}
          onItemsChange={setItems}
          onRailsChange={setRails}
          selectedId={selected}
          onSelectedIdChange={setSelected}
          height="100%"
        />
      </div>
    );
  },
};

/** La même scène, inclinée. Les étagères se dressent, les convoyeurs restent bas — le relief sert
 *  à dire ce qui est haut, pas seulement à annoncer que la vue a basculé. L'édition continue de
 *  fonctionner : la matrice de la caméra est inversée pour retrouver la case sous le pointeur. */
export const Isometrique: Story = {
  name: "Vue isométrique",
  render: function Render() {
    const [items, setItems] = useState<WarehouseItem[]>(WAREHOUSE_ITEMS);
    const [rails, setRails] = useState<WarehouseRail[]>(WAREHOUSE_RAILS);
    const [selected, setSelected] = useState<string | null>(null);
    const robots = useMovingRobots(true);
    return (
      <div style={{ height: "100dvh", padding: 12, boxSizing: "border-box" }}>
        <WarehouseCanvas
          items={items}
          rails={rails}
          robots={robots}
          onItemsChange={setItems}
          onRailsChange={setRails}
          selectedId={selected}
          onSelectedIdChange={setSelected}
          view3d="iso"
          height="100%"
        />
      </div>
    );
  },
};

/** Les statuts des voies, côte à côte. Les teintes sont volontairement pâles : un plan est
 *  essentiellement fait de voies, et cinq couleurs saturées couvrant la majorité de l'image ne
 *  laisseraient plus rien pour ce qui s'y déplace. */
export const StatutsDesVoies: Story = {
  name: "Statuts des voies",
  render: () => (
    <div style={{ height: 320, padding: 12, boxSizing: "border-box" }}>
      <WarehouseCanvas
        readOnly
        height="100%"
        cellSize={26}
        items={[
          { id: "l1", kind: "wall", label: "Libre", x: 1, y: 1, width: 1, height: 1 },
        ].slice(0, 0)}
        rails={[
          { id: "r1", status: "idle", points: [{ x: 2, y: 2 }, { x: 18, y: 2 }] },
          { id: "r2", status: "active", points: [{ x: 2, y: 4 }, { x: 18, y: 4 }] },
          { id: "r3", status: "reserved", points: [{ x: 2, y: 6 }, { x: 18, y: 6 }] },
          { id: "r4", status: "blocked", points: [{ x: 2, y: 8 }, { x: 18, y: 8 }] },
          { id: "r5", status: "closed", points: [{ x: 2, y: 10 }, { x: 18, y: 10 }] },
        ]}
      />
    </div>
  ),
};
