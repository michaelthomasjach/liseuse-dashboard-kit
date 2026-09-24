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
import { Rail } from "./Rail";
import { Picker } from "./Picker";
import { Monorail } from "./Monorail";
import { Car } from "./Car";
import { Parking } from "./Parking";
import { SolarArray } from "./SolarPanel";
import { PowerLine } from "./PowerLine";
import { Barrier } from "./Barrier";
import { SlidingGate } from "./SlidingGate";
import { TollBooth } from "./TollBooth";
import { FlowerBed } from "./FlowerBed";
import { Transformer } from "./Transformer";
import { PackingMachine } from "./PackingMachine";
import { RobotCell } from "./RobotCell";
import { Roof } from "./Roof";
import { RoofHvac, RoofSolar } from "./RoofUnits";
import { ColdRoom } from "./ColdRoom";
import { TruckBay } from "./TruckBay";
import { TREE_KINDS } from "./Tree";
import type { WallOpening } from "./Wall";
import { Builder } from "./three/builder";
import { Parts, placed, useBuilt } from "./three/scene";
import { HVAC_UNITS, ROOF_SOLAR_TIERS, SOLAR_TIERS, TRUCK_BAY_WIDTH, WALL_MOUNTED, isLinear, isRooftop, levelOf, sizeOf, thicknessOf, type PlannerItem, type PlannerPoint } from "./plannerModel";

/**
 * Un élément du plan, rendu par le module 3D du kit qui lui correspond — **à son niveau
 * d'évolution**.
 *
 *  Le plan décrit un mur par ses deux bouts et un chariot par son centre ; les modules, eux, se
 *  posent par le coin de leur emprise et tournent autour de son centre. Ce composant fait la
 *  traduction, et choisit selon le niveau les options du module (voir `TIERS`) : c'est le même
 *  mur, le même chariot que partout dans le kit, plus ou moins équipé.
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

/** Le portique de contrôle d'un tapis : deux montants, une traverse, le scanner dessous. */
function ScannerArch({ origin, rotation, length, width }: { origin: { x: number; y: number }; rotation: number; length: number; width: number }) {
  const built = useBuilt(() => {
    const b = new Builder();
    const x = length / 2;
    const top = 1.75;
    for (const y of [-0.08, width + 0.02]) b.box("paint-light", x - 0.06, x + 0.06, y, y + 0.06, 0, top);
    b.box("paint-light", x - 0.1, x + 0.1, -0.08, width + 0.08, top, top + 0.1);
    b.box("paint-dark", x - 0.08, x + 0.08, width / 2 - 0.25, width / 2 + 0.25, top - 0.12, top);
    b.faceZ("lq-screen__face", top - 0.121, x - 0.06, x + 0.06, width / 2 - 0.2, width / 2 + 0.2);
    return b.build();
  }, [length, width]);
  const { pose } = placed(origin, rotation, { x0: 0, x1: length, y0: 0, y1: width, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}

/** Le télémètre d'un chariot autonome, sur son protège-conducteur, et son bandeau d'état. */
function AutonomyKit({ origin, rotation }: { origin: { x: number; y: number }; rotation: number }) {
  const built = useBuilt(() => {
    const b = new Builder();
    b.cylinder("paint-dark", 1.0, 0.5, 1.65, 0.07, 0.08, "z", 14);
    b.box("robot-led", 0.44, 1.48, 0.12, 0.88, 1.55, 1.58, false);
    return b.build();
  }, []);
  const { pose } = placed(origin, rotation, { x0: 0, x1: 2.7, y0: 0, y1: 1, z0: 0, z1: 1 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}

/**
 * `mounts` : les ouvertures qu'un mur porte — portes, fenêtres, baies accrochées à lui (voir
 * `wallMounts`). `roofs` : afficher les toitures, qu'on masque pour voir dedans — et avec elles ce
 * qui est posé dessus (`ROOFTOP_KINDS`) et le plafond des chambres froides. `night` : de 0 à 1,
 * allume les luminaires (`light`).
 */
export function PlannerItem3D({ item, mounts, roofs = true, night = 0 }: { item: PlannerItem; mounts?: WallOpening[]; roofs?: boolean; night?: number }) {
  const lv = levelOf(item);
  if (isLinear(item)) {
    const L = Math.max(0.5, Math.hypot(item.x1 - item.x0, item.y1 - item.y0));
    const rotation = (Math.atan2(item.y1 - item.y0, item.x1 - item.x0) * 180) / Math.PI;
    const mx = (item.x0 + item.x1) / 2;
    const my = (item.y0 + item.y1) / 2;
    const T = thicknessOf(item);
    const origin = { x: mx - L / 2, y: my - T / 2 };
    const axis = { x: mx - L / 2, y: my };
    switch (item.kind) {
      case "wall":
        return (
          <StandardWall
            length={L}
            thickness={T}
            height={PLANNER_WALL_TOP}
            level={0}
            slab={false}
            piers={lv === 1 ? "none" : "spaced"}
            cladding={lv === 3}
            openings={mounts}
            origin={origin}
            rotation={rotation}
          />
        );
      case "dock": {
        if (lv === 1) {
          // De plain-pied : des portes sectionnelles au niveau du sol, pour les utilitaires.
          const n = Math.max(1, Math.floor((L - 1) / 4));
          const openings = Array.from({ length: n }, (_, i) => ({ at: (L * (i + 0.5)) / n - 0.8, width: 1.6, height: 1.9 }));
          return <StandardWall length={L} thickness={T} height={PLANNER_WALL_TOP} level={0} slab={false} piers="ends" openings={[...openings, ...(mounts ?? [])]} origin={origin} rotation={rotation} />;
        }
        return (
          <DockWall
            length={L}
            thickness={T}
            height={PLANNER_WALL_TOP - PLANNER_DOCK_LEVEL}
            level={PLANNER_DOCK_LEVEL}
            doors={Math.max(1, Math.floor((L - 1) / 3))}
            doorSpacing={3}
            yard={0}
            returns={0}
            cladding={lv === 3}
            open={lv === 3 ? 0.85 : 0}
            origin={origin}
            rotation={rotation}
          />
        );
      }
      case "fence":
        return <Fence kind={(["guard", "mesh", "jersey"] as const)[lv - 1]} length={L} origin={axis} rotation={rotation} />;
      case "conveyor":
        return (
          <>
            <Conveyor kind="straight" length={L} width={T} legHeight={0.8} guardHeight={lv === 1 ? 0 : undefined} origin={origin} rotation={rotation} load="carton" shadows />
            {lv === 3 && <ScannerArch origin={origin} rotation={rotation} length={L} width={T} />}
          </>
        );
      case "rail":
        return lv >= 2 ? <Monorail length={L} origin={origin} rotation={rotation} /> : <Rail length={L} origin={origin} rotation={rotation} />;
      case "monorail":
        return <Monorail length={L} origin={origin} rotation={rotation} />;
      case "picker":
      case "monoPicker": {
        // Un picker n'existe pas sans sa voie : on pose la voie avec lui, de la même longueur.
        const mono = item.kind === "monoPicker" || lv >= 2;
        return (
          <>
            {mono ? <Monorail length={L} origin={origin} rotation={rotation} /> : <Rail length={L} origin={origin} rotation={rotation} />}
            <Picker track={mono ? "mono" : "twin"} travel={L} origin={origin} rotation={rotation} load="carton" />
          </>
        );
      }
      case "palletRack": {
        const bays = Math.max(1, Math.round((L - 0.1) / 1.35));
        const La = bays * 1.35 + 0.1;
        const mid = Math.floor(bays / 2);
        return (
          <PalletRack
            bays={bays}
            levels={lv + 2}
            double={lv === 3}
            seed={hash(item.id)}
            storage={item.storage}
            passage={item.passage && bays >= 3 ? { from: mid, to: mid + 1, clearance: 2.2 } : undefined}
            origin={{ x: mx - La / 2, y: my - T / 2 }}
            rotation={rotation}
          />
        );
      }
      case "powerLine":
        return <PowerLine kind={(["wood", "concrete", "pylon"] as const)[lv - 1]} length={L} origin={axis} rotation={rotation} />;
      case "lowWall":
        // Un muret : un mur bas, sans poteaux — ou à poteaux, plus haut — ou surmonté d'une grille.
        return (
          <>
            <StandardWall length={L} thickness={T} height={lv === 2 ? 0.8 : 0.5} level={0} slab={false} piers={lv === 2 ? "spaced" : "none"} origin={origin} rotation={rotation} />
            {lv === 3 && (
              <group position={[0, 0, 0.5]}>
                <Fence kind="mesh" length={L} height={0.7} origin={axis} rotation={rotation} />
              </group>
            )}
          </>
        );
      case "gate":
        return <SlidingGate length={L} origin={axis} rotation={rotation} cycle={lv === 2 ? 10 : undefined} />;
    }
    return null;
  }
  const p = item as PlannerPoint;
  const s = sizeOf(p);
  const origin = { x: p.x - s.length / 2, y: p.y - s.width / 2 };
  const center = { x: p.x, y: p.y };
  const rotation = p.rotation;
  // Une porte, une fenêtre, une baie n'existent que dans leur mur : c'est lui qui les dessine.
  if (WALL_MOUNTED.includes(p.kind)) return null;
  // Ce qui est sur les toits disparaît avec eux.
  if (!roofs && isRooftop(p)) return null;
  switch (p.kind) {
    case "shelf":
      if (lv === 1) return <RackV2 width={s.length} depth={s.width} height={2.4} posts braces storage={p.storage} clearance={p.passage ? 1.8 : 0} origin={origin} rotation={rotation} />;
      return (
        <RackV2
          width={s.length}
          depth={s.width}
          height={lv === 2 ? 2.8 : 3.8}
          shelves={lv === 2 ? 4 : 6}
          deckThickness={0.05}
          slotsX={3}
          contents={["carton", "boite", "bidon", "carton", "bouteille"]}
          posts
          braces
          storage={p.storage}
          clearance={p.passage ? 1.8 : 0}
          origin={origin}
          rotation={rotation}
        />
      );
    case "shelfDecks":
      return <RackV2 width={s.length} depth={s.width} height={2.8} shelves={4} deckThickness={0.05} slotsX={3} contents={["carton", "boite", "bidon", "carton", "bouteille"]} posts braces origin={origin} rotation={rotation} />;
    case "conveyorCorner":
      return <Conveyor kind="corner" width={s.width} legHeight={0.8} guardHeight={lv === 1 ? 0 : undefined} origin={origin} rotation={rotation} load="carton" shadows />;
    case "conveyorTee":
      return <Conveyor kind="tee" width={s.width} legHeight={0.8} guardHeight={lv === 1 ? 0 : undefined} origin={origin} rotation={rotation} load="carton" flow="split" branch shadows />;
    case "railCorner":
      return lv >= 2 ? <Monorail kind="corner" radius={2} origin={{ x: p.x - 1.3, y: p.y - 1.3 }} rotation={rotation} /> : <Rail kind="corner" origin={origin} rotation={rotation} />;
    case "monorailCorner":
      return <Monorail kind="corner" radius={2} origin={origin} rotation={rotation} />;
    case "zone":
      return <StorageZone columns={3} rows={2} fill={[0, 1, 3][lv - 1]} origin={origin} rotation={rotation} />;
    case "forklift":
      return (
        <>
          <Forklift origin={origin} rotation={rotation} load="carton" driver={lv === 1} />
          {lv === 2 && <AutonomyKit origin={origin} rotation={rotation} />}
        </>
      );
    case "amr":
      return <Amr origin={origin} rotation={rotation} load={lv === 1 ? null : "palette"} />;
    case "arm":
      return <RobotArm origin={center} rotation={rotation} reach={1.4} running={lv >= 2} />;
    case "truck":
      return lv === 1 ? <Car kind="van" tone="light" origin={origin} rotation={rotation} /> : <SemiTruck origin={origin} rotation={rotation} />;
    case "container":
      return <ShippingContainer size={lv === 1 ? "20" : "40"} stack={lv === 3 ? 2 : 1} tone={hash(p.id) % 5} origin={origin} rotation={rotation} />;
    case "worker":
      return <Worker origin={center} rotation={rotation} />;
    case "tree":
      return lv === 1 ? (
        <Tree origin={center} kind="bush" seed={hash(p.id)} height={0.8} />
      ) : (
        <Tree origin={center} seed={hash(p.id)} kind={TREE_KINDS[hash(p.id) % TREE_KINDS.length]} height={lv === 2 ? 3 : 4.6} />
      );
    case "light":
      return <StreetLight kind={(["bollard", "street", "flood"] as const)[lv - 1]} origin={center} rotation={rotation} glow={night} />;
    case "parking":
      return <Parking bays={6} rows={1} fill={0.7} seed={hash(p.id)} canopy={(["none", "roof", "solar"] as const)[lv - 1]} origin={origin} rotation={rotation} />;
    case "solar":
      return <SolarArray {...SOLAR_TIERS[lv - 1]} origin={origin} rotation={rotation} />;
    case "shrub":
      return <Tree origin={center} seed={hash(p.id)} kind={(["grass", "boxwood", "bush", "shrub"] as const)[lv - 1]} />;
    case "barrier":
      return <Barrier kind={lv === 3 ? "gantry" : "boom"} width={s.width - 0.4} cycle={lv === 2 ? 6 : undefined} origin={{ x: p.x, y: p.y - (s.width - 0.4) / 2 }} rotation={rotation} />;
    case "tollBooth":
      return <TollBooth lanes={lv} origin={origin} rotation={rotation} />;
    case "flowerBed":
      return lv === 3 ? (
        <FlowerBed shape="round" length={s.length} seed={hash(p.id)} origin={origin} rotation={rotation} />
      ) : (
        <FlowerBed length={s.length} width={s.width} seed={hash(p.id)} origin={origin} rotation={rotation} />
      );
    case "transformer":
      return <Transformer kind={(["pad", "kiosk", "substation", "gridStation"] as const)[lv - 1]} origin={origin} rotation={rotation} />;
    case "packer":
      return <PackingMachine process={(["label", "strap", "wrap", "box"] as const)[lv - 1]} origin={origin} rotation={rotation} />;
    case "consolidator":
      return <RobotCell kind="gantry" slots={[4, 6, 8][lv - 1]} origin={origin} rotation={rotation} />;
    case "delta":
      return <RobotCell kind="delta" origin={origin} rotation={rotation} />;
    case "palletizer":
      return <RobotCell kind="palletizer" origin={origin} rotation={rotation} />;
    case "roofSolar":
      return <RoofSolar {...ROOF_SOLAR_TIERS[lv - 1]} height={PLANNER_WALL_TOP} origin={origin} rotation={rotation} />;
    case "hvac":
      return <RoofHvac units={HVAC_UNITS[lv - 1]} length={s.length} width={s.width} height={PLANNER_WALL_TOP} origin={origin} rotation={rotation} />;
    case "coldRoom":
      return <ColdRoom kind={lv === 2 ? "negative" : "positive"} length={s.length} width={s.width} height={1.6} ceiling={roofs} origin={origin} rotation={rotation} />;
    case "truckBay":
      return <TruckBay bays={Math.round(s.width / TRUCK_BAY_WIDTH)} length={s.length} bayWidth={TRUCK_BAY_WIDTH} origin={origin} rotation={rotation} />;
    case "roof":
      return roofs ? <Roof kind={(["deck", "skylight", "cold"] as const)[lv - 1]} length={s.length} width={s.width} height={PLANNER_WALL_TOP} origin={origin} rotation={rotation} /> : null;
  }
  return null;
}
