import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Modal } from "../../../primitives/Modal";
import { Tabs } from "../../../primitives/Tabs";
import { Checkbox } from "../../../forms/Checkbox";
import { TextField } from "../../../forms/TextField";
import { NumberField } from "../../../forms/NumberField";
import { Select } from "../../../forms/Select";
import { SearchIcon, SettingsIcon, TrashIcon, InfoIcon, OverlayBadgeIcon, PaneBadgeIcon } from "../../../icons";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorKind } from "../interfaces/IndicatorKind.interface";
import type { CustomIndicatorDef } from "../interfaces/CustomIndicatorDef.interface";
import { INDICATOR_CATALOG, type IndicatorCatalogEntry, indicatorCatalogEntry, indicatorLabel, defaultIndicatorColor } from "../indicatorCatalog";
import { INDICATOR_DESCRIPTIONS, VOLUME_DESCRIPTION } from "../indicatorDescriptions";
import { drawingToolMeta, drawingLabel } from "../drawingCatalog";

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
        <Modal open onClose={() => setIndicatorPickerOpen(false)} title="Ajouter un indicateur">
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
              doesn't reshuffle as the user types, only the results below it do. A second click on
              the already-selected one clears back to "Toutes", same toggle convention the
              category filter buttons elsewhere in this library already use. */}
          <div className="lq-chart__indicator-category-filters">
            <button
              type="button"
              className={["lq-chart__indicator-category-filter", categoryFilter === null && "lq-chart__indicator-category-filter--selected"]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setCategoryFilter(null)}
            >
              Toutes
            </button>
            {Array.from(new Set([...INDICATOR_CATALOG.map((entry) => entry.category), ...(customIndicators ?? []).map((def) => def.section)])).map(
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
          <div
            className="lq-chart__indicator-picker"
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
              const allOptions = [...builtinOptions, ...customOptions].filter(
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
                        <div key={option.key} className="lq-chart__indicator-picker-option">
                          <button type="button" className="lq-chart__indicator-picker-select" onClick={option.onSelect}>
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
        </Modal>
      )}

      {infoKind &&
        (() => {
          const title = infoKind === "volume" ? "Volume" : (INDICATOR_CATALOG.find((entry) => entry.kind === infoKind)?.label ?? infoKind);
          const description = infoKind === "volume" ? VOLUME_DESCRIPTION : INDICATOR_DESCRIPTIONS[infoKind];
          return (
            <Modal open onClose={() => setInfoKind(null)} title={title}>
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
            <>
              {indicatorCatalogEntry(indicatorDraft).hasPeriod && (
                <NumberField
                  label="Période"
                  min={1}
                  max={500}
                  step={1}
                  value={indicatorDraft.period}
                  onChange={(v) => setIndicatorDraft({ ...indicatorDraft, period: v === "" ? indicatorDraft.period : v })}
                />
              )}
              {indicatorCatalogEntry(indicatorDraft).hasStdDev && (
                <NumberField
                  label="Écart-type (bandes)"
                  min={0.5}
                  max={5}
                  step={0.1}
                  value={indicatorDraft.stdDev ?? 2}
                  onChange={(v) => setIndicatorDraft({ ...indicatorDraft, stdDev: v === "" ? indicatorDraft.stdDev : v })}
                />
              )}
              {indicatorDraft.kind === "macd" && (
                <div className="lq-chart__edit-drawing-row">
                  <NumberField
                    label="Rapide"
                    min={1}
                    max={200}
                    step={1}
                    value={indicatorDraft.fastPeriod ?? 12}
                    onChange={(v) => setIndicatorDraft({ ...indicatorDraft, fastPeriod: v === "" ? indicatorDraft.fastPeriod : v })}
                  />
                  <NumberField
                    label="Lent"
                    min={1}
                    max={400}
                    step={1}
                    value={indicatorDraft.slowPeriod ?? 26}
                    onChange={(v) => setIndicatorDraft({ ...indicatorDraft, slowPeriod: v === "" ? indicatorDraft.slowPeriod : v })}
                  />
                  <NumberField
                    label="Signal"
                    min={1}
                    max={200}
                    step={1}
                    value={indicatorDraft.signalPeriod ?? 9}
                    onChange={(v) => setIndicatorDraft({ ...indicatorDraft, signalPeriod: v === "" ? indicatorDraft.signalPeriod : v })}
                  />
                </div>
              )}
              {indicatorDraft.kind === "zigzag" && (
                <NumberField
                  label="Déviation (%)"
                  min={0.5}
                  max={50}
                  step={0.5}
                  value={indicatorDraft.zigzagDeviation ?? 5}
                  onChange={(v) => setIndicatorDraft({ ...indicatorDraft, zigzagDeviation: v === "" ? indicatorDraft.zigzagDeviation : v })}
                />
              )}
              {indicatorDraft.kind === "supertrend" && (
                <NumberField
                  label="Multiplicateur (× ATR)"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={indicatorDraft.supertrendMultiplier ?? 3}
                  onChange={(v) => setIndicatorDraft({ ...indicatorDraft, supertrendMultiplier: v === "" ? indicatorDraft.supertrendMultiplier : v })}
                />
              )}
              {indicatorDraft.kind === "chandelierExit" && (
                <>
                  <NumberField
                    label="Multiplicateur ATR"
                    min={0.5}
                    max={10}
                    step={0.1}
                    value={indicatorDraft.chandelierMultiplier ?? 3}
                    onChange={(v) => setIndicatorDraft({ ...indicatorDraft, chandelierMultiplier: v === "" ? indicatorDraft.chandelierMultiplier : v })}
                  />
                  <Checkbox
                    label="Utiliser le prix de clôture pour les extrêmes"
                    checked={indicatorDraft.chandelierUseClose ?? true}
                    onChange={(checked) => setIndicatorDraft({ ...indicatorDraft, chandelierUseClose: checked })}
                  />
                </>
              )}
              {indicatorDraft.kind === "parabolicSar" && (
                <div className="lq-chart__edit-drawing-row">
                  <NumberField
                    label="Pas"
                    min={0.01}
                    max={1}
                    step={0.01}
                    value={indicatorDraft.sarStep ?? 0.02}
                    onChange={(v) => setIndicatorDraft({ ...indicatorDraft, sarStep: v === "" ? indicatorDraft.sarStep : v })}
                  />
                  <NumberField
                    label="Max"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={indicatorDraft.sarMax ?? 0.2}
                    onChange={(v) => setIndicatorDraft({ ...indicatorDraft, sarMax: v === "" ? indicatorDraft.sarMax : v })}
                  />
                </div>
              )}
              {indicatorDraft.kind === "gaps" && (
                <NumberField
                  label="Écart minimum (%)"
                  min={0}
                  max={20}
                  step={0.1}
                  value={indicatorDraft.gapsMinPercent ?? 0.1}
                  onChange={(v) => setIndicatorDraft({ ...indicatorDraft, gapsMinPercent: v === "" ? indicatorDraft.gapsMinPercent : v })}
                />
              )}
              {indicatorDraft.kind === "pivotPoints" && (
                <div className="lq-chart__edit-drawing-row">
                  <Select
                    label="Type"
                    value={indicatorDraft.pivotType ?? "classic"}
                    onChange={(v) => setIndicatorDraft({ ...indicatorDraft, pivotType: v })}
                    options={[
                      { value: "classic", label: "Classic" },
                      { value: "fibonacci", label: "Fibonacci" },
                      { value: "woodie", label: "Woodie" },
                      { value: "camarilla", label: "Camarilla" },
                    ]}
                  />
                  <Select
                    label="Période de référence"
                    value={indicatorDraft.pivotPeriod ?? "weekly"}
                    onChange={(v) => setIndicatorDraft({ ...indicatorDraft, pivotPeriod: v })}
                    options={[
                      { value: "daily", label: "Journalière" },
                      { value: "weekly", label: "Hebdomadaire" },
                      { value: "monthly", label: "Mensuelle" },
                    ]}
                  />
                </div>
              )}
              {indicatorDraft.kind === "supportResistance" && (
                <NumberField
                  label="Nombre de niveaux"
                  min={1}
                  max={20}
                  step={1}
                  value={indicatorDraft.srMaxLevels ?? 6}
                  onChange={(v) => setIndicatorDraft({ ...indicatorDraft, srMaxLevels: v === "" ? indicatorDraft.srMaxLevels : v })}
                />
              )}
              {indicatorDraft.kind === "ichimoku" && (
                <div className="lq-chart__edit-drawing-row">
                  <NumberField
                    label="Conversion"
                    min={1}
                    max={100}
                    step={1}
                    value={indicatorDraft.ichimokuConversionPeriod ?? 9}
                    onChange={(v) => setIndicatorDraft({ ...indicatorDraft, ichimokuConversionPeriod: v === "" ? indicatorDraft.ichimokuConversionPeriod : v })}
                  />
                  <NumberField
                    label="Base"
                    min={1}
                    max={200}
                    step={1}
                    value={indicatorDraft.ichimokuBasePeriod ?? 26}
                    onChange={(v) => setIndicatorDraft({ ...indicatorDraft, ichimokuBasePeriod: v === "" ? indicatorDraft.ichimokuBasePeriod : v })}
                  />
                  <NumberField
                    label="Span B"
                    min={1}
                    max={300}
                    step={1}
                    value={indicatorDraft.ichimokuSpanPeriod ?? 52}
                    onChange={(v) => setIndicatorDraft({ ...indicatorDraft, ichimokuSpanPeriod: v === "" ? indicatorDraft.ichimokuSpanPeriod : v })}
                  />
                  <NumberField
                    label="Déplacement"
                    min={1}
                    max={200}
                    step={1}
                    value={indicatorDraft.ichimokuDisplacement ?? 26}
                    onChange={(v) => setIndicatorDraft({ ...indicatorDraft, ichimokuDisplacement: v === "" ? indicatorDraft.ichimokuDisplacement : v })}
                  />
                </div>
              )}
              {indicatorDraft.kind === "tpo" && (
                <>
                  <div className="lq-chart__edit-drawing-row">
                    <NumberField
                      label="Taille du bloc (min)"
                      min={1}
                      max={1440}
                      step={5}
                      value={indicatorDraft.tpoBlockMinutes ?? 30}
                      onChange={(v) => setIndicatorDraft({ ...indicatorDraft, tpoBlockMinutes: v === "" ? indicatorDraft.tpoBlockMinutes : v })}
                    />
                    <NumberField
                      label="Lignes de prix"
                      min={5}
                      max={100}
                      step={1}
                      value={indicatorDraft.tpoRowCount ?? 24}
                      onChange={(v) => setIndicatorDraft({ ...indicatorDraft, tpoRowCount: v === "" ? indicatorDraft.tpoRowCount : v })}
                    />
                  </div>
                  <div className="lq-chart__edit-drawing-row">
                    <NumberField
                      label="Zone de valeur (%)"
                      min={1}
                      max={100}
                      step={1}
                      value={indicatorDraft.tpoValueAreaPercent ?? 70}
                      onChange={(v) => setIndicatorDraft({ ...indicatorDraft, tpoValueAreaPercent: v === "" ? indicatorDraft.tpoValueAreaPercent : v })}
                    />
                    <Select
                      label="Étiquettes"
                      value={indicatorDraft.tpoLabelStyle ?? "letters"}
                      onChange={(v) => setIndicatorDraft({ ...indicatorDraft, tpoLabelStyle: v })}
                      options={[
                        { value: "letters", label: "Lettres" },
                        { value: "numbers", label: "Chiffres" },
                      ]}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {settingsTab === "style" && (
            <>
              {indicatorDraft.kind === "macd" && (
                <>
                  <Checkbox
                    label="Afficher l'histogramme"
                    checked={indicatorDraft.macdShowHistogram ?? true}
                    onChange={(checked) => setIndicatorDraft({ ...indicatorDraft, macdShowHistogram: checked })}
                  />
                  {(indicatorDraft.macdShowHistogram ?? true) && (
                    <div className="lq-chart__edit-drawing-row">
                      <div className="lq-field">
                        <label className="lq-field__label">Histogramme (hausse)</label>
                        <input
                          type="color"
                          className="lq-chart__color-input"
                          value={indicatorDraft.macdHistogramUpColor ?? "#26a69a"}
                          onChange={(e) => setIndicatorDraft({ ...indicatorDraft, macdHistogramUpColor: e.target.value })}
                        />
                      </div>
                      <div className="lq-field">
                        <label className="lq-field__label">Histogramme (baisse)</label>
                        <input
                          type="color"
                          className="lq-chart__color-input"
                          value={indicatorDraft.macdHistogramDownColor ?? "#ef5350"}
                          onChange={(e) => setIndicatorDraft({ ...indicatorDraft, macdHistogramDownColor: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
              {indicatorDraft.kind === "zigzag" && (
                <Checkbox
                  label="Afficher les labels HH / HL / LH / LL"
                  checked={indicatorDraft.zigzagShowLabels ?? true}
                  onChange={(checked) => setIndicatorDraft({ ...indicatorDraft, zigzagShowLabels: checked })}
                />
              )}
              {/* Supertrend/Parabolic SAR/Chandelier Exit each color themselves by trend (up/down),
                  not by a single indicator-wide color the way most others do — their own pair of
                  swatches here, defaulting to the chart's own up/down colors so leaving both unset
                  reproduces the exact behavior from before these fields existed. */}
              {indicatorDraft.kind === "supertrend" && (
                <div className="lq-chart__edit-drawing-row">
                  <div className="lq-field">
                    <label className="lq-field__label">Couleur (hausse)</label>
                    <input
                      type="color"
                      className="lq-chart__color-input"
                      value={indicatorDraft.supertrendUpColor ?? "#26a69a"}
                      onChange={(e) => setIndicatorDraft({ ...indicatorDraft, supertrendUpColor: e.target.value })}
                    />
                  </div>
                  <div className="lq-field">
                    <label className="lq-field__label">Couleur (baisse)</label>
                    <input
                      type="color"
                      className="lq-chart__color-input"
                      value={indicatorDraft.supertrendDownColor ?? "#ef5350"}
                      onChange={(e) => setIndicatorDraft({ ...indicatorDraft, supertrendDownColor: e.target.value })}
                    />
                  </div>
                </div>
              )}
              {indicatorDraft.kind === "parabolicSar" && (
                <div className="lq-chart__edit-drawing-row">
                  <div className="lq-field">
                    <label className="lq-field__label">Couleur (hausse)</label>
                    <input
                      type="color"
                      className="lq-chart__color-input"
                      value={indicatorDraft.sarUpColor ?? "#26a69a"}
                      onChange={(e) => setIndicatorDraft({ ...indicatorDraft, sarUpColor: e.target.value })}
                    />
                  </div>
                  <div className="lq-field">
                    <label className="lq-field__label">Couleur (baisse)</label>
                    <input
                      type="color"
                      className="lq-chart__color-input"
                      value={indicatorDraft.sarDownColor ?? "#ef5350"}
                      onChange={(e) => setIndicatorDraft({ ...indicatorDraft, sarDownColor: e.target.value })}
                    />
                  </div>
                </div>
              )}
              {indicatorDraft.kind === "chandelierExit" && (
                <>
                  <Checkbox
                    label="Afficher les labels Achat/Vente"
                    checked={indicatorDraft.chandelierShowLabels ?? true}
                    onChange={(checked) => setIndicatorDraft({ ...indicatorDraft, chandelierShowLabels: checked })}
                  />
                  <Checkbox
                    label="Surligner l'état (remplissage)"
                    checked={indicatorDraft.chandelierHighlightState ?? true}
                    onChange={(checked) => setIndicatorDraft({ ...indicatorDraft, chandelierHighlightState: checked })}
                  />
                  <div className="lq-chart__edit-drawing-row">
                    <div className="lq-field">
                      <label className="lq-field__label">Couleur (hausse)</label>
                      <input
                        type="color"
                        className="lq-chart__color-input"
                        value={indicatorDraft.chandelierUpColor ?? "#26a69a"}
                        onChange={(e) => setIndicatorDraft({ ...indicatorDraft, chandelierUpColor: e.target.value })}
                      />
                    </div>
                    <div className="lq-field">
                      <label className="lq-field__label">Couleur (baisse)</label>
                      <input
                        type="color"
                        className="lq-chart__color-input"
                        value={indicatorDraft.chandelierDownColor ?? "#ef5350"}
                        onChange={(e) => setIndicatorDraft({ ...indicatorDraft, chandelierDownColor: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}
              {indicatorDraft.kind === "pivotPoints" && (
                <Checkbox
                  label="Afficher uniquement le dernier pivot"
                  checked={indicatorDraft.pivotShowLastOnly ?? false}
                  onChange={(checked) => setIndicatorDraft({ ...indicatorDraft, pivotShowLastOnly: checked })}
                />
              )}
              {indicatorDraft.kind === "tpo" && (
                <>
                  <NumberField
                    label="Opacité (%)"
                    min={10}
                    max={100}
                    step={5}
                    value={indicatorDraft.tpoOpacity ?? 100}
                    onChange={(v) => setIndicatorDraft({ ...indicatorDraft, tpoOpacity: v === "" ? indicatorDraft.tpoOpacity : v })}
                  />
                  <Checkbox
                    label="Séparer les blocs"
                    checked={indicatorDraft.tpoSplitByBlocks ?? true}
                    onChange={(checked) => setIndicatorDraft({ ...indicatorDraft, tpoSplitByBlocks: checked })}
                  />
                </>
              )}
              {/* Support/Résistance colors each level by whether the last close currently sits
                  above or below it, and (besides its own "Séparer les blocs" toggle just above)
                  TPO colors its own blocks with a fixed multi-stop gradient — neither reads
                  `color` or has a bespoke swatch of its own, so the Style tab would otherwise be
                  empty for them; says so instead of just leaving a blank panel. */}
              {(indicatorDraft.kind === "supportResistance" || indicatorDraft.kind === "tpo") && (
                <p className="lq-chart__indicator-picker-empty">Cet indicateur utilise ses propres couleurs, non personnalisables pour l'instant.</p>
              )}
              {/* Every other kind: one indicator-wide color. Supertrend/Parabolic SAR/Chandelier
                  Exit/Support-Résistance/TPO are excluded — each already has its own bespoke
                  color UI (or none at all) above instead of a single swatch that couldn't
                  represent a trend flip or a multi-stop gradient anyway. ADX *does* read it (for
                  its own ADX line only — +DI/-DI stay fixed), so it's deliberately not excluded
                  here. */}
              {indicatorDraft.kind !== "supertrend" &&
                indicatorDraft.kind !== "parabolicSar" &&
                indicatorDraft.kind !== "chandelierExit" &&
                indicatorDraft.kind !== "supportResistance" &&
                indicatorDraft.kind !== "tpo" && (
                <div className="lq-field">
                  <label className="lq-field__label">Couleur</label>
                  <input
                    type="color"
                    className="lq-chart__color-input"
                    value={indicatorDraft.color ?? defaultIndicatorColor(indicators.findIndex((i) => i.id === indicatorDraft.id))}
                    onChange={(e) => setIndicatorDraft({ ...indicatorDraft, color: e.target.value })}
                  />
                </div>
              )}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
