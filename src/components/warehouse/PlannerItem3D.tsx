import { DockWall, StandardWall } from "./BuildingWalls";
import { Fence } from "./Fence";
import { Conveyor } from "./Conveyor";
import { PalletRack } from "./PalletRack";
import { RackV2 } from "./RackV2";
import { StorageZone } from "./StorageZone";
import { Forklift } from "./Forklift";
import { Amr } from "./Amr";
import { RobotArm } from "./RobotArm";
import { SemiTruck } from "./SemiTruck";
import { ShippingContainer } from "./ShippingContainer";
import { Worker } from "./Worker";
import { Tree } from "./Tree";
import { StreetLight } from "./StreetLight";
import { LINEAR_THICKNESS, POINT_SIZE, isLinear, type PlannerItem } from "./plannerModel";

/**
 * Un élément du plan, rendu par le module 3D du kit qui lui correspond.
 *
 *  Le plan décrit un mur par ses deux bouts et un chariot par son centre ; les modules, eux, se
 *  posent par le coin de leur emprise et tournent autour de son centre. Ce composant fait la
 *  traduction, et rien d'autre : c'est le même mur, le même chariot que partout dans le kit.
 */

/** Un entier stable tiré d'un identifiant — la graine d'un arbre, par exemple. */
const hash = (s: string) => {
  let h = 7;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 100003;
  return h;
};

/** La hauteur du plancher des quais, en cases : celle d'un plancher de remorque. */
export const PLANNER_DOCK_LEVEL = 0.6;
/** La hauteur des murs, du sol à l'acrotère, en cases. */
export const PLANNER_WALL_TOP = 3;

export function PlannerItem3D({ item }: { item: PlannerItem }) {
  if (isLinear(item)) {
    const L = Math.max(0.5, Math.hypot(item.x1 - item.x0, item.y1 - item.y0));
    const rotation = (Math.atan2(item.y1 - item.y0, item.x1 - item.x0) * 180) / Math.PI;
    const mx = (item.x0 + item.x1) / 2;
    const my = (item.y0 + item.y1) / 2;
    const T = LINEAR_THICKNESS[item.kind];
    const origin = { x: mx - L / 2, y: my - T / 2 };
    switch (item.kind) {
      case "wall":
        return <StandardWall length={L} thickness={T} height={PLANNER_WALL_TOP} level={0} slab={false} origin={origin} rotation={rotation} />;
      case "dock": {
        const doors = Math.max(1, Math.floor((L - 1) / 3));
        return (
          <DockWall
            length={L}
            thickness={T}
            height={PLANNER_WALL_TOP - PLANNER_DOCK_LEVEL}
            level={PLANNER_DOCK_LEVEL}
            doors={doors}
            doorSpacing={3}
            yard={4.8}
            returns={1}
            origin={origin}
            rotation={rotation}
          />
        );
      }
      case "fence":
        return <Fence kind="mesh" length={L} origin={{ x: mx - L / 2, y: my }} rotation={rotation} />;
      case "conveyor":
        return <Conveyor kind="straight" length={L} width={T} legHeight={0.8} origin={origin} rotation={rotation} load="carton" shadows />;
      case "palletRack": {
        const bays = Math.max(1, Math.round((L - 0.1) / 1.35));
        const La = bays * 1.35 + 0.1;
        return <PalletRack bays={bays} levels={4} seed={hash(item.id)} origin={{ x: mx - La / 2, y: my - T / 2 }} rotation={rotation} />;
      }
    }
  }
  const p = item as Exclude<PlannerItem, { x0: number }>;
  const s = POINT_SIZE[p.kind];
  const origin = { x: p.x - s.length / 2, y: p.y - s.width / 2 };
  const center = { x: p.x, y: p.y };
  const rotation = p.rotation;
  switch (p.kind) {
    case "shelf":
      return <RackV2 width={s.length} depth={s.width} height={2.4} posts braces origin={origin} rotation={rotation} />;
    case "zone":
      return <StorageZone columns={3} rows={2} origin={origin} rotation={rotation} />;
    case "forklift":
      return <Forklift origin={origin} rotation={rotation} load="carton" driver />;
    case "amr":
      return <Amr origin={origin} rotation={rotation} />;
    case "arm":
      return <RobotArm origin={center} rotation={rotation} reach={1.4} running />;
    case "truck":
      return <SemiTruck origin={origin} rotation={rotation} />;
    case "container":
      return <ShippingContainer size="40" tone={hash(p.id) % 5} origin={origin} rotation={rotation} />;
    case "worker":
      return <Worker origin={center} rotation={rotation} />;
    case "tree":
      return <Tree origin={center} seed={hash(p.id)} kind={(["round", "conifer", "round", "poplar"] as const)[hash(p.id) % 4]} />;
    case "light":
      return <StreetLight kind="flood" origin={center} rotation={rotation} />;
  }
  return null;
}
