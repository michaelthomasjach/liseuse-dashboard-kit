import { useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { Candle } from "./CandlestickChart";
import { computeSeasonality, type SeasonalityBucket } from "./internal/seasonality";
import { LineAreaChart, type LineAreaChartHandle, type ChartSeries, type ChartPoint } from "./LineAreaChart";
import { Popover } from "../forms/Popover";
import { Checkbox } from "../forms/Checkbox";
import { DropdownPanel } from "../primitives/DropdownPanel";
import { Modal } from "../primitives/Modal";
import { ChevronLeftIcon, ChevronDownIcon, CalendarIcon, EyeIcon, EyeOffIcon, SettingsIcon, TrashIcon, MeasureIcon, AverageLineIcon } from "../icons";
import { DEFAULT_MARGIN, TOOLS_RAIL_WIDTH, PRICE_AXIS_WIDTH_MOBILE, TOOLS_RAIL_HEIGHT_MOBILE } from "./candlestick/constants";
import "./charts-shared.css";

// The only granularity offered now (see this file's own git history for the Semaine/Trimestre/
// Année options this replaced) — always computed at "day" resolution internally, each bucket a
// trading-day *ordinal* within its own year rather than a calendar day-of-year offset (see
// computeSeasonality's own doc for why), for a curve as detailed as the underlying trading-day
// data actually supports. See MONTH_TICK_INDEXES below for how the X axis still only *labels*
// the 12 month boundaries among those points.
const MONTH_LABELS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

// Any non-leap year works as the template — this never names a real year, just the shape one
// has (Jan 1 is day 0, and no Feb 29 to throw month-start days off from every *other* year's own
// day-bucket math).
const REFERENCE_YEAR = 2001;

// A trading-day ordinal no longer corresponds to one exact calendar date the way a calendar
// day-of-year offset used to — different years place their own weekends/holidays on different
// calendar days, so (say) "trading day 40" lands on a slightly different real date each year
// (see computeSeasonality's own doc for why bucketing this way, instead of by calendar date, is
// what actually keeps the average meaningful). Every calendar-facing label below (month-tick
// placement, the hover crosshair's own date) is therefore only an approximation from here on,
// spreading a standard-convention 252-trading-day year evenly across the 365-day calendar rather
// than pretending to name an exact date.
const TRADING_DAYS_PER_YEAR = 252;
function approxCalendarDayOfYear(tradingDayIndex: number): number {
  return Math.round((tradingDayIndex * 365) / TRADING_DAYS_PER_YEAR);
}

// Which trading-day bucket each month *approximately* starts in — the inverse of
// approxCalendarDayOfYear above (a calendar day-of-year converted back to the nominal trading-day
// ordinal it maps to), so the two never drift apart. Used both to label the X axis sparsely (see
// xTickFormat below) and to size the "space before January/after December" padding (see
// xDomainPadding).
function monthStartDayIndex(monthIdx: number): number {
  const calendarDay = Math.round((Date.UTC(REFERENCE_YEAR, monthIdx, 1) - Date.UTC(REFERENCE_YEAR, 0, 1)) / 86_400_000);
  return Math.min(Math.round((calendarDay * TRADING_DAYS_PER_YEAR) / 365), TRADING_DAYS_PER_YEAR - 1);
}
const MONTH_TICK_INDEXES = MONTH_LABELS.map((_, i) => monthStartDayIndex(i));

// One tick mark per nominal trading day of the year (not the engine's own, more generous 365-slot
// bucket array — a market that never has more than ~253 real sessions in a year has nothing to
// mark past that point anyway); xTickFormat below is what actually keeps all but the 12
// month-boundary ones unlabeled.
const DAY_TICK_VALUES = Array.from({ length: TRADING_DAYS_PER_YEAR }, (_, i) => i);

// "the space between 2 months (January-February)" — the user's own chosen unit for how wide a
// margin to leave before January and after December (see xDomainPadding below), applied
// symmetrically on both ends rather than each end using its own neighboring months' particular
// width.
const MONTH_GAP_WIDTH = MONTH_TICK_INDEXES[1] - MONTH_TICK_INDEXES[0];

// A day-bucket index's own *approximate* calendar date within the reference year (see
// approxCalendarDayOfYear's own doc for why it's only approximate) — the hover crosshair/ruler's
// own denser per-point label, as opposed to xTickFormat's sparse month-only axis labels. -1 is
// the synthetic "Réf." anchor bucket (see computeSeasonality's own doc) rather than a real day.
function formatDayBucket(index: number): string {
  if (index === -1) return "Réf.";
  const date = new Date(Date.UTC(REFERENCE_YEAR, 0, 1 + approxCalendarDayOfYear(index)));
  return d3.timeFormat("%d %b")(date);
}

// US presidential elections land every 4 years on the nose (1788, 1792, … 2024, 2028…) — no
// lookup table needed, just the one arithmetic fact; the other three phases of the same 4-year
// cycle follow from it (post-election the year right after, midterm two years after, pre-election
// the year right before the next one).
const isUSPresidentialElectionYear = (year: number) => year % 4 === 0;
const isUSPostElectionYear = (year: number) => year % 4 === 1;
const isUSMidtermElectionYear = (year: number) => year % 4 === 2;
const isUSPreElectionYear = (year: number) => year % 4 === 3;

// Dedicated pastel tones for the two conditional area-fill settings (see fillUnderCurve/
// fillBetweenCurves below) — independent of YEAR_PASTEL_COLORS just below (that palette identi-
// fies *which year* a line is; these two identify a *sign*, green for "up"/"outperforming",
// red for "down"/"underperforming", so reusing a slot from that other palette by coincidence
// would be confusing/fragile if it were ever reordered).
const PASTEL_GREEN = "#a8d8b8";
const PASTEL_RED = "#e8a8a8";

/** The chart body's own display mode — "current" (the default: the average line, plus the current
 *  (in-progress) year's own line overlaid on top of it, when there is one), "independent" (one
 *  line per included year, see the image the user attached: several thin past-year lines plus a
 *  thicker current-year one ending in a dot where its data currently stops). No separate "average
 *  only" mode of its own to pick — "current" already degrades to exactly that whenever there's no
 *  in-progress year in the data to overlay (see `hasCurrentYear`), so a 3rd option selecting the
 *  same rendering "current" already falls back to would have been redundant. */
type SeasonalityViewMode = "independent" | "current";

// A dedicated pastel palette for year lines — not indicators.ts's own INDICATOR_COLORS (sharper,
// built for a single indicator line standing alone against the price series), since several
// pastel lines sharing one small chart read as a *set* without any one of them fighting for
// attention — only the current year (drawn thicker, see `series` below) is meant to stand out.
// Literal hex, not a CSS var: a native `<input type="color">` can't open on a `var()` reference.
const YEAR_PASTEL_COLORS = ["#a8c3e8", "#a8d8b8", "#f0c99a", "#e8b4c8", "#c9b8e8", "#9ed9d3"];

/** One year's own occurrence value at every bucket it has data for — gaps (a bucket that year
 *  never reached, e.g. an in-progress current year past "today") are simply omitted rather than
 *  interpolated or zeroed, so the resulting line stops exactly where that year's own data does. */
function occurrencesForYear(buckets: SeasonalityBucket[], year: number): ChartPoint[] {
  const points: ChartPoint[] = [];
  for (const bucket of buckets) {
    const occurrence = bucket.occurrences.find((o) => o.year === year);
    if (occurrence) points.push({ x: bucket.index, y: occurrence.value });
  }
  return points;
}

export interface SeasonalityViewProps {
  data: Candle[];
  /** Shown in the header, next to "— Saisonnalité" — same convention as the main chart's own
   *  symbol label. */
  symbol?: string;
  /** Returns to the regular (non-seasonality) chart body. */
  onBack: () => void;
  /** Narrow/phone layout (see CandlestickChart's own `isNarrowLayout`). Only affects the price
   *  axis' own width, which drops to the same PRICE_AXIS_WIDTH_MOBILE gutter the candle chart uses
   *  there — so switching between the two views doesn't move the scale sideways under the reader.
   *  Default false. */
  mobile?: boolean;
  /** Same gate CandlestickChart's own header uses (`showHeader`) — without it there'd be no way
   *  back out of seasonality mode, so this only ever hides the header in the same edge case the
   *  main chart's own header would already be hidden in. Default true. */
  showHeader?: boolean;
  /** Fixed height in px for the chart area. Fills 100% of the container's width regardless. */
  height?: number;
  className?: string;
}

/**
 * Presentational half of the seasonality feature — `computeSeasonality` (see
 * `internal/seasonality.ts`) does the actual aggregation, kept entirely independent of this
 * component (and of React) so it can be tested, reused, or extended on its own. The header holds
 * the back button, title, and the view-mode dropdown (Années indépendantes/Année en cours, the
 * latter also the default — see `SeasonalityViewMode`); granularity and the years filter live in
 * their own
 * left-docked icon rail instead — same `TOOLS_RAIL_WIDTH`/visual convention as
 * `CandlestickChart`'s own drawing-tools rail — each opening its own popover (`DropdownPanel` for
 * years, since a multi-select with its own bulk actions needs more than the plain option list a
 * `Select` gives). The chart body itself renders through
 * `LineAreaChart` rather than a bespoke chart of its own — a seasonal path is just one more line
 * series once it's been computed, no reason to re-implement axes/zoom/hover for it — told to
 * match the main chart's own right-side price-axis convention (`yAxisOrientation="right"`,
 * `margin` reserving the same rail width on its own left edge) and to drop its own border
 * (`embedded`) since it's nested inside CandlestickChart's own bordered root.
 */
export function SeasonalityView({ data, symbol, onBack, showHeader = true, height = 380, mobile = false, className }: SeasonalityViewProps) {
  const availableYears = useMemo(() => Array.from(new Set(data.map((d) => d.date.getUTCFullYear()))).sort((a, b) => a - b), [data]);
  // Excluded, not included: unchecking a handful of years (an election year, a crash) out of a
  // long history is the common case — a whitelist would make every *other* year the odd one out.
  const [excludedYears, setExcludedYears] = useState<Set<number>>(new Set());
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const yearPickerAnchorRef = useRef<HTMLButtonElement>(null);
  // The chart's own built-in reset button (`LineAreaChart`'s `showZoomReset`) is hidden in favor
  // of this one, rendered in the header instead — same spot the main (non-seasonality) chart's
  // own "Réinitialiser le zoom" lives, rather than floating over the plot's own top-right corner
  // (where LineAreaChart's default toolbar sits, fine standalone but visually stranded once this
  // rail/header layout wraps around it).
  const lineChartRef = useRef<LineAreaChartHandle>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [viewMode, setViewMode] = useState<SeasonalityViewMode>("current");
  const [viewModeMenuOpen, setViewModeMenuOpen] = useState(false);
  const viewModeAnchorRef = useRef<HTMLButtonElement>(null);
  // Per-year display state for whichever years currently render as their own line (see
  // managedYears below) — deliberately separate from `excludedYears` above: that one decides what
  // feeds the *average*, this one only ever hides/recolors an already-individual line, and the two
  // shouldn't fight over the same checkbox. A year hidden this way, then later dropped out of
  // `result.years` entirely (e.g. via `excludedYears`), just leaves an inert, harmless entry here.
  const [hiddenYears, setHiddenYears] = useState<Set<number>>(new Set());
  const [yearColors, setYearColors] = useState<Record<number, string>>({});
  // Which year's own settings modal (currently just a color picker) is open — null when none is.
  const [colorModalYear, setColorModalYear] = useState<number | null>(null);
  // The rail's own ruler toggle — click-to-measure on the chart body (see LineAreaChart's
  // `measureActive`). `zoomable={!measureActive}` below suspends drag-to-pan/zoom while it's on,
  // same reasoning CandlestickChart's own drawing tools already suspend zoom while an `activeTool`
  // is set: the two gesture sets would otherwise fight over the same clicks/drags.
  const [measureActive, setMeasureActive] = useState(false);
  // The rail's own hover-average toggle — only actually wired into the chart (see LineAreaChart's
  // own `hoverAverage`) while viewMode === "independent" below, same "stays toggleable regardless
  // of the current view mode" reasoning fillUnderCurve/fillBetweenCurves already use just below:
  // flipping back to "independent" later shouldn't require re-enabling it. Meaningless in
  // "current" mode anyway (only ever two series there — the average line and the current year —
  // so there's already a dedicated average series on the chart to read directly).
  const [hoverAverageActive, setHoverAverageActive] = useState(false);
  // Both settings only ever take visual effect in "current" mode (see fillUnderCurve/
  // fillBetweenCurves' own use in `series`/`fillBetween` below) — left toggleable regardless of
  // the current viewMode rather than hidden in "independent", so flipping to "current" later
  // doesn't require re-opening this modal to turn them back on.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fillUnderCurve, setFillUnderCurve] = useState(false);
  const [fillBetweenCurves, setFillBetweenCurves] = useState(false);

  const result = useMemo(() => computeSeasonality(data, "day", excludedYears), [data, excludedYears]);
  const includedCount = availableYears.length - excludedYears.size;
  const currentYear = new Date().getUTCFullYear();
  const hasCurrentYear = result.years.includes(currentYear);

  // A year's own line color: a caller override if one was ever set via the "Années affichées"
  // list, else a slot in YEAR_PASTEL_COLORS above — a literal hex palette (a native
  // `<input type="color">` can't open on a `var(--lq-color-x)` reference as its own `value`, so
  // this can't reuse CHART_PALETTE's CSS-var-based colors the way most of this library's
  // categorical color-cycling does). Slot 0 (pastel blue, nowhere near the plain "average" line's
  // own accent) is reserved for the lone current-year overlay so the two can never coincide;
  // `fallbackIndex` is otherwise the caller's choice of which slot — a year's own position among
  // every included year, for independentYears.
  function colorForYear(year: number, fallbackIndex: number): string {
    return yearColors[year] ?? YEAR_PASTEL_COLORS[((fallbackIndex % YEAR_PASTEL_COLORS.length) + YEAR_PASTEL_COLORS.length) % YEAR_PASTEL_COLORS.length];
  }

  // The single source of truth for "which color does this year's line actually render in right
  // now" — "independent" cycles every included year through the palette by its own position,
  // otherwise there's only ever the lone current-year overlay, pinned to slot 0. Used both to
  // build `series` below and to color the "Années affichées" list's own swatches, so the two can
  // never drift apart the way two separately-inlined copies of this same branch just did.
  function displayColorForYear(year: number): string {
    return viewMode === "independent" ? colorForYear(year, result.years.indexOf(year)) : colorForYear(year, 0);
  }

  // Whichever years currently render as their own individual line — exactly the set the "Années
  // affichées" list below manages — regardless of `hiddenYears` (a hidden year stays listed, with
  // its own eye toggled off, so it can be brought back).
  const managedYears: number[] = viewMode === "independent" ? result.years : hasCurrentYear ? [currentYear] : [];

  const series: ChartSeries[] =
    viewMode === "independent"
      ? result.years
          .filter((year) => !hiddenYears.has(year))
          .map((year) => ({
            id: `year-${year}`,
            label: String(year),
            color: displayColorForYear(year),
            data: occurrencesForYear(result.buckets, year),
            strokeWidth: year === currentYear ? 3 : 1.5,
            endDot: year === currentYear,
          }))
      : [
          {
            id: "seasonality",
            label: `Moyenne (${result.years.length} année${result.years.length > 1 ? "s" : ""})`,
            data: result.buckets.map((b) => ({ x: b.index, y: b.average })),
          },
          ...(hasCurrentYear && !hiddenYears.has(currentYear)
            ? [
                {
                  id: `year-${currentYear}`,
                  label: `${currentYear} (en cours)`,
                  color: displayColorForYear(currentYear),
                  data: occurrencesForYear(result.buckets, currentYear),
                  strokeWidth: 3,
                  endDot: true,
                  // "Seulement en mode Année en cours" — this whole branch already only builds
                  // while viewMode === "current", so no extra gate needed here beyond the
                  // setting itself. Fills toward 0% (referenceLineY, passed to LineAreaChart
                  // below), not toward the average line — see fillBetween just below for that
                  // second, distinct comparison.
                  ...(fillUnderCurve ? { fillSignedAtReference: { positiveColor: PASTEL_GREEN, negativeColor: PASTEL_RED } } : {}),
                },
              ]
            : []),
        ];

  function toggleHiddenYear(year: number) {
    setHiddenYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  function toggleYear(year: number) {
    setExcludedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  // The years panel's own trash action — unlike toggleHiddenYear (a soft, reversible show/hide),
  // this drops the year from `excludedYears` itself, the same set "Années incluses" own checkbox
  // list manages — so it stops contributing to the average too, not just its own individual line,
  // and its row here simply stops existing on the next render (managedYears is derived from
  // result.years, which this shrinks) rather than needing its own "removed" state to track.
  function removeYear(year: number) {
    setExcludedYears((prev) => new Set(prev).add(year));
  }

  // Every footer preset works the same way: decide which years should end up *included*, then
  // exclude everything else — a plain re-derivation of `excludedYears` rather than toggling
  // individual years, so each preset always lands on the exact same result regardless of
  // whatever was selected before it.
  function includeOnly(predicate: (year: number) => boolean) {
    setExcludedYears(new Set(availableYears.filter((y) => !predicate(y))));
  }

  const yearsLabel = `${includedCount} année${includedCount > 1 ? "s" : ""}`;
  const recentYearsCount = Math.min(5, availableYears.length);
  const recentYearsCutoff = availableYears[availableYears.length - recentYearsCount];

  // "current" only offered once there's actually a current (in-progress) year in the data to
  // overlay — same gate the old standalone rail button used to hide behind entirely. Without it,
  // "current" mode still renders (it always has — see `series` above), just as a plain average
  // with nothing extra to overlay, so the trigger's own label falls back to "Moyenne" below to
  // describe what's actually showing instead of naming a mode with nothing to pick it from.
  const viewModeOptions: { value: SeasonalityViewMode; label: string }[] = [
    { value: "independent", label: "Années indépendantes" },
    ...(hasCurrentYear ? [{ value: "current" as const, label: "Année en cours" }] : []),
  ];
  const currentViewModeLabel = viewModeOptions.find((o) => o.value === viewMode)?.label ?? "Moyenne";

  return (
    <div className={["lq-chart__seasonality", className].filter(Boolean).join(" ")}>
      {showHeader && (
        <div className="lq-chart__header">
          <button type="button" className="lq-chart__icon-button" onClick={onBack} aria-label="Retour au graphique">
            <ChevronLeftIcon size={14} />
          </button>
          <span className="lq-chart__symbol-info-name">{symbol ? `${symbol} — Saisonnalité` : "Saisonnalité"}</span>
          {/* The view-mode picker — "Moyenne"/"Années indépendantes"/"Année en cours" — used to be
              two separate rail toggle buttons; now a single header dropdown, same
              trigger-button-plus-chevron convention the main (non-seasonality) chart's own
              timeframe picker already uses (see ChartHeader.tsx), since it's the same "pick one of
              a few named modes" shape. */}
          <button
            ref={viewModeAnchorRef}
            type="button"
            className="lq-chart__timeframe-trigger"
            onClick={() => setViewModeMenuOpen((o) => !o)}
            aria-label={`Mode d'affichage : ${currentViewModeLabel}`}
          >
            <span className="lq-chart__timeframe-trigger-label">{currentViewModeLabel}</span>
            <ChevronDownIcon size={12} />
          </button>
          <Popover open={viewModeMenuOpen} onClose={() => setViewModeMenuOpen(false)} anchorRef={viewModeAnchorRef} placement="bottom">
            <div className="lq-chart__tool-menu">
              {viewModeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={["lq-chart__tool-menu-option", opt.value === viewMode && "lq-chart__tool-menu-option--selected"]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    setViewMode(opt.value);
                    setViewModeMenuOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Popover>
          {/* Gated on the chart branch too, not just `isZoomed` — a data set too thin for even
              one real week-bucket (the empty-state branch below, no LineAreaChart at all) unmounts
              the chart without a chance to report itself back to `isZoomed=false`, which would
              otherwise leave a dead button in the header with nothing left for it to reset. */}
          {isZoomed && result.buckets.length > 1 && (
            <button type="button" className="lq-chart__reset-button" onClick={() => lineChartRef.current?.resetZoom()}>
              Réinitialiser le zoom
            </button>
          )}
        </div>
      )}

      <div style={{ position: "relative" }}>
        {/* Bottom-docked and horizontal on the phone layout, exactly like the candle chart's own
            ToolsRail — a 40px column of icons down the left edge of an already narrow plot costs
            more width than the tools are worth there, and the drawing rail this view sits beside
            has made the bottom edge the place tools live on that layout. Same class pair, so the
            flush-icons/no-borders/full-width rules written for that rail apply here untouched. */}
        <div
          className={["lq-chart__tools-rail", mobile && "lq-chart__tools-rail--horizontal"].filter(Boolean).join(" ")}
          style={mobile ? { height: TOOLS_RAIL_HEIGHT_MOBILE } : { width: TOOLS_RAIL_WIDTH, height }}
        >
          <div className="lq-chart__tools-rail-items">
            {/* Opens the two conditional-fill toggles below (aire sous la courbe / aire entre
                les deux courbes) — occupies the rail slot the old granularity picker used to
                (see this file's own git history), the only remaining per-chart setting once
                granularity itself stopped being a choice. */}
            <button
              type="button"
              className={["lq-chart__icon-button", settingsOpen && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
              onClick={() => setSettingsOpen((o) => !o)}
              aria-label="Paramètres de la saisonnalité"
              title="Paramètres d'affichage"
            >
              <SettingsIcon size={14} />
            </button>

            <button
              ref={yearPickerAnchorRef}
              type="button"
              className={["lq-chart__icon-button", yearPickerOpen && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
              onClick={() => setYearPickerOpen((o) => !o)}
              aria-label={`Années incluses : ${yearsLabel}`}
              title="Années incluses dans le calcul"
            >
              <CalendarIcon size={14} />
            </button>
            <DropdownPanel
              open={yearPickerOpen}
              onClose={() => setYearPickerOpen(false)}
              anchorRef={yearPickerAnchorRef}
              placement="bottom"
              // The preset/filter buttons live in `header` now, ahead of the year checkboxes
              // below in `children` — swapped from the original header-then-body-then-footer
              // order (filters used to be the footer, after the checkbox list) since the filters
              // are what most people reach for first, before hand-picking individual years.
              // `DropdownPanel` itself has no "a 4th section before the body" slot of its own, so
              // this reuses the same .lq-dropdown-panel__footer row style (border-top, wrapping
              // button row) nested inside `header` instead of passed as its own `footer` prop.
              header={
                <>
                  <div className="lq-dropdown-panel__header-row">
                    <span>Années incluses</span>
                    <span className="lq-dropdown-panel__header-count">{yearsLabel}</span>
                  </div>
                  <div className="lq-dropdown-panel__footer">
                    <button type="button" className="lq-dropdown-panel__footer-action" onClick={() => setExcludedYears(new Set())}>
                      Tout cocher
                    </button>
                    <button
                      type="button"
                      className="lq-dropdown-panel__footer-action"
                      onClick={() => setExcludedYears(new Set(availableYears))}
                    >
                      Tout décocher
                    </button>
                    <button
                      type="button"
                      className="lq-dropdown-panel__footer-action"
                      onClick={() => includeOnly(isUSPresidentialElectionYear)}
                      title="Ne garder que les années d'élection présidentielle américaine (1988, 1992, 1996…)"
                    >
                      Années d'élection (US)
                    </button>
                    <button
                      type="button"
                      className="lq-dropdown-panel__footer-action"
                      onClick={() => includeOnly(isUSMidtermElectionYear)}
                      title="Ne garder que les années de mi-mandat américaines (1990, 1994, 1998…)"
                    >
                      Mi-mandat (US)
                    </button>
                    <button
                      type="button"
                      className="lq-dropdown-panel__footer-action"
                      onClick={() => includeOnly(isUSPreElectionYear)}
                      title="Ne garder que les années précédant une élection présidentielle américaine (1991, 1995, 1999…)"
                    >
                      Pré-élection (US)
                    </button>
                    <button
                      type="button"
                      className="lq-dropdown-panel__footer-action"
                      onClick={() => includeOnly(isUSPostElectionYear)}
                      title="Ne garder que les années suivant une élection présidentielle américaine (1989, 1993, 1997…)"
                    >
                      Post-élection (US)
                    </button>
                    {recentYearsCount < availableYears.length && (
                      <button
                        type="button"
                        className="lq-dropdown-panel__footer-action"
                        onClick={() => includeOnly((y) => y >= recentYearsCutoff)}
                      >
                        {recentYearsCount} dernières années
                      </button>
                    )}
                  </div>
                </>
              }
            >
              {availableYears.map((year) => (
                <Checkbox key={year} checked={!excludedYears.has(year)} onChange={() => toggleYear(year)} label={String(year)} />
              ))}
            </DropdownPanel>

            <button
              type="button"
              className={["lq-chart__icon-button", measureActive && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
              onClick={() => setMeasureActive((a) => !a)}
              aria-label={measureActive ? "Désactiver l'outil règle" : "Outil règle"}
              title="Mesurer entre deux points"
            >
              <MeasureIcon size={14} />
            </button>

            <button
              type="button"
              className={["lq-chart__icon-button", hoverAverageActive && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
              onClick={() => setHoverAverageActive((a) => !a)}
              aria-label={hoverAverageActive ? "Désactiver la moyenne au survol" : "Moyenne au survol"}
              title="Afficher la moyenne de toutes les années à l'endroit survolé (mode Années indépendantes)"
            >
              <AverageLineIcon size={14} />
            </button>
          </div>
        </div>

        {/* Inline, always-on overlay (not a modal behind a rail button — that left it
            undiscoverable, see this file's own git history) for whichever years currently render
            as their own line. Floats over the plot's own top-left corner, right next to the
            rail, only while there's actually something to show. */}
        {/* Same look and interaction pattern as CandlestickChart's own price-overlay indicator
            legend (see ChartLegend.tsx / .lq-chart__indicator-legend in charts-shared.css) —
            plain colored text, no swatch/box/border, actions revealed on hover, double-click the
            label as a shortcut into the same settings modal the gear opens. Positioned inline
            (top/left) the same way ChartLegend's own wrapper is, since this file has no
            `dims.margin` of its own to read a position from. */}
        {managedYears.length > 0 && (
          <div
            // The legend's own rows (`.lq-chart__indicator-legend-item`) opt back into
            // pointer-events despite the container itself being pointer-events:none (so text
            // and hover-revealed actions stay clickable) — which, while measuring, silently
            // swallowed the ruler's very first click whenever it landed in this top-left corner
            // (a natural first-click spot, right where this legend already sits): the click
            // never reached the plot's own overlay underneath, so `measureStart` stayed null and
            // the *next* click became a degenerate zero-length "measurement" of a single point
            // against itself. `--inert` forces every row back to pointer-events:none for exactly
            // as long as the ruler is active, letting a click there fall through to the plot.
            className={["lq-chart__indicator-legend", measureActive && "lq-chart__indicator-legend--inert"].filter(Boolean).join(" ")}
            style={{ position: "absolute", top: 8, left: TOOLS_RAIL_WIDTH + 8, zIndex: 6 }}
          >
            {managedYears.map((year) => {
              const hidden = hiddenYears.has(year);
              const label = `${year}${year === currentYear ? " (en cours)" : ""}`;
              return (
                <div
                  key={year}
                  className="lq-chart__indicator-legend-item"
                  style={{ color: displayColorForYear(year) }}
                  onDoubleClick={() => setColorModalYear(year)}
                >
                  <span className={["lq-chart__indicator-legend-label", hidden && "lq-chart__indicator-legend-label--hidden"].filter(Boolean).join(" ")}>
                    {label}
                  </span>
                  <div className="lq-chart__indicator-legend-actions">
                    <button
                      type="button"
                      className="lq-chart__indicator-legend-action"
                      onClick={() => toggleHiddenYear(year)}
                      aria-label={hidden ? `Afficher ${label}` : `Masquer ${label}`}
                    >
                      {hidden ? <EyeOffIcon size={11} /> : <EyeIcon size={11} />}
                    </button>
                    <button
                      type="button"
                      className="lq-chart__indicator-legend-action"
                      onClick={() => removeYear(year)}
                      aria-label={`Supprimer ${label}`}
                    >
                      <TrashIcon size={11} />
                    </button>
                    <button
                      type="button"
                      className="lq-chart__indicator-legend-action"
                      onClick={() => setColorModalYear(year)}
                      aria-label={`Paramètres ${label}`}
                    >
                      <SettingsIcon size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {result.buckets.length <= 1 ? (
          <div className="lq-chart__empty" style={{ paddingLeft: TOOLS_RAIL_WIDTH }}>
            Pas assez de données pour calculer une saisonnalité.
          </div>
        ) : (
          <LineAreaChart
            ref={lineChartRef}
            series={series}
            xType="linear"
            // Straight segments between each day-bucket's own real value, not a smoothed spline
            // through them — at day resolution (see the "day" granularity above), monotone
            // smoothing was still visibly rounding off real peaks/troughs instead of just
            // prettifying sparse points, reading as an "interpolated curve" rather than an
            // honest close-to-close line.
            curveType="linear"
            // The hover crosshair/ruler's own denser per-point label (every real day-bucket, not
            // just the 12 month boundaries xTickFormat below labels on the axis itself).
            // Rounded, not an exact `===` match: the regular hover crosshair only ever passes an
            // exact bucket index (snapped via allXValues), but the ruler's own points are raw,
            // unsnapped pixel positions (see LineAreaChart's `measureActive`) that land between
            // buckets more often than not.
            formatX={(x) => formatDayBucket(Math.round(Number(x)))}
            formatY={(y) => `${Number(y) >= 0 ? "+" : ""}${Number(y).toFixed(1)}%`}
            axisHoverLabels
            // 365 real tick marks (one per day-bucket, see DAY_TICK_VALUES) but only the 12 that
            // land on a month boundary get an actual label — everything else reads "" via
            // xTickFormat, so the axis stays a bare mark there instead of a crowded 365-label row.
            xTickValues={DAY_TICK_VALUES}
            xTickFormat={(x) => {
              const monthIdx = MONTH_TICK_INDEXES.indexOf(Math.round(Number(x)));
              return monthIdx >= 0 ? MONTH_LABELS[monthIdx] : "";
            }}
            // "the space between 2 months (January-February)" on both ends — see
            // MONTH_GAP_WIDTH's own doc.
            xDomainPadding={{ start: MONTH_GAP_WIDTH, end: MONTH_GAP_WIDTH }}
            yTicks={8}
            // The floating years panel (see managedYears, above the chart in this file's own
            // JSX) already covers "which color is which year" (plus hide/recolor/remove, which
            // the plain legend can't do) — showing both would be two separately-stateful ways to
            // hide the same line (LineAreaChart's own click-to-fade legend item vs. this file's
            // own `hiddenYears`), so the built-in legend stays off.
            showLegend={false}
            hoverAverage={hoverAverageActive && viewMode === "independent"}
            fullscreenToggle={false}
            yAxisOrientation="right"
            embedded
            referenceLineY={0}
            showZoomReset={false}
            onZoomChange={setIsZoomed}
            // Same gutter the candle chart gives its own price axis on each layout — `Math.min` so a
            // DEFAULT_MARGIN.right that were ever narrowed below it stays narrow rather than being
            // widened back up by this.
            margin={{
              ...DEFAULT_MARGIN,
              // The rail this reserves room for is the left column on desktop and the bottom strip on
              // mobile (see it above) — so the reservation moves from one edge to the other with it,
              // rather than leaving 40px walled off on the left for a rail that is no longer there.
              left: mobile ? 0 : TOOLS_RAIL_WIDTH,
              bottom: (DEFAULT_MARGIN.bottom ?? 0) + (mobile ? TOOLS_RAIL_HEIGHT_MOBILE : 0),
              // Same gutter the candle chart gives its own price axis on each layout — `Math.min` so
              // a DEFAULT_MARGIN.right that were ever narrowed below it stays narrow rather than
              // being widened back up by this.
              right: mobile ? Math.min(DEFAULT_MARGIN.right ?? PRICE_AXIS_WIDTH_MOBILE, PRICE_AXIS_WIDTH_MOBILE) : DEFAULT_MARGIN.right,
            }}
            height={height}
            measureActive={measureActive}
            zoomable={!measureActive}
            // "si année actuelle > moyenne des années alors couleur verte pastel, si <, rouge
            // pastel" — only meaningful (and only ever built) once both lines actually coexist,
            // i.e. viewMode === "current" with an in-progress year to compare against the
            // average (see `series` above for both ids).
            {...(viewMode === "current" && fillBetweenCurves && hasCurrentYear
              ? { fillBetween: { seriesIdA: `year-${currentYear}`, seriesIdB: "seasonality", aAboveColor: PASTEL_GREEN, aBelowColor: PASTEL_RED } }
              : {})}
          />
        )}
      </div>

      {colorModalYear !== null && (
        <Modal open onClose={() => setColorModalYear(null)} title={`Paramètres — ${colorModalYear}`} footer={null}>
          <div className="lq-field">
            <label className="lq-field__label">Couleur</label>
            <input
              type="color"
              className="lq-chart__color-input"
              value={displayColorForYear(colorModalYear)}
              onChange={(e) => setYearColors((prev) => ({ ...prev, [colorModalYear]: e.target.value }))}
            />
          </div>
        </Modal>
      )}

      {settingsOpen && (
        <Modal open onClose={() => setSettingsOpen(false)} title="Paramètres de la saisonnalité" footer={null}>
          {/* Both settings below only ever take visual effect in "current" mode (see their own
              use in `series`/`fillBetween`) — a shared note here instead of repeating it on each
              checkbox's own label, which is a plain string everywhere else this component is
              used (see ChartSettingsModals' own Checkbox calls). */}
          <p className="lq-chart__indicator-picker-empty">Les deux réglages ci-dessous ne s'appliquent qu'en mode Année en cours.</p>
          <Checkbox checked={fillUnderCurve} onChange={() => setFillUnderCurve((v) => !v)} label="Colorer l'aire entre la courbe et l'axe 0%" />
          <Checkbox checked={fillBetweenCurves} onChange={() => setFillBetweenCurves((v) => !v)} label="Colorer l'aire entre les deux courbes" />
        </Modal>
      )}
    </div>
  );
}
