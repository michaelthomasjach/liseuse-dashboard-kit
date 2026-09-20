import { Fragment, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  WAREHOUSE_KINDS,
  clampSlots,
  footprintOf,
  isConveyor,
  rotateItem,
  isHorizontal,
  pointAlongPath,
  snapToGrid,
  type WarehouseItem,
  type WarehouseItemKind,
  type WarehouseRail,
  type WarehouseRobot,
} from "./warehouseModel";
import { conveyorLines, flowChevrons } from "./conveyorFlow";
import { ISO_HEIGHT, ISO_TRANSFORM, projectIso, unprojectIso } from "./warehouseIso";
import { RefreshIcon } from "../icons";
import { WarehouseInspector } from "./WarehouseInspector";
import "./WarehouseCanvas.css";

export interface WarehouseCanvasProps {
  items: WarehouseItem[];
  rails: WarehouseRail[];
  robots?: WarehouseRobot[];
  /** Fires with the whole next list, like every other controlled component here. Omit both this
   *  and `onRailsChange` for a read-only view of a running floor. */
  onItemsChange?: (items: WarehouseItem[]) => void;
  onRailsChange?: (rails: WarehouseRail[]) => void;
  /** Pixels per grid cell at 100 %. Default 22. */
  cellSize?: number;
  /** Which element is selected, by id. Controlled so a side panel can drive it. */
  selectedId?: string | null;
  onSelectedIdChange?: (id: string | null) => void;
  /** Hides the palette and every editing gesture, leaving pan and zoom. Default false. */
  readOnly?: boolean;
  /** `"plan"` (default) looks straight down; `"iso"` tilts the floor into an isometric view and
   *  stands the racks up. Editing works in both — see the component's own doc. */
  view3d?: "plan" | "iso";
  onView3dChange?: (mode: "plan" | "iso") => void;
  /** Height of the whole thing. Default "520px"; pass "100%" inside a sized container. */
  height?: number | string;
  className?: string;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 3;
/** Past this many screen pixels per cell, a rack is drawn with its individual locations rather
 *  than as one block. Same idea as the Sankey's labels: zooming in adds information instead of
 *  only making the same information bigger. */
const SLOT_DETAIL_AT = 14;
/** A pointer that moves less than this between press and release was a click, not a drag. */
const CLICK_SLACK = 4;
/** Seconds for one pass of the flow wave down a conveyor. Slow enough to read as a direction
 *  rather than a flicker, and the same for every conveyor whatever its length — a plan where the
 *  short belts pulsed faster than the long ones would be saying something about speed that is not
 *  in the data. */
const FLOW_CYCLE = 1.6;

type Drag =
  | { kind: "pan"; startX: number; startY: number; originX: number; originY: number }
  | { kind: "item"; id: string; grabX: number; grabY: number; x: number; y: number }
  | { kind: "resize"; id: string; x: number; y: number }
  | { kind: "palette"; itemKind: WarehouseItemKind; x: number; y: number; clientX: number; clientY: number };

const PALETTE_ORDER: WarehouseItemKind[][] = [
  ["rack", "station", "charger"],
  ["conveyor", "belt", "curve", "junction"],
  ["zone", "wall"],
];

/**
 * A warehouse floor you can draw: drop racks, conveyors and stations from a palette, trace the
 * rails between them, and watch machines run the routes they have been given.
 *
 * Built on the same canvas the no-code script editor uses — one `{x, y, scale}` view over an
 * absolutely-positioned layer, a palette you drag out of, wheel-zoom anchored on the pointer, and
 * a discriminated drag state. That is not code sharing for its own sake: the two surfaces are the
 * same gesture vocabulary, and a second canvas in this kit that panned or zoomed differently would
 * be the one that feels broken.
 *
 * ## Why the model is in cells and the screen is in pixels
 *
 * Everything the caller passes is in grid cells (see `warehouseModel.ts`). Racks are whole bays
 * wide and aisles are whole trucks wide, so "two racks back to back" should be a matter of putting
 * them next to each other rather than of getting a pixel figure right. Dragging snaps to the grid
 * for the same reason.
 *
 * ## Why nothing here animates
 *
 * `robots` are drawn at the `progress` they arrive with, and this component runs no clock. Whatever
 * is driving the floor — a WMS feed, a simulation, a replay — already owns the timing, and a view
 * that animated on its own would keep gliding after that source had stopped, which is the worst
 * thing a monitoring view can do. `advanceRobots` is exported for callers who have no such source.
 *
 * First version, meant to be built on: no rotation, no multi-select, no undo.
 */
export function WarehouseCanvas({
  items,
  rails,
  robots = [],
  onItemsChange,
  onRailsChange,
  cellSize = 22,
  selectedId = null,
  onSelectedIdChange,
  readOnly = false,
  view3d,
  onView3dChange,
  height = 520,
  className,
}: WarehouseCanvasProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 40, y: 40, scale: 1 });
  /** Uncontrolled unless the caller passes `view3d` — the toolbar toggle has to work on its own. */
  const [ownMode, setOwnMode] = useState<"plan" | "iso">("plan");
  const mode = view3d ?? ownMode;
  const iso = mode === "iso";
  const setMode = (next: "plan" | "iso") => {
    setOwnMode(next);
    onView3dChange?.(next);
  };
  const [drag, setDrag] = useState<Drag | null>(null);
  /** Points of the rail being traced, in cells. `null` when not tracing. */
  const [tracing, setTracing] = useState<{ points: { x: number; y: number }[]; cursor: { x: number; y: number } } | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  /**
   * The item the rotate handle belongs to, and the timer that lets the pointer reach it.
   *
   * The handle sits *outside* the box it turns, which is what makes it reachable on a rack that
   * fills its own footprint — and also means leaving the box would hide the handle before the
   * pointer got there. Releasing the hover is deferred, the same trick `UserMenu` uses to let a
   * pointer cross into a cascading submenu.
   */
  const [hoverItem, setHoverItem] = useState<string | null>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const holdHover = (id: string) => {
    window.clearTimeout(hoverTimer.current);
    setHoverItem(id);
  };
  const releaseHover = () => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setHoverItem(null), 140);
  };
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);
  /** Each item's own box on the plan. The inspector anchors to one of these, so it follows the
   *  item when the plan is panned or zoomed instead of floating where the item used to be. */
  const itemNodes = useRef(new Map<string, HTMLDivElement>());
  /** A stable object for `Popover`'s `anchorRef`, re-pointed at whichever item is selected. */
  const anchorRef = useRef<HTMLElement | null>(null);
  anchorRef.current = selectedId === null ? null : itemNodes.current.get(selectedId) ?? null;
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  /**
   * Set when a click lands on an item, read by the inspector's own `onClose`.
   *
   * `Popover` closes on any pointerdown outside its panel and its anchor — and clicking a *second*
   * item is exactly that. Its close handler runs after the item's own, so without this guard
   * selecting B would deselect B: select(B), then close → select(null). Escape and a click on the
   * empty plan still clear the selection, which is what closing should mean.
   */
  const reselecting = useRef(false);

  /**
   * A pointer released anywhere else ends the drag.
   *
   * The surface's own `pointerup` handles every release that lands on it, which is almost all of
   * them — and is the one that commits. This is for the rest: let go over the palette, over the
   * toolbar, or outside the window, and without it `drag` would still be set, so the canvas would
   * keep dragging whatever was grabbed on the next mouse move and never let go. It cancels rather
   * than commits, because a release off the canvas is not a placement.
   */
  useEffect(() => {
    if (drag === null) return;
    const cancel = () => setDrag(null);
    window.addEventListener("pointerup", cancel);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointerup", cancel);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [drag]);

  const editable = !readOnly && (onItemsChange !== undefined || onRailsChange !== undefined);
  const select = (id: string | null) => onSelectedIdChange?.(id);

  /** Client coordinates to grid cells. */
  const toCell = useCallback(
    (clientX: number, clientY: number) => {
      const rect = surfaceRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      // Back out the pan and the zoom first; what is left is the canvas's own pixel space in plan
      // view, and the *projected* pixel space in isometric — which the inverse matrix undoes.
      const px = (clientX - rect.left - view.x) / view.scale;
      const py = (clientY - rect.top - view.y) / view.scale;
      const flat = iso ? unprojectIso(px, py) : { x: px, y: py };
      return { x: flat.x / cellSize, y: flat.y / cellSize };
    },
    [view, cellSize, iso]
  );

  /**
   * While something is being carried out of the palette, the pointer is tracked on `window`.
   *
   * The surface's own `pointermove` only fires over the surface, so the ghost would sit frozen on
   * the palette until the pointer crossed into the plan — exactly the stretch where someone needs
   * to see that they have picked something up.
   */
  useEffect(() => {
    if (drag?.kind !== "palette") return;
    const track = (event: PointerEvent) => {
      const cell = toCell(event.clientX, event.clientY);
      setDrag((current) =>
        current?.kind === "palette"
          ? { ...current, x: cell.x, y: cell.y, clientX: event.clientX, clientY: event.clientY }
          : current
      );
    };
    window.addEventListener("pointermove", track);
    return () => window.removeEventListener("pointermove", track);
  }, [drag?.kind, toCell]);

  function onSurfacePointerDown(event: ReactPointerEvent) {
    if (event.button !== 0) return;
    if (tracing) {
      const cell = toCell(event.clientX, event.clientY);
      const point = { x: snapToGrid(cell.x), y: snapToGrid(cell.y) };
      setTracing({ points: [...tracing.points, point], cursor: point });
      return;
    }
    select(null);
    setDrag({ kind: "pan", startX: event.clientX, startY: event.clientY, originX: view.x, originY: view.y });
  }

  function onSurfacePointerMove(event: ReactPointerEvent) {
    if (tracing) {
      const cell = toCell(event.clientX, event.clientY);
      setTracing({ ...tracing, cursor: { x: snapToGrid(cell.x), y: snapToGrid(cell.y) } });
      return;
    }
    if (!drag) return;
    if (drag.kind === "pan") {
      setView((v) => ({ ...v, x: drag.originX + (event.clientX - drag.startX), y: drag.originY + (event.clientY - drag.startY) }));
      return;
    }
    const origin = pressOrigin.current;
    if (origin && Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > CLICK_SLACK) movedRef.current = true;
    const cell = toCell(event.clientX, event.clientY);
    if (drag.kind === "item") setDrag({ ...drag, x: cell.x - drag.grabX, y: cell.y - drag.grabY });
    else setDrag({ ...drag, x: cell.x, y: cell.y });
  }

  function onSurfacePointerUp() {
    if (!drag) {
      pressOrigin.current = null;
      return;
    }
    if (drag.kind === "item" && movedRef.current) {
      onItemsChange?.(
        items.map((item) => (item.id === drag.id ? { ...item, x: snapToGrid(drag.x), y: snapToGrid(drag.y) } : item))
      );
    } else if (drag.kind === "resize") {
      onItemsChange?.(
        items.map((item) => {
          if (item.id !== drag.id) return item;
          // The handle is dragged in the *footprint's* frame — what is on screen — and `width`
          // and `height` are the item's own sides, so a quarter-turned item has to map them back
          // or resizing it would swap which side was being pulled.
          const box = { width: Math.max(1, snapToGrid(drag.x - item.x)), height: Math.max(1, snapToGrid(drag.y - item.y)) };
          const quarter = (item.rotation ?? 0) % 180 !== 0;
          const width = quarter ? box.height : box.width;
          const height = quarter ? box.width : box.height;
          // A rack's bays follow its length rather than staying put: a rack made twice as long
          // with the same number of bays is a drawing of nothing real.
          const bays = item.bays === undefined ? undefined : Math.max(1, width);
          const next = { ...item, width, height, bays };
          return { ...next, slots: item.slots ? clampSlots(next) : undefined };
        })
      );
    } else if (drag.kind === "palette") {
      const preset = WAREHOUSE_KINDS[drag.itemKind];
      const item: WarehouseItem = {
        id: `${drag.itemKind}-${Date.now().toString(36)}`,
        kind: drag.itemKind,
        label: preset.label,
        x: snapToGrid(drag.x - preset.width / 2),
        y: snapToGrid(drag.y - preset.height / 2),
        width: preset.width,
        height: preset.height,
        bays: preset.bays,
        levels: preset.levels,
        slots: preset.storage ? [] : undefined,
      };
      onItemsChange?.([...items, item]);
      select(item.id);
    }
    setDrag(null);
    pressOrigin.current = null;
    movedRef.current = false;
  }

  function finishTrace() {
    if (tracing && tracing.points.length >= 2) {
      onRailsChange?.([...rails, { id: `rail-${Date.now().toString(36)}`, points: tracing.points, status: "idle" }]);
    }
    setTracing(null);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      if (tracing) {
        setTracing(null);
        event.preventDefault();
      }
      return;
    }
    if (event.key === "Enter" && tracing) {
      finishTrace();
      event.preventDefault();
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && selectedId && editable) {
      event.preventDefault();
      if (items.some((item) => item.id === selectedId)) onItemsChange?.(items.filter((item) => item.id !== selectedId));
      else onRailsChange?.(rails.filter((rail) => rail.id !== selectedId));
      select(null);
    }
  }

  /** Frames everything, so "where did my floor go" is one button rather than a hunt. */
  const fit = useCallback(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const xs: number[] = [];
    const ys: number[] = [];
    const note = (x: number, y: number) => {
      xs.push(x);
      ys.push(y);
    };
    for (const item of items) {
      note(item.x, item.y);
      note(item.x + item.width, item.y + item.height);
    }
    for (const rail of rails) for (const point of rail.points) note(point.x, point.y);
    for (const robot of robots) for (const point of robot.path) note(point.x, point.y);
    if (xs.length === 0) return setView({ x: 40, y: 40, scale: 1 });

    const rect = surface.getBoundingClientRect();
    const minX = Math.min(...xs) - 2;
    const maxX = Math.max(...xs) + 2;
    const minY = Math.min(...ys) - 2;
    const maxY = Math.max(...ys) + 2;

    // The box to fit is the one that ends up *on screen*, and the camera changes it: a plan turned
    // 45° is about half again as wide and a good deal shorter. Fitting the plan-view box in
    // isometric would leave the floor rattling around inside a frame sized for a shape it no
    // longer has. So the four corners are projected — plus the tallest item's top, which is what
    // actually reaches the upper edge once the racks stand up.
    const tallest = Math.max(0, ...items.map((item) => ISO_HEIGHT[item.kind])) * cellSize;
    const corners = iso
      ? [
          projectIso(minX * cellSize, minY * cellSize, 0),
          projectIso(maxX * cellSize, minY * cellSize, 0),
          projectIso(minX * cellSize, maxY * cellSize, 0),
          projectIso(maxX * cellSize, maxY * cellSize, 0),
          projectIso(minX * cellSize, minY * cellSize, tallest),
        ]
      : [
          { x: minX * cellSize, y: minY * cellSize },
          { x: maxX * cellSize, y: maxY * cellSize },
        ];
    const left = Math.min(...corners.map((c) => c.x));
    const right = Math.max(...corners.map((c) => c.x));
    const top = Math.min(...corners.map((c) => c.y));
    const bottom = Math.max(...corners.map((c) => c.y));

    const scale = Math.max(
      MIN_SCALE,
      Math.min(MAX_SCALE, Math.min(rect.width / Math.max(1, right - left), rect.height / Math.max(1, bottom - top)))
    );
    setView({
      scale,
      x: rect.width / 2 - ((left + right) / 2) * scale,
      y: rect.height / 2 - ((top + bottom) / 2) * scale,
    });
  }, [items, rails, robots, cellSize, iso]);

  const px = (cells: number) => cells * cellSize;

  /** A point on the plan, in cells, to its place on screen — whichever camera is in force. The
   *  overlay is outside the canvas transform, so anything drawn there has to be projected by hand;
   *  that is also what keeps its contents at a constant size instead of shrinking with the zoom. */
  const toScreen = (cellX: number, cellY: number, cellZ = 0) => {
    const flat = iso ? projectIso(px(cellX), px(cellY), px(cellZ)) : { x: px(cellX), y: px(cellY) };
    return { left: view.x + view.scale * flat.x, top: view.y + view.scale * flat.y };
  };

  /** The slab everything stands on, in cells — the content's own extent with a margin. Only drawn
   *  in isometric, where a tilted plan with nothing under it reads as objects floating in a void. */
  const floor = (() => {
    if (items.length === 0 && rails.length === 0) return { x: 0, y: 0, width: 40, height: 24 };
    const xs: number[] = [];
    const ys: number[] = [];
    for (const item of items) {
      const box = footprintOf(item);
      xs.push(item.x, item.x + box.width);
      ys.push(item.y, item.y + box.height);
    }
    for (const rail of rails) {
      for (const point of rail.points) {
        xs.push(point.x);
        ys.push(point.y);
      }
    }
    const minX = Math.floor(Math.min(...xs)) - 2;
    const minY = Math.floor(Math.min(...ys)) - 2;
    return { x: minX, y: minY, width: Math.ceil(Math.max(...xs)) + 2 - minX, height: Math.ceil(Math.max(...ys)) + 2 - minY };
  })();
  const showSlots = cellSize * view.scale >= SLOT_DETAIL_AT;

  /** A rail or a robot path as an SVG polyline, in pixels on the unscaled canvas layer. */
  const polyline = (points: { x: number; y: number }[]) => points.map((p) => `${px(p.x)},${px(p.y)}`).join(" ");

  return (
    <div className={["lq-wh", className].filter(Boolean).join(" ")} style={{ height }}>
      {editable && (
        <div className="lq-wh__palette">
          <p className="lq-wh__palette-intro">
            Glissez un élément sur le plan — il suit la souris et se pose sur la grille. Cliquez-en un pour le régler.
          </p>
          {PALETTE_ORDER.map((group, i) => (
            <section key={i} className="lq-wh__palette-group">
              {group.map((kind) => {
                const preset = WAREHOUSE_KINDS[kind];
                return (
                  <button
                    key={kind}
                    type="button"
                    className="lq-wh__palette-item"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      const cell = toCell(event.clientX, event.clientY);
                      setDrag({ kind: "palette", itemKind: kind, x: cell.x, y: cell.y, clientX: event.clientX, clientY: event.clientY });
                    }}
                  >
                    <span className={`lq-wh__swatch lq-wh__swatch--${kind}`} aria-hidden="true" />
                    <span className="lq-wh__palette-text">
                      <span className="lq-wh__palette-title">{preset.label}</span>
                      <span className="lq-wh__palette-hint">{preset.hint}</span>
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      )}

      <div className="lq-wh__stage">
        <div className="lq-wh__toolbar">
          {editable && (
            <button
              type="button"
              className={["lq-wh__tool", tracing && "lq-wh__tool--on"].filter(Boolean).join(" ")}
              onClick={() => (tracing ? finishTrace() : setTracing({ points: [], cursor: { x: 0, y: 0 } }))}
            >
              {tracing ? "Terminer le rail" : "Tracer un rail"}
            </button>
          )}
          <button
            type="button"
            className={["lq-wh__tool", iso && "lq-wh__tool--on"].filter(Boolean).join(" ")}
            onClick={() => setMode(iso ? "plan" : "iso")}
            aria-pressed={iso}
          >
            {iso ? "Vue de dessus" : "Vue isométrique"}
          </button>
          <button type="button" className="lq-wh__tool" onClick={fit}>
            Recadrer
          </button>
          <span className="lq-wh__zoom">{Math.round(view.scale * 100)} %</span>
          <span className="lq-wh__count">
            {items.length} élément{items.length > 1 ? "s" : ""} · {rails.length} rail{rails.length > 1 ? "s" : ""} ·{" "}
            {robots.length} machine{robots.length > 1 ? "s" : ""}
          </span>
        </div>

        <div
          ref={surfaceRef}
          className={[
            "lq-wh__surface",
            iso && "lq-wh__surface--iso",
            drag?.kind === "pan" && "lq-wh__surface--panning",
            tracing && "lq-wh__surface--tracing",
          ]
            .filter(Boolean)
            .join(" ")}
          // The screen-space grid is the plan view's own. Tilted, it would stay square while
          // everything on it went diagonal — so in isometric it is switched off here and drawn as
          // a real floor inside the canvas instead, where the camera projects it along with the
          // racks standing on it.
          style={
            iso
              ? undefined
              : { backgroundSize: `${px(1) * view.scale}px ${px(1) * view.scale}px`, backgroundPosition: `${view.x}px ${view.y}px` }
          }
          tabIndex={0}
          onPointerDown={onSurfacePointerDown}
          onPointerMove={onSurfacePointerMove}
          onPointerUp={onSurfacePointerUp}
          onPointerCancel={() => setDrag(null)}
          onDoubleClick={() => tracing && finishTrace()}
          onKeyDown={onKeyDown}
          onWheel={(event) => {
            event.preventDefault();
            const rect = event.currentTarget.getBoundingClientRect();
            const pointerX = event.clientX - rect.left;
            const pointerY = event.clientY - rect.top;
            setView((v) => {
              const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * Math.exp(-event.deltaY * 0.0015)));
              // Anchored on the pointer, so the cell under the cursor stays under it — the same
              // rule the script canvas and the tile map both follow.
              const ratio = scale / v.scale;
              return { scale, x: pointerX - (pointerX - v.x) * ratio, y: pointerY - (pointerY - v.y) * ratio };
            });
          }}
        >
          <div
            className={["lq-wh__canvas", iso && "lq-wh__canvas--iso"].filter(Boolean).join(" ")}
            style={{
              // The camera is appended after the pan and the zoom, in that order — which is the
              // order `toCell` undoes it in. The two must stay in step or a dragged rack lands
              // somewhere other than where the hand was.
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale}) ${iso ? ISO_TRANSFORM : ""}`.trim(),
            }}
          >
            {iso && (
              <div
                className="lq-wh__floor"
                style={{
                  left: px(floor.x),
                  top: px(floor.y),
                  width: px(floor.width),
                  height: px(floor.height),
                  backgroundSize: `${px(1)}px ${px(1)}px`,
                }}
              />
            )}
            {/* Zones first: they are the floor's own regions and everything stands on them. */}
            {items
              .filter((item) => item.kind === "zone")
              .map((item) => renderItem(item))}

            {/* Lanes under the machinery, machines over it — a robot must never disappear behind
                the rack it is working at. */}
            <svg className="lq-wh__lanes" aria-hidden="true">
              {rails.map((rail) => (
                <g key={rail.id} className={`lq-wh__rail lq-wh__rail--${rail.status ?? "idle"}`}>
                  <polyline className="lq-wh__rail-bed" points={polyline(rail.points)} />
                  <polyline className="lq-wh__rail-line" points={polyline(rail.points)} />
                  {editable && (
                    <polyline
                      className="lq-wh__rail-hit"
                      points={polyline(rail.points)}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        select(rail.id);
                      }}
                    />
                  )}
                  {selectedId === rail.id && rail.points.map((point, i) => <circle key={i} className="lq-wh__rail-node" cx={px(point.x)} cy={px(point.y)} r={3} />)}
                </g>
              ))}

              {robots.map((robot) => (
                <polyline
                  key={robot.id}
                  className={`lq-wh__path lq-wh__path--${robot.pathStatus ?? (robot.status === "moving" ? "active" : "idle")}`}
                  points={polyline(robot.path)}
                />
              ))}

              {tracing && tracing.points.length > 0 && (
                <polyline className="lq-wh__rail-pending" points={polyline([...tracing.points, tracing.cursor])} />
              )}
            </svg>

            {items.filter((item) => item.kind !== "zone").map((item) => renderItem(item))}

            {/* Where it will land. The ghost under the cursor says what is being carried; this
                says where it goes — and they are different places, because the drop snaps to the
                grid and the cursor does not. Without it, releasing is a guess. */}
            {drag?.kind === "palette" && (
              <div
                className="lq-wh__drop-preview"
                style={{
                  left: px(snapToGrid(drag.x - WAREHOUSE_KINDS[drag.itemKind].width / 2)),
                  top: px(snapToGrid(drag.y - WAREHOUSE_KINDS[drag.itemKind].height / 2)),
                  width: px(WAREHOUSE_KINDS[drag.itemKind].width),
                  height: px(WAREHOUSE_KINDS[drag.itemKind].height),
                }}
              />
            )}

            {robots.map((robot) => {
              const at = pointAlongPath(robot.path, robot.progress);
              if (at === null) return null;
              return (
                <div
                  key={robot.id}
                  className={`lq-wh__robot lq-wh__robot--${robot.status ?? "moving"}`}
                  style={{
                    left: px(at.x),
                    top: px(at.y),
                    width: px(1.6),
                    height: px(1.2),
                    transform: `translate(-50%, -50%) rotate(${at.angle}deg)${iso ? ` translateZ(${px(0.35)}px)` : ""}`,
                    backgroundColor: robot.color,
                  }}
                  title={robot.label ?? robot.id}
                >
                  {/* Counter-rotated, so the machine turns and its name stays readable. */}
                  {robot.label && showSlots && !iso && (
                    <span className="lq-wh__robot-label" style={{ transform: `rotate(${-at.angle}deg)` }}>
                      {robot.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* The flat layer: labels in isometric, and the rotate handle in both views. Outside the
              canvas transform, so its contents keep their own size at every zoom and, in
              isometric, are not sheared by the camera. */}
          <div className="lq-wh__overlay">
            {editable &&
              hoverItem !== null &&
              (() => {
                const item = items.find((candidate) => candidate.id === hoverItem);
                if (!item || item.kind === "zone") return null;
                const box = footprintOf(item);
                // The box's top-right corner, and then a nudge up and out — the handle belongs
                // *beside* the thing it turns, not on top of it, or it would cover the very corner
                // someone is trying to see while turning it.
                const at = toScreen(item.x + box.width, item.y, iso ? ISO_HEIGHT[item.kind] : 0);
                return (
                  <button
                    type="button"
                    className="lq-wh__rotate"
                    style={{ left: at.left, top: at.top }}
                    title="Pivoter de 90°"
                    aria-label="Pivoter de 90°"
                    onPointerEnter={() => holdHover(item.id)}
                    onPointerLeave={releaseHover}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onItemsChange?.(items.map((candidate) => (candidate.id === item.id ? rotateItem(candidate) : candidate)));
                    }}
                  >
                    <RefreshIcon size={13} />
                  </button>
                );
              })()}
          </div>

          {/* Labels, flat, over the tilt.
              Text put through the camera comes out sheared and reads at a slant — which is exactly
              what an isometric picture should do to a rack and must not do to its name. So the
              names live outside the transform, each placed at the projected centre of its own top
              face: the picture tilts, the words do not. */}
          {iso && (
            <div className="lq-wh__overlay" aria-hidden="true">
              {items
                .filter((item) => item.label)
                .map((item) => {
                  const box = footprintOf(item);
                  const at = projectIso(px(item.x + box.width / 2), px(item.y + box.height / 2), px(ISO_HEIGHT[item.kind]));
                  return (
                    <span
                      key={item.id}
                      className={["lq-wh__tag", selectedId === item.id && "lq-wh__tag--selected"].filter(Boolean).join(" ")}
                      style={{ left: view.x + view.scale * at.x, top: view.y + view.scale * at.y }}
                    >
                      {item.label}
                    </span>
                  );
                })}
              {robots
                .filter((robot) => robot.label)
                .map((robot) => {
                  const on = pointAlongPath(robot.path, robot.progress);
                  if (on === null) return null;
                  const at = projectIso(px(on.x), px(on.y), px(0.9));
                  return (
                    <span
                      key={robot.id}
                      className={`lq-wh__tag lq-wh__tag--robot lq-wh__tag--${robot.status ?? "moving"}`}
                      style={{ left: view.x + view.scale * at.x, top: view.y + view.scale * at.y }}
                    >
                      {robot.label}
                    </span>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Fixed to the viewport, not to the canvas: it follows the hand, so it must not be scaled
          by the zoom or clipped by the surface — it is picked up on the palette, which is outside
          the surface entirely. */}
      {drag?.kind === "palette" && (
        <div
          className="lq-wh__ghost"
          style={{
            left: drag.clientX,
            top: drag.clientY,
            width: px(WAREHOUSE_KINDS[drag.itemKind].width) * view.scale,
            height: px(WAREHOUSE_KINDS[drag.itemKind].height) * view.scale,
          }}
        >
          <span className="lq-wh__ghost-label">{WAREHOUSE_KINDS[drag.itemKind].label}</span>
        </div>
      )}

      {editable && selectedItem && (
        <WarehouseInspector
          item={selectedItem}
          anchorRef={anchorRef}
          // Everything that can move the item's box on screen: the camera, its own geometry, and
          // the live coordinates while it is being dragged or resized (which the committed
          // geometry does not yet reflect).
          trackKey={[
            view.x,
            view.y,
            view.scale,
            selectedItem.x,
            selectedItem.y,
            selectedItem.width,
            selectedItem.height,
            selectedItem.rotation ?? 0,
            drag && "id" in drag && drag.id === selectedItem.id ? `${drag.x},${drag.y}` : "",
          ].join("|")}
          onChange={(next) => onItemsChange?.(items.map((item) => (item.id === next.id ? next : item)))}
          onDelete={() => {
            onItemsChange?.(items.filter((item) => item.id !== selectedItem.id));
            select(null);
          }}
          onClose={() => {
            if (reselecting.current) {
              reselecting.current = false;
              return;
            }
            select(null);
          }}
        />
      )}
    </div>
  );

  function renderItem(item: WarehouseItem) {
    const live = drag?.kind === "item" && drag.id === item.id ? { x: drag.x, y: drag.y } : item;
    // The drawn box is the *footprint*: width and height are the item's own sides and do not swap
    // when it is turned, so the plan has to ask for the rotated box rather than read them.
    const size =
      drag?.kind === "resize" && drag.id === item.id
        ? { width: Math.max(1, drag.x - item.x), height: Math.max(1, drag.y - item.y) }
        : footprintOf(item);
    const selected = selectedId === item.id;

    const lift = iso ? ISO_HEIGHT[item.kind] : 0;

    return (
      <Fragment key={item.id}>
        {/* The two walls that hold the top face up, and the only two a 45° camera ever shows: the
            canvas's +x and +y edges both point toward the viewer once the floor is turned, so the
            north and west faces are always hidden and are not drawn at all. */}
        {lift > 0 && (
          <>
            <div
              className={`lq-wh__wall lq-wh__wall--front lq-wh__wall--${item.kind}`}
              style={{
                left: px(live.x),
                top: px(live.y + size.height),
                width: px(size.width),
                height: px(lift),
                transform: "rotateX(90deg)",
              }}
            >
              {renderRackFace(item, "front")}
            </div>
            <div
              className={`lq-wh__wall lq-wh__wall--side lq-wh__wall--${item.kind}`}
              style={{
                left: px(live.x + size.width),
                top: px(live.y),
                width: px(lift),
                height: px(size.height),
                transform: "rotateY(-90deg)",
              }}
            >
              {renderRackFace(item, "side")}
            </div>
          </>
        )}
      <div
        ref={(el) => {
          if (el) itemNodes.current.set(item.id, el);
          else itemNodes.current.delete(item.id);
        }}
        className={[`lq-wh__item`, `lq-wh__item--${item.kind}`, selected && "lq-wh__item--selected"].filter(Boolean).join(" ")}
        style={{
          left: px(live.x),
          top: px(live.y),
          width: px(size.width),
          height: px(size.height),
          backgroundColor: item.color,
          // In isometric the box is the *top* face, lifted to its own height; the two walls below
          // are rendered beside it, in the canvas's own frame.
          transform: iso ? `translateZ(${px(ISO_HEIGHT[item.kind])}px)` : undefined,
        }}
        onPointerEnter={() => {
          if (editable && item.kind !== "zone") holdHover(item.id);
        }}
        onPointerLeave={releaseHover}
        onPointerDown={(event) => {
          event.stopPropagation();
          if (tracing) return;
          if (selectedId !== null && selectedId !== item.id) reselecting.current = true;
          select(item.id);
          if (!editable) return;
          pressOrigin.current = { x: event.clientX, y: event.clientY };
          movedRef.current = false;
          const cell = toCell(event.clientX, event.clientY);
          setDrag({ kind: "item", id: item.id, grabX: cell.x - item.x, grabY: cell.y - item.y, x: item.x, y: item.y });
        }}
      >
        {item.kind === "rack" && showSlots && renderSlots(item)}
        {isConveyor(item.kind) && renderFlow(item)}
        {item.label && !iso && <span className="lq-wh__item-label">{item.label}</span>}

        {editable && selected && item.kind !== "zone" && (
          <span
            className="lq-wh__handle"
            onPointerDown={(event) => {
              event.stopPropagation();
              const cell = toCell(event.clientX, event.clientY);
              setDrag({ kind: "resize", id: item.id, x: cell.x, y: cell.y });
            }}
          />
        )}
      </div>
      </Fragment>
    );
  }

  /**
   * The line the goods travel and the chevrons along it, as an SVG laid over the item.
   *
   * In the item's *own* frame — length along `+x` — and then rotated as a whole. That is what lets
   * one corner drawing serve all four orientations: rotating the finished picture turns the corner
   * with it, where four sets of coordinates would be four chances to get one of them backwards.
   *
   * SVG rather than a repeating CSS background, which is what the straight run used before: a
   * background can hatch a box, it cannot follow an arc, and a corner whose arrows went straight
   * through the turn would be saying the opposite of what the corner is for.
   */
  function renderFlow(item: WarehouseItem) {
    const lines = conveyorLines(item.kind, item.width, item.height);
    const rotation = item.rotation ?? 0;
    // The SVG is drawn in the item's own frame, so its box is the unrotated one; the rotation is
    // applied to the element and the box re-centred on the footprint it now occupies.
    const w = px(item.width);
    const h = px(item.height);
    const box = footprintOf(item);
    return (
      <svg
        className="lq-wh__flow"
        aria-hidden="true"
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{
          left: (px(box.width) - w) / 2,
          top: (px(box.height) - h) / 2,
          transform: `rotate(${rotation}deg)`,
        }}
      >
        {lines.map((line, i) => {
          const chevrons = flowChevrons(line, item.reversed === true);
          return (
            <g key={i}>
              <polyline className="lq-wh__flow-line" points={line.map((point) => `${px(point.x)},${px(point.y)}`).join(" ")} />
              {chevrons.map((chevron, j) => (
                <path
                  key={j}
                  className="lq-wh__flow-chevron"
                  d="M-3,-3 L3,0 L-3,3"
                  transform={`translate(${px(chevron.x)},${px(chevron.y)}) rotate(${chevron.angle})`}
                  // A wave of brightness running down the line, not arrows sliding along it.
                  // Sliding would be wrong on a corner — the chevrons follow an arc, and a
                  // translation would carry them off it — and on a junction there are two arms
                  // with nothing to slide between. Staggering the *same* pulse gives the sense of
                  // travel on any shape, for one animated property.
                  //
                  // The delay is negative so the wave is already spread out on the first frame
                  // rather than starting with every arrow lit at once; it counts backwards when
                  // the belt is reversed, so the wave runs the way the goods do.
                  style={{
                    animationDelay: `${-((item.reversed === true ? chevrons.length - 1 - j : j) / Math.max(1, chevrons.length)) * FLOW_CYCLE}s`,
                  }}
                />
              ))}
            </g>
          );
        })}
      </svg>
    );
  }

  /**
   * A rack's shelves, drawn on the wall you actually look at.
   *
   * Without this a rack in the isometric view is a plain box — which is what it looked like,
   * because everything that says "rack" (the levels, the bays, what is in them) was on the top
   * face, and the top face is the one you barely see once the floor is tilted. A rack is read from
   * the front: uprights, shelves, and the pallets between them.
   *
   * Which wall carries the bays depends on how the rack is turned. Its bays run along its own
   * length, so an unturned rack shows them on the front wall (the `+y` edge, which spans x) and
   * its narrow end on the side; a rack turned a quarter shows the opposite. Getting this the wrong
   * way round draws a ten-bay rack as a ten-shelf tower, which is a different object.
   */
  function renderRackFace(item: WarehouseItem, wall: "front" | "side") {
    if (item.kind !== "rack") return null;
    const bays = item.bays ?? 0;
    const levels = item.levels ?? 0;
    if (bays === 0 || levels === 0) return null;

    const byKey = new Map(clampSlots(item).map((slot) => [`${slot.bay}:${slot.level}`, slot]));
    const showsBays = wall === (isHorizontal(item) ? "front" : "side");

    // The end of the rack: no bays to show, just the shelves stacked up. Drawn as plain bands
    // rather than as empty slots, because an end view that showed slots would be claiming there is
    // a pallet position facing the aisle when there is only a stanchion.
    if (!showsBays) {
      return (
        <span className="lq-wh__face lq-wh__face--end" style={{ gridTemplateRows: `repeat(${levels}, 1fr)` }}>
          {Array.from({ length: levels }, (_, i) => (
            <span key={i} className="lq-wh__shelf" />
          ))}
        </span>
      );
    }

    // Level 0 is the bottom shelf and a grid fills row by row, so the top row is emitted first —
    // the same rule the plan view's own slot grid follows, and for the same reason: a rack drawn
    // upside down lies about where the stock is.
    return (
      <span
        className="lq-wh__face"
        style={{ gridTemplateColumns: `repeat(${bays}, 1fr)`, gridTemplateRows: `repeat(${levels}, 1fr)` }}
      >
        {Array.from({ length: levels }, (_, row) => levels - 1 - row).flatMap((level) =>
          Array.from({ length: bays }, (_, bay) => {
            const slot = byKey.get(`${bay}:${level}`);
            return <span key={`${bay}:${level}`} className={`lq-wh__cell lq-wh__cell--${slot?.status ?? "empty"}`} />;
          })
        )}
      </span>
    );
  }

  function renderSlots(item: WarehouseItem) {
    const bays = item.bays ?? 0;
    const levels = item.levels ?? 0;
    if (bays === 0 || levels === 0) return null;
    const byKey = new Map(clampSlots(item).map((slot) => [`${slot.bay}:${slot.level}`, slot]));
    const horizontal = isHorizontal(item);
    const cell = (bay: number, level: number) => {
      const slot = byKey.get(`${bay}:${level}`);
      return (
        <span
          key={`${bay}:${level}`}
          className={`lq-wh__slot lq-wh__slot--${slot?.status ?? "empty"}`}
          title={slot?.label ?? `Travée ${bay + 1}, niveau ${level + 1}`}
        />
      );
    };

    // Turned a quarter, the bays run down the rack instead of across it — so the grid is
    // transposed rather than the whole box rotated in CSS. Transposing keeps every slot a square
    // aligned to the plan; a CSS rotation would leave them tilted against the grid everything else
    // snaps to.
    return (
      <span
        className="lq-wh__slots"
        style={
          horizontal
            ? { gridTemplateColumns: `repeat(${bays}, 1fr)`, gridTemplateRows: `repeat(${levels}, 1fr)` }
            : { gridTemplateColumns: `repeat(${levels}, 1fr)`, gridTemplateRows: `repeat(${bays}, 1fr)` }
        }
      >
        {/* Level 0 is the bottom shelf, and a grid fills row by row — so the top row is drawn
            first. A rack drawn upside down is a rack that lies about where the stock is. */}
        {horizontal
          ? Array.from({ length: levels }, (_, row) => levels - 1 - row).flatMap((level) =>
              Array.from({ length: bays }, (_, bay) => cell(bay, level))
            )
          : Array.from({ length: bays }, (_, bay) =>
              Array.from({ length: levels }, (_, column) => cell(bay, levels - 1 - column))
            ).flat()}
      </span>
    );
  }
}
