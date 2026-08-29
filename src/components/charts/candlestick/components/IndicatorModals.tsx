import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Modal } from "../../../primitives/Modal";
import { Tabs } from "../../../primitives/Tabs";
import { TextField } from "../../../forms/TextField";
import { SearchIcon, SettingsIcon, TrashIcon, InfoIcon, OverlayBadgeIcon, PaneBadgeIcon } from "../../../icons";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorKind } from "../interfaces/IndicatorKind.interface";
import type { CustomIndicatorDef } from "../interfaces/CustomIndicatorDef.interface";
import type { ScriptDef } from "../interfaces/ScriptDef.interface";
import { INDICATOR_CATALOG, type IndicatorCatalogEntry, indicatorCatalogEntry, indicatorLabel } from "../indicatorCatalog";
import { INDICATOR_DESCRIPTIONS, VOLUME_DESCRIPTION } from "../indicatorDescriptions";
import { INDICATOR_DIAGRAMS } from "../diagrams/indicatorDiagramRegistry";
import { drawingToolMeta, drawingLabel } from "../drawingCatalog";
import { IndicatorSettingsInputs, IndicatorSettingsStyle } from "./IndicatorSettingsFields";

export interface IndicatorModalsProps {
  indicatorPickerOpen: boolean;
  setIndicatorPickerOpen: (open: boolean) => void;
  /** Which indicator's "how it works" info modal is open, if any — "volume" since it isn't a
   *  real IndicatorKind (see VOLUME_DESCRIPTION's own doc). Lifted up to CandlestickChart itself
   *  (not local state here) since the info icon that opens it now lives in three places: the
   *  picker below, ChartLegend's own indicator rows, and PaneHeaders' own own-pane rows. */
  infoKind: IndicatorKind | "volume" | null;
  setInfoKind: (kind: IndicatorKind | "volume" | null) => void;
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
  toggleScriptEnabled: (id: string) => void;
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

/** The three indicator-related modals: "Ajouter un indicateur" (search + catalog, plus a Volume
 *  entry since it's just as valid an "add a pane" choice), "Dessins et indicateurs" (a flat
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
  toggleScriptEnabled,
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
  // A second, independent filter alongside the search box — `null` ("Toutes") shows every
  // category. Local state (unlike `indicatorSearchQuery`, lifted to the caller): nothing outside
  // this modal ever needs to read or reset it.
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  // Which tab the settings modal shows — same "nothing outside this modal needs it" reasoning as
  // categoryFilter above. Reset to "inputs" whenever a *different* indicator's settings open (not
  // on every render — editingIndicatorId only actually changes when the user picks a new one),
  // so switching from one indicator to the next doesn't leave it stranded on a "Style" tab the
  // next indicator happens to render differently.
  const [settingsTab, setSettingsTab] = useState<"inputs" | "style">("inputs");
  useEffect(() => {
    setSettingsTab("inputs");
  }, [editingIndicatorId]);
  // The picker's own scroll position, restored across a close/reopen cycle instead of resetting
  // to the top every time — a plain ref (not state) since nothing about it should ever trigger a
  // re-render, and it needs to survive the picker's own unmount (Modal returns null while closed,
  // dropping any DOM-held scroll position with it) the same way a ref already does for every
  // other "remember this across remounts" case in this codebase.
  const pickerScrollRef = useRef<HTMLDivElement>(null);
  const pickerScrollTopRef = useRef(0);
  // useLayoutEffect (not useEffect) so the restored position is already in place at first paint
  // — plain useEffect runs after the browser paints, which would show the list back at the top
  // for one frame before jumping to the remembered position.
  useLayoutEffect(() => {
    if (indicatorPickerOpen && pickerScrollRef.current) pickerScrollRef.current.scrollTop = pickerScrollTopRef.current;
  }, [indicatorPickerOpen]);

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
      {indicatorPickerOpen && (
        <Modal open onClose={() => setIndicatorPickerOpen(false)} title="Ajouter un indicateur" size="wide">
          {/* Left/right split (see .lq-chart__modal-split's own doc) — search + category filters
              on the left, the catalog itself on the right, each scrolling on its own. */}
          <div className="lq-chart__modal-split">
            <div className="lq-chart__modal-split-sidebar">
              <TextField
                placeholder="Rechercher un indicateur…"
                value={indicatorSearchQuery}
                onChange={(e) => setIndicatorSearchQuery(e.target.value)}
                leadingIcon={<SearchIcon size={14} />}
                autoFocus
              />
              {/* Predefined, stable filters — every built-in category (in catalog order) plus
                  whichever custom sections the caller's own `customIndicators` bring in, computed
                  from the full catalog regardless of the current search text so the row itself
                  doesn't reshuffle as the user types, only the results below it do. A second click
                  on the already-selected one clears back to "Toutes", same toggle convention the
                  category filter buttons elsewhere in this library already use. */}
              <div className="lq-chart__indicator-category-filters lq-chart__modal-filter-list--vertical">
                <button
                  type="button"
                  className={["lq-chart__indicator-category-filter", categoryFilter === null && "lq-chart__indicator-category-filter--selected"]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setCategoryFilter(null)}
                >
                  Toutes
                </button>
                {Array.from(
                  new Set([
                    ...INDICATOR_CATALOG.map((entry) => entry.category),
                    ...(customIndicators ?? []).map((def) => def.section),
                    ...(scripts.length > 0 ? ["Mes scripts"] : []),
                  ])
                ).map(
                  (category) => (
                    <button
                      key={category}
                      type="button"
                      className={[
                        "lq-chart__indicator-category-filter",
                        categoryFilter === category && "lq-chart__indicator-category-filter--selected",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setCategoryFilter((c) => (c === category ? null : category))}
                    >
                      {category}
                    </button>
                  )
                )}
              </div>
            </div>
            <div
              className="lq-chart__modal-split-content lq-chart__indicator-picker"
              ref={pickerScrollRef}
              onScroll={(e) => {
                pickerScrollTopRef.current = e.currentTarget.scrollTop;
              }}
            >
              {(() => {
                const query = indicatorSearchQuery.trim().toLowerCase();
                // Volume has no category of its own (see its own doc below), so it only ever shows
                // up under "Toutes", not under any specific category filter.
                const showVolumeOption = showVolume && categoryFilter === null && "volume".includes(query);
                // Built-in and custom entries merged into one tagged list before grouping, so a
                // custom indicator's own `section` slots it in alongside the built-in categories
                // exactly like any other — each entry keeps a reference to whichever of
                // IndicatorCatalogEntry/CustomIndicatorDef it actually came from, since only that
                // original shape knows what `onClick` needs to add it (addIndicator vs.
                // addCustomIndicator take different argument types).
                // `descriptionKind` is undefined for a custom indicator (no canned description this
                // library could show for one — see INDICATOR_DESCRIPTIONS' own doc) — its row gets
                // no info icon rather than one that opens to nothing.
                type PickerOption = {
                  key: string;
                  label: string;
                  category: string;
                  pane: "price" | "own";
                  onSelect: () => void;
                  descriptionKind?: IndicatorKind;
                  /** Script rows only — whether this script is currently enabled (running), shown
                   *  as a dimmed row when it isn't. `undefined` for every other option kind, which
                   *  never dims (they're always "add a new one", not an on/off toggle). */
                  enabled?: boolean;
                };
                const builtinOptions: PickerOption[] = INDICATOR_CATALOG.filter(
                  (entry) => entry.label.toLowerCase().includes(query) || entry.shortLabel.toLowerCase().includes(query)
                ).map((entry) => ({
                  key: entry.kind,
                  label: entry.label,
                  category: entry.category,
                  pane: entry.pane,
                  onSelect: () => (entry.kind === "correlation" ? openCorrelationSetup() : addIndicator(entry)),
                  descriptionKind: entry.kind,
                }));
                const customOptions: PickerOption[] = (customIndicators ?? [])
                  .filter((def) => def.label.toLowerCase().includes(query) || (def.shortLabel ?? "").toLowerCase().includes(query))
                  .map((def) => ({
                    key: def.id,
                    label: def.label,
                    category: def.section,
                    pane: def.type === "overlay" ? "price" : "own",
                    onSelect: () => addCustomIndicator(def),
                  }));
                const scriptOptions: PickerOption[] = scripts
                  .filter((s) => s.name.toLowerCase().includes(query))
                  .map((s) => ({
                    key: s.id,
                    label: s.name,
                    category: "Mes scripts",
                    pane: "own",
                    onSelect: () => toggleScriptEnabled(s.id),
                    enabled: s.enabled !== false,
                  }));
                const allOptions = [...builtinOptions, ...customOptions, ...scriptOptions].filter(
                  (option) => categoryFilter === null || option.category === categoryFilter
                );
                const groups: { category: string; options: PickerOption[] }[] = [];
                for (const option of allOptions) {
                  const group = groups.find((g) => g.category === option.category);
                  if (group) group.options.push(option);
                  else groups.push({ category: option.category, options: [option] });
                }
                if (!showVolumeOption && groups.length === 0) {
                  return <p className="lq-chart__indicator-picker-empty">Aucun indicateur ne correspond à « {indicatorSearchQuery} ».</p>;
                }
                return (
                  <>
                    {/* Volume isn't part of INDICATOR_CATALOG — it's the caller's own data (not
                        something computed), driven by `showVolume`/the volume pane's own header
                        rather than an `Indicator` entry — but it's still just as valid an "add a
                        pane" choice as RSI/CHOP/MACD, so it gets a slot here too, re-showing the
                        pane if it was previously collapsed or removed. */}
                    {showVolumeOption && (
                      <div className="lq-chart__indicator-picker-group">
                        <div className="lq-chart__indicator-picker-group-label">Volume</div>
                        <div className="lq-chart__indicator-picker-option">
                          <button
                            type="button"
                            className="lq-chart__indicator-picker-select"
                            onClick={() => setVolumePaneState("expanded")}
                          >
                            <span className="lq-chart__indicator-picker-name">Volume</span>
                            <span className="lq-chart__indicators-manager-badge" title="Panneau séparé">
                              <PaneBadgeIcon size={13} />
                            </span>
                          </button>
                          <button
                            type="button"
                            className="lq-chart__pane-header-action"
                            onClick={() => setInfoKind("volume")}
                            aria-label="À propos de Volume"
                          >
                            <InfoIcon size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                    {groups.map((group) => (
                      <div className="lq-chart__indicator-picker-group" key={group.category}>
                        <div className="lq-chart__indicator-picker-group-label">{group.category}</div>
                        {group.options.map((option) => (
                          <div
                            key={option.key}
                            className={["lq-chart__indicator-picker-option", option.enabled === false && "lq-chart__indicator-picker-option--disabled"]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            <button
                              type="button"
                              className="lq-chart__indicator-picker-select"
                              onClick={option.onSelect}
                              title={option.enabled === undefined ? undefined : option.enabled ? "Désactiver ce script" : "Activer ce script"}
                            >
                              <span className="lq-chart__indicator-picker-name">{option.label}</span>
                              <span
                                className="lq-chart__indicators-manager-badge"
                                title={option.pane === "price" ? "Superposé au prix" : "Panneau séparé"}
                              >
                                {option.pane === "price" ? <OverlayBadgeIcon size={13} /> : <PaneBadgeIcon size={13} />}
                              </span>
                            </button>
                            {option.descriptionKind && (
                              <button
                                type="button"
                                className="lq-chart__pane-header-action"
                                onClick={() => setInfoKind(option.descriptionKind!)}
                                aria-label={`À propos de ${option.label}`}
                              >
                                <InfoIcon size={13} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>
        </Modal>
      )}

      {infoKind &&
        (() => {
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
            <IndicatorSettingsInputs indicatorDraft={indicatorDraft} setIndicatorDraft={setIndicatorDraft} indicators={indicators} />
          )}

          {settingsTab === "style" && (
            <IndicatorSettingsStyle indicatorDraft={indicatorDraft} setIndicatorDraft={setIndicatorDraft} indicators={indicators} />
          )}
        </Modal>
      )}
    </>
  );
}
