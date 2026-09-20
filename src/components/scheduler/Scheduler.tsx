import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  HOUR,
  MINUTE,
  buildTicks,
  formatDuration,
  normaliseTask,
  overlappingTaskIds,
  packRows,
  rescaleSegments,
  snapTime,
  tickStepMinutes,
  type SchedulerResource,
  type SchedulerTask,
} from "./schedulerModel";
import { SchedulerTaskModal } from "./SchedulerTaskModal";
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
  /**
   * A plain wheel zooms the time axis; `Maj` + wheel scrolls the rows. Default true.
   *
   * It is worth knowing what this trades: a board is a table, and a table's wheel normally scrolls
   * it. With this on, a list of forty machines is scrolled with `Maj`, the scrollbar, or a drag.
   * Set it false to get the table behaviour back — plain wheel scrolls, `Ctrl` zooms.
   */
  wheelZoom?: boolean;
  /** Opens the task's own dialog on click. Needs `onTasksChange` to be of any use. Default true. */
  taskDialog?: boolean;
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
 * ## The wheel zooms the time axis
 *
 * As it does on every other canvas in this kit, anchored on the pointer so the moment under the
 * cursor stays under it. That is a trade and worth naming: a board is also a table, and a table's
 * wheel normally scrolls it — so scrolling the rows moves to `Maj` + wheel, the scrollbar, or a
 * drag. `wheelZoom={false}` swaps the two back for a board long enough that reading down it
 * matters more than zooming across it.
 *
 * ## Clicking a task opens it
 *
 * The block carries a name and, if there is room, a duration; everything else — description,
 * exact times, pattern, the steps it breaks into — lives in its dialog. A bar an inch tall has
 * room for a name, and a board that tried to show more on it would be legible only on its two
 * longest tasks.
 */
export function Scheduler({
  resources,
  tasks: rawTasks,
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
  wheelZoom = true,
  taskDialog = true,
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
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  /** Where the press landed, so a drag of two pixels is not mistaken for a click on a board where
   *  every block is also a drag handle. */
  const pressAt = useRef<{ x: number; y: number } | null>(null);

  const editable = onTasksChange !== undefined;
  const select = (id: string | null) => onSelectedTaskIdChange?.(id);

  const pxPerMs = pxPerHour / HOUR;
  const contentWidth = Math.max(1, (windowTo - windowFrom) * pxPerMs);

  // Normalised once, here, rather than at every reader: a segmented task's length is the sum of
  // its steps, and everything below — packing, clash detection, the blocks themselves — can then
  // go on reading `end` without knowing that rule exists.
  const tasks = useMemo(() => rawTasks.map(normaliseTask), [rawTasks]);

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
    const task = tasks.find((candidate) => candidate.id === drag.id);
    if (!task) return;

    if (drag.edge === "start") {
      // A block may not be pulled through its own far end: one snap step is the shortest thing
      // that still reads as a block.
      const start = Math.min(snapped, drag.endTime - snapMinutes * MINUTE);
      // Moving the start of a segmented task slides it: its steps keep their own lengths, and the
      // end follows. Shortening it from the left would mean deciding which step to eat into,
      // which is a decision the dialog exists to make.
      onTasksChange?.(
        tasks.map((candidate) =>
          candidate.id !== drag.id
            ? candidate
            : candidate.subtasks && candidate.subtasks.length > 0
              ? { ...candidate, start, end: start + (candidate.end - candidate.start) }
              : { ...candidate, start }
        )
      );
      return;
    }

    const end = Math.max(snapped, drag.startTime + snapMinutes * MINUTE);
    // `rescaleSegments` is a no-op on a plain task and scales the steps in proportion on a
    // segmented one — which is what lets the grip keep working on both without the parts ever
    // contradicting the whole.
    onTasksChange?.(tasks.map((candidate) => (candidate.id === drag.id ? rescaleSegments(candidate, end) : candidate)));
  }

  const zoomBy = (factor: number) => setPxPerHour((current) => Math.min(MAX_PX_PER_HOUR, Math.max(MIN_PX_PER_HOUR, current * factor)));

  function onWheel(event: React.WheelEvent) {
    // `Maj` is the escape hatch in whichever direction the default points — it scrolls the rows
    // when the wheel zooms, and zooms when the wheel scrolls.
    const zooming = wheelZoom ? !event.shiftKey : event.ctrlKey || event.metaKey;
    if (!zooming) return;
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
  const openTask = tasks.find((task) => task.id === openTaskId) ?? null;

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
                        `lq-sched__task--pattern-${task.pattern ?? "solid"}`,
                        selectedTaskId === task.id && "lq-sched__task--selected",
                        clashing.has(task.id) && "lq-sched__task--clash",
                        task.locked && "lq-sched__task--locked",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{ left, width, top: lane * laneHeight + 3, height: laneHeight - 6, backgroundColor: task.color }}
                      title={`${task.label} · ${formatDuration(task.end - task.start)}`}
                      onPointerUp={(event) => {
                        const from = pressAt.current;
                        pressAt.current = null;
                        // A click, not the end of a drag — four pixels of slop, the same figure
                        // the warehouse and the globe both use.
                        if (!taskDialog || !from || Math.hypot(event.clientX - from.x, event.clientY - from.y) > 4) return;
                        setOpenTaskId(task.id);
                      }}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        pressAt.current = { x: event.clientX, y: event.clientY };
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
                      {/* The steps, drawn as shares of the block. Under the label rather than
                          replacing it: the divisions are what the segmentation looks like, the
                          name is still what the block is. */}
                      {task.subtasks && task.subtasks.length > 0 && (
                        <span className="lq-sched__steps" aria-hidden="true">
                          {task.subtasks.map((step) => (
                            <span
                              key={step.id}
                              className={`lq-sched__step lq-sched__step--${step.status ?? task.status ?? "planned"}`}
                              style={{ flexGrow: Math.max(1, step.minutes) }}
                              title={`${step.label} · ${formatDuration(step.minutes * MINUTE)}`}
                            />
                          ))}
                        </span>
                      )}
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

      {openTask && editable && (
        <SchedulerTaskModal
          task={openTask}
          resources={resources}
          snapMinutes={snapMinutes}
          locale={locale}
          onChange={(next) => onTasksChange?.(tasks.map((task) => (task.id === next.id ? next : task)))}
          onDelete={() => {
            onTasksChange?.(tasks.filter((task) => task.id !== openTask.id));
            setOpenTaskId(null);
            select(null);
          }}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </div>
  );
}
