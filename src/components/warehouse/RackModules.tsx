import { clampSlots, footprintOf, isHorizontal, type WarehouseItem, type WarehouseSlotStatus } from "./warehouseModel";

/**
 * A rack drawn the way a rack is built: one module — two uprights, a beam per level, and whatever
 * is sitting on each beam — repeated once per bay, with adjacent modules sharing their post.
 *
 * ## Why this is not a grid of bordered cells
 *
 * Three earlier versions drew the rack as a CSS grid and tuned the cells' borders: tinted cells,
 * then transparent cells, then heavier vertical borders, then inset shadows. Every one of them
 * was still a table — and a table of white cells with rules between them does not read as steel
 * shelving however the rules are weighted, because the *thing* in a rack is the frame, and a
 * border is a property of a cell, not a thing. Here the frame is the drawing: posts and beams are
 * rectangles with real thickness, a pallet is a box resting on a beam, and an empty bay is exactly
 * what it is on the floor — the gap between two posts under a beam, with nothing in it.
 *
 * ## One elevation, four faces
 *
 * The module is drawn once, in its own frame: `u` runs along the rack's length, `v` runs *up from
 * the floor*. Each face then maps `(u, v)` onto its own box with a single transform:
 *
 *   - the isometric **front** wall is sheared up from its floor line (`ISO_FRONT_WALL`) with CSS-y
 *     running up the rack, so `(u, v)` lands as `(x, y)` unchanged;
 *   - the isometric **side** wall is sheared with CSS-x running up the rack (`ISO_SIDE_WALL`), so
 *     the two axes swap;
 *   - the **plan** view flattens the elevation into the footprint, level 0 along the aisle edge;
 *   - the **roof** (the top face in isometric) shows what is seen from above: the two long beams,
 *     the posts as squares, and the pallets on the top level.
 *
 * Which faces carry bays follows the rack's rotation. Bays run along its length, so an unturned
 * rack shows them on the front wall and its end on the side; turned a quarter, the reverse. An end
 * face is drawn as a single module with nothing on its beams — a rack's end has posts and beams
 * and no pallet facing the aisle.
 */

export type RackFace = "plan" | "roof" | "front" | "side";

export interface RackModulesProps {
  item: WarehouseItem;
  face: RackFace;
  /** Pixels per grid cell. */
  cellSize: number;
  /** The standing rack's height in cells — the isometric lift. Unused by the plan view. */
  lift?: number;
}

/** What a pallet is called in the tooltip, by status. */
const STATUS_LABEL: Record<WarehouseSlotStatus, string> = {
  empty: "libre",
  occupied: "occupé",
  reserved: "réservé",
  blocked: "bloqué",
};

export function RackModules({ item, face, cellSize, lift = 0 }: RackModulesProps) {
  const bays = item.bays ?? 0;
  const levels = item.levels ?? 0;
  if (item.kind !== "rack" || bays === 0 || levels === 0) return null;

  const px = (cells: number) => cells * cellSize;
  const box = footprintOf(item);
  const horizontal = isHorizontal(item);

  // Which faces show the bays, and how long the module run is on this face, in cells.
  const showsBays = face === "plan" || face === "roof" || face === (horizontal ? "front" : "side");
  const alongCells = face === "front" ? box.width : face === "side" ? box.height : horizontal ? box.width : box.height;
  const depthCells = horizontal ? box.height : box.width;

  // The elevation's own size: `uLen` along the run, `H` up. In plan the "height" is the footprint's
  // depth — the elevation is flattened into it, level 0 along the aisle edge.
  const uLen = px(alongCells);
  const H = face === "plan" || face === "roof" ? px(depthCells) : px(lift);
  const modules = showsBays ? bays : 1;
  const bayW = uLen / modules;
  const levelH = H / levels;

  // Member thicknesses, from the module's own size so the drawing keeps its proportions at every
  // zoom — a post is a tenth of a bay whether the bay is 20 px or 200.
  const post = Math.max(2, bayW * 0.1);
  const beam = Math.max(2, Math.min(levelH * 0.16, post));
  const gap = Math.max(1, post * 0.35);

  const byKey = new Map(clampSlots(item).map((slot) => [`${slot.bay}:${slot.level}`, slot]));

  // The face's own box, and the transform that lays `(u, v)` into it.
  let width: number;
  let height: number;
  let transform: string;
  if (face === "front") {
    width = uLen;
    height = H;
    transform = "";
  } else if (face === "side") {
    width = H;
    height = uLen;
    transform = "matrix(0 1 1 0 0 0)";
  } else if (horizontal) {
    // Plan / roof, rack along x: `v` grows toward the top of the footprint, so flip it — level 0
    // (and the front beam of the roof) lie along the bottom edge, the aisle side.
    width = uLen;
    height = H;
    transform = `matrix(1 0 0 -1 0 ${H})`;
  } else {
    width = H;
    height = uLen;
    transform = "matrix(0 1 1 0 0 0)";
  }

  const children: React.ReactNode[] = [];

  if (face === "roof") {
    // Seen from above: two long beams, a post at every division on both edges, and only the top
    // level's pallets — everything below is under them.
    children.push(<rect key="bf" className="lq-wh__beam" x={0} y={0} width={uLen} height={beam} />);
    children.push(<rect key="bb" className="lq-wh__beam" x={0} y={H - beam} width={uLen} height={beam} />);
    for (let i = 0; i <= modules; i += 1) {
      const x = Math.min(Math.max(0, i * bayW - post / 2), uLen - post);
      children.push(<rect key={`pf${i}`} className="lq-wh__post" x={x} y={0} width={post} height={post} />);
      children.push(<rect key={`pb${i}`} className="lq-wh__post" x={x} y={H - post} width={post} height={post} />);
    }
    for (let b = 0; b < modules; b += 1) {
      const slot = byKey.get(`${b}:${levels - 1}`);
      if (!slot || slot.status === "empty") continue;
      children.push(
        <rect
          key={`t${b}`}
          className={`lq-wh__pallet lq-wh__pallet--${slot.status}`}
          x={b * bayW + post / 2 + gap}
          y={beam + gap}
          width={bayW - post - 2 * gap}
          height={H - 2 * beam - 2 * gap}
        />
      );
    }
  } else {
    // The elevation. Beams first, then pallets on them, then the posts over everything — a post
    // stands in front of the beam ends and the pallet edges, which is what makes the modules read
    // as modules rather than as a ladder with boxes on it.
    for (let l = 0; l <= levels; l += 1) {
      const v = l === levels ? H - beam : l * levelH;
      children.push(<rect key={`b${l}`} className="lq-wh__beam" x={0} y={v} width={uLen} height={beam} />);
    }
    if (showsBays) {
      for (let b = 0; b < modules; b += 1) {
        for (let l = 0; l < levels; l += 1) {
          const slot = byKey.get(`${b}:${l}`);
          if (!slot || slot.status === "empty") continue;
          const opening = levelH - beam;
          children.push(
            <rect
              key={`p${b}-${l}`}
              className={`lq-wh__pallet lq-wh__pallet--${slot.status}`}
              x={b * bayW + post / 2 + gap}
              y={l * levelH + beam}
              width={bayW - post - 2 * gap}
              height={Math.max(1, opening * 0.68)}
            >
              <title>{slot.label ?? `Travée ${b + 1}, niveau ${l + 1} — ${STATUS_LABEL[slot.status]}`}</title>
            </rect>
          );
        }
      }
    }
    for (let i = 0; i <= modules; i += 1) {
      const x = Math.min(Math.max(0, i * bayW - post / 2), uLen - post);
      children.push(<rect key={`p${i}`} className="lq-wh__post" x={x} y={0} width={post} height={H} />);
    }
  }

  return (
    <svg className={`lq-wh__rack lq-wh__rack--${face}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <g transform={transform || undefined}>{children}</g>
    </svg>
  );
}
