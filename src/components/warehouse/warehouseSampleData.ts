import { buildSlots, type WarehouseItem, type WarehouseRail, type WarehouseRobot } from "./warehouseModel";

/**
 * A small fulfilment floor: two blocks of racking either side of a central aisle, a picking line
 * feeding a packing station, chargers on the back wall, and four machines on the rails between
 * them.
 *
 * Laid out so the things the component has to get right are all visible at once — a lane in each
 * status, racks at different fill levels, a rail crossing a conveyor, a machine at a charger.
 */

/** Occupancy that reads as a real floor rather than as noise: the lower shelves are worked hardest
 *  and the top one is overflow, so fill drops with height. */
const fill = (bay: number, level: number, seed: number) => {
  const score = (Math.sin(bay * 12.9898 + level * 78.233 + seed) * 43758.5453) % 1;
  const chance = level === 0 ? 0.82 : level === 1 ? 0.6 : 0.3;
  const value = Math.abs(score);
  if (value < chance * 0.88) return "occupied" as const;
  if (value < chance) return "reserved" as const;
  return "empty" as const;
};

function rack(id: string, x: number, y: number, bays: number, seed: number): WarehouseItem {
  return {
    id,
    kind: "rack",
    label: id.toUpperCase(),
    x,
    y,
    width: bays,
    height: 2,
    bays,
    levels: 3,
    slots: buildSlots(bays, 3, (bay, level) => fill(bay, level, seed)),
  };
}

export const WAREHOUSE_ITEMS: WarehouseItem[] = [
  { id: "zone-stock", kind: "zone", label: "Stockage", x: 2, y: 2, width: 30, height: 18 },
  { id: "zone-expe", kind: "zone", label: "Expédition", x: 35, y: 2, width: 16, height: 18 },

  rack("a1", 4, 4, 10, 1),
  rack("a2", 4, 8, 10, 2),
  rack("a3", 4, 12, 10, 3),
  rack("b1", 18, 4, 10, 4),
  rack("b2", 18, 8, 10, 5),
  rack("b3", 18, 12, 10, 6),

  { id: "conv-1", kind: "conveyor", label: "Convoyeur principal", x: 36, y: 6, width: 14, height: 1 },
  { id: "belt-1", kind: "belt", label: "Tapis d'emballage", x: 36, y: 12, width: 10, height: 1 },

  { id: "st-pack", kind: "station", label: "Emballage", x: 46, y: 10, width: 4, height: 4 },
  { id: "st-pick", kind: "station", label: "Prélèvement", x: 31, y: 4, width: 3, height: 3 },

  { id: "ch-1", kind: "charger", label: "Borne 1", x: 4, y: 17, width: 2, height: 2 },
  { id: "ch-2", kind: "charger", label: "Borne 2", x: 7, y: 17, width: 2, height: 2 },

  { id: "wall-n", kind: "wall", x: 2, y: 1, width: 49, height: 1 },
];

export const WAREHOUSE_RAILS: WarehouseRail[] = [
  // The main north-south aisle, and the two cross aisles serving the racking.
  { id: "rail-main", label: "Allée centrale", status: "active", points: [{ x: 15, y: 3 }, { x: 15, y: 19 }] },
  { id: "rail-east", label: "Allée est", status: "idle", points: [{ x: 29, y: 3 }, { x: 29, y: 19 }] },
  { id: "rail-cross-top", status: "idle", points: [{ x: 3, y: 3 }, { x: 34, y: 3 }] },
  { id: "rail-cross-mid", status: "reserved", points: [{ x: 3, y: 11 }, { x: 34, y: 11 }] },
  { id: "rail-cross-low", status: "blocked", points: [{ x: 3, y: 15 }, { x: 29, y: 15 }] },
  { id: "rail-out", status: "idle", points: [{ x: 29, y: 7 }, { x: 35, y: 7 }] },
  { id: "rail-dock", status: "closed", label: "Quai 3 — fermé", points: [{ x: 36, y: 16 }, { x: 50, y: 16 }] },
];

export const WAREHOUSE_ROBOTS: WarehouseRobot[] = [
  {
    id: "agv-1",
    label: "AGV-1",
    status: "loaded",
    pathStatus: "active",
    progress: 0.25,
    path: [
      { x: 15, y: 19 },
      { x: 15, y: 11 },
      { x: 29, y: 11 },
      { x: 29, y: 7 },
      { x: 35, y: 7 },
    ],
  },
  {
    id: "agv-2",
    label: "AGV-2",
    status: "moving",
    pathStatus: "reserved",
    progress: 0.6,
    path: [
      { x: 3, y: 11 },
      { x: 15, y: 11 },
      { x: 15, y: 3 },
    ],
  },
  {
    id: "agv-3",
    label: "AGV-3",
    status: "charging",
    progress: 0,
    path: [{ x: 5, y: 17 }],
  },
  {
    id: "agv-4",
    label: "AGV-4",
    status: "fault",
    pathStatus: "blocked",
    progress: 0.45,
    path: [
      { x: 3, y: 15 },
      { x: 29, y: 15 },
    ],
  },
];
