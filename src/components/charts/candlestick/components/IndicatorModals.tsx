import type { IndicatorInfoTarget, IndicatorCodeTarget } from "../interfaces/IndicatorInfoTarget.interface";
import type { CommunityIndicatorEntry } from "../interfaces/CommunityIndicatorEntry.interface";
import { isScriptInfoTarget } from "../interfaces/IndicatorInfoTarget.interface";
import { analyzeScriptDescription } from "../scripting/scriptDescription";
import { ScriptDescriptionText } from "../scripting/components/ScriptDescriptionText";
import { analyzeScriptVariables } from "../scripting/scriptVariables";
import { scriptIdFromIndicatorId } from "../scripting/scriptOutputToCustomIndicatorDef";
import { ScriptParamsFields } from "../scripting/components/ScriptParamsFields";
import type { ScriptParamValue } from "../interfaces/ScriptParam.interface";
import { useEffect, useRef, useState } from "react";
import { Modal } from "../../../primitives/Modal";
import { InfoText } from "./InfoText";
import { Tabs } from "../../../primitives/Tabs";
import { SettingsIcon, TrashIcon, OverlayBadgeIcon, PaneBadgeIcon } from "../../../icons";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorKind } from "../interfaces/IndicatorKind.interface";
import type { CustomIndicatorDef } from "../interfaces/CustomIndicatorDef.interface";
import type { ScriptDef } from "../interfaces/ScriptDef.interface";
import { INDICATOR_CATALOG, type IndicatorCatalogEntry, indicatorCatalogEntry, indicatorLabel } from "../indicatorCatalog";
import { INDICATOR_DESCRIPTIONS, VOLUME_DESCRIPTION } from "../indicatorDescriptions";
import { INDICATOR_SCRIPT_SOURCES } from "../indicatorScriptSources";
import { CodeBlock } from "../../../primitives/CodeBlock";
import { INDICATOR_DIAGRAMS, VolumeDiagram } from "../diagrams/indicatorDiagramRegistry";
import { drawingToolMeta, drawingLabel } from "../drawingCatalog";
import { IndicatorSettingsInputs, IndicatorSettingsStyle } from "./IndicatorSettingsFields";
import { LinkedStyleRulesSection } from "./IndicatorStyleRulesEditor";
import { SettingsSection, differsFromDefaults, indicatorDefaults } from "./IndicatorSettingsLayout";
import { IndicatorPickerModal } from "./IndicatorPickerModal";
import { IndicatorTemplatesMenu } from "./IndicatorTemplatesMenu";
import { indicatorSettingsKey, withIndicatorSettings, type IndicatorTemplate } from "../indicatorPresets";
import { IndicatorHelpButton, useOpenIndicatorHelp } from "./IndicatorHelp";
import { hasIndicatorHelp } from "../indicatorHelp";
import { VolumePaneSettings, PriceOverlayToggle } from "./VolumePaneSettings";
import { ChartSymbolSettings, type ChartSymbolSettingsProps } from "./ChartSettingsDialog";
import { hasCandleColorOverrides, resetCandleColors } from "../candleColorOverrides";
import { VOLUME_PANE_ID, isPriceOverlay } from "../attachedIndicators";

/** Où se range un panneau d'indicateur : en bas (le cas courant) ou accroché à gauche / à droite (script). */
function indicatorDockOf(ind: Indicator): "bottom" | "left" | "right" {
  return ind.customData?.dock === "left" || ind.customData?.dock === "right" ? ind.customData.dock : "bottom";
}

/** Onglets des paramètres du graphique : la série principale (le symbole), puis les indicateurs tracés sur les prix. */
const PRICE_PANE_ID = "price";

export interface IndicatorModalsProps {
  indicatorPickerOpen: boolean;
  setIndicatorPickerOpen: (open: boolean) => void;
  /** Which indicator's "how it works" info modal is open, if any — "volume" since it isn't a
   *  real IndicatorKind (see VOLUME_DESCRIPTION's own doc). Lifted up to CandlestickChart itself
   *  (not local state here) since the info icon that opens it now lives in three places: the
   *  picker below, ChartLegend's own indicator rows, and PaneHeaders' own own-pane rows. */
  infoKind: IndicatorInfoTarget | null;
  setInfoKind: (target: IndicatorInfoTarget | null) => void;
  indicatorSearchQuery: string;
  setIndicatorSearchQuery: (query: string) => void;
  showVolume: boolean;
  setVolumePaneState: (state: "expanded" | "collapsed" | "hidden") => void;
  addIndicator: (entry: IndicatorCatalogEntry) => void;
  /** Opens the "Confirm Inputs"-style setup modal instead — the picker's own special-case for
   *  "correlation" (see CorrelationSetupModal's own doc), the one built-in kind that can't just
   *  be added with catalog defaults the way every other one is. */
  openCorrelationSetup: () => void;
  /** Caller-supplied indicators (see CandlestickChartProps.customIndicators) — merged into the
   *  picker alongside the built-in catalog, grouped by their own `section`. */
  customIndicators: CustomIndicatorDef[] | undefined;
  /** Voir `CandlestickChartProps.symbolIsEquity`. */
  symbolIsEquity?: boolean;
  addCustomIndicator: (def: CustomIndicatorDef) => void;
  /** Onglet « Communauté » — voir `CandlestickChartProps.communityIndicators`. */
  communityIndicators?: CommunityIndicatorEntry[];
  /** Ajoute (copie en lecture seule) le script d'un autre membre ; absent hors d'un `ChartWorkspace`. */
  addCommunityScript?: (entry: CommunityIndicatorEntry) => void;
  /** The chart's own saved scripts (see useScriptingState) — shown in the picker under "Mes
   *  scripts" alongside the built-in catalog and any custom indicators, so a script doesn't only
   *  exist inside the script editor's own tab strip. Unlike a built-in/custom row, a script is
   *  already a unique, persistent thing (never "added" more than once) — clicking its row toggles
   *  it enabled/disabled instead of creating a new indicator instance. */
  scripts: ScriptDef[];
  /** Where each script's own output currently lands on the chart, by script id — forwarded to the
   *  picker, see `IndicatorPickerModalProps.scriptPlacements`. */
  scriptPlacements?: Record<string, ("price" | "own")[]>;
  /** Scripts mid-run, so their picker row can say so and refuse a second click. */
  runningScriptIds?: string[];
  /** Commits one `new Variable(...)` parameter of a script-produced indicator's own script. Unlike
   *  every other field in this modal it applies immediately (and re-runs the script) rather than on
   *  "Enregistrer" — a parameter belongs to the script, not to the indicator draft this modal
   *  edits, so there is no draft for it to sit in. See useScriptingState's own doc. */
  setScriptParamValue: (id: string, name: string, value: ScriptParamValue) => void;
  toggleScriptEnabled: (id: string) => void;
  /** Opens an existing script in the editor — the picker's own "</>" button on a "Mes scripts" row,
   *  same shortcut a script-produced pane header already offers (see PaneHeaders.tsx). Undefined
   *  outside a `ChartWorkspace`, which is the only thing that ever renders a `ScriptEditorPanel`
   *  (see `useChartScripting`'s own doc) — the code modal then shows the script read-only, with no
   *  editor to send it to. */
  onEditScript?: (scriptId: string) => void;
  /** Which indicator's source the code viewer is showing, and how to change it. Lifted out of this
   *  component so the chart legend can open the same viewer — see ChartLegend's own
   *  `onOpenIndicatorCode`. */
  codeViewer: {
    codeTarget: IndicatorCodeTarget | null;
    setCodeTarget: (target: IndicatorCodeTarget | null) => void;
  };
  /** Creates a brand-new script from a built-in indicator's own script equivalent (see
   *  INDICATOR_SCRIPT_SOURCES) and opens it in the editor — the "Ouvrir dans l'éditeur" button of
   *  the picker's own code modal, i.e. "fork this built-in indicator". Same `undefined` outside a
   *  `ChartWorkspace` reasoning as `onEditScript` above. */
  onCreateScript?: (name: string, code: string) => void;
  /** Deletes a script for good — the picker's own trash button on a "Mes scripts" row, once its
   *  confirmation modal is accepted. Same `undefined` outside a `ChartWorkspace` reasoning as the
   *  two above: the script list isn't this chart's to shorten, so the button simply doesn't render.
   *  Distinct from `toggleScriptEnabled` (the row's own click), which only stops a script running
   *  and leaves it in the list. */
  onDeleteScript?: (scriptId: string) => void;
  /** Builds a `@strategy` script from an indicator script and opens it — the picker's own
   *  "créer une stratégie à partir de cet indicateur" action. The indicator is *imported* by the
   *  result, not copied into it (see `strategyFromIndicator`), so it stays the single source of
   *  truth for whatever both of them compute. Same `undefined` outside a `ChartWorkspace` reasoning
   *  as the callbacks above. */
  onCreateStrategyFromIndicator?: (scriptId: string) => void;
  /** Which picker rows are starred, by their own `PickerOption.key` (an `IndicatorKind` for a
   *  built-in, a def id for a custom one, a script id for a script). Held by the chart rather than
   *  the picker so it survives the modal closing, which is the whole point of a favourite. */
  favoriteIndicatorIds: string[];
  toggleFavoriteIndicator: (key: string) => void;
  indicatorsManagerOpen: boolean;
  setIndicatorsManagerOpen: (open: boolean) => void;
  indicators: Indicator[];
  commitIndicators: (next: Indicator[]) => void;
  ownPaneIndicators: Indicator[];
  volumeVisible: boolean;
  visibleDrawings: TrendLineDrawing[];
  setEditingId: (id: string | null) => void;
  setDraft: (d: TrendLineDrawing) => void;
  setEditModalTab: (tab: "coords" | "text" | "style") => void;
  commitDrawings: (next: TrendLineDrawing[]) => void;
  drawings: TrendLineDrawing[];
  openIndicatorSettings: (id: string) => void;
  removeIndicator: (id: string) => void;
  setVolumeSettingsOpen: (open: boolean) => void;
  /** Paramètres du panneau Volume ouverts (onglet « Volume », ou celui d'une moyenne posée dessus). */
  volumeSettingsOpen: boolean;
  /** Volume affiché sur le graphique des prix plutôt que dans son panneau (onglet « Volume »). */
  volumeOverlay: boolean;
  setVolumeOverlay: (on: boolean) => void;
  /** Paramètres du graphique (clic droit sur les prix → « Paramètres du graphique (symbole)… ») ouverts : onglet du
   *  symbole, ou celui d'un indicateur tracé sur les prix. */
  priceSettingsOpen: boolean;
  setPriceSettingsOpen: (open: boolean) => void;
  /** Le symbole du graphique : nom de l'onglet de la série principale. */
  symbol?: string;
  /** Réglages de la série principale (onglet du symbole), les mêmes que la page « Symbole » des paramètres système. */
  chartDisplayMode: ChartSymbolSettingsProps["chartDisplayMode"];
  setChartDisplayMode: ChartSymbolSettingsProps["setChartDisplayMode"];
  onChartDisplayModeChange: ChartSymbolSettingsProps["onChartDisplayModeChange"];
  closePulseVisible: boolean;
  setClosePulseVisible: (visible: boolean) => void;
  setUpColorOverride: (color: string | undefined) => void;
  setDownColorOverride: (color: string | undefined) => void;
  candleColorRules: ChartSymbolSettingsProps["candleColorRules"];
  setCandleColorRules: ChartSymbolSettingsProps["setCandleColorRules"];
  showCandleColorRules: boolean;
  chartStyle: ChartSymbolSettingsProps["chartStyle"];
  setChartStyle: ChartSymbolSettingsProps["setChartStyle"];
  /** Couleurs des barres du volume (celles des bougies, `upColorOverride` / `downColorOverride`, tant qu'elles ne sont
   *  pas réglées). */
  volumeUpColorOverride: string | undefined;
  setVolumeUpColorOverride: (color: string | undefined) => void;
  volumeDownColorOverride: string | undefined;
  setVolumeDownColorOverride: (color: string | undefined) => void;
  upColorOverride: string | undefined;
  downColorOverride: string | undefined;
  /** Tous les indicateurs du graphique, scripts compris (`indicators` n'a que ceux de la liste) : les onglets des
   *  paramètres d'un panneau, et les courbes qu'une zone remplie peut citer. */
  candleRuleIndicators: Indicator[];
  /** Rubrique « Zones remplies » de l'onglet Style — voir `CandlestickChartProps.showAreaFills`. Défaut vrai. */
  showAreaFills?: boolean;
  /** Option « Afficher sur le graphique des prix » — voir `CandlestickChartProps.showPaneOverlay`. Défaut vrai. */
  showPaneOverlay?: boolean;
  editingIndicatorId: string | null;
  indicatorDraft: Indicator | null;
  setIndicatorDraft: (d: Indicator) => void;
  /** Réécrit les règles de style conditionnel d'un autre indicateur (« Règles liées », voir usePaneLayout). */
  updateIndicatorStyleRules?: (id: string, rules: NonNullable<Indicator["styleRules"]>) => void;
  /** Modèles de configuration d'indicateur, tous types confondus (menu « Modèles » des paramètres). */
  indicatorTemplates?: IndicatorTemplate[];
  saveIndicatorTemplate?: (name: string, ind: Indicator) => void;
  deleteIndicatorTemplate?: (id: string) => void;
  closeIndicatorSettings: () => void;
  deleteEditingIndicator: () => void;
  saveIndicatorSettings: () => void;
  /** Le panneau visé quand le catalogue est ouvert depuis son clic droit — voir IndicatorPickerModal. */
  pickerTargetPane?: { id: string; label: string } | null;
  addOnPane?: (kind: IndicatorKind, paneId: string) => void;
}

/** The indicator-related modals other than the picker itself (see IndicatorPickerModal): "Dessins
 *  et indicateurs" (a flat
 *  manage-everything list — drawings, price-overlay indicators, own-pane indicators/volume, each
 *  with the same settings/delete actions already reachable from the chart itself), and the
 *  per-indicator settings modal (period/stdDev/MACD periods/color, whichever apply to that
 *  indicator's own kind). */
export function IndicatorModals({
  indicatorPickerOpen,
  setIndicatorPickerOpen,
  infoKind,
  setInfoKind,
  indicatorSearchQuery,
  setIndicatorSearchQuery,
  showVolume,
  setVolumePaneState,
  addIndicator,
  openCorrelationSetup,
  customIndicators,
  symbolIsEquity,
  addCustomIndicator,
  communityIndicators,
  addCommunityScript,
  scripts,
  setScriptParamValue,
  toggleScriptEnabled,
  scriptPlacements,
  runningScriptIds,
  onEditScript,
  codeViewer,
  onCreateScript,
  onDeleteScript,
  onCreateStrategyFromIndicator,
  favoriteIndicatorIds,
  toggleFavoriteIndicator,
  indicatorsManagerOpen,
  setIndicatorsManagerOpen,
  indicators,
  commitIndicators,
  ownPaneIndicators,
  volumeVisible,
  visibleDrawings,
  setEditingId,
  setDraft,
  setEditModalTab,
  commitDrawings,
  drawings,
  openIndicatorSettings,
  removeIndicator,
  setVolumeSettingsOpen,
  volumeSettingsOpen,
  volumeOverlay,
  setVolumeOverlay,
  priceSettingsOpen,
  setPriceSettingsOpen,
  symbol,
  chartDisplayMode,
  setChartDisplayMode,
  onChartDisplayModeChange,
  closePulseVisible,
  setClosePulseVisible,
  setUpColorOverride,
  setDownColorOverride,
  candleColorRules,
  setCandleColorRules,
  showCandleColorRules,
  chartStyle,
  setChartStyle,
  volumeUpColorOverride,
  setVolumeUpColorOverride,
  volumeDownColorOverride,
  setVolumeDownColorOverride,
  upColorOverride,
  downColorOverride,
  candleRuleIndicators,
  showAreaFills = true,
  showPaneOverlay = true,
  editingIndicatorId,
  indicatorDraft,
  setIndicatorDraft,
  updateIndicatorStyleRules,
  indicatorTemplates = [],
  saveIndicatorTemplate,
  deleteIndicatorTemplate,
  closeIndicatorSettings,
  pickerTargetPane,
  addOnPane,
}: IndicatorModalsProps) {
  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);
  // Set when the user clicks a picker row for an indicator that's already on the chart — instead
  // of silently adding a second instance, this opens a small "which did you mean" modal on top of
  // the picker (see its own render below) offering the two things that click could plausibly have
  // meant: add another instance anyway, or take the existing one(s) off the chart instead. `onAdd`/
  // `onRemove` close over whichever option was clicked, so this modal itself never needs to know
  // built-in vs. custom indicator distinctions — that's all resolved once, at click time, below.
  const [duplicatePrompt, setDuplicatePrompt] = useState<{ label: string; onAdd: () => void; onRemove: () => void } | null>(null);
  // Which row's "</>" is open, if any — the picker's own code view (an indicator's script
  // equivalent, or a script's own code). Local state, unlike `infoKind` lifted all the way up to
  // CandlestickChart: that one's icon appears in three separate places (picker, legend, pane
  // headers) and has to survive the picker closing under it, this one exists only here.
  // Controlled from CandlestickChart rather than local state: the picker is no longer the only way
  // in — an indicator's own legend row opens the same viewer — and two components cannot share one
  // component's local state.
  const { codeTarget, setCodeTarget } = codeViewer;
  // Page d'aide complète d'un indicateur intégré (« ? ») : la fenêtre « À propos » y renvoie aussi.
  const openIndicatorHelp = useOpenIndicatorHelp();
  // Which script the trash button is asking to delete, if any — deleting one is irreversible (its
  // code is gone with it), so unlike every other action in this picker it goes through a confirm
  // step rather than happening on the click itself. Holds the name too, so the modal can say what
  // it's about to delete without looking it up again.
  const [scriptToDelete, setScriptToDelete] = useState<{ id: string; name: string } | null>(null);
  // Which tab the settings modal shows — same "nothing outside this modal needs it" reasoning as
  // categoryFilter above. Reset to "inputs" whenever a *different* indicator's settings open (not
  // on every render — editingIndicatorId only actually changes when the user picks a new one),
  // so switching from one indicator to the next doesn't leave it stranded on a "Style" tab the
  // next indicator happens to render differently.
  const [settingsTab, setSettingsTab] = useState<"inputs" | "style">("inputs");
  useEffect(() => {
    setSettingsTab("inputs");
  }, [editingIndicatorId]);
  // Scoped to exactly what the manager list itself shows (visibleDrawings, not every drawing that
  // ever existed — a drawing outside the current view has no row here to have deleted it from) so
  // "tout supprimer" never removes something the user never saw listed. Indicators have no such
  // split: `indicators` is already 100% overlay + own-pane, nothing hidden from the list. Doesn't
  // close indicatorsManagerOpen itself — same as removing the last item one at a time, the manager
  // just re-renders into its own empty state.
  // Couleurs hausse / baisse que le graphique dessine vraiment (thème courant), pour l'onglet « Volume » : lues sur un
  // repère rendu dans l'arbre du graphique, qui hérite de ses variables CSS (la fenêtre, elle, est rendue ailleurs).
  const themeAnchorRef = useRef<HTMLSpanElement>(null);
  const [volumeTheme, setVolumeTheme] = useState<{ up: string; down: string; isEink: boolean }>({ up: "#26a69a", down: "#ef5350", isEink: false });
  useEffect(() => {
    const el = themeAnchorRef.current;
    if (!el || (!volumeSettingsOpen && !priceSettingsOpen)) return;
    const computed = getComputedStyle(el);
    setVolumeTheme({
      up: computed.getPropertyValue("--lq-color-up").trim() || "#26a69a",
      down: computed.getPropertyValue("--lq-color-down").trim() || "#ef5350",
      isEink: el.closest('[data-lq-palette="eink"]') !== null,
    });
  }, [volumeSettingsOpen, priceSettingsOpen]);

  function handleDeleteAll() {
    commitDrawings(drawings.filter((d) => !visibleDrawings.some((v) => v.id === d.id)));
    commitIndicators([]);
    if (volumeVisible) setVolumePaneState("hidden");
    setConfirmDeleteAllOpen(false);
  }

  return (
    <>
      <IndicatorPickerModal
        open={indicatorPickerOpen}
        onClose={() => setIndicatorPickerOpen(false)}
        searchQuery={indicatorSearchQuery}
        setSearchQuery={setIndicatorSearchQuery}
        setInfoKind={setInfoKind}
        setCodeTarget={setCodeTarget}
        showVolume={showVolume}
        setVolumePaneState={setVolumePaneState}
        addIndicator={addIndicator}
        indicators={indicators}
        commitIndicators={commitIndicators}
        customIndicators={customIndicators}
        symbolIsEquity={symbolIsEquity}
        addCustomIndicator={addCustomIndicator}
        communityIndicators={communityIndicators}
        addCommunityScript={addCommunityScript}
        scripts={scripts}
        scriptPlacements={scriptPlacements}
        runningScriptIds={runningScriptIds}
        toggleScriptEnabled={toggleScriptEnabled}
        openCorrelationSetup={openCorrelationSetup}
        favoriteIndicatorIds={favoriteIndicatorIds}
        toggleFavoriteIndicator={toggleFavoriteIndicator}
        onDeleteScript={onDeleteScript}
        onCreateStrategyFromIndicator={onCreateStrategyFromIndicator}
        onDuplicate={setDuplicatePrompt}
        onRequestDeleteScript={setScriptToDelete}
        targetPane={pickerTargetPane}
        addOnPane={addOnPane}
      />

      {duplicatePrompt && (
        <Modal
          open
          onClose={() => setDuplicatePrompt(null)}
          title="Indicateur déjà affiché"
          footer={
            <div className="lq-chart__edit-drawing-footer">
              <button
                type="button"
                className="lq-chart__reset-button"
                onClick={() => {
                  duplicatePrompt.onRemove();
                  setDuplicatePrompt(null);
                }}
              >
                Supprimer de la chart
              </button>
              <button
                type="button"
                className="lq-chart__confirm-button"
                onClick={() => {
                  duplicatePrompt.onAdd();
                  setDuplicatePrompt(null);
                }}
              >
                Ajouter quand même
              </button>
            </div>
          }
        >
          <p className="lq-chart__indicator-info-text">
            « {duplicatePrompt.label} » est déjà affiché sur ce graphique. Voulez-vous en ajouter une deuxième instance, ou
            retirer celle déjà présente ?
          </p>
        </Modal>
      )}

      {infoKind &&
        (() => {
          // A script-produced indicator documents itself: whatever its own script declared with
          // `@description`, rendered in this library's own small markup (see ScriptDescriptionText).
          // Nothing in the built-in catalog applies to it — its kind is always the catch-all
          // "custom", whose description would say nothing about what this particular script does.
          if (isScriptInfoTarget(infoKind)) {
            const script = scripts.find((entry) => entry.id === infoKind.scriptId);
            const source = script?.runDraftCode ?? script?.code ?? "";
            const { description } = analyzeScriptDescription(source);
            return (
              <Modal open onClose={() => setInfoKind(null)} title={script?.name ?? "Script"}>
                {description ? (
                  <ScriptDescriptionText text={description} />
                ) : (
                  <p className="lq-chart__indicator-info-text">
                    Ce script ne déclare pas de description. Ajoutez @description &quot;…&quot; en haut du script pour en écrire une.
                  </p>
                )}
              </Modal>
            );
          }
          const title = infoKind === "volume" ? "Volume" : (INDICATOR_CATALOG.find((entry) => entry.kind === infoKind)?.label ?? infoKind);
          const description = infoKind === "volume" ? VOLUME_DESCRIPTION : INDICATOR_DESCRIPTIONS[infoKind];
          // "volume" has no INDICATOR_DIAGRAMS entry for the same reason it has no canned
          // description keyed by IndicatorKind — it isn't one — so its diagram is named directly.
          const Diagram = infoKind === "volume" ? VolumeDiagram : INDICATOR_DIAGRAMS[infoKind];
          return (
            <Modal
              open
              onClose={() => setInfoKind(null)}
              title={title}
              size="wide"
              footer={
                openIndicatorHelp && infoKind !== "volume" && hasIndicatorHelp(infoKind) ? (
                  <div className="lq-chart__edit-drawing-footer">
                    <button
                      type="button"
                      className="lq-chart__confirm-button"
                      onClick={() => {
                        openIndicatorHelp(infoKind);
                        setInfoKind(null);
                      }}
                    >
                      Aide complète : formule et paramètres
                    </button>
                  </div>
                ) : undefined
              }
            >
              {Diagram && <Diagram />}
              {description && <InfoText>{description}</InfoText>}
            </Modal>
          );
        })()}

      {codeTarget !== null &&
        (() => {
          // A script row shows its own real code (the editor's unsaved draft when there is one, so
          // this never contradicts what the editor is showing) and offers to jump to it; a built-in
          // row shows the script *equivalent* of its computation (see INDICATOR_SCRIPT_SOURCES) and
          // offers to fork it into a brand-new script. Only the second is a copy — a built-in
          // indicator keeps computing in TypeScript over the whole series either way, so nothing
          // here is the code the chart is actually running for it.
          // Un indicateur de la communauté (pas encore ajouté, ou sa copie en lecture seule) : son code se consulte, et
          // se copie dans ses propres scripts quand l'éditeur est là ; il ne se modifie pas.
          const communityEntry =
            typeof codeTarget === "object" && "communityId" in codeTarget ? communityIndicators?.find((e) => e.id === codeTarget.communityId) : undefined;
          const isScript = typeof codeTarget === "object" && "scriptId" in codeTarget;
          const script = typeof codeTarget === "object" && "scriptId" in codeTarget ? scripts.find((entry) => entry.id === codeTarget.scriptId) : undefined;
          const shared = communityEntry ? { author: communityEntry.author } : script?.community;
          const label = communityEntry
            ? communityEntry.label
            : typeof codeTarget === "object"
              ? (script?.name ?? "Script")
              : (INDICATOR_CATALOG.find((entry) => entry.kind === codeTarget)?.label ?? codeTarget);
          const code = communityEntry
            ? (communityEntry.script?.code ?? "")
            : typeof codeTarget === "object"
              ? script?.community
                ? script.code
                : (script?.runDraftCode ?? script?.code ?? "")
              : (INDICATOR_SCRIPT_SOURCES[codeTarget] ?? "");
          const openInEditor = shared
            ? onCreateScript && (() => onCreateScript(label, code))
            : typeof codeTarget === "object" && "scriptId" in codeTarget
              ? onEditScript && (() => onEditScript(codeTarget.scriptId))
              : onCreateScript && (() => onCreateScript(label, code));
          return (
            <Modal
              open
              onClose={() => setCodeTarget(null)}
              title={label}
              size="wide"
              footer={
                openInEditor ? (
                  <div className="lq-chart__edit-drawing-footer">
                    <button
                      type="button"
                      className="lq-chart__confirm-button"
                      onClick={() => {
                        openInEditor();
                        setCodeTarget(null);
                        setIndicatorPickerOpen(false);
                      }}
                    >
                      {shared ? "Copier dans mes scripts" : isScript ? "Modifier ce script" : "Ouvrir dans l'éditeur"}
                    </button>
                  </div>
                ) : undefined
              }
            >
              <p className="lq-chart__indicator-info-text">
                {shared
                  ? `Indicateur partagé${shared.author ? ` par ${shared.author}` : ""} : lecture seule. Vous pouvez l'afficher et régler ses entrées, pas modifier son code${onCreateScript ? " — « Copier dans mes scripts » en fait une copie à vous" : ""}.`
                  : isScript
                  ? "Le code de ce script, tel qu'il s'exécute en ce moment."
                  : "Le calcul de cet indicateur, réécrit avec l'API de scripting de cette chart — de quoi le reprendre tel quel et le modifier. Ce n'est pas le code qu'exécute l'indicateur intégré, qui reste calculé en interne sur toute la série d'un coup ; c'est la manière de l'écrire soi-même, bougie par bougie."}
              </p>
              {code ? (
                <CodeBlock code={code} filename={label} highlight="javascript" showLineNumbers className="lq-code-block--fill" />
              ) : (
                <p className="lq-chart__indicator-info-text">Ce script est vide.</p>
              )}
            </Modal>
          );
        })()}

      {scriptToDelete && (
        <Modal
          open
          onClose={() => setScriptToDelete(null)}
          title="Supprimer ce script ?"
          footer={
            <div className="lq-chart__edit-drawing-footer">
              <button type="button" className="lq-chart__reset-button" onClick={() => setScriptToDelete(null)}>
                Annuler
              </button>
              <button
                type="button"
                className="lq-chart__confirm-button"
                onClick={() => {
                  onDeleteScript?.(scriptToDelete.id);
                  // The code modal may well be open on this very script behind this one (its "</>"
                  // sits right next to the trash that opened this) — closing it here keeps it from
                  // being left showing a script that no longer exists.
                  setCodeTarget(null);
                  setScriptToDelete(null);
                }}
              >
                Supprimer définitivement
              </button>
            </div>
          }
        >
          <p className="lq-chart__indicator-info-text">
            «&nbsp;{scriptToDelete.name}&nbsp;» sera supprimé de cette chart et de l&apos;éditeur de script, avec son code. Cette action est
            irréversible.
            {"\n\n"}
            Pour seulement l&apos;arrêter sans le perdre, fermez cette fenêtre et cliquez sur la ligne du script : elle le désactive et le
            laisse dans la liste.
          </p>
        </Modal>
      )}

      {indicatorsManagerOpen &&
        (() => {
          const overlay = indicators.filter((ind) => indicatorCatalogEntry(ind).pane === "price");
          const own = ownPaneIndicators;
          const hasAnything = overlay.length > 0 || own.length > 0 || volumeVisible || visibleDrawings.length > 0;
          // A row's own two actions mirror exactly what's already reachable from the chart itself
          // (the legend's roue crantée/corbeille for an overlay, a pane header's for an "own" one,
          // Suppr/double-clic for a drawing) — this list is a second way to reach the same actions,
          // not a new set of them, so nothing here can do anything the chart's own hover/pane-header
          // UI can't.
          const row = (label: string, badge: React.ReactNode, badgeTitle: string, onSettings: (() => void) | null, onDelete: () => void, key: string) => (
            <div className="lq-chart__indicators-manager-row" key={key}>
              <span className="lq-chart__indicators-manager-badge" title={badgeTitle}>
                {badge}
              </span>
              <span className="lq-chart__indicators-manager-name">{label}</span>
              <span className="lq-chart__indicators-manager-actions">
                {onSettings && (
                  <button type="button" className="lq-chart__pane-header-action" onClick={onSettings} aria-label={`Paramètres ${label}`}>
                    <SettingsIcon size={13} />
                  </button>
                )}
                <button type="button" className="lq-chart__pane-header-action" onClick={onDelete} aria-label={`Supprimer ${label}`}>
                  <TrashIcon size={13} />
                </button>
              </span>
            </div>
          );
          return (
            <Modal
              open
              onClose={() => setIndicatorsManagerOpen(false)}
              title="Dessins et indicateurs"
              footer={
                hasAnything ? (
                  <div className="lq-chart__edit-drawing-footer">
                    <button type="button" className="lq-chart__reset-button" onClick={() => setConfirmDeleteAllOpen(true)}>
                      Tout supprimer
                    </button>
                  </div>
                ) : null
              }
            >
              <div className="lq-chart__indicators-manager">
                {!hasAnything ? (
                  <p className="lq-chart__indicator-picker-empty">Rien à gérer pour l'instant — aucun dessin ni indicateur actif.</p>
                ) : (
                  <>
                    {visibleDrawings.length > 0 && (
                      <div className="lq-chart__indicator-picker-group">
                        <div className="lq-chart__indicator-picker-group-label">Dessins</div>
                        {visibleDrawings.map((dr) => {
                          const ToolIcon = drawingToolMeta(dr).icon;
                          return row(
                            drawingLabel(dr),
                            <ToolIcon size={13} />,
                            drawingToolMeta(dr).label,
                            () => {
                              setEditingId(dr.id);
                              setDraft(dr);
                              setEditModalTab("coords");
                            },
                            () => commitDrawings(drawings.filter((d) => d.id !== dr.id)),
                            dr.id
                          );
                        })}
                      </div>
                    )}
                    {overlay.length > 0 && (
                      <div className="lq-chart__indicator-picker-group">
                        <div className="lq-chart__indicator-picker-group-label">Superposés au prix</div>
                        {overlay.map((ind) =>
                          row(
                            indicatorLabel(ind),
                            <OverlayBadgeIcon size={13} />,
                            "Superposé au prix",
                            () => openIndicatorSettings(ind.id),
                            () => removeIndicator(ind.id),
                            ind.id
                          )
                        )}
                      </div>
                    )}
                    {(own.length > 0 || volumeVisible) && (
                      <div className="lq-chart__indicator-picker-group">
                        <div className="lq-chart__indicator-picker-group-label">En sous-panneau</div>
                        {volumeVisible &&
                          row("Volume", <PaneBadgeIcon size={13} />, "Panneau séparé", () => setVolumeSettingsOpen(true), () => setVolumePaneState("hidden"), "volume")}
                        {own.map((ind) =>
                          row(
                            indicatorLabel(ind),
                            <PaneBadgeIcon size={13} />,
                            "Panneau séparé",
                            () => openIndicatorSettings(ind.id),
                            () => removeIndicator(ind.id),
                            ind.id
                          )
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </Modal>
          );
        })()}

      {confirmDeleteAllOpen && (
        <Modal
          open
          onClose={() => setConfirmDeleteAllOpen(false)}
          title="Tout supprimer ?"
          footer={
            <div className="lq-chart__edit-drawing-footer">
              <button type="button" className="lq-chart__reset-button" onClick={() => setConfirmDeleteAllOpen(false)}>
                Annuler
              </button>
              <button type="button" className="lq-chart__confirm-button" onClick={handleDeleteAll}>
                Tout supprimer
              </button>
            </div>
          }
        >
          <p className="lq-chart__indicators-manager-confirm-text">
            Tous les dessins et indicateurs actifs sur ce graphique seront supprimés. Cette action est irréversible.
          </p>
        </Modal>
      )}

      {/* Repère dans l'arbre du graphique (la fenêtre, elle, est rendue ailleurs) : les couleurs du thème s'y lisent. */}
      <span ref={themeAnchorRef} style={{ display: "contents" }} aria-hidden="true" />

      {(() => {
        // Les paramètres d'un panneau (Volume, RSI, MACD, script…) : un onglet par série, la principale d'abord puis
        // chaque indicateur posé dessus. Un indicateur tracé sur les prix garde sa fenêtre à lui (Entrées / Style).
        const draft = editingIndicatorId && indicatorDraft ? indicatorDraft : null;
        const paneId = draft ? settingsPaneOf(draft) : volumeSettingsOpen ? VOLUME_PANE_ID : priceSettingsOpen ? PRICE_PANE_ID : null;
        if (draft && paneId === null) return renderIndicatorModal(draft);
        if (paneId === null) return null;
        return renderPaneModal(paneId, draft);
      })()}
    </>
  );

  /** Le panneau où un indicateur se règle : celui sur lequel il est posé, le sien (panneau séparé), ou aucun (prix). */
  function settingsPaneOf(ind: Indicator): string | null {
    if (ind.sourceId) return ind.sourceId;
    // Sur les prix : sa fenêtre à lui (Entrées / Style), sauf depuis les paramètres du graphique, où il a son onglet.
    if (indicatorCatalogEntry(ind).pane === "price") return priceSettingsOpen ? PRICE_PANE_ID : null;
    return ind.id;
  }

  /** Tous les indicateurs, scripts compris, la version en cours de réglage à la place de l'enregistrée. */
  function everyIndicatorWith(draft: Indicator | null): Indicator[] {
    const all = candleRuleIndicators.length > 0 ? candleRuleIndicators : [...indicators, ...ownPaneIndicators];
    return draft ? all.map((i) => (i.id === draft.id ? draft : i)) : all;
  }

  /** Ce qui sert à régler un indicateur, partagé par sa fenêtre et par son onglet dans les paramètres du panneau. */
  function indicatorEditing(draft: Indicator) {
    // A script-produced pane's own parameters, read straight off the script that owns it — the same list the
    // editor's own panel shows, backed by the same `ScriptDef.paramValues`, so editing here or there is the same edit.
    const scriptId = scriptIdFromIndicatorId(draft.customData?.id);
    const script = scriptId === null ? undefined : scripts.find((s) => s.id === scriptId);
    const params = script ? analyzeScriptVariables(script.runDraftCode ?? script.code).params : [];
    const paramsDiffer = !!script && params.some((p) => script.paramValues?.[p.name] !== undefined && JSON.stringify(script.paramValues[p.name]) !== JSON.stringify(p.defaultValue));
    const canReset = paramsDiffer || differsFromDefaults(draft);
    const resetAll = () => {
      setIndicatorDraft(indicatorDefaults(draft));
      if (script) for (const p of params) if (script.paramValues?.[p.name] !== undefined) setScriptParamValue(script.id, p.name, p.defaultValue);
    };
    const kindLabel = draft.customData ? (script ? "Indicateur scripté" : "Indicateur personnalisé") : (INDICATOR_CATALOG.find((entry) => entry.kind === draft.kind)?.label ?? draft.kind);
    const scriptParams =
      script && params.length > 0 ? (
        <SettingsSection title="Paramètres du script">
          <div className="lq-ind-settings__script-params">
            <ScriptParamsFields params={params} values={script.paramValues} onChange={(name, value) => setScriptParamValue(script.id, name, value)} />
          </div>
        </SettingsSection>
      ) : undefined;
    const helpButton = draft.customData ? undefined : <IndicatorHelpButton kind={draft.kind} className="lq-modal__close-icon" />;
    // « Modèles » : ceux de ce type, à appliquer (ses réglages, sur les valeurs par défaut), enregistrer ou supprimer ;
    // « Rétablir les valeurs par défaut » y est aussi.
    const templateKind = indicatorSettingsKey(draft);
    const templatesMenu = saveIndicatorTemplate ? (
      <IndicatorTemplatesMenu
        kindLabel={draft.customData ? draft.customData.label : kindLabel}
        templates={indicatorTemplates.filter((t) => t.kind === templateKind)}
        onApply={(t) => setIndicatorDraft(withIndicatorSettings(draft, indicatorDefaults(draft), t.settings))}
        onSave={(name) => saveIndicatorTemplate(name, draft)}
        onDelete={(id) => deleteIndicatorTemplate?.(id)}
        canReset={canReset}
        onReset={resetAll}
      />
    ) : (
      <button type="button" className="lq-ind-settings__link" onClick={resetAll} disabled={!canReset}>
        Réinitialiser les valeurs par défaut
      </button>
    );
    return { canReset, resetAll, kindLabel, scriptParams, everyIndicator: everyIndicatorWith(draft), helpButton, templatesMenu };
  }

  function renderIndicatorModal(draft: Indicator) {
    const { kindLabel, scriptParams, everyIndicator, helpButton, templatesMenu } = indicatorEditing(draft);
    // « MACD(12,26,9) » n'a pas besoin du sous-titre « MACD » : le nom dit déjà le type.
    const subtitle = indicatorLabel(draft).startsWith(kindLabel) ? "Paramètres de l'indicateur" : kindLabel;
    return (
      <Modal
        open
        onClose={closeIndicatorSettings}
        className="lq-ind-settings-modal"
        title={
          <span className="lq-ind-settings__heading">
            <span className="lq-ind-settings__heading-name">{indicatorLabel(draft)}</span>
            <span className="lq-ind-settings__heading-kind">{subtitle}</span>
          </span>
        }
        closeLabel="Fermer les paramètres"
        headerActions={helpButton}
        // Pas de bouton « Enregistrer » : chaque réglage s'applique et s'enregistre aussitôt (voir usePaneLayout).
        footer={
          <div className="lq-ind-settings__footer">
            {templatesMenu}
            <button type="button" className="lq-ind-settings__button" onClick={closeIndicatorSettings}>
              Fermer
            </button>
          </div>
        }
      >
        <Tabs
          items={[
            { id: "inputs", label: "Entrées" },
            { id: "style", label: "Style" },
          ]}
          value={settingsTab}
          onChange={(id) => setSettingsTab(id as "inputs" | "style")}
          className="lq-ind-settings__tabs"
        />

        {settingsTab === "inputs" && <IndicatorSettingsInputs indicatorDraft={draft} setIndicatorDraft={setIndicatorDraft} indicators={everyIndicator} leading={scriptParams} />}

        {settingsTab === "style" && (
          <IndicatorSettingsStyle
            indicatorDraft={draft}
            setIndicatorDraft={setIndicatorDraft}
            indicators={everyIndicator}
            showAreaFills={showAreaFills}
            onChangeOwnerRules={updateIndicatorStyleRules}
            onOpenIndicator={openIndicatorSettings}
          />
        )}
      </Modal>
    );
  }

  /** Les paramètres d'un panneau, en onglets : la série principale (le volume, ou l'indicateur du panneau), puis chaque
   *  indicateur posé dessus, sous le nom de sa légende. Chaque onglet a ses rubriques « Paramètres » et « Style » ;
   *  chaque réglage s'applique et s'enregistre aussitôt. Changer d'onglet, c'est régler une autre série du panneau. */
  function renderPaneModal(paneId: string, draft: Indicator | null) {
    const all = everyIndicatorWith(draft);
    const isVolume = paneId === VOLUME_PANE_ID;
    // Les prix : le symbole d'abord, puis chaque indicateur tracé sur les prix (moyennes, bandes, scripts superposés).
    const isPrice = paneId === PRICE_PANE_ID;
    const host = isVolume || isPrice ? undefined : all.find((i) => i.id === paneId);
    const attached = isPrice ? all.filter((i) => !i.sourceId && indicatorCatalogEntry(i).pane === "price") : all.filter((i) => i.sourceId === paneId);
    const symbolLabel = symbol?.trim() || "Prix";
    const mainTab = isVolume
      ? { id: VOLUME_PANE_ID, label: "Volume" }
      : isPrice
        ? { id: PRICE_PANE_ID, label: symbolLabel }
        : { id: paneId, label: host ? indicatorLabel(host) : "Panneau" };
    const tabs = [mainTab, ...attached.map((i) => ({ id: i.id, label: indicatorLabel(i) }))];
    const activeTab = draft ? draft.id : mainTab.id;
    const close = () => {
      closeIndicatorSettings();
      setVolumeSettingsOpen(false);
      setPriceSettingsOpen(false);
    };
    // La fenêtre tient par son drapeau (volume, prix) d'un onglet à l'autre : le retour à l'onglet principal la retrouve.
    const keepOpen = () => {
      if (isVolume) setVolumeSettingsOpen(true);
      if (isPrice) setPriceSettingsOpen(true);
    };
    const selectTab = (id: string) => {
      if (id === activeTab) return;
      keepOpen();
      if (id === VOLUME_PANE_ID || id === PRICE_PANE_ID) {
        closeIndicatorSettings();
        return;
      }
      openIndicatorSettings(id);
    };
    const editing = draft ? indicatorEditing(draft) : null;
    const removable = draft && (draft.sourceId || isPrice) ? draft : null;
    const symbolProps: ChartSymbolSettingsProps = {
      theme: volumeTheme,
      chartDisplayMode,
      setChartDisplayMode,
      onChartDisplayModeChange,
      closePulseVisible,
      setClosePulseVisible,
      upColorOverride,
      setUpColorOverride,
      downColorOverride,
      setDownColorOverride,
      candleColorRules,
      setCandleColorRules,
      showCandleColorRules,
      candleRuleIndicators: all,
      chartStyle,
      setChartStyle,
    };

    return (
      <Modal
        open
        onClose={close}
        className="lq-ind-settings-modal lq-pane-settings-modal"
        title={
          <span className="lq-ind-settings__heading">
            <span className="lq-ind-settings__heading-name">{mainTab.label}</span>
            <span className="lq-ind-settings__heading-kind">{isPrice ? "Paramètres du graphique" : "Paramètres du panneau"}</span>
          </span>
        }
        closeLabel={isPrice ? "Fermer les paramètres du graphique" : "Fermer les paramètres du panneau"}
        headerActions={editing?.helpButton}
        footer={
          <div className="lq-ind-settings__footer">
            {editing ? (
              <span className="lq-pane-settings__footer-links">
                {editing.templatesMenu}
                {removable && (
                  <button
                    type="button"
                    className="lq-ind-settings__link"
                    onClick={() => {
                      removeIndicator(removable.id);
                      selectTab(mainTab.id);
                    }}
                  >
                    {isPrice ? "Retirer du graphique" : "Retirer du panneau"}
                  </button>
                )}
              </span>
            ) : isPrice ? (
              <button type="button" className="lq-ind-settings__link" disabled={!hasCandleColorOverrides(symbolProps)} onClick={() => resetCandleColors(symbolProps)}>
                Revenir aux couleurs du thème
              </button>
            ) : (
              <button
                type="button"
                className="lq-ind-settings__link"
                disabled={!volumeUpColorOverride && !volumeDownColorOverride}
                onClick={() => {
                  setVolumeUpColorOverride(undefined);
                  setVolumeDownColorOverride(undefined);
                }}
              >
                Réinitialiser aux couleurs des bougies
              </button>
            )}
            <button type="button" className="lq-ind-settings__button" onClick={close}>
              Fermer
            </button>
          </div>
        }
      >
        <Tabs items={tabs} value={activeTab} onChange={selectTab} className="lq-ind-settings__tabs lq-pane-settings__tabs" />
        {draft && editing ? (
          <>
            {/* La série principale d'un panneau du bas : sur le graphique des prix ou dans son panneau. */}
            {showPaneOverlay && !isPrice && draft.id === mainTab.id && !draft.sourceId && indicatorDockOf(draft) === "bottom" && (
              <PriceOverlayToggle
                checked={isPriceOverlay(draft)}
                onChange={(on) => setIndicatorDraft({ ...draft, priceOverlay: on })}
                hint="Sa propre échelle, cachée : ses unités ne sont pas celles du cours. Son panneau disparaît ; les indicateurs posés dessus le suivent."
              />
            )}
            <div className="lq-pane-settings__group">
              <h3 className="lq-pane-settings__group-title">Paramètres</h3>
              <IndicatorSettingsInputs
                indicatorDraft={draft}
                setIndicatorDraft={setIndicatorDraft}
                indicators={editing.everyIndicator}
                leading={editing.scriptParams}
                emptyText="Pas de paramètre de calcul."
              />
            </div>
            <div className="lq-pane-settings__group">
              <h3 className="lq-pane-settings__group-title">Style</h3>
              <IndicatorSettingsStyle
                indicatorDraft={draft}
                setIndicatorDraft={setIndicatorDraft}
                indicators={editing.everyIndicator}
                showAreaFills={showAreaFills}
                onChangeOwnerRules={updateIndicatorStyleRules}
                onOpenIndicator={openIndicatorSettings}
              />
            </div>
          </>
        ) : isPrice ? (
          <>
            <div className="lq-pane-settings__group">
              <h3 className="lq-pane-settings__group-title">Paramètres</h3>
              <ChartSymbolSettings {...symbolProps} part="params" />
            </div>
            <div className="lq-pane-settings__group">
              <h3 className="lq-pane-settings__group-title">Style</h3>
              <ChartSymbolSettings {...symbolProps} part="style" />
              {/* Les règles des indicateurs qui citent le cours (« SMA(20) au-dessus du cours »). */}
              {updateIndicatorStyleRules && (
                <div className="lq-ind-settings">
                  <LinkedStyleRulesSection target={{ kind: "close" }} indicators={all} onChangeOwnerRules={updateIndicatorStyleRules} onOpenIndicator={openIndicatorSettings} />
                </div>
              )}
            </div>
          </>
        ) : (
          <VolumePaneSettings
            overlay={volumeOverlay}
            setOverlay={showPaneOverlay || volumeOverlay ? setVolumeOverlay : undefined}
            theme={volumeTheme}
            upColorOverride={upColorOverride}
            downColorOverride={downColorOverride}
            volumeUpColorOverride={volumeUpColorOverride}
            setVolumeUpColorOverride={setVolumeUpColorOverride}
            volumeDownColorOverride={volumeDownColorOverride}
            setVolumeDownColorOverride={setVolumeDownColorOverride}
            linkedRules={
              updateIndicatorStyleRules && (
                <LinkedStyleRulesSection target={{ kind: "volume" }} indicators={all} onChangeOwnerRules={updateIndicatorStyleRules} onOpenIndicator={openIndicatorSettings} />
              )
            }
          />
        )}
      </Modal>
    );
  }
}
