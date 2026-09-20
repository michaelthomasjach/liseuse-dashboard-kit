import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  HOUR,
  MINUTE,
  buildTicks,
  formatDuration,
  overlappingTaskIds,
  packRows,
  snapTime,
  tickStepMinutes,
  type SchedulerResource,
  type SchedulerTask,
} from "./schedulerModel";
import "./Scheduler.css";

export interface SchedulerProps {
  resources: SchedulerResource[];
  tasks: SchedulerTask[];
  /** Receives the whole next list, like every other controlled component here. Omit it for a
   *  read-only board — nothing becomes draggable and no resize handles appear. */
  onTasksChange?: (tasks: SchedulerTask[]) => void;
  /** The window shown, as epoch ms or `Date`. */
  from: number | Date;
  to: number | Date;
  /** Drawn as a vertical marker. Omit for a plan with no "today" — a template, a scenario. */
  now?: number | Date;
  /** Everything a drag produces is rounded to this. Default 15 minutes. A schedule snapped to the
   *  minute is a schedule nobody can line two tasks up in. */
  snapMinutes?: number;
  /** Starting zoom. Default 60 px for an hour. */
  pxPerHour?: number;
  /** Row height per lane, in px. Default 34. A row with two overlapping tasks is two lanes tall. */
  laneHeight?: number;
  /** Width of the resource column. Default 168. */
  resourceWidth?: number;
  selectedTaskId?: string | null;
  onSelectedTaskIdChange?: (id: string | null) => void;
  height?: number | string;
  className?: string;
  locale?: string;
}

const MIN_PX_PER_HOUR = 6;
const MAX_PX_PER_HOUR = 600;
/** Grab zone at each end of a block. Below this the block is too short to carry handles and is
 *  moved only, never resized — which is better than a block you cannot pick up at all. */
const HANDLE_PX = 8;
const MIN_RESIZABLE_PX = 28;

type Drag =
  | { kind: "move"; id: string; grabOffset: number; startTime: number; endTime: number; resourceId: string }
  | { kind: "resize"; id: string; edge: "start" | "end"; startTime: number; endTime: number };

/**
 * A resource timeline: one row per machine or person, time across, and the jobs booked on them as
 * blocks you can drag, drop onto another row, and pull by either end.
 *
 * ## Overlaps grow the row
 *
 * Two jobs booked on one machine at the same time is exactly what somebody opens a planner to
 * find, so they are never drawn on top of one another: the row splits into lanes and the clash is
 * visible as two bars side by side, marked. Hiding one behind the other would make the board
 * quietest precisely where it should be loudest.
 *
 * ## Why the wheel scrolls and does not zoom
 *
 * Every other canvas in this kit — the script graph, the warehouse, the tile map — zooms on a
 * plain wheel. This one does not, and the difference is deliberate: those are surfaces you fly
 * over, this is a table you read down. A board of forty machines needs the wheel for what the
 * wheel does in every other table. Zoom is Ctrl (or a trackpad pinch, which sends the same), plus
 * the two buttons in the toolbar.
 */
export function Scheduler({
  resources,
  tasks,
  onTasksChange,
  from,
  to,
  now,
  snapMinutes = 15,
  pxPerHour: initialPxPerHour = 60,
  laneHeight = 34,
  resourceWidth = 168,
  selectedTaskId = null,
  onSelectedTaskIdChange,
  height = 460,
  className,
  locale = "fr-FR",
}: SchedulerProps) {
  const windowFrom = typeof from === "number" ? from : from.getTime();
  const windowTo = typeof to === "number" ? to : to.getTime();
  const nowAt = now === undefined ? null : typeof now === "number" ? now : now.getTime();

  const bodyRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLDivElement>(null);
  const [pxPerHour, setPxPerHour] = useState(initialPxPerHour);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hoverResource, setHoverResource] = useState<string | null>(null);

  const editable = onTasksChange !== undefined;
  const select = (id: string | null) => onSelectedTaskIdChange?.(id);

  const pxPerMs = pxPerHour / HOUR;
  const contentWidth = Math.max(1, (windowTo - windowFrom) * pxPerMs);

  const rows = useMemo(() => packRows(resources, tasks), [resources, tasks]);
  const clashing = useMemo(() => overlappingTaskIds(rows), [rows]);
  const stepMinutes = tickStepMinutes(pxPerHour);
  const ticks = useMemo(() => buildTicks(windowFrom, windowTo, stepMinutes, locale), [windowFrom, windowTo, stepMinutes, locale]);

  const xOf = (time: number) => (time - windowFrom) * pxPerMs;
  const timeOf = (x: number) => windowFrom + x / pxPerMs;

  /**
   * The header and the resource column are scrolled from the body's own scroll event.
   *
   * Both could have been made `position: sticky` inside one scroller instead, and that was the
   * first attempt: sticky in *two* directions, inside a container that scrolls in two directions,
   * is where the header and the first column start disagreeing about who is on top. One real
   * scroller driving two clipped panes has no such argument to lose.
   */
  const syncScroll = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (headRef.current) headRef.current.scrollLeft = body.scrollLeft;
    if (asideRef.current) asideRef.current.scrollTop = body.scrollTop;
  }, []);

  /** Where in the body a given time sits, in client pixels. */
  const clientToTime = useCallback(
    (clientX: number) => {
      const body = bodyRef.current;
      if (!body) return windowFrom;
      const rect = body.getBoundingClientRect();
      return timeOf(clientX - rect.left + body.scrollLeft);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [windowFrom, pxPerMs]
  );

  /** A drag released anywhere ends it — including outside the window, where the body's own
   *  handlers never fire and the board would otherwise keep dragging the block on the next move. */
  useEffect(() => {
    if (drag === null) return;
    const stop = () => {
      setDrag(null);
      setHoverResource(null);
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [drag]);

  const commit = (id: string, patch: Partial<SchedulerTask>) => {
    onTasksChange?.(tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  };

  function onBodyPointerMove(event: ReactPointerEvent) {
    if (!drag) return;
    const time = clientToTime(event.clientX);

    if (drag.kind === "move") {
      const length = drag.endTime - drag.startTime;
      const start = snapTime(time - drag.grabOffset, snapMinutes);
      // Which row the pointer is over, found from the rows' own boxes rather than from arithmetic
      // on the lane height — rows are not all the same height once one of them has split into
      // lanes, so there is no single height to divide by.
      const over = document.elementsFromPoint(event.clientX, event.clientY).find((el) => el.hasAttribute("data-resource"));
      const resourceId = over?.getAttribute("data-resource") ?? drag.resourceId;
      setHoverResource(resourceId);
      commit(drag.id, { start, end: start + length, resourceId });
      return;
    }

    const snapped = snapTime(time, snapMinutes);
    if (drag.edge === "start") {
      // A block may not be pulled through its own far end: one snap step is the shortest thing
      // that still reads as a block.
      commit(drag.id, { start: Math.min(snapped, drag.endTime - snapMinutes * MINUTE) });
    } else {
      commit(drag.id, { end: Math.max(snapped, drag.startTime + snapMinutes * MINUTE) });
    }
  }

  const zoomBy = (factor: number) => setPxPerHour((current) => Math.min(MAX_PX_PER_HOUR, Math.max(MIN_PX_PER_HOUR, current * factor)));

  function onWheel(event: React.WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const body = bodyRef.current;
    if (!body) return;
    const rect = body.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const anchored = timeOf(pointerX + body.scrollLeft);
    const next = Math.min(MAX_PX_PER_HOUR, Math.max(MIN_PX_PER_HOUR, pxPerHour * Math.exp(-event.deltaY * 0.0015)));
    setPxPerHour(next);
    // Keep the moment under the cursor under it, the same rule every other zoom in this kit
    // follows — here it has to be reapplied to `scrollLeft` rather than to a transform.
    requestAnimationFrame(() => {
      body.scrollLeft = (anchored - windowFrom) * (next / HOUR) - pointerX;
      syncScroll();
    });
  }

  const rowHeightOf = (lanes: number) => lanes * laneHeight + 6;

  return (
    <div className={["lq-sched", className].filter(Boolean).join(" ")} style={{ height }}>
      <div className="lq-sched__toolbar">
        <button type="button" className="lq-sched__tool" onClick={() => zoomBy(1 / 1.4)} aria-label="Dézoomer le temps">
          −
        </button>
        <button type="button" className="lq-sched__tool" onClick={() => zoomBy(1.4)} aria-label="Zoomer le temps">
          +
        </button>
        <span className="lq-sched__zoom">{Math.round(pxPerHour)} px/h</span>
        {clashing.size > 0 && (
          <span className="lq-sched__clash-count">
            {clashing.size} tâche{clashing.size > 1 ? "s" : ""} en conflit
          </span>
        )}
        <span className="lq-sched__hint">Ctrl + molette pour zoomer</span>
      </div>

      <div className="lq-sched__grid" style={{ gridTemplateColumns: `${resourceWidth}px minmax(0, 1fr)` }}>
        <div className="lq-sched__corner">Ressource</div>

        <div className="lq-sched__head" ref={headRef}>
          <div className="lq-sched__head-inner" style={{ width: contentWidth }}>
            {ticks.map((tick) => (
              <span
                key={tick.time}
                className={["lq-sched__tick", tick.major && "lq-sched__tick--major"].filter(Boolean).join(" ")}
                style={{ left: xOf(tick.time) }}
              >
                {tick.label}
              </span>
            ))}
          </div>
        </div>

        <div className="lq-sched__aside" ref={asideRef}>
          {rows.map((row) => (
            <div key={row.resource.id} className="lq-sched__resource" style={{ height: rowHeightOf(row.lanes) }}>
              <span className="lq-sched__resource-name">{row.resource.label}</span>
              {row.resource.meta && <span className="lq-sched__resource-meta">{row.resource.meta}</span>}
            </div>
          ))}
        </div>

        <div
          className="lq-sched__body"
          ref={bodyRef}
          onScroll={syncScroll}
          onWheel={onWheel}
          onPointerMove={onBodyPointerMove}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget || (event.target as HTMLElement).hasAttribute("data-resource")) select(null);
          }}
        >
          <div className="lq-sched__canvas" style={{ width: contentWidth }}>
            {/* Gridlines, drawn once for the whole board rather than per row: a line per row would
                be one element per row per tick, and they have to align anyway. */}
            <div className="lq-sched__grid-lines" aria-hidden="true">
              {ticks.map((tick) => (
                <span
                  key={tick.time}
                  className={["lq-sched__grid-line", tick.major && "lq-sched__grid-line--major"].filter(Boolean).join(" ")}
                  style={{ left: xOf(tick.time) }}
                />
              ))}
            </div>

            {nowAt !== null && nowAt >= windowFrom && nowAt <= windowTo && (
              <span className="lq-sched__now" style={{ left: xOf(nowAt) }} aria-hidden="true" />
            )}

            {rows.map((row) => (
              <div
                key={row.resource.id}
                className={["lq-sched__row", hoverResource === row.resource.id && "lq-sched__row--target"].filter(Boolean).join(" ")}
                style={{ height: rowHeightOf(row.lanes) }}
                data-resource={row.resource.id}
              >
                {row.tasks.map(({ task, lane }) => {
                  const left = xOf(task.start);
                  const width = Math.max(2, xOf(task.end) - left);
                  const resizable = editable && !task.locked && width >= MIN_RESIZABLE_PX;
                  return (
                    <div
                      key={task.id}
                      className={[
                        "lq-sched__task",
                        `lq-sched__task--${task.status ?? "planned"}`,
                        selectedTaskId === task.id && "lq-sched__task--selected",
                        clashing.has(task.id) && "lq-sched__task--clash",
                        task.locked && "lq-sched__task--locked",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{ left, width, top: lane * laneHeight + 3, height: laneHeight - 6, backgroundColor: task.color }}
                      title={`${task.label} · ${formatDuration(task.end - task.start)}`}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        select(task.id);
                        if (!editable || task.locked) return;
                        const time = clientToTime(event.clientX);
                        const box = event.currentTarget.getBoundingClientRect();
                        const nearStart = resizable && event.clientX - box.left <= HANDLE_PX;
                        const nearEnd = resizable && box.right - event.clientX <= HANDLE_PX;
                        if (nearStart || nearEnd) {
                          setDrag({ kind: "resize", id: task.id, edge: nearStart ? "start" : "end", startTime: task.start, endTime: task.end });
                        } else {
                          setDrag({
                            kind: "move",
                            id: task.id,
                            grabOffset: time - task.start,
                            startTime: task.start,
                            endTime: task.end,
                            resourceId: task.resourceId,
                          });
                        }
                      }}
                    >
                      {resizable && <span className="lq-sched__grip lq-sched__grip--start" />}
                      <span className="lq-sched__task-label">{task.label}</span>
                      {width > 72 && <span className="lq-sched__task-time">{formatDuration(task.end - task.start)}</span>}
                      {resizable && <span className="lq-sched__grip lq-sched__grip--end" />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
