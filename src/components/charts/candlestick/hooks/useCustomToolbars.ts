import { useMemo, useRef, useState } from "react";
import type { ChartCustomToolbar } from "../interfaces/ChartCustomToolbar.interface";
import type { DrawingToolType } from "../interfaces/DrawingToolType.interface";
import type { ChartContextMenuItem } from "../components/ChartContextMenu";
import { INDICATOR_CATALOG, type IndicatorCatalogEntry } from "../indicatorCatalog";
import { buildCustomToolbarCatalog, type CustomToolbarCatalogContext } from "../customToolbarCatalog";
import type { FloatingToolbarPlacement } from "./useFloatingToolbarPosition";

/** Ce que les boutons d'une barre personnalisée font sur le graphique : les mêmes gestes que le rail d'outils, l'en-tête
 *  et le clic droit, rassemblés ici pour que la barre n'ait rien à savoir du graphique. */
export interface CustomToolbarChartActions {
  activeTool: DrawingToolType | null;
  toggleDrawingTool: (type: DrawingToolType) => void;
  magnetActive: boolean;
  toggleMagnet: () => void;
  drawingsHidden: boolean;
  toggleDrawingsHidden: () => void;
  drawingsLocked: boolean;
  toggleDrawingsLocked: () => void;
  resetZoom: () => void;
  capture: (action: "copy" | "download") => void;
  replayOn: boolean;
  toggleReplay: () => void;
  openIndicatorPicker: () => void;
  drawingsManagerOpen: boolean;
  toggleDrawingsManager: () => void;
  marketStateOpen: boolean;
  toggleMarketState: () => void;
  openSettings: () => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  timeframe?: string;
  changeTimeframe?: (value: string) => void;
  addIndicator: (entry: IndicatorCatalogEntry) => void;
}

export interface UseCustomToolbarsArgs {
  /** Faux : ni barres ni entrées de menu (fonction désactivée par l'hôte). */
  enabled: boolean;
  defaultCustomToolbars?: ChartCustomToolbar[];
  onCustomToolbarsChange?: (toolbars: ChartCustomToolbar[]) => void;
  catalogContext: CustomToolbarCatalogContext;
  actions: CustomToolbarChartActions;
  /** Le tracé dans le parent positionné des barres (même repère que la barre flottante d'un dessin). */
  plotLeft: number;
  plotWidth: number;
}

function newToolbarId(): string {
  return `ctb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Barres d'outils personnalisées : la liste (non contrôlée, de départ `defaultCustomToolbars`, chaque changement
 *  remonté par `onCustomToolbarsChange`), ce que fait chaque outil, et les entrées du clic droit. */
export function useCustomToolbars({ enabled, defaultCustomToolbars, onCustomToolbarsChange, catalogContext, actions, plotLeft, plotWidth }: UseCustomToolbarsArgs) {
  const [toolbars, setToolbarsState] = useState<ChartCustomToolbar[]>(() => (defaultCustomToolbars ?? []).filter((t) => t && typeof t.id === "string"));
  const onChangeRef = useRef(onCustomToolbarsChange);
  onChangeRef.current = onCustomToolbarsChange;
  // La liste à jour, pour enchaîner deux changements dans le même geste sans perdre le premier.
  const toolbarsRef = useRef(toolbars);
  toolbarsRef.current = toolbars;
  const [renamingId, setRenamingId] = useState<string | null>(null);
  /** Barre dont le sélecteur d'outils doit s'ouvrir (celle qu'on vient de créer). */
  const [pickerRequestId, setPickerRequestId] = useState<string | null>(null);

  function commit(next: ChartCustomToolbar[]) {
    toolbarsRef.current = next;
    setToolbarsState(next);
    onChangeRef.current?.(next);
  }
  function update(id: string, patch: Partial<ChartCustomToolbar>) {
    commit(toolbarsRef.current.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  const { timeframes, canChangeTimeframe, favoriteIndicatorKinds, zoomable, replay, fullscreenToggle } = catalogContext;
  const favoritesKey = favoriteIndicatorKinds.join(",");
  const catalog = useMemo(
    () => buildCustomToolbarCatalog({ timeframes, canChangeTimeframe, favoriteIndicatorKinds, zoomable, replay, fullscreenToggle }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeframes, canChangeTimeframe, favoritesKey, zoomable, replay, fullscreenToggle],
  );

  function create() {
    const used = new Set(toolbarsRef.current.map((t) => t.name));
    let n = toolbarsRef.current.length + 1;
    while (used.has(`Barre ${n}`)) n++;
    const k = toolbarsRef.current.length % 5;
    const toolbar: ChartCustomToolbar = {
      id: newToolbarId(),
      name: `Barre ${n}`,
      tools: [],
      visible: true,
      dock: null,
      // En décalé pour que deux barres neuves ne se recouvrent pas.
      x: plotLeft + Math.max(8, plotWidth / 2 - 140) + 24 * k,
      y: 40 + 40 * k,
    };
    commit([...toolbarsRef.current, toolbar]);
    setPickerRequestId(toolbar.id);
  }

  const a = actions;
  /** Allumé (outil armé, bascule active, unité de temps courante) ; undefined : un bouton d'action simple. */
  function isActive(id: string): boolean | undefined {
    const [kind, value] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
    if (kind === "draw") return a.activeTool === value;
    if (kind === "tf") return a.timeframe === value;
    switch (id) {
      case "action:magnet": return a.magnetActive;
      case "action:hideDrawings": return a.drawingsHidden;
      case "action:lockDrawings": return a.drawingsLocked;
      case "action:zoomIn": return a.activeTool === "zoomIn";
      case "action:replay": return a.replayOn;
      case "action:drawingsManager": return a.drawingsManagerOpen;
      case "action:marketState": return a.marketStateOpen;
      case "action:fullscreen": return a.isFullscreen;
      default: return undefined;
    }
  }
  function activate(id: string) {
    const value = id.slice(id.indexOf(":") + 1);
    if (id.startsWith("draw:")) return a.toggleDrawingTool(value as DrawingToolType);
    if (id.startsWith("tf:")) return a.changeTimeframe?.(value);
    if (id.startsWith("ind:")) {
      const entry = INDICATOR_CATALOG.find((e) => e.kind === value);
      return entry ? a.addIndicator(entry) : undefined;
    }
    switch (id) {
      case "action:magnet": return a.toggleMagnet();
      case "action:hideDrawings": return a.toggleDrawingsHidden();
      case "action:lockDrawings": return a.toggleDrawingsLocked();
      case "action:zoomIn": return a.toggleDrawingTool("zoomIn");
      case "action:resetZoom": return a.resetZoom();
      case "action:captureCopy": return a.capture("copy");
      case "action:captureDownload": return a.capture("download");
      case "action:replay": return a.toggleReplay();
      case "action:indicators": return a.openIndicatorPicker();
      case "action:drawingsManager": return a.toggleDrawingsManager();
      case "action:marketState": return a.toggleMarketState();
      case "action:settings": return a.openSettings();
      case "action:fullscreen": return a.toggleFullscreen();
    }
  }

  /** Entrées du clic droit sur la zone des prix : créer une barre, et le sous-menu qui liste les barres enregistrées. */
  const menuItems: ChartContextMenuItem[] = !enabled
    ? []
    : [
        { label: "Ajouter une toolbar personnalisée", onSelect: create },
        ...(toolbars.length > 0
          ? [
              {
                label: "Toolbars personnalisées",
                onSelect: () => {},
                submenu: toolbars.map(
                  (t): ChartContextMenuItem => ({
                    label: t.name,
                    hint: t.visible ? "affichée" : "masquée",
                    onSelect: () => {},
                    submenu: [
                      { label: t.visible ? "Masquer" : "Afficher", onSelect: () => update(t.id, { visible: !t.visible }) },
                      { label: "Renommer…", onSelect: () => setRenamingId(t.id) },
                      { label: "Supprimer", onSelect: () => commit(toolbarsRef.current.filter((x) => x.id !== t.id)) },
                    ],
                  }),
                ),
              },
            ]
          : []),
      ];

  const layerProps = {
    toolbars: enabled ? toolbars : [],
    catalog,
    isActive,
    activate,
    setTools: (id: string, tools: string[]) => update(id, { tools }),
    setPlacement: (id: string, p: FloatingToolbarPlacement) => update(id, { dock: p.dock, x: p.x, y: p.y }),
    close: (id: string) => update(id, { visible: false }),
    renamingId: enabled ? renamingId : null,
    startRename: setRenamingId,
    rename: (id: string, name: string) => {
      const trimmed = name.trim();
      if (trimmed) update(id, { name: trimmed });
      setRenamingId(null);
    },
    cancelRename: () => setRenamingId(null),
    pickerRequestId,
    clearPickerRequest: () => setPickerRequestId(null),
  };

  return { toolbars, menuItems, layerProps };
}

export type CustomToolbarsLayerState = ReturnType<typeof useCustomToolbars>["layerProps"];
