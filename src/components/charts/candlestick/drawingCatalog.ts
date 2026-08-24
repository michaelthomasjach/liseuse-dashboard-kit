import {
  TrendLineIcon,
  ExtendedLineIcon,
  ChannelIcon,
  DisjointChannelIcon,
  HorizontalLineIcon,
  HorizontalRayIcon,
  VerticalLineIcon,
  FibonacciIcon,
  FibonacciExtensionIcon,
  ElliottImpulseIcon,
  ElliottCorrectionIcon,
  RectangleShapeIcon,
  ZonesIcon,
  ElbowArrowIcon,
  BrushIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowLineIcon,
  MeasureIcon,
  OverlayBadgeIcon,
  HeadShouldersIcon,
  ForecastIcon,
  RangeForecastIcon,
  LongPositionIcon,
  ShortPositionIcon,
  PitchforkIcon,
  SchiffPitchforkIcon,
  ModifiedSchiffPitchforkIcon,
  InsidePitchforkIcon,
  TextIcon,
  CommentIcon,
  NoteIcon,
  PriceNoteIcon,
  PinIcon,
  FlagMarkIcon,
  SignpostIcon,
  PriceLabelIcon,
} from "../../icons";
import type { DrawingToolType } from "./interfaces/DrawingToolType.interface";
import type { TrendLineDrawing } from "./interfaces/TrendLineDrawing.interface";

/** Standard Fibonacci retracement ratios, 0 (y1) to 1 (y2) — the same default set most trading
 *  platforms show (TradingView included). Not configurable per drawing: there was no request for
 *  that, and hand-rolling a "which levels" UI for one tool would be a lot of surface area for a
 *  set virtually everyone leaves at the defaults anyway. */
export const FIBONACCI_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/** Standard Fibonacci extension ratios — projected from the 3rd point (C) by this fraction of
 *  the 1st-to-2nd (A-to-B) leg's own price span, the conventional "trend-based Fib extension"
 *  formula most trading platforms use. */
export const FIBONACCI_EXTENSION_LEVELS = [0, 0.382, 0.618, 1, 1.382, 1.618, 2, 2.618];

/** How many points *beyond* x1/y1 and x2/y2 each multi-point tool collects before committing,
 *  and what each of those extra points (plus the first two) is labeled in the edit modal.
 *  Governs two different things depending on the tool: for fibonacciExtension/elliottCorrection/
 *  elliottImpulse, `handleOverlayClick` uses `extraPoints` to drive the actual generic
 *  click-collection loop (each click becomes one more raw point, verbatim). "disjointChannel" is
 *  here *only* for its edit-modal labels — its own placement flow is entirely custom (see
 *  handleOverlayClick's dedicated branch, checked before the generic one below it ever runs) since
 *  its 4th point is computed, not clicked. Tools not listed here (trendline/extended/fibonacci: 2
 *  points total; channel: 3, but its 3rd click sets `channelOffset` instead of a raw point,
 *  handled separately) don't use this at all. */
export const MULTI_POINT_TOOLS: Partial<Record<DrawingToolType, { extraPoints: number; labels: string[] }>> = {
  fibonacciExtension: { extraPoints: 1, labels: ["Point A", "Point B", "Point C"] },
  elliottCorrection: { extraPoints: 2, labels: ["Point 0", "Point A", "Point B", "Point C"] },
  elliottImpulse: { extraPoints: 4, labels: ["Point 0", "Point 1", "Point 2", "Point 3", "Point 4", "Point 5"] },
  disjointChannel: { extraPoints: 2, labels: ["Point 1", "Point 2", "Point 3", "Point 4"] },
  // The pattern's own 7 vertices in path order — 1 (the low right before the left shoulder), 2
  // (Épaule gauche), 3 (the trough between the two peaks), 4 (Tête), 5 (the trough after it,
  // paired with point 1 to derive the neckline — see drawHeadShoulders.ts), 6 (Épaule droite), 7
  // (the pattern's own confirmation point — below the neckline there confirms the breakout).
  headShoulders: { extraPoints: 5, labels: ["Point 1", "Épaule gauche", "Creux 1", "Tête", "Creux 2", "Épaule droite", "Point 7"] },
  // The 3 pitchfork points — labeled A/B/C to match the standard Andrews' Pitchfork reference
  // diagrams (and the same lettering drawPitchfork.ts itself now draws next to each point on the
  // chart). A (x1/y1) is the handle every variant's own median starts from or targets; B/C (x2/y2,
  // extraPoints[0]) are the two points the parallel tine lines pass through, unchanged across all
  // 4 variants (see pitchforkGeometry.ts).
  pitchfork: { extraPoints: 1, labels: ["A", "B", "C"] },
  schiffPitchfork: { extraPoints: 1, labels: ["A", "B", "C"] },
  modifiedSchiffPitchfork: { extraPoints: 1, labels: ["A", "B", "C"] },
  insidePitchfork: { extraPoints: 1, labels: ["A", "B", "C"] },
  // Listed here *only* for these labels — same "edit-modal labels only, placement is entirely
  // custom" reasoning disjointChannel's own doc above already explains. x1/y1 = Point de départ
  // (Current), x2/y2 = Max, extraPoints[0] = Min — both Max and Min are first *derived*
  // automatically from the tool's 2nd click (see rangeForecastMaxMin), then freely draggable by
  // hand afterward like any other point. Avg is never one of this drawing's own stored points —
  // always the midpoint of Max/Min, recomputed wherever it's needed (rendering, hit-testing) so
  // it never drifts out of sync after Max/Min are redragged.
  rangeForecast: { extraPoints: 1, labels: ["Point de départ", "Max", "Min"] },
  // Listed here *only* for these labels too — "longPosition"/"shortPosition" are single-click
  // tools (see TrendLineDrawing.lineType's own doc): entry is the click itself, target/stop are
  // both derived immediately from it (see longShortPositionDefaults), then freely draggable by
  // hand afterward like any other point.
  longPosition: { extraPoints: 1, labels: ["Entrée", "Objectif", "Stop"] },
  shortPosition: { extraPoints: 1, labels: ["Entrée", "Objectif", "Stop"] },
  // "note"/"priceNote": a plain 2-point line like a regular trend line, just with custom labels
  // here (0 extraPoints — x1/y1 and x2/y2 alone) so the edit modal reads "Ancre"/"Note" instead
  // of the generic "Point 1"/"Point 2" a bare 2-point line with no catalog entry falls back to.
  note: { extraPoints: 0, labels: ["Ancre", "Note"] },
  priceNote: { extraPoints: 0, labels: ["Ancre", "Note"] },
};

// Short vertex labels drawn directly on the chart next to each point — distinct from
// MULTI_POINT_TOOLS' longer "Point X" labels, which are for the edit modal's field list instead.
export const ELLIOTT_IMPULSE_VERTEX_LABELS = ["0", "1", "2", "3", "4", "5"];
export const ELLIOTT_CORRECTION_VERTEX_LABELS = ["0", "A", "B", "C"];
// Every one of the pattern's own 7 vertices gets a plain number (drawHeadShoulders.ts renders
// these in the theme's own "down" red, distinct from the pattern's own line color) — separate
// from the green pill badges drawHeadShoulders.ts also draws over the 3 peaks specifically
// (indices 1/3/5: Épaule gauche/Tête/Épaule droite), which name those three, not every vertex.
export const HEAD_SHOULDERS_VERTEX_LABELS = ["1", "2", "3", "4", "5", "6", "7"];

export interface DrawingToolDef {
  type: DrawingToolType;
  label: string;
  icon: typeof TrendLineIcon;
  /** Groups this tool with its own neighbors inside a tall dropdown (see ToolsRail.tsx, which
   *  draws a thin divider wherever it changes between two consecutive tools) — purely a visual
   *  grouping within one category's own menu, unrelated to `DrawingToolCategory.id` itself.
   *  Optional: a category whose tools are all left untagged (every one but "lines" today) renders
   *  as one flat list, same as before this field existed. */
  subgroup?: string;
}

export interface DrawingToolCategory {
  /** Stable key — also what tracks each category's own "last picked tool" and open/closed
   *  dropdown state, so it has to stay unique and never change once shipped. */
  id: string;
  /** Shown as a non-interactive header at the top of the category's own dropdown, above its
   *  list of tools. */
  label: string;
  tools: DrawingToolDef[];
}

// Each category gets its own button + chevron + dropdown in the rail (see the JSX below) —
// the button represents whichever of its own tools was picked last (defaulting to the first),
// same as the single button used to for the whole flat list before categories existed. 5
// categories by design: "shapes" (folded into "lines" as its generalist catch-all) and "elliott"
// (renamed/repurposed into "chartPatterns", gaining headShoulders, since Elliott waves are
// themselves one kind of chart pattern) both lost their own top-level slot; "measure" kept its
// own instead of joining "lines" like "shapes" did, since unlike a shape it doesn't add a drawing
// to the chart at all — a different enough kind of tool to stay a category of its own.
export const DRAWING_TOOL_CATEGORIES: DrawingToolCategory[] = [
  {
    id: "lines",
    label: "Lines",
    tools: [
      // subgroup "trend": the original free/constrained trend-line family.
      { type: "trendline", label: "Ligne de tendance", icon: TrendLineIcon, subgroup: "trend" },
      { type: "extended", label: "Ligne étendue", icon: ExtendedLineIcon, subgroup: "trend" },
      { type: "channel", label: "Canal", icon: ChannelIcon, subgroup: "trend" },
      { type: "disjointChannel", label: "Canal disjoint", icon: DisjointChannelIcon, subgroup: "trend" },
      { type: "horizontal", label: "Ligne horizontale", icon: HorizontalLineIcon, subgroup: "trend" },
      { type: "ray", label: "Ligne horizontale (à partir d'une date)", icon: HorizontalRayIcon, subgroup: "trend" },
      { type: "vertical", label: "Ligne verticale", icon: VerticalLineIcon, subgroup: "trend" },
      // subgroup "pitchfork": the 4 Andrews' Pitchfork variants.
      { type: "pitchfork", label: "Pitchfork", icon: PitchforkIcon, subgroup: "pitchfork" },
      { type: "schiffPitchfork", label: "Schiff Pitchfork", icon: SchiffPitchforkIcon, subgroup: "pitchfork" },
      { type: "modifiedSchiffPitchfork", label: "Modified Schiff Pitchfork", icon: ModifiedSchiffPitchforkIcon, subgroup: "pitchfork" },
      { type: "insidePitchfork", label: "Inside Pitchfork", icon: InsidePitchforkIcon, subgroup: "pitchfork" },
      // subgroup "regions": bounded-area shapes.
      { type: "rectangle", label: "Rectangle", icon: RectangleShapeIcon, subgroup: "regions" },
      { type: "zones", label: "Zones (positif/neutre/négatif)", icon: ZonesIcon, subgroup: "regions" },
      // subgroup "markers": arrows and freehand annotation.
      { type: "elbowArrow", label: "Flèche coudée", icon: ElbowArrowIcon, subgroup: "markers" },
      { type: "brush", label: "Pinceau", icon: BrushIcon, subgroup: "markers" },
      { type: "arrowUp", label: "Flèche haut", icon: ArrowUpIcon, subgroup: "markers" },
      { type: "arrowDown", label: "Flèche bas", icon: ArrowDownIcon, subgroup: "markers" },
      { type: "arrowLine", label: "Ligne fléchée", icon: ArrowLineIcon, subgroup: "markers" },
    ],
  },
  {
    id: "fibonacci",
    label: "Fibonacci",
    tools: [
      { type: "fibonacci", label: "Retracement de Fibonacci", icon: FibonacciIcon },
      { type: "fibonacciExtension", label: "Extension de Fibonacci", icon: FibonacciExtensionIcon },
    ],
  },
  {
    id: "chartPatterns",
    label: "Chart patterns",
    tools: [
      { type: "elliottImpulse", label: "Vague d'Elliott (impulsive)", icon: ElliottImpulseIcon },
      { type: "elliottCorrection", label: "Vague d'Elliott (correctrice)", icon: ElliottCorrectionIcon },
      { type: "headShoulders", label: "ETE (Épaule-Tête-Épaule)", icon: HeadShouldersIcon },
    ],
  },
  {
    id: "forecasting",
    label: "Forecasting",
    tools: [
      { type: "forecast", label: "Projection de prix", icon: ForecastIcon },
      { type: "rangeForecast", label: "Range forecast", icon: RangeForecastIcon },
      { type: "longPosition", label: "Position longue", icon: LongPositionIcon },
      { type: "shortPosition", label: "Position courte", icon: ShortPositionIcon },
    ],
  },
  {
    // More tools land here over time (Note, Note de prix, Pin, Tableau, Étiquette de prix,
    // Signpost, Marque drapeau) — each placed via its own live on-canvas entry/marker flow
    // instead of a click-collection sequence, so this category grows independently of the
    // click-based ones above.
    id: "textNotes",
    label: "Texte et notes",
    tools: [
      { type: "text", label: "Texte", icon: TextIcon },
      { type: "comment", label: "Commentaire", icon: CommentIcon },
      { type: "note", label: "Note", icon: NoteIcon },
      { type: "priceNote", label: "Note de prix", icon: PriceNoteIcon },
      { type: "pin", label: "Pin", icon: PinIcon },
      { type: "flagMark", label: "Marque drapeau", icon: FlagMarkIcon },
      { type: "signpost", label: "Signpost", icon: SignpostIcon },
      { type: "priceLabel", label: "Étiquette de prix", icon: PriceLabelIcon },
    ],
  },
  {
    id: "measure",
    label: "Measure",
    tools: [{ type: "measure", label: "Mesure", icon: MeasureIcon }],
  },
];

export function categoryOfTool(type: DrawingToolType): DrawingToolCategory {
  return DRAWING_TOOL_CATEGORIES.find((c) => c.tools.some((t) => t.type === type)) ?? DRAWING_TOOL_CATEGORIES[0];
}

// Bare-type lookup `drawingToolMeta` below builds on — also useful on its own wherever only a
// `DrawingToolType` is available and no actual `TrendLineDrawing` exists yet (e.g. the floating
// toolbar's own bell button, while a tool is merely active with nothing placed yet).
export function toolMetaForType(toolId: DrawingToolType): { label: string; icon: typeof TrendLineIcon } {
  for (const category of DRAWING_TOOL_CATEGORIES) {
    const tool = category.tools.find((t) => t.type === toolId);
    if (tool) return tool;
  }
  return DRAWING_TOOL_CATEGORIES[0].tools[0];
}

// Which tool would have created a drawing shaped like this one — `lineType` covers most of them
// directly, but a plain two-point line (undefined `lineType`) is either "Ligne de tendance" or
// "Ligne fléchée" depending on arrowLeft/arrowRight, since neither of those two tools sets a
// `lineType` of its own to disambiguate by. Used for both its label and its icon, e.g. in the
// "Dessins et indicateurs" modal's per-row badge.
export function drawingToolMeta(dr: TrendLineDrawing): { label: string; icon: typeof TrendLineIcon } {
  // Not a click-to-place tool (added from the symbol-search modal instead — see
  // onAddSymbolOverlay), so it has no entry in DRAWING_TOOL_CATEGORIES to find below. Reuses
  // OverlayBadgeIcon (already means "drawn directly over the price candles" elsewhere) rather
  // than a new icon just for this.
  if (dr.lineType === "symbolOverlay") {
    return { label: [dr.overlaySymbol, dr.overlaySymbolName].filter(Boolean).join(" · ") || "Symbole", icon: OverlayBadgeIcon };
  }
  return toolMetaForType(dr.lineType ?? (dr.arrowLeft || dr.arrowRight ? "arrowLine" : "trendline"));
}

// A drawing's own `text` (set from its edit modal's Texte tab) if it has one, otherwise falls
// back to its tool's own name (see drawingToolMeta).
export function drawingLabel(dr: TrendLineDrawing): string {
  return dr.text || drawingToolMeta(dr).label;
}
