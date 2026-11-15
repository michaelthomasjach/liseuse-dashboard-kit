import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { observeElementSize } from "../../internal/observeElementSize";
import { ChartTooltip } from "./ChartTooltip";
import "./charts-shared.css";
import "./CalendarHeatmap.css";

export interface CalendarHeatmapDatum {
  /** Calendar day, `"YYYY-MM-DD"` — a date, not an instant: no time zone is applied to it. */
  date: string;
  /** Intensity of the day (requests, visits, commits…). `0` is drawn as an empty day; `null` means
   *  "no reading" (not tracked yet, source down) and is drawn as an outlined cell instead, so a day
   *  without data never reads as a quiet day. */
  value: number | null;
  /** Rendered as-is in the hover/focus tooltip — falls back to the formatted date and value. */
  tooltip?: ReactNode;
  /** Text read by screen readers for this cell — falls back to the formatted date and value. */
  ariaLabel?: string;
}

export interface CalendarHeatmapProps {
  data: CalendarHeatmapDatum[];
  /** First day shown (`"YYYY-MM-DD"`). Defaults to the earliest `data` date, else 52 weeks before `to`. */
  from?: string;
  /** Last day shown (`"YYYY-MM-DD"`). Defaults to the latest `data` date, else today (UTC). */
  to?: string;
  /** First row of each column: 1 = Monday (default, ISO), 0 = Sunday. */
  weekStartsOn?: 0 | 1;
  /** Largest side of a day cell in px; cells shrink to fit the width down to `minCellSize`. Default 14. */
  maxCellSize?: number;
  /** Smallest side of a day cell in px. Below that, the calendar scrolls sideways (on a phone) and opens
   *  on its most recent weeks. Default 9. */
  minCellSize?: number;
  /** Space between cells in px. Default 3. */
  gap?: number;
  /** Number of non-empty intensity steps. Default 4. */
  levels?: number;
  /** Value drawn at full intensity (anything above is clamped). Defaults to the largest value of `data`. */
  maxValue?: number;
  /** CSS color of the fullest step. Default `--lq-chart-calendar-fill`, else `--lq-color-accent`. */
  color?: string;
  formatValue?: (value: number) => string;
  /** Long date of the default tooltip and of the cells' accessible text. */
  formatDate?: (date: Date) => string;
  /** Locale of the month and weekday labels and of the default date format. Default `"fr-FR"`. */
  locale?: string;
  /** Month names above the columns. Default true. */
  showMonthLabels?: boolean;
  /** Weekday names (every other row) before the rows. Default true. */
  showWeekdayLabels?: boolean;
  /** "Less ▢▢▢▢ More" scale under the calendar. Default true. */
  legend?: boolean;
  legendLabels?: { less: string; more: string };
  /** Day drawn with a stronger outline (e.g. the one whose detail is open). */
  selectedDate?: string | null;
  /** Makes each day a button (click, Enter or Space). */
  onDateClick?: (date: string, datum: CalendarHeatmapDatum | undefined) => void;
  /** Name of the whole calendar for screen readers. */
  ariaLabel?: string;
  className?: string;
}

const DAY_MS = 86_400_000;
const MONTH_LABEL_HEIGHT = 16;
const WEEKDAY_LABEL_WIDTH = 30;

const parseDay = (day: string): number => Date.parse(`${day}T00:00:00Z`);
const dayKey = (t: number): string => new Date(t).toISOString().slice(0, 10);

/** Intensity step of a value: 0 for nothing, then 1…levels. */
export function calendarLevel(value: number | null, max: number, levels: number): number {
  if (value === null || !(value > 0) || !(max > 0)) return 0;
  return Math.min(levels, Math.max(1, Math.ceil((value / max) * levels)));
}

/** Fill of a step: the empty-day tint for 0, then `color` from a light wash up to full strength. */
function levelFill(level: number, levels: number, color: string): string {
  if (level <= 0) return "var(--lq-chart-calendar-empty, color-mix(in srgb, var(--lq-color-text) 8%, transparent))";
  const pct = levels <= 1 ? 100 : Math.round(28 + (72 * (level - 1)) / (levels - 1));
  return pct >= 100 ? color : `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

/**
 * Calendar heatmap, one cell per day over weeks laid out as columns (the "contributions" calendar):
 * how often something happened, day after day, over months — regular or occasional at a glance.
 *
 * Fits its container's width (cells between `minCellSize` and `maxCellSize`); narrower than that it
 * scrolls sideways and opens on its latest weeks. Keyboard: the calendar is a single tab stop, arrow
 * keys move by day (up/down) and by week (left/right), Home/End jump to the ends, Enter or Space
 * picks the day; the focused day shows the same tooltip as the hovered one. Colors come from theme
 * variables (`--lq-chart-calendar-fill`, `-empty`, `-cell-radius`), so it follows light and dark
 * surfaces and the e-ink palette.
 */
export function CalendarHeatmap({
  data,
  from,
  to,
  weekStartsOn = 1,
  maxCellSize = 14,
  minCellSize = 9,
  gap = 3,
  levels = 4,
  maxValue,
  color = "var(--lq-chart-calendar-fill, var(--lq-color-accent))",
  formatValue = (v) => v.toLocaleString(),
  formatDate,
  locale = "fr-FR",
  showMonthLabels = true,
  showWeekdayLabels = true,
  legend = true,
  legendLabels = { less: "Moins", more: "Plus" },
  selectedDate = null,
  onDateClick,
  ariaLabel,
  className,
}: CalendarHeatmapProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  const byDate = useMemo(() => new Map(data.map((d) => [d.date, d])), [data]);

  // Range of days shown, then the grid: columns are weeks starting on `weekStartsOn`.
  const grid = useMemo(() => {
    const dates = data.map((d) => d.date).sort();
    const end = parseDay(to ?? dates[dates.length - 1] ?? dayKey(Date.now()));
    const start = Math.min(end, parseDay(from ?? dates[0] ?? dayKey(end - 364 * DAY_MS)));
    const offset = (new Date(start).getUTCDay() - weekStartsOn + 7) % 7;
    const origin = start - offset * DAY_MS;
    const columns = Math.floor((end - origin) / DAY_MS / 7) + 1;
    const days: { date: string; col: number; row: number; t: number }[] = [];
    for (let t = start; t <= end; t += DAY_MS) {
      const i = Math.round((t - origin) / DAY_MS);
      days.push({ date: dayKey(t), col: Math.floor(i / 7), row: i % 7, t });
    }
    return { start, end, columns, days };
  }, [data, from, to, weekStartsOn]);

  const max = useMemo(() => maxValue ?? data.reduce((m, d) => (d.value !== null && d.value > m ? d.value : m), 0), [data, maxValue]);

  // Cell size fitted to the width, within [minCellSize, maxCellSize].
  const left = showWeekdayLabels ? WEEKDAY_LABEL_WIDTH : 0;
  const top = showMonthLabels ? MONTH_LABEL_HEIGHT : 0;
  const fitted = width > 0 ? Math.floor((width - left + gap) / grid.columns - gap) : maxCellSize;
  const cell = Math.max(minCellSize, Math.min(maxCellSize, fitted));
  const pitch = cell + gap;
  const svgWidth = left + grid.columns * pitch - gap;
  const svgHeight = top + 7 * pitch - gap;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    return observeElementSize(el, () => setWidth(el.clientWidth));
  }, []);

  // Too wide for the container (phone): open on the most recent weeks, at the right end.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = el.scrollWidth;
  }, [svgWidth, grid.end]);

  const longDate = useMemo(
    () => formatDate ?? ((d: Date) => d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })),
    [formatDate, locale],
  );
  const describe = useCallback(
    (date: string): string => {
      const d = byDate.get(date);
      if (d?.ariaLabel) return d.ariaLabel;
      const label = longDate(new Date(parseDay(date)));
      return d === undefined || d.value === null ? `${label} : pas de donnée` : `${label} : ${formatValue(d.value)}`;
    },
    [byDate, longDate, formatValue],
  );

  // Month names above the first column holding the 1st of that month (and the first column, unless
  // the next month starts too close to it for both names to fit).
  const months = useMemo(() => {
    if (!showMonthLabels) return [];
    const fmt = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
    const out: { col: number; label: string }[] = [];
    for (const d of grid.days) {
      const first = new Date(d.t).getUTCDate() === 1;
      if (d === grid.days[0] || first) {
        if (first && out.length && out[out.length - 1].col >= d.col - 2) out.pop();
        if (!out.length || out[out.length - 1].col !== d.col) out.push({ col: d.col, label: fmt.format(new Date(d.t)).replace(/\.$/, "") });
      }
    }
    return out;
  }, [grid, locale, showMonthLabels]);

  const weekdays = useMemo(() => {
    if (!showWeekdayLabels) return [];
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
    // 2024-01-07 is a Sunday: day n of the week is that date plus n days.
    return [0, 2, 4].map((row) => ({ row, label: fmt.format(new Date(Date.UTC(2024, 0, 7 + ((row + weekStartsOn) % 7)))).replace(/\.$/, "") }));
  }, [locale, showWeekdayLabels, weekStartsOn]);

  const lastDate = grid.days[grid.days.length - 1]?.date ?? null;
  // The single tab stop: the day last focused, else the selected day, else the most recent one.
  const inRange = (date: string | null): date is string => date !== null && date >= grid.days[0]?.date && date <= (lastDate ?? "");
  const focusable = inRange(active) ? active : inRange(selectedDate) ? selectedDate : lastDate;
  const position = (date: string) => {
    const d = grid.days.find((x) => x.date === date);
    return d ? { x: left + d.col * pitch, y: top + d.row * pitch } : null;
  };

  const moveTo = (t: number) => {
    const clamped = Math.min(grid.end, Math.max(grid.start, t));
    const date = dayKey(clamped);
    setActive(date);
    setHover(date);
    svgRef.current?.querySelector<SVGRectElement>(`[data-date="${date}"]`)?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const current = (e.target as Element).getAttribute?.("data-date");
    if (!current) return;
    const t = parseDay(current);
    const step: Record<string, number> = { ArrowUp: -DAY_MS, ArrowDown: DAY_MS, ArrowLeft: -7 * DAY_MS, ArrowRight: 7 * DAY_MS };
    if (e.key in step) moveTo(t + step[e.key]);
    else if (e.key === "Home") moveTo(grid.start);
    else if (e.key === "End") moveTo(grid.end);
    else if ((e.key === "Enter" || e.key === " ") && onDateClick) onDateClick(current, byDate.get(current));
    else return;
    e.preventDefault();
  };

  const tip = hover ? position(hover) : null;
  const hovered = hover ? byDate.get(hover) : undefined;

  return (
    <div className={["lq-calendar-heatmap", className].filter(Boolean).join(" ")}>
      <div ref={scrollRef} className="lq-calendar-heatmap__scroll">
        <div className="lq-calendar-heatmap__plot" style={{ width: svgWidth, height: svgHeight }}>
          <svg
            ref={svgRef}
            width={svgWidth}
            height={svgHeight}
            role="group"
            aria-label={ariaLabel}
            onKeyDown={onKeyDown}
            onMouseLeave={() => setHover(null)}
          >
            {months.map((m) => (
              <text key={`m${m.col}`} className="lq-calendar-heatmap__label" x={left + m.col * pitch} y={MONTH_LABEL_HEIGHT - 5} aria-hidden="true">
                {m.label}
              </text>
            ))}
            {weekdays.map((w) => (
              <text key={`w${w.row}`} className="lq-calendar-heatmap__label" x={0} y={top + w.row * pitch + cell / 2} dominantBaseline="central" aria-hidden="true">
                {w.label}
              </text>
            ))}
            {grid.days.map((d) => {
              const datum = byDate.get(d.date);
              const value = datum?.value ?? null;
              const missing = datum === undefined || value === null;
              const level = calendarLevel(value, max, levels);
              const selected = selectedDate === d.date;
              return (
                <rect
                  key={d.date}
                  data-date={d.date}
                  className={[
                    "lq-calendar-heatmap__cell",
                    missing ? "lq-calendar-heatmap__cell--missing" : "",
                    selected ? "lq-calendar-heatmap__cell--selected" : "",
                    onDateClick ? "lq-calendar-heatmap__cell--clickable" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  x={left + d.col * pitch}
                  y={top + d.row * pitch}
                  width={cell}
                  height={cell}
                  style={missing ? undefined : { fill: levelFill(level, levels, color) }}
                  tabIndex={d.date === focusable ? 0 : -1}
                  role={onDateClick ? "button" : "img"}
                  aria-label={describe(d.date)}
                  aria-pressed={onDateClick ? selected : undefined}
                  onMouseEnter={() => setHover(d.date)}
                  onFocus={() => {
                    setActive(d.date);
                    setHover(d.date);
                  }}
                  onBlur={() => setHover(null)}
                  onClick={onDateClick ? () => onDateClick(d.date, datum) : undefined}
                />
              );
            })}
          </svg>
          {tip && hover && (
            // Beside the day, on the side with more room, so the box never hides the day it describes.
            <ChartTooltip x={tip.x > svgWidth / 2 ? tip.x - 2 : tip.x + cell + 2} y={Math.max(0, tip.y - 8)} align={tip.x > svgWidth / 2 ? "left" : "right"} visible>
              {hovered?.tooltip ?? (
                <>
                  <div className="lq-chart-tooltip__title">{longDate(new Date(parseDay(hover)))}</div>
                  <div>{hovered === undefined || hovered.value === null ? "Pas de donnée" : formatValue(hovered.value)}</div>
                </>
              )}
            </ChartTooltip>
          )}
        </div>
      </div>
      {legend && (
        <div className="lq-calendar-heatmap__legend" aria-hidden="true" style={{ maxWidth: svgWidth }}>
          <span>{legendLabels.less}</span>
          {Array.from({ length: levels + 1 }, (_, level) => (
            <svg key={level} width={Math.min(cell, 12)} height={Math.min(cell, 12)}>
              <rect className="lq-calendar-heatmap__cell" width={Math.min(cell, 12)} height={Math.min(cell, 12)} style={{ fill: levelFill(level, levels, color) }} />
            </svg>
          ))}
          <span>{legendLabels.more}</span>
        </div>
      )}
    </div>
  );
}
