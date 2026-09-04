import type { ChartMargin } from "../internal/useChartDimensions";
import type { TrendLineDrawing } from "./interfaces/TrendLineDrawing.interface";

export const DEFAULT_MARGIN: Partial<ChartMargin> = { top: 0, right: 72, bottom: 24, left: 0 };
/** Screen-space distance (px) under which the pointer counts as "hovering" a drawn line. */
export const DRAWING_HIT_DISTANCE = 8;
/** Screen-space distance (px) a pointer can move between down and up while still counting as a
 *  plain click rather than a drag — see useDrawingInteractions' own handleOverlayPointerUp,
 *  which selects the drawing on a click but leaves an actual body-drag alone (already handled by
 *  the commitDrawings calls in handlePointerMove). */
export const CLICK_DRAG_THRESHOLD = 4;
/** Width of the drawing-tools rail. Added to the left margin so the plot/axes never draw
 *  under it — the rail gets its own reserved strip instead of overlaying the chart. */
export const TOOLS_RAIL_WIDTH = 40;
/** Height of the drawing-tools rail once it docks to the bottom instead of the left edge (see
 *  MOBILE_LAYOUT_BREAKPOINT) — added to the bottom margin the same way TOOLS_RAIL_WIDTH is added to
 *  the left one in the desktop layout, so the plot/axes never draw under it either. 44px matches
 *  the icon buttons' own coarse-pointer tap target (see .lq-chart__icon-button's own doc). */
export const TOOLS_RAIL_HEIGHT_MOBILE = 44;
/** Price-axis width once the chart is narrow enough to count as a phone layout (see
 *  MOBILE_LAYOUT_BREAKPOINT) — a ceiling on `DEFAULT_MARGIN.right`, never a widening of it. That
 *  72px gutter is sized for six-figure prices beside a desktop-width plot; on a ~360px screen it
 *  was a fifth of the whole width spent on four or five digits, taken straight out of the candles.
 *  Still comfortably wider than a "1 234.56" label at the axis' own font size. */
export const PRICE_AXIS_WIDTH_MOBILE = 44;
/** Width (px) below which the whole touch layout engages: the drawing-tools rail flips from a
 *  left-docked column to a bottom-docked scrollable row, the price axis narrows, a script's docked
 *  panes open folded, the legend stacks its quote, drawing points are placed by tap-and-nudge, and
 *  the workspace becomes two pages behind a bottom nav.
 *
 *  1200, not a phone's width, because the layout is wanted on tablets and on a folding phone with
 *  the screen open — an unfolded fold reports around 840 CSS px, a tablet 768 in portrait and 1024
 *  in landscape, and all three want the same finger-first treatment a phone gets. The cost is
 *  accepted deliberately: a desktop chart in a narrow embedding (one panel of a split-screen
 *  workspace, say) crosses it too and gets the same layout. That has always been the rule here —
 *  the measurement is the chart's own wrapper (see useChartDimensions), never the window, so a
 *  narrow embedding is treated as what it is, a narrow chart. */
export const MOBILE_LAYOUT_BREAKPOINT = 1200;
/** Distance (px) the date "+" button sits inset from the plot's own bottom edge — close to the
 *  date axis it mirrors (but clear of the date label's own badge just below the plot), and
 *  still inside the interactive rect so hovering it never counts as leaving the plot (see
 *  .lq-chart__plot's onPointerLeave). */
export const CROSSHAIR_ADD_INSET = 20;
/** Vertical gap between the live-price badge and the countdown badge sitting right below it. */
export const LIVE_COUNTDOWN_OFFSET = 20;
/** Half the rendered height of a `.lq-chart__axis-value--y` badge — see clampToPriceAxis. */
export const AXIS_BADGE_HALF_HEIGHT = 10;
/** Single drag-handle position for an axis-constrained line, as a fraction of the plot's own
 *  size along the axis it doesn't move on: a horizontal line's handle sits 1/4 of the width in
 *  from the right edge, a vertical line's handle 1/4 of the height down from the top. */
export const AXIS_HANDLE_FRACTION_X = 0.75;
export const AXIS_HANDLE_FRACTION_Y = 0.25;
/** Upper bound on how many date labels the bottom axis shows at once, regardless of how many
 *  candles are actually in view — matches BarChart/DeltaChart's own categorical-axis throttle. */
export const MAX_DATE_TICKS = 12;
/** Minimum pixel width reserved per date label before another tick is allowed to share the axis
 *  with it — see dateTickValues' own width-aware cap. A plain candle count alone (MAX_DATE_TICKS)
 *  can't account for how much horizontal room is actually available; a narrow split-screen panel
 *  squeezing the same 12 labels a full-width chart would show into a fraction of the space is
 *  exactly what overlapped them into unreadable clutter. */
export const MIN_DATE_TICK_SPACING_PX = 80;
export const DEFAULT_DRAWING_COLOR = "#6c87c9";
// Stable reference (not a fresh `[]` every render) for `visibleDrawings` to fall back to while
// drawings are hidden — avoids retriggering effects/memos keyed on it purely from array identity.
export const EMPTY_DRAWINGS: TrendLineDrawing[] = [];
/** How far past the data's own edges panning can reveal empty "future"/"past" space, as a
 *  fraction of the *current* viewport width — not a fixed candle count, which would feel
 *  enormous zoomed in (a handful of real candles next to a huge empty block) and negligible
 *  zoomed out. See the custom `constrain` passed to useD3Zoom below for the derivation: it
 *  caps how far each edge of the visible domain can sit past [0, data.length] to this fraction
 *  of the viewport, at every zoom level. */
export const MAX_EMPTY_FRACTION = 0.5;
/** Height (px) of a sub-pane's (volume, or an "own"-pane indicator — RSI/CHOP/MACD) header strip
 *  when collapsed — the full pane shrinks to exactly this, full width, showing just its name and
 *  an expand button. */
export const SUB_PANE_COLLAPSED_HEIGHT = 40;
/** Default height of an expanded sub-pane, as a fraction of the plot's own bounded height — the
 *  starting point before any manual resize (see paneHeightFractions/startPaneResize). */
export const DEFAULT_PANE_HEIGHT_FRACTION = 0.22;
/** Drag-to-resize bounds for a sub-pane, same fraction units as DEFAULT_PANE_HEIGHT_FRACTION. */
export const MIN_PANE_HEIGHT_FRACTION = 0.08;
export const MAX_PANE_HEIGHT_FRACTION = 0.6;
/** The `sidePanel` column's own default width (20%, see CandlestickChartProps.sidePanel) — a CSS
 *  flex-basis percentage, not a pixel value, so it always reads as "1/5 of the chart" regardless
 *  of container size with no JS measurement needed; only overridden once the user actually drags
 *  the resize handle (see useSidePanel's own widthPx). */
export const SIDE_PANEL_DEFAULT_WIDTH_FRACTION = "20%";
/** Drag-to-resize bounds for the side panel, plain pixels (unlike the pane-height fractions
 *  above) since there's no single "bounded" dimension already in scope to take a fraction of at
 *  the point the drag starts — see useSidePanel's own startResize. */
export const SIDE_PANEL_MIN_WIDTH = 200;
export const SIDE_PANEL_MAX_WIDTH = 560;
/** How many candles wide a freshly-placed "longPosition"/"shortPosition" box defaults to — a bar
 *  count rather than a pixel width so it reads the same regardless of the current zoom level,
 *  same reasoning MAX_EMPTY_FRACTION above uses a fraction over a fixed count for the opposite
 *  reason. Target/stop are freely draggable afterward, same as every other tool's default sizing. */
export const POSITION_TOOL_DEFAULT_BARS = 20;
/** "table"'s own default grid size at creation — freely reconfigurable afterward from the edit
 *  modal's Style tab (see TrendLineDrawing.tableRows/tableCols's own doc). */
export const TABLE_DEFAULT_ROWS = 3;
export const TABLE_DEFAULT_COLS = 3;
/** How close (px) to a "table"'s own outer edge a double-click needs to land to open its full
 *  edit modal (rows/cols/color/stroke) instead of a cell — see useDrawingInteractions' own
 *  handleOverlayDoubleClick. Without this margin the modal would be unreachable: its cells tile
 *  the box edge to edge, so every interior point already resolves to one. */
export const TABLE_BORDER_HIT_MARGIN = 6;
/** A `plot.pane(name, { dock: "left"|"right" })` script pane's own column — a flex sibling of
 *  `.lq-chart__main` (same shape as `ChartSidePanel`'s own width, see SIDE_PANEL_*_WIDTH), plain
 *  pixels since there's no single "bounded" dimension already in scope to take a fraction of at
 *  the point the drag starts, same reasoning as the side panel's own bounds. */
export const SIDE_DOCK_PANE_DEFAULT_WIDTH = 220;
export const SIDE_DOCK_PANE_MIN_WIDTH = 120;
export const SIDE_DOCK_PANE_MAX_WIDTH = 480;
/** Extra breathing room (px), beyond the header row's own SUB_PANE_COLLAPSED_HEIGHT, before a
 *  docked pane's plotted content is allowed to start — the header's own row already stops
 *  visually overlapping the content without this, but flush against it with zero gap still read
 *  as touching/cluttered. */
export const SIDE_DOCK_HEADER_GAP = 10;
/** Width (px) of the vertical band a *collapsed* docked pane folds down to — the exact mirror of
 *  SUB_PANE_COLLAPSED_HEIGHT, which is the height a collapsed pane in the *bottom* stack keeps.
 *  A docked pane collapses along its column's own short axis (it folds sideways, toward the
 *  column's outer edge) rather than along the stack's vertical one, so the band it leaves behind
 *  is vertical — its label rendered rotated inside it, see SideDockCollapsedStrip.tsx. */
export const SIDE_DOCK_COLLAPSED_WIDTH = 40;
