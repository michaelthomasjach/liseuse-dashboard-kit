import { describe, expect, it } from "vitest";
import { acceptsPlotZoomGesture, type PlotZoomGestureState } from "./plotZoomFilter";

const base: PlotZoomGestureState = {
  type: "wheel",
  activeTool: null,
  replayArmed: false,
  placementActive: false,
  drawingHovered: false,
  measureHovered: false,
  shiftMeasureEnabled: true,
  dblClickOnTarget: false,
};

describe("zoom du graphique et outils de dessin", () => {
  it("zoome à la molette quel que soit l'outil armé", () => {
    for (const tool of ["trendline", "horizontal", "ray", "rectangle", "fibonacci", "measure", "zoomIn", "rangeAsk", "channel"] as const) {
      expect(acceptsPlotZoomGesture({ ...base, activeTool: tool as PlotZoomGestureState["activeTool"] })).toBe(true);
    }
    // Même sur un dessin survolé pendant la pose.
    expect(acceptsPlotZoomGesture({ ...base, activeTool: "trendline" as PlotZoomGestureState["activeTool"], drawingHovered: true })).toBe(true);
  });

  it("laisse les clics, glisser et doubles-clics à l'outil armé", () => {
    for (const type of ["mousedown", "touchstart", "dblclick"]) {
      expect(acceptsPlotZoomGesture({ ...base, type, activeTool: "trendline" as PlotZoomGestureState["activeTool"] })).toBe(false);
    }
  });

  it("garde les règles sans outil : glisser permis, refusé sur un dessin survolé ou avec Maj", () => {
    expect(acceptsPlotZoomGesture({ ...base, type: "mousedown" })).toBe(true);
    expect(acceptsPlotZoomGesture({ ...base, type: "mousedown", drawingHovered: true })).toBe(false);
    expect(acceptsPlotZoomGesture({ ...base, type: "mousedown", shiftKey: true })).toBe(false);
    expect(acceptsPlotZoomGesture({ ...base, type: "wheel", shiftKey: true })).toBe(true);
    expect(acceptsPlotZoomGesture({ ...base, type: "mousedown", replayArmed: true })).toBe(false);
    expect(acceptsPlotZoomGesture({ ...base, type: "wheel", replayArmed: true })).toBe(true);
  });
});
