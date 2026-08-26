import type { ComponentType } from "react";
import type { DrawingToolType } from "../interfaces/DrawingToolType.interface";
import { TrendlineDiagram, ExtendedDiagram, ChannelDiagram, DisjointChannelDiagram, HorizontalDiagram, RayDiagram, VerticalDiagram } from "./lineToolDiagrams";
import { PitchforkDiagram, SchiffPitchforkDiagram, ModifiedSchiffPitchforkDiagram, InsidePitchforkDiagram } from "./pitchforkToolDiagrams";
import { RectangleDiagram, ZonesDiagram, ElbowArrowDiagram, BrushDiagram, ArrowUpDiagram, ArrowDownDiagram, ArrowLineDiagram } from "./regionMarkerToolDiagrams";
import {
  FibonacciDiagram,
  FibonacciExtensionDiagram,
  ElliottImpulseDiagram,
  ElliottCorrectionDiagram,
  HeadShouldersDiagram,
  CupHandleDiagram,
} from "./fibonacciPatternToolDiagrams";
import { ForecastDiagram, RangeForecastDiagram, LongPositionDiagram, ShortPositionDiagram } from "./forecastToolDiagrams";
import {
  TextDiagram,
  CommentDiagram,
  NoteDiagram,
  PriceNoteDiagram,
  PinDiagram,
  FlagMarkDiagram,
  SignpostDiagram,
  PriceLabelDiagram,
  TableDiagram,
} from "./textNoteToolDiagrams";
import { MeasureDiagram } from "./measureToolDiagram";

/** One explanatory diagram per `DrawingToolType` actually reachable from the tool-picker menus
 *  (see DRAWING_TOOL_CATEGORIES) — "zoomIn" has none, since it never appears in that catalog at
 *  all (an internal-only tool, not something a user ever picks by name — see its own doc in
 *  drawingCatalog.ts/useDrawingInteractions.ts). */
export const DRAWING_DIAGRAMS: Partial<Record<DrawingToolType, ComponentType>> = {
  trendline: TrendlineDiagram,
  extended: ExtendedDiagram,
  channel: ChannelDiagram,
  disjointChannel: DisjointChannelDiagram,
  horizontal: HorizontalDiagram,
  ray: RayDiagram,
  vertical: VerticalDiagram,
  pitchfork: PitchforkDiagram,
  schiffPitchfork: SchiffPitchforkDiagram,
  modifiedSchiffPitchfork: ModifiedSchiffPitchforkDiagram,
  insidePitchfork: InsidePitchforkDiagram,
  rectangle: RectangleDiagram,
  zones: ZonesDiagram,
  elbowArrow: ElbowArrowDiagram,
  brush: BrushDiagram,
  arrowUp: ArrowUpDiagram,
  arrowDown: ArrowDownDiagram,
  arrowLine: ArrowLineDiagram,
  fibonacci: FibonacciDiagram,
  fibonacciExtension: FibonacciExtensionDiagram,
  elliottImpulse: ElliottImpulseDiagram,
  elliottCorrection: ElliottCorrectionDiagram,
  headShoulders: HeadShouldersDiagram,
  cupHandle: CupHandleDiagram,
  forecast: ForecastDiagram,
  rangeForecast: RangeForecastDiagram,
  longPosition: LongPositionDiagram,
  shortPosition: ShortPositionDiagram,
  text: TextDiagram,
  comment: CommentDiagram,
  note: NoteDiagram,
  priceNote: PriceNoteDiagram,
  pin: PinDiagram,
  flagMark: FlagMarkDiagram,
  signpost: SignpostDiagram,
  priceLabel: PriceLabelDiagram,
  table: TableDiagram,
  measure: MeasureDiagram,
};
