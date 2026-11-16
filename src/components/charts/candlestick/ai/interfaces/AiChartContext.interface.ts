import type { Candle } from "../../interfaces/Candle.interface";
import type { Indicator } from "../../interfaces/Indicator.interface";
import type { IndicatorCatalogEntry } from "../../indicatorCatalog";
import type { TrendLineDrawing } from "../../interfaces/TrendLineDrawing.interface";
import type { ScriptDef } from "../../interfaces/ScriptDef.interface";
import type { CustomIndicatorDef } from "../../interfaces/CustomIndicatorDef.interface";
import type { ScriptRunOutput } from "../../scripting/interfaces/ScriptRunOutput.interface";
import type { FundamentalDataPoint } from "../../interfaces/FundamentalDataPoint.interface";
import type { OverlayDataPoint } from "../../interfaces/TrendLineDrawing.interface";
import type { AiWorkspaceControls } from "./AiWorkspaceControls.interface";

/** Everything the assistant can read from, and every lever it can pull.
 *
 *  One object, assembled by the chart from what it already has, rather than the assistant reaching
 *  into the chart's internals: this is the whole surface the model is given, so it can be read in
 *  one place and — the point — nothing outside it is reachable, however the model is prompted. A
 *  tool that is not here does not exist.
 *
 *  Every mutating entry is the *same* function the corresponding button already calls. The
 *  assistant adding an indicator and a person adding one are one code path, so they cannot drift
 *  apart, and an action the model takes is undoable exactly as a person's would be. */
export interface AiChartContext {
  symbol: string | undefined;
  timeframe: string | undefined;
  availableTimeframes: string[];
  data: Candle[];
  fundamentals: FundamentalDataPoint[] | undefined;
  /** Voir `CandlestickChartProps.symbolIsEquity` : false, les indicateurs réservés aux actions ne s'ajoutent pas. */
  symbolIsEquity?: boolean;

  indicators: Indicator[];
  indicatorCatalog: IndicatorCatalogEntry[];
  indicatorLabel: (indicator: Indicator) => string;
  addIndicator: (entry: IndicatorCatalogEntry) => void;
  removeIndicator: (id: string) => void;
  setVolumeVisible: (visible: boolean) => void;
  volumeVisible: boolean;

  /** The drawings as they stand *now*, not as the last render saw them — a tool that appends has
   *  to see what the tool before it in the same pass appended. */
  drawings: () => TrendLineDrawing[];
  commitDrawings: (next: TrendLineDrawing[]) => void;
  /** A fresh drawing id from the chart's own counter, so an assistant-made drawing can never
   *  collide with a hand-drawn one. */
  nextDrawingId: () => string;

  scripts: ScriptDef[];
  runOutputs: Record<string, ScriptRunOutput>;
  /** Creates a script and returns its id. */
  addScript: (name: string, code: string) => string;
  updateScript: (id: string, code: string) => void;
  runScript: (id: string) => void;
  /** Tous les scripts du compte, à jour dans le même appel d'outil — dans un `ChartWorkspace`, ceux de toutes les
   *  fenêtres (`scripts` n'a que ceux de ce graphique). Absent : `scripts`. Sert à refuser un nom déjà pris. */
  allScripts?: () => ScriptDef[];
  /** Renomme un script (même id, même onglet). Le nom est vérifié avant par l'outil. */
  renameScript?: (id: string, name: string) => void;
  /** Indicateurs personnels fournis par l'application (`CandlestickChartProps.customIndicators`). */
  customIndicatorDefs?: () => CustomIndicatorDef[];

  setTimeframe: ((timeframe: string) => void) | undefined;
  setSymbol: ((symbol: string) => void) | undefined;
  /** Opens a script in the editor, so "j'ai écrit la stratégie" ends with it on screen rather
   *  than merely saved. */
  openScript: ((id: string) => void) | undefined;

  /** Replay (quand le graphique le propose) : démarre à la dernière bougie à cette date ou avant (null : un instant
   *  tiré au hasard) et renvoie la date retenue, ou null sans données. Dans un espace de travail, toutes les
   *  fenêtres suivent. */
  startReplay?: (at: Date | null) => Date | null;
  quitReplay?: () => void;
  /** Date de la dernière bougie révélée par le replay en cours, null hors replay. */
  replayCutoff?: () => Date | null;
  /** Filigrane du symbole (taille en % de la taille par défaut, opacité de 0 à 1). */
  watermark?: () => { visible: boolean; opacity: number; size: number };
  setWatermark?: (patch: Partial<{ visible: boolean; opacity: number; size: number }>) => void;

  /** Bougies d'un autre symbole, dans l'unité de temps de ce graphique, demandées à l'application
   *  (`loadSymbolCandles`, à défaut `onAddSymbolOverlay`). Absent : aucun moyen d'en obtenir — la bibliothèque n'a
   *  pas de source de données. */
  loadCandles?: (symbol: string) => Promise<Candle[]>;
  /** Le symbole de l'application qui affiche « numérateur / dénominateur » (`ratioSymbol`), ou null s'il n'en a pas. */
  ratioSymbol?: (numerator: string, denominator: string) => string | null;
  /** Superpose une série au graphique avec la comparaison de symboles (axe en % depuis la première bougie visible),
   *  comme le « + » de la recherche. Rend false si ce symbole est déjà superposé. */
  addComparison?: (symbol: string, name: string, points: OverlayDataPoint[]) => boolean;
  /** L'espace de travail qui contient ce graphique, quand il est au premier plan d'un `ChartWorkspace`. */
  workspace?: AiWorkspaceControls;
  /** Capture de ce qui est affiché (même composition que le bouton appareil photo) : ce graphique, ou tout l'espace de
   *  travail qui le contient. Null quand il n'est pas à l'écran. Voir l'outil `capturer_le_graphique`. */
  capture?: (zone: AiCaptureZone) => Promise<AiChartCapture | null>;
  /** Les leviers du contrôle complet (navigation, axes, panneaux, apparence, fenêtres de paramètres, clic droit…),
   *  posés par `CandlestickChart` — voir `aiChartControls`. Absent : ces outils ne sont pas proposés. */
  controls?: import("../aiChartControls").AiChartControls;
}

/** « graphique » : la fenêtre au premier plan ; « espace_de_travail » : toutes les fenêtres de l'espace de travail. */
export type AiCaptureZone = "graphique" | "espace_de_travail";

/** Une capture : l'image composée et la période des bougies visibles à ce moment. */
export interface AiChartCapture {
  canvas: HTMLCanvasElement;
  visibleFrom?: Date;
  visibleTo?: Date;
}
