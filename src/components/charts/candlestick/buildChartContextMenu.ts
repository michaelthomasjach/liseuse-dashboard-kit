import type * as d3 from "d3";
import { ATTACHABLE_KINDS } from "./attachedIndicators";
import type { IndicatorKind } from "./interfaces/IndicatorKind.interface";
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
  /** Clic droit sur le panneau d'un indicateur (RSI, MACD…) : son id et son nom, pour y poser une moyenne. */
  paneId?: string;
  paneLabel?: string;
  /** La valeur de l'indicateur du panneau à la hauteur du clic (sur son échelle à lui). */
  paneValue?: number;
  /** Clic droit sur la ligne d'un indicateur : son id et son nom, pour ouvrir ses paramètres. */
  indicatorId?: string;
  indicatorLabel?: string;
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
  /** Ouvre le catalogue des indicateurs ; depuis le panneau d'un indicateur, il cible ce panneau. */
  openIndicatorPicker: (pane?: { id: string; label: string }) => void;
  /** Pose une moyenne (SMA, EMA, WMA) sur le panneau du clic droit (`anchor.paneId`). */
  addOnPane?: (kind: IndicatorKind, paneId: string) => void;
  /** Ouvre les paramètres de l'indicateur du clic droit (`anchor.indicatorId`). */
  openIndicatorSettings?: (id: string) => void;
  /** Ouvre la création d'une alerte sur un indicateur (celui du panneau cliqué, ou la ligne sous le pointeur), au
   *  niveau du clic ; « price » comme id : une alerte sur le prix. */
  openIndicatorAlert?: (id: string, label: string, value: number | undefined) => void;
  /** Ouvre la recherche pour ajouter un symbole au graphique ; entrée absente sans elle. */
  openAddSymbol?: () => void;
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
  addOnPane,
  openIndicatorSettings,
  openIndicatorAlert,
  openAddSymbol,
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
    // Une alerte au niveau du clic : sur l'indicateur du panneau cliqué (RSI, MACD…), sur la ligne d'indicateur
    // sous le pointeur, ou sinon sur le prix — comme « Ajouter une alerte » de TradingView.
    ...(() => {
      if (!openIndicatorAlert) return [];
      const target = anchor.paneId
        ? { id: anchor.paneId, label: anchor.paneLabel ?? "ce panneau", value: anchor.paneValue, hint: anchor.paneLabel }
        : anchor.indicatorId
          ? { id: anchor.indicatorId, label: anchor.indicatorLabel ?? "cet indicateur", value: anchor.price, hint: anchor.indicatorLabel }
          : { id: "price", label: "Prix", value: anchor.price, hint: formatPrice(anchor.price) };
      return [
        { label: "Ajouter une alerte", hint: target.hint, onSelect: () => openIndicatorAlert(target.id, target.label, target.value) },
        { separator: true },
      ] as ChartContextMenuItem[];
    })(),
    ...(openAddSymbol ? [{ label: "Ajouter un symbole…", onSelect: openAddSymbol }] : []),
    { label: "Ajouter un indicateur…", onSelect: () => openIndicatorPicker() },
    // Le catalogue limité à ce qui se calcule sur les valeurs du panneau cliqué, posé sur lui.
    ...(anchor.paneId && addOnPane
      ? [
          {
            label: `Ajouter un indicateur sur ${anchor.paneLabel ?? "ce panneau"}…`,
            onSelect: () => openIndicatorPicker({ id: anchor.paneId as string, label: anchor.paneLabel ?? "ce panneau" }),
          },
        ]
      : []),
    // Sur le panneau d'un indicateur : une moyenne de sa série, dessinée dans ce panneau.
    ...(anchor.paneId && addOnPane
      ? ATTACHABLE_KINDS.map(({ kind, label }) => ({
          label: `Ajouter une ${label} sur ${anchor.paneLabel ?? "ce panneau"}`,
          onSelect: () => addOnPane(kind, anchor.paneId as string),
        }))
      : []),
    { separator: true },
    { label: "Réinitialiser le zoom", hint: "Espace", onSelect: resetZoom },
    ...(fullscreenToggle
      ? ([{ label: isFullscreen ? "Quitter le plein écran" : "Plein écran", onSelect: toggleFullscreen }] as ChartContextMenuItem[])
      : []),
    { separator: true },
    // Also reachable from the tools rail — but that rail only exists when `drawingTools` is on,
    // and the readout has nothing to do with drawing. This is the way in that always works.
    { label: marketStateOpen ? "Masquer l'état du marché" : "État du marché", onSelect: toggleMarketState },
    // Sur la ligne d'un indicateur : ses paramètres (période, couleurs, style…), juste avant ceux du graphique.
    ...(anchor.indicatorId && openIndicatorSettings
      ? ([
          {
            label: anchor.indicatorLabel ? `Paramètres de l'indicateur ${anchor.indicatorLabel}…` : "Paramètres de l'indicateur…",
            onSelect: () => openIndicatorSettings(anchor.indicatorId as string),
          },
        ] as ChartContextMenuItem[])
      : []),
    { label: "Paramètres du graphique…", onSelect: openSettings },
  ];
}
