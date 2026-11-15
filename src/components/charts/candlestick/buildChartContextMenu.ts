import type * as d3 from "d3";
import { VOLUME_PANE_ID } from "./attachedIndicators";
import type { IndicatorKind } from "./interfaces/IndicatorKind.interface";
import type { ChartContextMenuItem, ChartMenuTarget } from "./components/ChartContextMenu";
import type { Candle } from "./interfaces/Candle.interface";
import type { TrendLineDrawing } from "./interfaces/TrendLineDrawing.interface";
import { drawingNoun } from "./drawingCatalog";
import type { PriceScaleMode } from "./interfaces/PriceScaleMode.interface";

/** Libellés des échelles de l'axe des prix, dans l'ordre du menu. */
const PRICE_SCALE_LABELS: Record<PriceScaleMode, string> = { linear: "Linéaire", log: "Logarithmique", percent: "Pourcentage" };

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
  /** Clic droit sur le panneau Volume : pour y poser une moyenne. */
  volumePane?: boolean;
  /** Clic droit sur la ligne d'un indicateur : son id et son nom, pour ouvrir ses paramètres. */
  indicatorId?: string;
  indicatorLabel?: string;
  /** Légende de l'indicateur du panneau cliqué (`paneId`), et de celui de la ligne (`indicatorId`), masquée ou non. */
  paneLegendHidden?: boolean;
  indicatorLegendHidden?: boolean;
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
  /** Retire du graphique l'indicateur du clic droit (panneau ou ligne sous le pointeur), par son id : cet indicateur
   *  seul, même si un autre a le même nom (deux SMA(20)). Entrées absentes sans elle. */
  removeIndicator?: (id: string) => void;
  /** Ouvre la création d'une alerte sur un indicateur (celui du panneau cliqué, ou la ligne sous le pointeur), au
   *  niveau du clic ; « price » comme id : une alerte sur le prix. */
  openIndicatorAlert?: (id: string, label: string, value: number | undefined) => void;
  /** Ouvre la recherche pour ajouter un symbole au graphique ; entrée absente sans elle. */
  openAddSymbol?: () => void;
  resetZoom: () => void;
  /** Échelle de l'axe des prix et ajustement automatique aux bougies visibles : sous-menu « Échelle des
   *  prix » (clic droit sur la zone des prix ou son axe), le même réglage que Paramètres → Échelles. */
  priceScaleMode?: PriceScaleMode;
  setPriceScaleMode?: (mode: PriceScaleMode) => void;
  priceAutoFit?: boolean;
  setPriceAutoFit?: (on: boolean) => void;
  fullscreenToggle: boolean;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  marketStateOpen: boolean;
  toggleMarketState: () => void;
  openSettings: () => void;
  /** Ligne d'informations (symbole, OHLC) masquée, et la bascule. */
  symbolInfoHidden?: boolean;
  toggleSymbolInfo?: () => void;
  /** Barres d'outils personnalisées (« Ajouter une toolbar personnalisée », sous-menu des barres enregistrées) :
   *  proposées sur la zone des prix seulement. */
  customToolbarItems?: ChartContextMenuItem[];
  /** Ouvre les paramètres du panneau Volume (clic droit sur le volume). */
  openVolumeSettings?: () => void;
  /** Masque / réaffiche la légende d'un indicateur (`Indicator.legendHidden`) ; entrées absentes sans elle. */
  toggleIndicatorLegend?: (id: string) => void;
  /** Légende du panneau Volume masquée, et la bascule. */
  volumeLegendHidden?: boolean;
  toggleVolumeLegend?: () => void;
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
  removeIndicator,
  openIndicatorAlert,
  openAddSymbol,
  resetZoom,
  priceScaleMode,
  setPriceScaleMode,
  priceAutoFit,
  setPriceAutoFit,
  fullscreenToggle,
  isFullscreen,
  toggleFullscreen,
  marketStateOpen,
  toggleMarketState,
  openSettings,
  symbolInfoHidden,
  toggleSymbolInfo,
  customToolbarItems,
  toggleIndicatorLegend,
  openVolumeSettings,
  volumeLegendHidden,
  toggleVolumeLegend,
}: BuildChartContextMenuArgs): ChartContextMenuItem[] {
  if (anchor === null) return [];
  const candle = data[Math.max(0, Math.min(data.length - 1, anchor.index))] ?? null;

  // Clic droit sur le panneau d'un indicateur ou sur le volume (pas sur les prix).
  const inSubPane = Boolean(anchor.paneId || anchor.volumePane);
  // Ce que vise chaque entrée, entouré sur le graphique tant qu'elle est survolée (voir ChartContextMenu) : le panneau
  // cliqué, celui des prix, le graphique entier, ou une courbe précise dans son panneau.
  const zone = anchor.paneId ?? (anchor.volumePane ? "volume" : "price");
  const onZone: ChartMenuTarget = { pane: zone };
  const onPrice: ChartMenuTarget = { pane: "price" };
  const onChart: ChartMenuTarget = { pane: "chart" };
  const onLine: ChartMenuTarget | undefined = anchor.indicatorId ? { pane: zone, lineId: anchor.indicatorId } : undefined;
  const t = (target: ChartMenuTarget | undefined, items: ChartContextMenuItem[]): ChartContextMenuItem[] =>
    items.map((item) => (item.separator || item.target ? item : { ...item, target }));
  return [
    // Object commands first, and only when the click actually landed on one — a menu whose top
    // item changes meaning depending on where you clicked is exactly what a context menu is for.
    ...(targetDrawing === null
      ? []
      : (() => {
          // Le dessin nommé par ce qu'il est : « la ligne », « le rectangle »…
          const noun = drawingNoun(targetDrawing);
          const patch = (p: Partial<TrendLineDrawing>) => commitDrawings(drawings.map((d) => (d.id === targetDrawing.id ? { ...d, ...p } : d)));
          return t({ pane: zone, drawingId: targetDrawing.id }, [
            { label: `Paramètres ${noun.of}…`, onSelect: () => setEditingDrawingId(targetDrawing.id) },
            {
              label: targetDrawing.locked ? `Déverrouiller ${noun.the}` : `Verrouiller ${noun.the}`,
              onSelect: () => patch({ locked: !targetDrawing.locked }),
            },
            ...(targetDrawing.timeframe && targetDrawing.lineType !== "symbolOverlay"
              ? [
                  {
                    label: targetDrawing.timeframeOnly
                      ? `Afficher ${noun.the} sur toutes les unités de temps`
                      : `Masquer ${noun.the} sur les autres unités de temps`,
                    onSelect: () => patch({ timeframeOnly: !targetDrawing.timeframeOnly }),
                  },
                ]
              : []),
            { label: `Supprimer ${noun.the}`, onSelect: () => commitDrawings(drawings.filter((d) => d.id !== targetDrawing.id)) },
            { separator: true },
          ] as ChartContextMenuItem[]);
        })()),
    ...t(onPrice, [
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
    ]),
    { separator: true },
    // Reading a number off a chart and retyping it is the small friction every trading tool has.
    ...t(onPrice, [
    { label: "Copier le prix", onSelect: () => void navigator.clipboard?.writeText(formatPrice(anchor.price)) },
    {
      label: "Copier la date",
      disabled: candle === null,
      onSelect: () => void (candle && navigator.clipboard?.writeText(formatDate(candle.date))),
    },
    ]),
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
        {
          label: "Ajouter une alerte",
          hint: target.hint,
          onSelect: () => openIndicatorAlert(target.id, target.label, target.value),
          target: anchor.paneId ? onZone : (onLine ?? onPrice),
        },
        { separator: true },
      ] as ChartContextMenuItem[];
    })(),
    // Le menu suit la zone cliquée : sur les prix, ce qui concerne le graphique principal ; sur le panneau d'un
    // indicateur ou le volume, ce qui concerne ce panneau seulement.
    ...(!inSubPane && openAddSymbol ? [{ label: "Ajouter un symbole…", onSelect: openAddSymbol, target: onPrice }] : []),
    ...(!inSubPane ? [{ label: "Ajouter un indicateur…", onSelect: () => openIndicatorPicker(), target: onPrice }] : []),
    ...(!inSubPane && customToolbarItems?.length ? [{ separator: true } as ChartContextMenuItem, ...customToolbarItems] : []),
    // Sur un panneau (indicateur, script, volume) : d'abord ses paramètres, où que l'on clique dans le panneau.
    ...(anchor.paneId && openIndicatorSettings
      ? ([
          {
            label: `Paramètres du ${anchor.paneLabel ?? "panneau"}…`,
            onSelect: () => openIndicatorSettings(anchor.paneId as string),
            target: onZone,
          },
        ] as ChartContextMenuItem[])
      : []),
    ...(anchor.volumePane && openVolumeSettings ? [{ label: "Paramètres du Volume…", onSelect: openVolumeSettings, target: onZone }] : []),
    // Le catalogue limité à ce qui se calcule sur les valeurs du panneau cliqué, posé sur lui.
    ...(anchor.paneId && addOnPane
      ? [
          {
            label: `Ajouter un indicateur sur ${anchor.paneLabel ?? "ce panneau"}…`,
            onSelect: () => openIndicatorPicker({ id: anchor.paneId as string, label: anchor.paneLabel ?? "ce panneau" }),
            target: onZone,
          },
        ]
      : []),
    // Sur le panneau Volume : le même catalogue limité, posé sur le volume (le choix se fait dans la fenêtre).
    ...(anchor.volumePane && addOnPane
      ? [{ label: "Ajouter un indicateur sur Volume…", onSelect: () => openIndicatorPicker({ id: VOLUME_PANE_ID, label: "Volume" }), target: onZone }]
      : []),
    // (Les moyennes sur le panneau d'un indicateur passent par « Ajouter un indicateur sur … », qui les propose.)
    { separator: true },
    { label: "Réinitialiser le zoom", hint: "Espace", onSelect: resetZoom, target: onChart },
    ...(!inSubPane && setPriceScaleMode && setPriceAutoFit
      ? ([
          {
            label: "Échelle des prix",
            hint: [priceAutoFit ? "Auto" : null, PRICE_SCALE_LABELS[priceScaleMode ?? "linear"]].filter(Boolean).join(" · "),
            onSelect: () => {},
            target: onPrice,
            submenu: [
              {
                label: "Auto (ajuster aux données visibles)",
                hint: priceAutoFit ? "✓" : undefined,
                onSelect: () => setPriceAutoFit(!priceAutoFit),
              },
              { separator: true },
              ...(Object.keys(PRICE_SCALE_LABELS) as PriceScaleMode[]).map((mode) => ({
                label: PRICE_SCALE_LABELS[mode],
                hint: (priceScaleMode ?? "linear") === mode ? "✓" : undefined,
                onSelect: () => setPriceScaleMode(mode),
              })),
            ],
          },
        ] as ChartContextMenuItem[])
      : []),
    ...(fullscreenToggle
      ? ([{ label: isFullscreen ? "Quitter le plein écran" : "Plein écran", onSelect: toggleFullscreen, target: onChart }] as ChartContextMenuItem[])
      : []),
    { separator: true },
    // Also reachable from the tools rail — but that rail only exists when `drawingTools` is on,
    // and the readout has nothing to do with drawing. This is the way in that always works.
    ...(!inSubPane ? [{ label: marketStateOpen ? "Masquer l'état du marché" : "État du marché", onSelect: toggleMarketState, target: onPrice }] : []),
    // La légende en haut à gauche : nom du symbole, type de bougies, ouverture / plus haut / plus bas / clôture.
    ...(!inSubPane && toggleSymbolInfo
      ? [{ label: symbolInfoHidden ? "Afficher la légende du symbole (OHLC)" : "Masquer la légende du symbole (OHLC)", onSelect: toggleSymbolInfo, target: onPrice }]
      : []),
    // La légende de ce que vise le clic, comme celle du symbole : le panneau d'un indicateur, le volume, et la courbe
    // sous le pointeur (un indicateur sur les prix, ou posé sur le panneau). Masquée, elle se réduit à une poignée.
    ...(anchor.paneId && toggleIndicatorLegend
      ? [
          {
            label: `${anchor.paneLegendHidden ? "Afficher" : "Masquer"} la légende du ${anchor.paneLabel ?? "panneau"}`,
            onSelect: () => toggleIndicatorLegend(anchor.paneId as string),
            target: onZone,
          },
        ]
      : []),
    ...(anchor.volumePane && toggleVolumeLegend
      ? [{ label: `${volumeLegendHidden ? "Afficher" : "Masquer"} la légende du volume`, onSelect: toggleVolumeLegend, target: onZone }]
      : []),
    ...(anchor.indicatorId && anchor.indicatorId !== anchor.paneId && toggleIndicatorLegend
      ? [
          {
            label: `${anchor.indicatorLegendHidden ? "Afficher" : "Masquer"} la légende du ${anchor.indicatorLabel ?? "l'indicateur"}`,
            onSelect: () => toggleIndicatorLegend(anchor.indicatorId as string),
            target: onLine,
          },
        ]
      : []),
    // Sur la ligne d'un indicateur : ses paramètres (période, couleurs, style…), juste avant ceux du graphique
    // (sauf l'indicateur du panneau lui-même, déjà proposé juste au-dessus).
    ...(anchor.indicatorId && openIndicatorSettings && anchor.indicatorId !== anchor.paneId
      ? ([
          {
            // « Paramètres du SMA(14)… », comme « Paramètres du RSI(14)… » juste au-dessus.
            label: anchor.indicatorLabel ? `Paramètres du ${anchor.indicatorLabel}…` : "Paramètres de l'indicateur…",
            onSelect: () => openIndicatorSettings(anchor.indicatorId as string),
            target: onLine,
          },
        ] as ChartContextMenuItem[])
      : []),
    // Supprimer ce que vise le clic : la ligne sous le pointeur, sinon le panneau. Par son id, jamais par son nom.
    ...(removeIndicator && (anchor.indicatorId || anchor.paneId)
      ? ([
          { separator: true },
          anchor.indicatorId && anchor.indicatorId !== anchor.paneId
            ? {
                label: anchor.indicatorLabel ? `Supprimer le ${anchor.indicatorLabel}` : "Supprimer l'indicateur",
                onSelect: () => removeIndicator(anchor.indicatorId as string),
                target: onLine,
              }
            : {
                label: `Supprimer le ${anchor.paneLabel ?? "panneau"}`,
                onSelect: () => removeIndicator(anchor.paneId as string),
                target: onZone,
              },
        ] as ChartContextMenuItem[])
      : []),
    // Les paramètres du graphique sur la zone des prix seulement : sur un panneau, ceux du panneau (plus haut).
    ...(!inSubPane ? [{ label: "Paramètres du graphique…", onSelect: openSettings, target: onChart }] : []),
  ];
}
