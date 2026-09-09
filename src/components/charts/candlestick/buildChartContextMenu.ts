import type * as d3 from "d3";
import type { ChartContextMenuItem } from "./components/ChartContextMenu";
import type { Candle } from "./interfaces/Candle.interface";
import type { TrendLineDrawing } from "./interfaces/TrendLineDrawing.interface";

/** Where the right-click landed, in both coordinate spaces the menu needs. */
export interface ChartContextMenuAnchor {
  menuX: number;
  menuY: number;
  price: number;
  index: number;
  bounds: { width: number; height: number };
}

export interface BuildChartContextMenuArgs {
  /** Null while no menu is open — the builder then returns an empty list. */
  anchor: ChartContextMenuAnchor | null;
  data: Candle[];
  drawings: TrendLineDrawing[];
  /** The drawing under the pointer when the menu opened, if any. Its commands come first. */
  targetDrawing: TrendLineDrawing | null;
  commitDrawings: (next: TrendLineDrawing[]) => void;
  setEditingDrawingId: (id: string) => void;
  /** Mutable counter behind every generated drawing id — shared with the rest of the chart so a
   *  menu-made line can never collide with a hand-drawn one. */
  nextDrawingId: () => string;
  priceScale: d3.ScaleLinear<number, number>;
  /** Same formatting the price axis itself uses, percent mode included. */
  formatPrice: (v: number) => string;
  formatDate: (d: Date) => string;
  openIndicatorPicker: () => void;
  resetZoom: () => void;
  fullscreenToggle: boolean;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  marketStateOpen: boolean;
  toggleMarketState: () => void;
  openSettings: () => void;
}

/** What the chart's right-click menu offers, top to bottom.
 *
 *  A plain function rather than a hook or a memo: it closes over a dozen handlers that are fresh
 *  every render anyway, and the list is only ever read while a menu is actually open. Kept out of
 *  `CandlestickChart` because it is a piece of copy as much as it is code — the labels, the order,
 *  and which commands are offered at all are the thing being decided here. */
export function buildChartContextMenu({
  anchor,
  data,
  drawings,
  targetDrawing,
  commitDrawings,
  setEditingDrawingId,
  nextDrawingId,
  priceScale,
  formatPrice,
  formatDate,
  openIndicatorPicker,
  resetZoom,
  fullscreenToggle,
  isFullscreen,
  toggleFullscreen,
  marketStateOpen,
  toggleMarketState,
  openSettings,
}: BuildChartContextMenuArgs): ChartContextMenuItem[] {
  if (anchor === null) return [];
  const candle = data[Math.max(0, Math.min(data.length - 1, anchor.index))] ?? null;

  return [
    // Object commands first, and only when the click actually landed on one — a menu whose top
    // item changes meaning depending on where you clicked is exactly what a context menu is for.
    ...(targetDrawing === null
      ? []
      : ([
          { label: "Modifier le dessin…", onSelect: () => setEditingDrawingId(targetDrawing.id) },
          { label: "Supprimer le dessin", onSelect: () => commitDrawings(drawings.filter((d) => d.id !== targetDrawing.id)) },
          { separator: true },
        ] as ChartContextMenuItem[])),
    {
      label: "Ligne horizontale ici",
      hint: formatPrice(anchor.price),
      onSelect: () =>
        commitDrawings([
          ...drawings,
          {
            id: nextDrawingId(),
            x1: data[0].date,
            y1: anchor.price,
            x2: data[data.length - 1].date,
            y2: anchor.price,
            lineType: "horizontal",
          },
        ]),
    },
    {
      label: "Ligne verticale ici",
      hint: candle ? formatDate(candle.date) : undefined,
      disabled: candle === null,
      onSelect: () => {
        if (!candle) return;
        const [p0, p1] = priceScale.domain() as [number, number];
        commitDrawings([
          ...drawings,
          { id: nextDrawingId(), x1: candle.date, y1: p0, x2: candle.date, y2: p1, lineType: "vertical" },
        ]);
      },
    },
    { separator: true },
    // Reading a number off a chart and retyping it is the small friction every trading tool has.
    { label: "Copier le prix", onSelect: () => void navigator.clipboard?.writeText(formatPrice(anchor.price)) },
    {
      label: "Copier la date",
      disabled: candle === null,
      onSelect: () => void (candle && navigator.clipboard?.writeText(formatDate(candle.date))),
    },
    { separator: true },
    { label: "Ajouter un indicateur…", onSelect: openIndicatorPicker },
    { separator: true },
    { label: "Réinitialiser le zoom", hint: "Espace", onSelect: resetZoom },
    ...(fullscreenToggle
      ? ([{ label: isFullscreen ? "Quitter le plein écran" : "Plein écran", onSelect: toggleFullscreen }] as ChartContextMenuItem[])
      : []),
    { separator: true },
    // Also reachable from the tools rail — but that rail only exists when `drawingTools` is on,
    // and the readout has nothing to do with drawing. This is the way in that always works.
    { label: marketStateOpen ? "Masquer l'état du marché" : "État du marché", onSelect: toggleMarketState },
    { label: "Paramètres du graphique…", onSelect: openSettings },
  ];
}
