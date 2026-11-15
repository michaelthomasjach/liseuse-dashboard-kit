import * as d3 from "d3";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { PriceScaleMode } from "../interfaces/PriceScaleMode.interface";
import type { ChartStyleSettings } from "../chartStyle";
import type { ChartAlert, ChartAlertDraft } from "../interfaces/ChartAlertDraft.interface";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import { indicatorCatalogEntry } from "../indicatorCatalog";

/**
 * Les leviers du graphique que les outils de contrôle (navigation, axes, panneaux, apparence, fenêtres de paramètres…)
 * actionnent : chacun est la fonction que le bouton, le menu ou le geste correspondant appelle déjà. Construit par
 * `CandlestickChart` à partir de son état courant (lu au moment de l'appel) — voir `buildAiChartControls`.
 */

type Scale = d3.ScaleLinear<number, number>;

/** Un panneau du graphique, tel que les outils le décrivent. */
export interface AiPaneInfo {
  /** « price » (les prix), « volume », sinon l'id de l'indicateur qui occupe le panneau. */
  id: string;
  kind: "prix" | "volume" | "indicateur";
  label: string;
  /** Indicateurs dessinés dans ce panneau (moyennes sur les prix, moyennes posées sur un panneau). */
  indicatorIds: string[];
  collapsed: boolean;
  fullscreen: boolean;
  /** Liste des indicateurs repliée dans la légende de ce panneau (chevron). */
  legendCollapsed: boolean;
  /** Légende masquée (réduite à une poignée). */
  legendHidden: boolean;
  /** Axe vertical automatique (suit les données visibles) ou réglé à la main. */
  yAuto: boolean;
  /** Valeurs affichées en bas et en haut du panneau, null si le panneau n'est pas affiché. */
  range: { min: number; max: number } | null;
  /** Position dans l'ordre des panneaux du bas (0 = juste sous les prix), absent pour les prix. */
  order?: number;
}

/** Les réglages de couleur et d'affichage hors « Toile » (fenêtre des paramètres système). */
export interface AiAppearance {
  upColor?: string;
  downColor?: string;
  volumeUpColor?: string;
  volumeDownColor?: string;
  closePulse: boolean;
  futureZone: boolean;
  pastZone: boolean;
}

/** Fenêtres de paramètres que les outils savent ouvrir. */
export type AiDialogTarget =
  | { kind: "systeme" }
  | { kind: "graphique" }
  | { kind: "volume" }
  | { kind: "separateurs_de_jours" }
  | { kind: "indicateur"; id: string }
  | { kind: "dessin"; id: string };

export interface AiChartControls {
  /** Fenêtre visible, en positions de bougies (fractionnaires ; 0 = bord gauche de la première bougie). */
  view: () => { start: number; end: number; length: number };
  /** Cadre la vue sur [start, end] (positions de bougies), animé ; annoncé aux graphiques liés comme un geste. */
  setView: (start: number, end: number) => void;
  /** La loupe « − » : retour à la vue d'ouverture, axes Y en automatique. */
  resetView: () => void;

  priceScaleMode: () => PriceScaleMode;
  setPriceScaleMode: (mode: PriceScaleMode) => void;
  autoFit: () => boolean;
  setAutoFit: (on: boolean) => void;

  panes: () => AiPaneInfo[];
  /** Fixe les bornes d'un axe vertical (« price », « volume » ou l'id d'un panneau) ; false si le panneau n'existe pas. */
  setPaneRange: (paneId: string, min: number, max: number) => boolean;
  /** Double-clic sur l'axe : retour à l'automatique (null : tous les axes). */
  resetPaneRange: (paneId: string | null) => void;
  setPaneCollapsed: (paneId: string, collapsed: boolean) => boolean;
  togglePaneFullscreen: (paneId: string) => void;
  /** Déplace un panneau du bas à cette position (0 = juste sous les prix). */
  movePane: (paneId: string, position: number) => boolean;
  toggleLegendCollapsed: (paneId: string) => void;
  setLegendHidden: (paneId: string, hidden: boolean) => boolean;
  volumeOverlay: () => boolean;
  setVolumeOverlay: (on: boolean) => void;

  indicators: () => Indicator[];
  indicatorLabel: (indicator: Indicator) => string;
  patchIndicator: (id: string, patch: Partial<Indicator>) => boolean;
  appendIndicator: (partial: Omit<Indicator, "id">) => void;

  style: () => ChartStyleSettings;
  patchStyle: (patch: Partial<ChartStyleSettings>) => void;
  appearance: () => AiAppearance;
  setAppearance: (patch: Partial<AiAppearance>) => void;
  /** Personnalisation avancée (Toile) incluse : sans elle, les réglages de la Toile sont gardés mais pas appliqués. */
  advancedAppearance: () => boolean;
  candleColorRules: () => unknown[];
  setCandleColorRules: (rules: unknown[]) => void;

  displayMode: () => string;
  displayModes: () => { mode: string; label: string }[];
  setDisplayMode: (mode: string) => void;

  templates: () => { id: string; name: string }[];
  activeTemplateId: () => string | null;
  loadTemplate: (id: string) => void;
  saveTemplateAs: (name: string) => void;

  drawingsHidden: () => boolean;
  setDrawingsHidden: (hidden: boolean) => void;
  drawingsLocked: () => boolean;
  setDrawingsLocked: (locked: boolean) => void;

  alerts: () => ChartAlert[];
  createAlert?: (draft: ChartAlertDraft) => void;
  updateAlert?: (id: string, draft: ChartAlertDraft) => void;
  deleteAlert?: (id: string) => void;

  fullscreen: () => boolean;
  toggleFullscreen: () => void;
  symbolInfoHidden: () => boolean;
  setSymbolInfoHidden: (hidden: boolean) => void;
  marketStateOpen: () => boolean;
  setMarketStateOpen: (open: boolean) => void;

  undo: () => boolean;
  redo: () => boolean;

  openDialog: (target: AiDialogTarget) => boolean;

  /** L'élément racine du graphique (en-tête, tracé, légendes) : la zone que l'outil d'interaction générique parcourt. */
  root: () => HTMLElement | null;
  /** Point de l'écran (coordonnées client) d'une bougie et d'une valeur dans un panneau, null hors de l'écran. */
  clientPoint: (index: number, value: number | null, paneId: string) => { x: number; y: number } | null;
  /** L'élément qui reçoit le clic droit du tracé. */
  plotElement: () => HTMLElement | null;
}

/** L'état de `CandlestickChart` dont les leviers sont faits, relu à chaque appel. */
export interface AiControlsState {
  plotElement: HTMLElement | null;
  chartRoot: HTMLElement | null;
  margin: { left: number; top: number };
  dataLength: number;
  xScale: Scale;
  zoomedXScale: Scale;
  maxXZoom: number;
  boundedWidth: number;
  setXTransformAnimated: (t: d3.ZoomTransform) => void;
  resetZoom: () => void;

  priceScaleMode: PriceScaleMode;
  setPriceScaleMode: (mode: PriceScaleMode) => void;
  yAutoScaling: boolean;
  setYAutoScaling: (on: boolean) => void;
  priceYAuto: boolean;
  priceHeight: number;
  zoomedPriceScale: Scale;
  yTransform: d3.ZoomTransform;
  setYTransform: (t: d3.ZoomTransform) => void;
  setYManuallyAdjusted: (on: boolean) => void;
  resetYAxis: () => void;

  volumeVisible: boolean;
  volumeCollapsed: boolean;
  volumePaneState: "expanded" | "collapsed" | "hidden";
  setVolumePaneState: (state: "expanded" | "collapsed" | "hidden") => void;
  volumeOverlay: boolean;
  setVolumeOverlay: (on: boolean) => void;
  volumeLegendHidden: boolean;
  toggleVolumeLegend: () => void;
  ownPaneIndicators: Indicator[];
  paneScaleAndOffset: (valueAxis: string) => { scale: Scale; offset: number };
  paneYTransform: Record<string, d3.ZoomTransform>;
  panPaneY: (paneId: string, start: d3.ZoomTransform, dy: number) => void;
  resetPaneYAxis: (paneId: string) => void;
  resetAllPaneYAxes: () => void;
  allPanesOrder: string[];
  reorderPanes: (order: string[]) => void;
  fullscreenPaneId: string | null;
  togglePaneFullscreen: (paneId: string) => void;
  legendCollapsed: Record<string, boolean>;
  toggleLegendCollapsed: (paneId: string) => void;

  indicators: Indicator[];
  indicatorLabel: (indicator: Indicator) => string;
  patchIndicator: (id: string, patch: Partial<Indicator>) => void;
  appendIndicator: (partial: Omit<Indicator, "id">) => void;

  chartStyle: ChartStyleSettings;
  setChartStyle: (next: ChartStyleSettings) => void;
  advancedAppearance: boolean;
  appearance: AiAppearance;
  setUpColor: (c: string | undefined) => void;
  setDownColor: (c: string | undefined) => void;
  setVolumeUpColor: (c: string | undefined) => void;
  setVolumeDownColor: (c: string | undefined) => void;
  setClosePulse: (on: boolean) => void;
  setFutureZone: (on: boolean) => void;
  setPastZone: (on: boolean) => void;
  candleColorRules: unknown[];
  setCandleColorRules: (rules: unknown[]) => void;

  displayMode: string;
  displayModes: { mode: string; label: string }[];
  setDisplayMode: (mode: string) => void;

  templates: { id: string; name: string }[];
  activeTemplateId: string | null;
  loadTemplate: (id: string) => void;
  saveTemplateAs: (name: string) => void;

  drawingsHidden: boolean;
  setDrawingsHidden: (hidden: boolean) => void;
  drawingsLocked: boolean;
  setDrawingsLocked: (locked: boolean) => void;
  drawings: () => TrendLineDrawing[];
  editDrawing: (drawing: TrendLineDrawing) => void;

  alerts: ChartAlert[];
  onCreateAlert?: (draft: ChartAlertDraft) => void;
  onUpdateAlert?: (id: string, draft: ChartAlertDraft) => void;
  onDeleteAlert?: (id: string) => void;

  isFullscreen: boolean;
  toggleFullscreen: () => void;
  symbolInfoHidden: boolean;
  setSymbolInfoHidden: (hidden: boolean) => void;
  marketStateOpen: boolean;
  setMarketStateOpen: (open: boolean) => void;
  undo: () => boolean;
  redo: () => boolean;

  openSystemSettings: () => void;
  openSymbolSettings: () => void;
  openVolumeSettings: () => void;
  openDaySeparators: () => void;
  openIndicatorSettings: (id: string) => void;
}

/** Transformation verticale qui fait tenir [min, max] dans le panneau d'une échelle zoomée par `current`. */
export function transformForRange(zoomed: Scale, current: d3.ZoomTransform, min: number, max: number): d3.ZoomTransform | null {
  if (!(Number.isFinite(min) && Number.isFinite(max)) || max <= min) return null;
  const [r0, r1] = zoomed.range();
  // Échelle de départ (sans zoom) en pixels : zoomed(v) = current.applyY(base(v)).
  const base = (v: number) => current.invertY(zoomed(v));
  const bMin = base(min);
  const bMax = base(max);
  if (!Number.isFinite(bMin) || !Number.isFinite(bMax) || bMin === bMax) return null;
  const k = (r0 - r1) / (bMin - bMax);
  if (!Number.isFinite(k) || k <= 0) return null;
  return new d3.ZoomTransform(k, 0, r1 - k * bMax);
}

const domainOf = (scale: Scale | undefined): { min: number; max: number } | null => {
  if (!scale) return null;
  const [a, b] = scale.domain();
  return Number.isFinite(a) && Number.isFinite(b) ? { min: Math.min(a, b), max: Math.max(a, b) } : null;
};

export function buildAiChartControls(get: () => AiControlsState): AiChartControls {
  const paneScale = (s: AiControlsState, paneId: string): Scale | undefined => {
    if (paneId === "price") return s.zoomedPriceScale;
    if (paneId === "volume" && !s.volumeVisible) return undefined;
    if (paneId !== "volume" && !s.ownPaneIndicators.some((i) => i.id === paneId)) return undefined;
    try {
      return s.paneScaleAndOffset(paneId).scale;
    } catch {
      return undefined;
    }
  };
  return {
    view: () => {
      const s = get();
      const [start, end] = s.zoomedXScale.domain();
      return { start, end, length: s.dataLength };
    },
    setView: (start, end) => {
      const s = get();
      const x0 = s.xScale(start);
      const x1 = s.xScale(end);
      if (!(x1 - x0 > 0) || s.boundedWidth <= 0) return;
      const k = Math.min(s.maxXZoom, Math.max(1, s.boundedWidth / (x1 - x0)));
      s.setXTransformAnimated(new d3.ZoomTransform(k, -k * x0, 0));
    },
    resetView: () => get().resetZoom(),

    priceScaleMode: () => get().priceScaleMode,
    setPriceScaleMode: (mode) => get().setPriceScaleMode(mode),
    autoFit: () => get().yAutoScaling,
    setAutoFit: (on) => get().setYAutoScaling(on),

    panes: () => {
      const s = get();
      const out: AiPaneInfo[] = [];
      const overlays = s.indicators.filter((i) => !i.sourceId && (indicatorCatalogEntry(i).pane === "price" || i.priceOverlay === true)).map((i) => i.id);
      out.push({
        id: "price",
        kind: "prix",
        label: "Prix",
        indicatorIds: overlays,
        collapsed: false,
        fullscreen: s.fullscreenPaneId === "price",
        legendCollapsed: Boolean(s.legendCollapsed.price),
        legendHidden: s.symbolInfoHidden,
        yAuto: s.priceYAuto,
        range: domainOf(s.zoomedPriceScale),
      });
      const order = s.allPanesOrder;
      if (s.volumeVisible) {
        out.push({
          id: "volume",
          kind: "volume",
          label: s.volumeOverlay ? "Volume (sur les prix)" : "Volume",
          indicatorIds: s.indicators.filter((i) => i.sourceId === "volume").map((i) => i.id),
          collapsed: s.volumeCollapsed,
          fullscreen: s.fullscreenPaneId === "volume",
          legendCollapsed: Boolean(s.legendCollapsed.volume),
          legendHidden: s.volumeLegendHidden,
          yAuto: !("volume" in s.paneYTransform),
          range: s.volumeCollapsed || s.volumeOverlay ? null : domainOf(paneScale(s, "volume")),
          ...(order.includes("volume") ? { order: order.indexOf("volume") } : {}),
        });
      }
      for (const ind of s.ownPaneIndicators) {
        out.push({
          id: ind.id,
          kind: "indicateur",
          label: s.indicatorLabel(ind),
          indicatorIds: [ind.id, ...s.indicators.filter((i) => i.sourceId === ind.id).map((i) => i.id)],
          collapsed: ind.paneCollapsed === true,
          fullscreen: s.fullscreenPaneId === ind.id,
          legendCollapsed: Boolean(s.legendCollapsed[ind.id]),
          legendHidden: ind.legendHidden === true,
          yAuto: !(ind.id in s.paneYTransform),
          range: ind.paneCollapsed ? null : domainOf(paneScale(s, ind.id)),
          ...(order.includes(ind.id) ? { order: order.indexOf(ind.id) } : {}),
        });
      }
      return out;
    },
    setPaneRange: (paneId, min, max) => {
      const s = get();
      const zoomed = paneScale(s, paneId);
      if (!zoomed) return false;
      const current = paneId === "price" ? s.yTransform : (s.paneYTransform[paneId] ?? d3.zoomIdentity);
      const next = transformForRange(zoomed, current, min, max);
      if (!next) return false;
      if (paneId === "price") {
        s.setYManuallyAdjusted(true);
        s.setYTransform(next);
      } else {
        s.panPaneY(paneId, next, 0);
      }
      return true;
    },
    resetPaneRange: (paneId) => {
      const s = get();
      if (paneId === null) {
        s.resetYAxis();
        s.resetAllPaneYAxes();
      } else if (paneId === "price") s.resetYAxis();
      else s.resetPaneYAxis(paneId);
    },
    setPaneCollapsed: (paneId, collapsed) => {
      const s = get();
      if (paneId === "volume") {
        if (!s.volumeVisible) return false;
        s.setVolumePaneState(collapsed ? "collapsed" : "expanded");
        return true;
      }
      if (!s.ownPaneIndicators.some((i) => i.id === paneId)) return false;
      s.patchIndicator(paneId, { paneCollapsed: collapsed });
      return true;
    },
    togglePaneFullscreen: (paneId) => get().togglePaneFullscreen(paneId),
    movePane: (paneId, position) => {
      const s = get();
      const order = [...s.allPanesOrder];
      const from = order.indexOf(paneId);
      if (from === -1) return false;
      order.splice(from, 1);
      order.splice(Math.max(0, Math.min(order.length, Math.round(position))), 0, paneId);
      s.reorderPanes(order);
      return true;
    },
    toggleLegendCollapsed: (paneId) => get().toggleLegendCollapsed(paneId),
    setLegendHidden: (paneId, hidden) => {
      const s = get();
      if (paneId === "price") {
        s.setSymbolInfoHidden(hidden);
        return true;
      }
      if (paneId === "volume") {
        if (s.volumeLegendHidden !== hidden) s.toggleVolumeLegend();
        return true;
      }
      if (!s.indicators.some((i) => i.id === paneId)) return false;
      s.patchIndicator(paneId, { legendHidden: hidden });
      return true;
    },
    volumeOverlay: () => get().volumeOverlay,
    setVolumeOverlay: (on) => get().setVolumeOverlay(on),

    indicators: () => get().indicators,
    indicatorLabel: (indicator) => get().indicatorLabel(indicator),
    patchIndicator: (id, patch) => {
      const s = get();
      if (!s.indicators.some((i) => i.id === id)) return false;
      s.patchIndicator(id, patch);
      return true;
    },
    appendIndicator: (partial) => get().appendIndicator(partial),

    style: () => get().chartStyle,
    patchStyle: (patch) => {
      const s = get();
      const next: ChartStyleSettings = { ...s.chartStyle };
      for (const [key, value] of Object.entries(patch) as [keyof ChartStyleSettings, unknown][]) {
        if (value === null || value === undefined) delete next[key];
        else (next as Record<string, unknown>)[key] = value;
      }
      s.setChartStyle(next);
    },
    appearance: () => get().appearance,
    setAppearance: (patch) => {
      const s = get();
      if ("upColor" in patch) s.setUpColor(patch.upColor);
      if ("downColor" in patch) s.setDownColor(patch.downColor);
      if ("volumeUpColor" in patch) s.setVolumeUpColor(patch.volumeUpColor);
      if ("volumeDownColor" in patch) s.setVolumeDownColor(patch.volumeDownColor);
      if (patch.closePulse !== undefined) s.setClosePulse(patch.closePulse);
      if (patch.futureZone !== undefined) s.setFutureZone(patch.futureZone);
      if (patch.pastZone !== undefined) s.setPastZone(patch.pastZone);
    },
    advancedAppearance: () => get().advancedAppearance,
    candleColorRules: () => get().candleColorRules,
    setCandleColorRules: (rules) => get().setCandleColorRules(rules),

    displayMode: () => get().displayMode,
    displayModes: () => get().displayModes,
    setDisplayMode: (mode) => get().setDisplayMode(mode),

    templates: () => get().templates,
    activeTemplateId: () => get().activeTemplateId,
    loadTemplate: (id) => get().loadTemplate(id),
    saveTemplateAs: (name) => get().saveTemplateAs(name),

    drawingsHidden: () => get().drawingsHidden,
    setDrawingsHidden: (hidden) => get().setDrawingsHidden(hidden),
    drawingsLocked: () => get().drawingsLocked,
    setDrawingsLocked: (locked) => get().setDrawingsLocked(locked),

    alerts: () => get().alerts,
    ...(get().onCreateAlert ? { createAlert: (draft: ChartAlertDraft) => get().onCreateAlert?.(draft) } : {}),
    ...(get().onUpdateAlert ? { updateAlert: (id: string, draft: ChartAlertDraft) => get().onUpdateAlert?.(id, draft) } : {}),
    ...(get().onDeleteAlert ? { deleteAlert: (id: string) => get().onDeleteAlert?.(id) } : {}),

    fullscreen: () => get().isFullscreen,
    toggleFullscreen: () => get().toggleFullscreen(),
    symbolInfoHidden: () => get().symbolInfoHidden,
    setSymbolInfoHidden: (hidden) => get().setSymbolInfoHidden(hidden),
    marketStateOpen: () => get().marketStateOpen,
    setMarketStateOpen: (open) => get().setMarketStateOpen(open),

    undo: () => get().undo(),
    redo: () => get().redo(),

    openDialog: (target) => {
      const s = get();
      switch (target.kind) {
        case "systeme":
          s.openSystemSettings();
          return true;
        case "graphique":
          s.openSymbolSettings();
          return true;
        case "volume":
          if (!s.volumeVisible) return false;
          s.openVolumeSettings();
          return true;
        case "separateurs_de_jours":
          s.openDaySeparators();
          return true;
        case "indicateur":
          if (!s.indicators.some((i) => i.id === target.id)) return false;
          s.openIndicatorSettings(target.id);
          return true;
        case "dessin": {
          const drawing = s.drawings().find((d) => d.id === target.id);
          if (!drawing) return false;
          s.editDrawing(drawing);
          return true;
        }
      }
    },

    root: () => {
      const s = get();
      return (s.chartRoot?.closest(".lq-chart") as HTMLElement | null) ?? s.chartRoot;
    },
    clientPoint: (index, value, paneId) => {
      const s = get();
      const plot = s.plotElement;
      if (!plot) return null;
      const rect = plot.getBoundingClientRect();
      const x = rect.left + s.margin.left + s.zoomedXScale(index + 0.5);
      let y: number;
      if (paneId === "price") {
        const [lo, hi] = s.zoomedPriceScale.range();
        y = value === null ? (lo + hi) / 2 : s.zoomedPriceScale(value);
      } else {
        const zoomed = paneScale(s, paneId);
        if (!zoomed) return null;
        let offset = 0;
        try {
          offset = s.paneScaleAndOffset(paneId).offset;
        } catch {
          return null;
        }
        const [lo, hi] = zoomed.range();
        y = offset + (value === null ? (lo + hi) / 2 : zoomed(value));
      }
      y += rect.top + s.margin.top;
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
    },
    plotElement: () => get().plotElement,
  };
}
