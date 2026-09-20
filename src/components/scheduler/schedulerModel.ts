/**
 * What a schedule is made of, and the arithmetic a timeline needs.
 *
 * Kept apart from the component for the same reason the Sankey's layout and the warehouse's
 * geometry are: it is arithmetic over time, it needs no DOM, and the two places it can be subtly
 * wrong — how overlapping tasks are stacked, and which gridline is worth drawing — both produce a
 * picture that looks perfectly reasonable and says the wrong thing.
 */

export type SchedulerTaskStatus = "planned" | "running" | "done" | "late" | "blocked";

/** How a block is filled. A second axis alongside `status`, and deliberately not a replacement for
 *  it: status says how the work is going, the pattern is for whatever else a board needs to
 *  separate at a glance — provisional against confirmed, internal against subcontracted. */
export type SchedulerTaskPattern = "solid" | "striped" | "hatched";

export interface SchedulerSubtask {
  id: string;
  label: string;
  /** Its own length, in minutes. */
  minutes: number;
  status?: SchedulerTaskStatus;
}

export interface SchedulerResource {
  id: string;
  label: string;
  /** A second line under the name — a role, a zone, a skill. */
  meta?: string;
}

export interface SchedulerTask {
  id: string;
  /** Which row it sits on. A task whose resource nobody declared is dropped rather than drawn on
   *  a row that does not exist. */
  resourceId: string;
  label: string;
  /** Epoch milliseconds. Plain numbers rather than `Date`: they are compared, subtracted and
   *  snapped on every pointer move, and a `Date` would be allocated for each one. */
  start: number;
  end: number;
  status?: SchedulerTaskStatus;
  color?: string;
  pattern?: SchedulerTaskPattern;
  /** Shown in the task's own dialog. Not drawn on the block: a bar an inch tall has room for a
   *  name and nothing else, and a description squeezed into it would only be legible on the two
   *  longest tasks of the board. */
  description?: string;
  /**
   * The steps the task breaks into, laid end to end from its start.
   *
   * When a task has these, **they are its length**: `end` is derived from their sum rather than
   * kept alongside it. Two numbers that are supposed to agree eventually disagree, and a task
   * whose parts add up to something other than the task is exactly the kind of wrongness a
   * planner must not be able to display. `normaliseTask` is what enforces it.
   */
  subtasks?: SchedulerSubtask[];
  /** Neither movable nor resizable — a fixed appointment, a shift already signed off. */
  locked?: boolean;
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** A task with the lane it was packed into, and how many lanes its row ended up needing. */
export interface PackedTask {
  task: SchedulerTask;
  lane: number;
}

export interface PackedRow {
  resource: SchedulerResource;
  tasks: PackedTask[];
  /** At least 1, even for an empty row — a resource with nothing booked still has a line. */
  lanes: number;
}

/**
 * Lays each resource's tasks into as few lanes as possible, so none hides another.
 *
 * The alternative — drawing overlapping tasks on top of each other — is what makes a schedule
 * lie: two jobs booked on the same machine at the same time is precisely the thing somebody opens
 * a planner to notice, and stacking them into one bar hides exactly that. Here the row grows
 * instead, and a double booking is visible as two bars side by side.
 *
 * Greedy by start time, first lane that has room. That is optimal for interval graphs — the
 * minimum number of lanes equals the largest number of tasks overlapping at any one instant, and
 * this reaches it — so there is nothing cleverer to do.
 */
export function packRows(resources: SchedulerResource[], tasks: SchedulerTask[]): PackedRow[] {
  const byResource = new Map<string, SchedulerTask[]>(resources.map((resource) => [resource.id, []]));
  for (const task of tasks) byResource.get(task.resourceId)?.push(task);

  return resources.map((resource) => {
    const ordered = (byResource.get(resource.id) ?? []).slice().sort((a, b) => a.start - b.start || a.end - b.end);
    /** The end time of the last task in each lane. */
    const lastEnd: number[] = [];
    const packed: PackedTask[] = [];

    for (const task of ordered) {
      let lane = lastEnd.findIndex((end) => end <= task.start);
      if (lane === -1) {
        lane = lastEnd.length;
        lastEnd.push(task.end);
      } else {
        lastEnd[lane] = Math.max(lastEnd[lane], task.end);
      }
      packed.push({ task, lane });
    }

    return { resource, tasks: packed, lanes: Math.max(1, lastEnd.length) };
  });
}

/** Ids of tasks that overlap another on the same resource — the thing a planner is opened to
 *  find. Reported separately from the packing so a caller can count them, list them, or refuse to
 *  save, rather than only see them. */
export function overlappingTaskIds(rows: PackedRow[]): Set<string> {
  const clashing = new Set<string>();
  for (const row of rows) {
    const ordered = row.tasks.map((packed) => packed.task).sort((a, b) => a.start - b.start);
    for (let i = 0; i < ordered.length; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        if (ordered[j].start >= ordered[i].end) break;
        clashing.add(ordered[i].id);
        clashing.add(ordered[j].id);
      }
    }
  }
  return clashing;
}

/** Rounds a moment to the nearest `minutes`. */
export function snapTime(time: number, minutes: number): number {
  if (minutes <= 0) return time;
  const step = minutes * MINUTE;
  return Math.round(time / step) * step;
}

/** The ladder of steps a time axis is allowed to use, in minutes. Every one divides the next, so
 *  zooming never lands on a grid whose lines fall between the previous one's. */
const STEPS = [5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, 2 * 1440, 7 * 1440];

/** How much room a label needs before the next one starts crowding it. */
const MIN_TICK_PX = 76;

/** The coarsest step that still puts a label every `MIN_TICK_PX`, given the zoom.
 *
 *  Picked from a fixed ladder rather than computed, so that zooming in moves from hours to
 *  half-hours to quarters — divisions of a clock people actually use — instead of landing on
 *  "every 37 minutes", which is what an evenly-spaced-labels calculation would produce. */
export function tickStepMinutes(pxPerHour: number): number {
  for (const step of STEPS) {
    if ((step / 60) * pxPerHour >= MIN_TICK_PX) return step;
  }
  return STEPS[STEPS.length - 1];
}

export interface SchedulerTick {
  time: number;
  label: string;
  /** Midnight, where the day changes — drawn heavier, because a schedule read across a night is
   *  the one place a reader can be off by a whole day without noticing. */
  major: boolean;
}

export function buildTicks(from: number, to: number, stepMinutes: number, locale = "fr-FR"): SchedulerTick[] {
  const step = stepMinutes * MINUTE;
  const dayLabel = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" });
  const timeLabel = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });

  const ticks: SchedulerTick[] = [];
  // Started from a whole multiple of the step rather than from `from`, so the gridlines sit on
  // round times whatever window happens to be shown.
  for (let time = Math.ceil(from / step) * step; time <= to; time += step) {
    const date = new Date(time);
    const midnight = date.getHours() === 0 && date.getMinutes() === 0;
    ticks.push({
      time,
      major: midnight,
      label: midnight || stepMinutes >= 1440 ? dayLabel.format(date) : timeLabel.format(date),
    });
  }
  return ticks;
}

/** Duration in the shortest form that is still exact — "2 h 30", "45 min", "3 j". */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 1440 === 0) return `${minutes / 1440} j`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

/** The task with its `end` back in step with its segments. A task without segments is returned
 *  untouched, so this is safe to run over a whole board on every render. */
export function normaliseTask(task: SchedulerTask): SchedulerTask {
  if (!task.subtasks || task.subtasks.length === 0) return task;
  const total = task.subtasks.reduce((sum, step) => sum + Math.max(1, step.minutes), 0);
  const end = task.start + total * MINUTE;
  return end === task.end ? task : { ...task, end };
}

/** Cuts a task into `count` equal steps, keeping its overall length.
 *
 *  Equal by default because the first thing anyone does after splitting is drag the divisions
 *  around, and an even cut is the one starting point that makes no claim about the work. */
export function segmentTask(task: SchedulerTask, count: number): SchedulerTask {
  const steps = Math.max(1, Math.round(count));
  const totalMinutes = Math.max(steps, Math.round((task.end - task.start) / MINUTE));
  const each = Math.floor(totalMinutes / steps);
  const subtasks: SchedulerSubtask[] = Array.from({ length: steps }, (_, i) => ({
    id: `${task.id}-s${i + 1}`,
    label: `Étape ${i + 1}`,
    // The remainder goes to the last step rather than being spread: the task must keep exactly the
    // length it had, and a minute handed out round-robin would leave the divisions off the grid.
    minutes: i === steps - 1 ? totalMinutes - each * (steps - 1) : each,
  }));
  return normaliseTask({ ...task, subtasks });
}

/** Stretches a segmented task to a new end by scaling its steps in proportion.
 *
 *  Which is what lets the right-hand grip keep working on a segmented task: without it, dragging
 *  the end would set an `end` the steps immediately contradict. */
export function rescaleSegments(task: SchedulerTask, newEnd: number): SchedulerTask {
  if (!task.subtasks || task.subtasks.length === 0) return { ...task, end: newEnd };
  const wanted = Math.max(task.subtasks.length, Math.round((newEnd - task.start) / MINUTE));
  const current = task.subtasks.reduce((sum, step) => sum + Math.max(1, step.minutes), 0);
  const factor = wanted / current;
  let handed = 0;
  const subtasks = task.subtasks.map((step, i) => {
    const minutes = i === task.subtasks!.length - 1 ? wanted - handed : Math.max(1, Math.round(step.minutes * factor));
    handed += minutes;
    return { ...step, minutes: Math.max(1, minutes) };
  });
  return normaliseTask({ ...task, subtasks });
}
