import type { IndicatorInfoTarget } from "../interfaces/IndicatorInfoTarget.interface";
import { isScriptInfoTarget } from "../interfaces/IndicatorInfoTarget.interface";
import { analyzeScriptDescription } from "../scripting/scriptDescription";
import { ScriptDescriptionText } from "../scripting/components/ScriptDescriptionText";
import { analyzeScriptVariables } from "../scripting/scriptVariables";
import { scriptIdFromIndicatorId } from "../scripting/scriptOutputToCustomIndicatorDef";
import { ScriptParamsFields } from "../scripting/components/ScriptParamsFields";
import type { ScriptParamValue } from "../interfaces/ScriptParam.interface";
import { useEffect, useState } from "react";
import { Modal } from "../../../primitives/Modal";
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
import { INDICATOR_DIAGRAMS } from "../diagrams/indicatorDiagramRegistry";
import { drawingToolMeta, drawingLabel } from "../drawingCatalog";
import { IndicatorSettingsInputs, IndicatorSettingsStyle } from "./IndicatorSettingsFields";
import { IndicatorPickerModal } from "./IndicatorPickerModal";

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
  addCustomIndicator: (def: CustomIndicatorDef) => void;
  /** The chart's own saved scripts (see useScriptingState) — shown in the picker under "Mes
   *  scripts" alongside the built-in catalog and any custom indicators, so a script doesn't only
   *  exist inside the script editor's own tab strip. Unlike a built-in/custom row, a script is
   *  already a unique, persistent thing (never "added" more than once) — clicking its row toggles
   *  it enabled/disabled instead of creating a new indicator instance. */
  scripts: ScriptDef[];
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
    codeTarget: IndicatorKind | { scriptId: string } | null;
    setCodeTarget: (target: IndicatorKind | { scriptId: string } | null) => void;
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
  editingIndicatorId: string | null;
  indicatorDraft: Indicator | null;
  setIndicatorDraft: (d: Indicator) => void;
  closeIndicatorSettings: () => void;
  deleteEditingIndicator: () => void;
  saveIndicatorSettings: () => void;
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
  addCustomIndicator,
  scripts,
  setScriptParamValue,
  toggleScriptEnabled,
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
  editingIndicatorId,
  indicatorDraft,
  setIndicatorDraft,
  closeIndicatorSettings,
  deleteEditingIndicator,
  saveIndicatorSettings,
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
        addCustomIndicator={addCustomIndicator}
        scripts={scripts}
        toggleScriptEnabled={toggleScriptEnabled}
        openCorrelationSetup={openCorrelationSetup}
        favoriteIndicatorIds={favoriteIndicatorIds}
        toggleFavoriteIndicator={toggleFavoriteIndicator}
        onDeleteScript={onDeleteScript}
        onCreateStrategyFromIndicator={onCreateStrategyFromIndicator}
        onDuplicate={setDuplicatePrompt}
        onRequestDeleteScript={setScriptToDelete}
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
          // "volume" has no diagram of its own — same reasoning it has no INDICATOR_DIAGRAMS
          // entry as a plain number/IndicatorKind lookup: it isn't one.
          const Diagram = infoKind === "volume" ? undefined : INDICATOR_DIAGRAMS[infoKind];
          return (
            <Modal open onClose={() => setInfoKind(null)} title={title}>
              {Diagram && <Diagram />}
              <p className="lq-chart__indicator-info-text">{description}</p>
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
          const isScript = typeof codeTarget === "object";
          const script = isScript ? scripts.find((entry) => entry.id === codeTarget.scriptId) : undefined;
          const label = isScript
            ? (script?.name ?? "Script")
            : (INDICATOR_CATALOG.find((entry) => entry.kind === codeTarget)?.label ?? codeTarget);
          const code = isScript ? (script?.runDraftCode ?? script?.code ?? "") : (INDICATOR_SCRIPT_SOURCES[codeTarget] ?? "");
          const openInEditor = isScript
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
                      {isScript ? "Modifier ce script" : "Ouvrir dans l'éditeur"}
                    </button>
                  </div>
                ) : undefined
              }
            >
              <p className="lq-chart__indicator-info-text">
                {isScript
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

      {editingIndicatorId && indicatorDraft && (
        <Modal
          open
          onClose={closeIndicatorSettings}
          title={`Paramètres — ${indicatorLabel(indicatorDraft)}`}
          footer={
            <div className="lq-chart__edit-drawing-footer">
              <button type="button" className="lq-chart__reset-button" onClick={deleteEditingIndicator}>
                Supprimer
              </button>
              <button type="button" className="lq-chart__confirm-button" onClick={saveIndicatorSettings}>
                Enregistrer
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
            className="lq-chart__edit-drawing-tabs"
          />

          {settingsTab === "inputs" && (
            <>
              {(() => {
                // A script-produced pane's own parameters, read straight off the script that owns
                // it — the same list the editor's own panel shows, backed by the same
                // `ScriptDef.paramValues`, so editing here or there is the same edit.
                const scriptId = scriptIdFromIndicatorId(indicatorDraft.customData?.id);
                const script = scriptId === null ? undefined : scripts.find((s) => s.id === scriptId);
                if (!script) return null;
                const { params } = analyzeScriptVariables(script.runDraftCode ?? script.code);
                if (params.length === 0) return null;
                return (
                  <section className="lq-chart__script-params">
                    <h4 className="lq-chart__script-params-title">Paramètres du script</h4>
                    <ScriptParamsFields
                      params={params}
                      values={script.paramValues}
                      onChange={(name, value) => setScriptParamValue(script.id, name, value)}
                    />
                  </section>
                );
              })()}
              <IndicatorSettingsInputs indicatorDraft={indicatorDraft} setIndicatorDraft={setIndicatorDraft} indicators={indicators} />
            </>
          )}

          {settingsTab === "style" && (
            <IndicatorSettingsStyle indicatorDraft={indicatorDraft} setIndicatorDraft={setIndicatorDraft} indicators={indicators} />
          )}
        </Modal>
      )}
    </>
  );
}
