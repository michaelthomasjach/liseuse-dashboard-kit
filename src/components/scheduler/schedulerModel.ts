/**
 * What a schedule is made of, and the arithmetic a timeline needs.
 *
 * Kept apart from the component for the same reason the Sankey's layout and the warehouse's
 * geometry are: it is arithmetic over time, it needs no DOM, and the two places it can be subtly
 * wrong — how overlapping tasks are stacked, and which gridline is worth drawing — both produce a
 * picture that looks perfectly reasonable and says the wrong thing.
 */

export type SchedulerTaskStatus = "planned" | "running" | "done" | "late" | "blocked";

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
