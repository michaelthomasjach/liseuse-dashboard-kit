import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Modal } from "../../../primitives/Modal";
import { TextField } from "../../../forms/TextField";
import {
  SearchIcon, TrashIcon, InfoIcon, OverlayBadgeIcon, PaneBadgeIcon, CheckIcon, CodeIcon,
  TrendLineIcon, StarIcon, ChevronLeftIcon, ChevronRightIcon,
} from "../../../icons";
import { INDICATOR_CATALOG, type IndicatorCatalogEntry } from "../indicatorCatalog";
import { INDICATOR_SCRIPT_SOURCES } from "../indicatorScriptSources";
import { analyzeScriptKind } from "../scripting/scriptKind";
import type { IndicatorInfoTarget } from "../interfaces/IndicatorInfoTarget.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorKind } from "../interfaces/IndicatorKind.interface";
import type { CustomIndicatorDef } from "../interfaces/CustomIndicatorDef.interface";
import type { ScriptDef } from "../interfaces/ScriptDef.interface";
import { observeElementSizes } from "../../../../internal/observeElementSize";

/** The picker's own grouping/filter label for `scripts` — the one category that isn't a
 *  `IndicatorCatalogEntry.category` or a `CustomIndicatorDef.section` but a fixed name this file
 *  itself owns, and the only one that stays listed while empty (see its own filter button below). */
const SCRIPTS_CATEGORY = "Mes indicateurs";

/** Not a category rows *belong* to — a filter across every other one. A favourite keeps its own
 *  section heading here, so "Favoris" reads as a view of the catalogue rather than a copy of it;
 *  duplicating rows into a category of their own would make the same indicator appear twice under
 *  "Toutes" and leave the two copies to disagree about which is selected. */
const FAVORITES_CATEGORY = "Favoris";

/** Where a `@strategy` script is listed instead (see scriptKind.ts). Its own category rather than a
 *  badge inside "Mes scripts": clicking a strategy is a different act — it opens a backtest with an
 *  account and a panel of its own, not one more line on the price scale — and burying that
 *  distinction in an icon is how someone ends up running a strategy thinking they added an
 *  indicator. */
const STRATEGIES_CATEGORY = "Mes stratégies";

/** Where a `@quant` script is listed. Its own category for the same reason strategies have one:
 *  it is a different act. A quant analysis draws nothing on the chart at all — it runs over a list
 *  of symbols and returns a table of findings — so listing it beside things you add to the price
 *  scale would promise something clicking it can never do. */
const QUANT_CATEGORY = "Mes analyses";

/** Where a `@report` script is listed. Its own category again: what it produces is a document, not
 *  anything you could put on a price scale. */
const REPORT_CATEGORY = "Mes rapports";

const SCRIPT_CATEGORY_BY_KIND: Record<ReturnType<typeof analyzeScriptKind>["kind"], string> = {
  indicator: SCRIPTS_CATEGORY,
  strategy: STRATEGIES_CATEGORY,
  quant: QUANT_CATEGORY,
  report: REPORT_CATEGORY,
};

export interface IndicatorPickerModalProps {
  open: boolean;
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setInfoKind: (target: IndicatorInfoTarget | null) => void;
  /** Opens an indicator's (or a script's) source in the shared code viewer. */
  setCodeTarget: (target: IndicatorKind | { scriptId: string } | null) => void;
  showVolume: boolean;
  setVolumePaneState: (state: "expanded" | "collapsed" | "hidden") => void;
  addIndicator: (entry: IndicatorCatalogEntry) => void;
  indicators: Indicator[];
  commitIndicators: (next: Indicator[]) => void;
  customIndicators: CustomIndicatorDef[] | undefined;
  addCustomIndicator: (def: CustomIndicatorDef) => void;
  scripts: ScriptDef[];
  toggleScriptEnabled: (id: string) => void;
  openCorrelationSetup: () => void;
  favoriteIndicatorIds: string[];
  toggleFavoriteIndicator: (key: string) => void;
  onDeleteScript?: (scriptId: string) => void;
  onCreateStrategyFromIndicator?: (scriptId: string) => void;
  /** Raised instead of silently adding a second instance of an indicator already on the chart —
   *  the caller renders the "which did you mean" prompt on top of this modal. */
  onDuplicate: (prompt: { label: string; onAdd: () => void; onRemove: () => void }) => void;
  /** Raised by a script row's trash button — deleting a script is irreversible, so the caller
   *  puts a confirmation in front of it rather than acting on the click itself. */
  onRequestDeleteScript: (script: { id: string; name: string }) => void;
}

/** "Ajouter un indicateur" — search, category filters, and the catalog itself.
 *
 *  Its own file because it owns three pieces of behaviour nothing else in this modal set shares:
 *  the category filter, the sideways-scrolling category strip that has to say when there is more
 *  of it off-screen, and a scroll position remembered across a close/reopen cycle. The two
 *  destructive paths it can start — adding a duplicate, deleting a script — are raised to the
 *  caller rather than handled here, so this component only ever *offers* things. */
export function IndicatorPickerModal({
  open,
  onClose,
  searchQuery: indicatorSearchQuery,
  setSearchQuery: setIndicatorSearchQuery,
  setInfoKind,
  setCodeTarget,
  showVolume,
  setVolumePaneState,
  addIndicator,
  indicators,
  commitIndicators,
  customIndicators,
  addCustomIndicator,
  scripts,
  toggleScriptEnabled,
  openCorrelationSetup,
  favoriteIndicatorIds,
  toggleFavoriteIndicator,
  onDeleteScript,
  onCreateStrategyFromIndicator,
  onDuplicate,
  onRequestDeleteScript,
}: IndicatorPickerModalProps) {
  // A second, independent filter alongside the search box — `null` ("Toutes") shows every
  // category. Local state (unlike `indicatorSearchQuery`, lifted to the caller): nothing outside
  // this modal ever needs to read or reset it.
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  // Under `--stack-mobile` (see charts-shared.css) the category strip stops being a column and
  // becomes a row you drag sideways — deliberately, since the category count is open-ended. What it
  // did not do was *say so*: with a dozen categories the last of them sat 268px past the edge with
  // no scrollbar (hidden on purpose) and no other hint, so "Mes stratégies" was simply unfindable.
  // Same chevron-where-there-is-more treatment `ScriptFileTabs` already gives its own strip.
  const categoryStripRef = useRef<HTMLDivElement>(null);
  const [categoryOverflow, setCategoryOverflow] = useState({ left: false, right: false });
  const measureCategoryOverflow = useCallback(() => {
    const el = categoryStripRef.current;
    if (!el) return;
    // 1px of slack, or a fractional scroll width leaves the right chevron permanently lit.
    setCategoryOverflow({ left: el.scrollLeft > 1, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
  }, []);
  useEffect(() => {
    const el = categoryStripRef.current;
    if (!el) return;
    measureCategoryOverflow();
    // The strip and each of its items: its own box can stay put while its contents change
    // width. Through the element's own document — see observeElementSizes.
    return observeElementSizes([el, ...Array.from(el.children)], measureCategoryOverflow);
  }, [measureCategoryOverflow, open, scripts.length]);
  function scrollCategories(direction: -1 | 1) {
    categoryStripRef.current?.scrollBy({ left: direction * categoryStripRef.current.clientWidth * 0.66, behavior: "smooth" });
  }
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
    if (open && pickerScrollRef.current) pickerScrollRef.current.scrollTop = pickerScrollTopRef.current;
  }, [open]);


  if (!open) return null;

  return (
    // footer={null}: without it, Modal's own default footer would add a redundant full-width
    // "Fermer" button below a catalog that's mostly single-click rows already — the header's
    // own close icon (always present alongside `title`) stays the one way out.
    <Modal open onClose={() => onClose()} title="Ajouter un indicateur" size="wide" footer={null}>
      {/* Left/right split (see .lq-chart__modal-split's own doc) — search + category filters
          on the left, the catalog itself on the right, each scrolling on its own. The
          `--stack-mobile` modifier turns that into three stacked bands on a narrow viewport:
          search, then the filters as one sideways-scrolling row, then the catalog. Opt-in per
          modal rather than a blanket rule on `.lq-chart__modal-split`, so SymbolSearchModal —
          the only other user of this layout — keeps whatever its own narrow behaviour is until
          someone asks otherwise. */}
      <div className="lq-chart__modal-split lq-chart__modal-split--stack-mobile">
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
          <div className="lq-chart__indicator-category-strip">
          <div
            className="lq-chart__indicator-category-filters lq-chart__modal-filter-list--vertical"
            ref={categoryStripRef}
            onScroll={measureCategoryOverflow}
          >
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
                FAVORITES_CATEGORY,
                ...INDICATOR_CATALOG.map((entry) => entry.category),
                ...(customIndicators ?? []).map((def) => def.section),
                // Always present, even with no scripts at all — the tab is how someone finds
                // out scripts *exist* as a thing this chart does. Hiding it until the first
                // one is written means it can only ever be discovered by someone who already
                // knew; selecting it with an empty list shows an explanatory empty state
                // instead of the generic "aucun indicateur ne correspond" (see below).
                SCRIPTS_CATEGORY,
                STRATEGIES_CATEGORY,
                QUANT_CATEGORY,
                REPORT_CATEGORY,
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
          {categoryOverflow.left && (
            <button
              type="button"
              className="lq-chart__indicator-category-more lq-chart__indicator-category-more--left"
              aria-label="Catégories précédentes"
              title="Catégories précédentes"
              onClick={() => scrollCategories(-1)}
            >
              <ChevronLeftIcon size={12} />
            </button>
          )}
          {categoryOverflow.right && (
            <button
              type="button"
              className="lq-chart__indicator-category-more lq-chart__indicator-category-more--right"
              aria-label="Catégories suivantes"
              title="Catégories suivantes"
              onClick={() => scrollCategories(1)}
            >
              <ChevronRightIcon size={12} />
            </button>
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
              /** Built-in/custom rows only — at least one instance of this indicator is already
               *  on the chart. Drives both the row's own "already there" visual (a checkmark
               *  badge) and, on click, a confirm prompt instead of silently stacking a second
               *  instance (see `duplicatePrompt` state above). `undefined` for a script or
               *  Volume row, neither of which can be duplicated this way — a script click is
               *  always an enable/disable toggle, and Volume is a single unique pane. */
              alreadyPresent?: boolean;
              /** Built-in/custom rows only, paired with `alreadyPresent` — what "add anyway"
               *  vs. "remove from chart" each mean for this specific row. */
              onRemoveExisting?: () => void;
              /** What this row's own "</>" button opens, if it has one: a built-in kind (whose
               *  script equivalent INDICATOR_SCRIPT_SOURCES carries) or a script (whose own
               *  code is the thing to show). `undefined` — no button at all, same convention
               *  `descriptionKind` already follows — for a custom indicator (a caller's own,
               *  this library never had its source) and for the built-in kinds with no faithful
               *  script version (see INDICATOR_SCRIPT_SOURCES' own doc for which, and why). */
              codeTarget?: IndicatorKind | { scriptId: string };
              /** Script rows only — the script this row stands for, which its own trash button
               *  deletes. `undefined` everywhere else: a built-in or custom indicator is removed
               *  from the chart by clicking its already-present row (see `alreadyPresent`), and
               *  there is nothing to permanently delete. */
              scriptId?: string;
              /** Indicator-script rows only — offers "make a strategy out of this". Not shown on
               *  a row that is already a strategy (there is nothing to convert) nor on a
               *  built-in (this library has no source for one to import). */
              canBecomeStrategy?: boolean;
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
              codeTarget: INDICATOR_SCRIPT_SOURCES[entry.kind] ? entry.kind : undefined,
              alreadyPresent: indicators.some((ind) => ind.kind === entry.kind),
              onRemoveExisting: () => commitIndicators(indicators.filter((ind) => ind.kind !== entry.kind)),
            }));
            const customOptions: PickerOption[] = (customIndicators ?? [])
              .filter((def) => def.label.toLowerCase().includes(query) || (def.shortLabel ?? "").toLowerCase().includes(query))
              .map((def) => ({
                key: def.id,
                label: def.label,
                category: def.section,
                pane: def.type === "overlay" ? "price" : "own",
                onSelect: () => addCustomIndicator(def),
                alreadyPresent: indicators.some((ind) => ind.customData?.id === def.id),
                onRemoveExisting: () => commitIndicators(indicators.filter((ind) => ind.customData?.id !== def.id)),
              }));
            const scriptOptions: PickerOption[] = scripts
              .filter((s) => s.name.toLowerCase().includes(query))
              .map((s) => ({
                key: s.id,
                label: s.name,
                category: SCRIPT_CATEGORY_BY_KIND[analyzeScriptKind(s.code).kind],
                pane: "own",
                onSelect: () => toggleScriptEnabled(s.id),
                enabled: s.enabled !== false,
                codeTarget: { scriptId: s.id },
                scriptId: s.id,
                canBecomeStrategy: analyzeScriptKind(s.code).kind !== "strategy",
              }));
            const allOptions = [...builtinOptions, ...customOptions, ...scriptOptions].filter((option) =>
              categoryFilter === null
                ? true
                : categoryFilter === FAVORITES_CATEGORY
                  ? favoriteIndicatorIds.includes(option.key)
                  : option.category === categoryFilter
            );
            const groups: { category: string; options: PickerOption[] }[] = [];
            for (const option of allOptions) {
              const group = groups.find((g) => g.category === option.category);
              if (group) group.options.push(option);
              else groups.push({ category: option.category, options: [option] });
            }
            if (!showVolumeOption && groups.length === 0) {
              // Two different "nothing here" cases, which want two different messages: an
              // empty "Mes scripts" is the normal state of a chart nobody has written a script
              // for yet (nothing is wrong, and the message should say what a script *is* for),
              // whereas an empty result anywhere else really is a search that matched nothing.
              if (categoryFilter === FAVORITES_CATEGORY) {
                return (
                  <p className="lq-chart__indicator-picker-empty">
                    Aucun favori. L&apos;étoile au bout de chaque ligne épingle un indicateur ici — de quoi retrouver les quelques-uns
                    que vous utilisez vraiment sans reparcourir tout le catalogue.
                  </p>
                );
              }
              if (categoryFilter === STRATEGIES_CATEGORY && !scripts.some((s) => analyzeScriptKind(s.code).kind === "strategy")) {
                return (
                  <p className="lq-chart__indicator-picker-empty">
                    Aucune stratégie pour l&apos;instant. Une stratégie est un script qui prend des positions : d&apos;abord testées sur un
                    compte simulé dans le panneau qui s&apos;ouvre sous les bougies. Écrivez <code>@strategy</code> en haut d&apos;un script pour
                    en faire une, ou partez d&apos;un indicateur existant via son bouton «&nbsp;&lt;/&gt;&nbsp;».
                  </p>
                );
              }
              if (categoryFilter === QUANT_CATEGORY && !scripts.some((s) => analyzeScriptKind(s.code).kind === "quant")) {
                return <p className="lq-chart__indicator-picker-empty">Aucune analyse @quant pour l'instant.</p>;
              }
              if (categoryFilter === REPORT_CATEGORY && !scripts.some((s) => analyzeScriptKind(s.code).kind === "report")) {
                return <p className="lq-chart__indicator-picker-empty">Aucun rapport @report pour l'instant.</p>;
              }
              if (categoryFilter === SCRIPTS_CATEGORY && !scripts.some((s) => analyzeScriptKind(s.code).kind === "indicator")) {
                return (
                  <p className="lq-chart__indicator-picker-empty">
                    Aucun script pour l&apos;instant. Un script est un indicateur que vous écrivez vous-même : ouvrez l&apos;éditeur
                    («&nbsp;&lt;/&gt;&nbsp;» dans la barre d&apos;outils) pour en créer un, ou partez du code d&apos;un indicateur intégré via
                    son propre bouton «&nbsp;&lt;/&gt;&nbsp;» dans cette liste.
                  </p>
                );
              }
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
                        className={[
                          "lq-chart__indicator-picker-option",
                          option.alreadyPresent && "lq-chart__indicator-picker-option--active",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <button
                          type="button"
                          className="lq-chart__indicator-picker-select"
                          onClick={() =>
                            option.alreadyPresent
                              ? onDuplicate({ label: option.label, onAdd: option.onSelect, onRemove: option.onRemoveExisting! })
                              : option.onSelect()
                          }
                          title={option.enabled === undefined ? undefined : option.enabled ? "Désactiver ce script" : "Activer ce script"}
                        >
                          <span className="lq-chart__indicator-picker-name">{option.label}</span>
                          {/* A dimmed row on its own says nothing about *why* it is dimmed —
                              the same eye-off the editor's own script tabs use for this exact
                              state names it, and the tooltip says what clicking will do. */}
                          {option.alreadyPresent && (
                            <span className="lq-chart__indicator-picker-check" title="Déjà affiché sur ce graphique">
                              <CheckIcon size={13} />
                            </span>
                          )}
                          <span
                            className="lq-chart__indicators-manager-badge"
                            title={option.pane === "price" ? "Superposé au prix" : "Panneau séparé"}
                          >
                            {option.pane === "price" ? <OverlayBadgeIcon size={13} /> : <PaneBadgeIcon size={13} />}
                          </span>
                        </button>
                        {option.codeTarget !== undefined && (
                          <button
                            type="button"
                            className="lq-chart__pane-header-action"
                            onClick={() => setCodeTarget(option.codeTarget!)}
                            aria-label={`Code de ${option.label}`}
                            title="Voir le code"
                          >
                            <CodeIcon size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          className={[
                            "lq-chart__pane-header-action",
                            favoriteIndicatorIds.includes(option.key) && "lq-chart__indicator-picker-star--on",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => toggleFavoriteIndicator(option.key)}
                          aria-label={favoriteIndicatorIds.includes(option.key) ? `Retirer ${option.label} des favoris` : `Ajouter ${option.label} aux favoris`}
                          title={favoriteIndicatorIds.includes(option.key) ? "Retirer des favoris" : "Ajouter aux favoris"}
                        >
                          <StarIcon size={13} />
                        </button>
                        {option.canBecomeStrategy && onCreateStrategyFromIndicator && (
                          <button
                            type="button"
                            className="lq-chart__pane-header-action"
                            onClick={() => onCreateStrategyFromIndicator(option.scriptId!)}
                            aria-label={`Créer une stratégie à partir de ${option.label}`}
                            title="Créer une stratégie à partir de cet indicateur"
                          >
                            <TrendLineIcon size={13} />
                          </button>
                        )}
                        {option.scriptId !== undefined && onDeleteScript && (
                          <button
                            type="button"
                            className="lq-chart__pane-header-action"
                            onClick={() => onRequestDeleteScript({ id: option.scriptId!, name: option.label })}
                            aria-label={`Supprimer ${option.label}`}
                            title="Supprimer ce script"
                          >
                            <TrashIcon size={13} />
                          </button>
                        )}
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
  );
}
