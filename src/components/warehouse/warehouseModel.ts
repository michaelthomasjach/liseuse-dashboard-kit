/**
 * What a warehouse floor is made of, and the arithmetic for drawing it.
 *
 * Kept apart from the component for the same reason `tileMath.ts` and `sankeyLayout.ts` are: it is
 * geometry, it needs no DOM, and it is the part where being slightly wrong still looks plausible.
 *
 * ## One coordinate system, and it is not pixels
 *
 * Everything here is in **grid cells**, never in pixels. A warehouse is laid out on a grid in real
 * life — racks are whole bays wide, aisles are whole trucks wide — and a model in pixels would
 * make "two racks, back to back" a matter of getting a number right instead of a matter of putting
 * them next to each other. The pixel size of a cell is a rendering decision the canvas makes and
 * the zoom changes; the model never sees it.
 */

export type WarehouseItemKind = "rack" | "conveyor" | "belt" | "station" | "charger" | "zone" | "wall";

/** How a lane is doing. Drawn in pale tints rather than saturated ones: a floor plan is mostly
 *  lanes, and five saturated colours covering most of the picture would leave nothing for the
 *  things that actually move on it. */
export type WarehouseLaneStatus = "idle" | "active" | "reserved" | "blocked" | "closed";

export type WarehouseSlotStatus = "empty" | "occupied" | "reserved" | "blocked";

export type WarehouseRobotStatus = "moving" | "idle" | "loaded" | "charging" | "fault";

export interface WarehousePoint {
  x: number;
  y: number;
}

export interface WarehouseSlot {
  /** Position along the rack, 0 at its left (or top, for a vertical rack). */
  bay: number;
  /** Shelf, 0 at the bottom. */
  level: number;
  status: WarehouseSlotStatus;
  label?: string;
}

/** Quarter turns. Anything else would break the grid the whole model is built on. */
export type WarehouseRotation = 0 | 90 | 180 | 270;

export interface WarehouseItem {
  id: string;
  kind: WarehouseItemKind;
  label?: string;
  /** Top-left corner, in grid cells. */
  x: number;
  y: number;
  /**
   * Size in grid cells, in the item's *own* frame — along its length and across it.
   *
   * These do not swap when it is turned. A rack of eight bays is eight long whichever way it
   * faces, and swapping the numbers on rotation would mean "width" sometimes counted bays and
   * sometimes counted shelves. What the plan needs is `footprintOf`, which applies the rotation
   * and hands back the box the item actually occupies.
   */
  width: number;
  height: number;
  /** Quarter turns clockwise. Absent means 0. */
  rotation?: WarehouseRotation;
  /** Racks only: how many bays along the length and how many shelves up. Slots are addressed
   *  against these, so shrinking a rack leaves slots that no longer exist — `clampSlots` drops
   *  them rather than drawing them outside their own rack. */
  bays?: number;
  levels?: number;
  slots?: WarehouseSlot[];
  /** Overrides the colour the kind would give it. */
  color?: string;
}

/** A physical track a machine can travel on. The network you draw. */
export interface WarehouseRail {
  id: string;
  /** Ordered points in grid cells. Drawn as a polyline — no smoothing, because a rail that has
   *  been prettified no longer says where the machine can actually go. */
  points: WarehousePoint[];
  status?: WarehouseLaneStatus;
  label?: string;
}

/** A machine, and the route it has been given. */
export interface WarehouseRobot {
  id: string;
  label?: string;
  /** The route, in grid cells. Usually a walk over the rails, but nothing here enforces that: a
   *  free-roaming AMR has a path and no rails at all, and the drawing is the same either way. */
  path: WarehousePoint[];
  /** How far along `path` it is, 0 to 1.
   *
   *  The component draws this and nothing else — it runs no clock of its own. Same reasoning as
   *  `LevelMeter`: whatever is driving the floor (a WMS feed, a simulation, a replay) already owns
   *  the timing, and a component that invented its own would drift away from the thing it is
   *  supposed to be showing. `advanceRobots` is there for callers who have no such source. */
  progress: number;
  status?: WarehouseRobotStatus;
  /** Status of the route itself, drawn under the machine. Defaults to "active" while it is
   *  moving, so a robot always shows the lane it is claiming. */
  pathStatus?: WarehouseLaneStatus;
  color?: string;
}

export interface WarehouseLayout {
  items: WarehouseItem[];
  rails: WarehouseRail[];
  robots: WarehouseRobot[];
}

/** What each kind is called, how big it arrives, and whether it holds stock. One table rather than
 *  a switch in three places — the palette, the drop handler and the renderer all read it. */
export const WAREHOUSE_KINDS: Record<
  WarehouseItemKind,
  { label: string; hint: string; width: number; height: number; storage: boolean; bays?: number; levels?: number }
> = {
  rack: { label: "Étagère", hint: "Rayonnage à emplacements", width: 8, height: 2, storage: true, bays: 8, levels: 3 },
  conveyor: { label: "Convoyeur", hint: "Rouleaux, sens unique", width: 8, height: 1, storage: false },
  belt: { label: "Tapis", hint: "Bande continue", width: 6, height: 1, storage: false },
  station: { label: "Poste", hint: "Préparation ou emballage", width: 3, height: 3, storage: false },
  charger: { label: "Borne", hint: "Recharge des robots", width: 2, height: 2, storage: false },
  zone: { label: "Zone", hint: "Secteur nommé, posé au fond", width: 12, height: 8, storage: false },
  wall: { label: "Cloison", hint: "Mur ou séparation", width: 10, height: 1, storage: false },
};

export function snapToGrid(value: number): number {
  return Math.round(value);
}

/** The box an item actually occupies on the plan, once its rotation is applied. A quarter turn
 *  swaps the two sides; a half turn leaves them alone. */
export function footprintOf(item: WarehouseItem): { width: number; height: number } {
  const quarter = (item.rotation ?? 0) % 180 !== 0;
  return quarter ? { width: item.height, height: item.width } : { width: item.width, height: item.height };
}

/** Turns an item a quarter clockwise, **about its own centre**.
 *
 *  About the centre rather than the top-left corner, because that is where a rack stays put: an
 *  eight-by-two rack turned about its corner swings six cells across the aisle and lands on
 *  whatever was there. The result is re-snapped, so a turn never leaves an item off the grid. */
export function rotateItem(item: WarehouseItem): WarehouseItem {
  const before = footprintOf(item);
  const rotation = (((item.rotation ?? 0) + 90) % 360) as WarehouseRotation;
  const after = footprintOf({ ...item, rotation });
  return {
    ...item,
    rotation,
    x: snapToGrid(item.x + (before.width - after.width) / 2),
    y: snapToGrid(item.y + (before.height - after.height) / 2),
  };
}

/** Whether a rack's bays run left to right (as opposed to top to bottom) once turned. */
export function isHorizontal(item: WarehouseItem): boolean {
  return (item.rotation ?? 0) % 180 === 0;
}

/** Total length of a polyline in grid cells. */
export function pathLength(points: WarehousePoint[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  return total;
}

/**
 * Where along a polyline a fraction `t` falls, and which way the traveller is facing there.
 *
 * Measured by *distance*, not by point index. A route from a routing layer has its points bunched
 * at corners, so stepping index by index would make a machine crawl through every turn and bolt
 * down every straight — the one thing that makes a simulated floor look wrong immediately.
 */
export function pointAlongPath(points: WarehousePoint[], t: number): { x: number; y: number; angle: number } | null {
  if (points.length === 0) return null;
  if (points.length === 1) return { ...points[0], angle: 0 };

  const total = pathLength(points);
  if (total === 0) return { ...points[0], angle: 0 };

  const target = Math.min(1, Math.max(0, t)) * total;
  let travelled = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const step = Math.hypot(b.x - a.x, b.y - a.y);
    if (step === 0) continue;
    if (travelled + step >= target) {
      const local = (target - travelled) / step;
      return {
        x: a.x + (b.x - a.x) * local,
        y: a.y + (b.y - a.y) * local,
        angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
      };
    }
    travelled += step;
  }
  const last = points[points.length - 1];
  const previous = points[points.length - 2];
  return { ...last, angle: (Math.atan2(last.y - previous.y, last.x - previous.x) * 180) / Math.PI };
}

/**
 * Moves every robot along its own path by `seconds` at `cellsPerSecond`, turning round at the end.
 *
 * Offered for callers with no live feed — a demo, a story, a mock-up. It is deliberately *not*
 * wired into the component: a floor that animates itself would keep moving when the data behind it
 * had stopped, which is the worst thing a monitoring view can do.
 */
export function advanceRobots(robots: WarehouseRobot[], seconds: number, cellsPerSecond = 2.2): WarehouseRobot[] {
  return robots.map((robot) => {
    if (robot.status === "idle" || robot.status === "charging" || robot.status === "fault") return robot;
    const total = pathLength(robot.path);
    if (total === 0) return robot;
    // Ping-pong over 0…2 and fold the second half back, so a machine runs its route and returns
    // rather than teleporting home — which is what a modulo would do.
    const cycle = (robot.progress + (seconds * cellsPerSecond) / total) % 2;
    return { ...robot, progress: cycle > 1 ? 2 - cycle : cycle };
  });
}

/** Drops slots that fall outside their rack's own `bays`/`levels`. Shrinking a rack in the editor
 *  otherwise leaves stock addressed to shelves that are no longer there. */
export function clampSlots(item: WarehouseItem): WarehouseSlot[] {
  if (!item.slots) return [];
  const bays = item.bays ?? 0;
  const levels = item.levels ?? 0;
  return item.slots.filter((slot) => slot.bay < bays && slot.level < levels);
}

/** A full grid of slots for a rack, with `fill` deciding each one's status — for building a
 *  fixture, or for initialising a rack somebody just dropped. */
export function buildSlots(bays: number, levels: number, fill: (bay: number, level: number) => WarehouseSlotStatus): WarehouseSlot[] {
  const slots: WarehouseSlot[] = [];
  for (let level = 0; level < levels; level += 1) {
    for (let bay = 0; bay < bays; bay += 1) slots.push({ bay, level, status: fill(bay, level) });
  }
  return slots;
}
