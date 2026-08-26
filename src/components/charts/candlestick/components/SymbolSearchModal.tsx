import { Modal } from "../../../primitives/Modal";
import { TextField } from "../../../forms/TextField";
import { SearchIcon, CloseIcon, RefreshIcon, CheckIcon, PlusIcon, StarIcon } from "../../../icons";
import type { SymbolSearchCategory } from "../interfaces/SymbolSearchCategory.interface";
import type { SymbolSearchResult } from "../interfaces/SymbolSearchResult.interface";
import type { TrendLineDrawing, OverlayDataPoint } from "../interfaces/TrendLineDrawing.interface";
import { SYMBOL_SEARCH_CATEGORIES, defaultSymbolLogoColor } from "../symbolSearchCatalog";

export interface SymbolSearchModalProps {
  /** Default "Symbol search" (CandlestickChart's own usage) — override for a differently-purposed
   *  reuse of this same search+category+results shell (see ChartWorkspace's own "add a symbol to
   *  this watchlist" modal, which reuses this component with its own title and no favorites/
   *  overlay affordances at all). */
  title?: string;
  symbolSearchOpen: boolean;
  setSymbolSearchOpen: (open: boolean) => void;
  symbolSearchQuery: string;
  setSymbolSearchQuery: (query: string) => void;
  symbolSearchCategory: SymbolSearchCategory;
  setSymbolSearchCategory: (category: SymbolSearchCategory) => void;
  symbolSearchResults: SymbolSearchResult[] | undefined;
  /** The hover-revealed (always-visible once favorited) star button — omitted entirely, on both
   *  props at once, for a reuse of this modal with no favorites concept of its own. */
  favoriteSymbolIds?: string[];
  toggleFavoriteSymbol?: (id: string) => void;
  onSymbolSelect: ((result: SymbolSearchResult) => void) | undefined;
  onAddSymbolOverlay: ((result: SymbolSearchResult) => OverlayDataPoint[] | Promise<OverlayDataPoint[]>) | undefined;
  symbolOverlays: TrendLineDrawing[];
  addingOverlaySymbols: Set<string>;
  handleAddSymbolOverlay: (result: SymbolSearchResult) => void;
  removeSymbolOverlay: (ticker: string) => void;
}

/** The "Symbol search" modal (opened by clicking `symbol` when `symbolSearch` is on, or reused
 *  wholesale by ChartWorkspace's own "add a symbol to this watchlist" flow — see `title`): a
 *  search field, single-select category pills, and the results list — each row can be clicked to
 *  fire `onSymbolSelect` (its own meaning depends on the caller: change the main symbol, or add to
 *  a watchlist), starred as a favorite (only when both `favoriteSymbolIds`/`toggleFavoriteSymbol`
 *  are provided), or (when `onAddSymbolOverlay` is provided) added as a comparison overlay via its
 *  own hover-revealed "+" (a checkmark once active, a spinner while the caller's promise is in
 *  flight). */
export function SymbolSearchModal({
  title = "Symbol search",
  symbolSearchOpen,
  setSymbolSearchOpen,
  symbolSearchQuery,
  setSymbolSearchQuery,
  symbolSearchCategory,
  setSymbolSearchCategory,
  symbolSearchResults,
  favoriteSymbolIds,
  toggleFavoriteSymbol,
  onSymbolSelect,
  onAddSymbolOverlay,
  symbolOverlays,
  addingOverlaySymbols,
  handleAddSymbolOverlay,
  removeSymbolOverlay,
}: SymbolSearchModalProps) {
  if (!symbolSearchOpen) return null;
  return (
    <Modal open onClose={() => setSymbolSearchOpen(false)} title={title} footer={null} size="wide">
      {/* Left/right split (see .lq-chart__modal-split's own doc) — search + category filters on
          the left, results on the right, each scrolling on its own. */}
      <div className="lq-chart__modal-split">
        <div className="lq-chart__modal-split-sidebar">
          <TextField
            placeholder="Rechercher un symbole…"
            value={symbolSearchQuery}
            onChange={(e) => setSymbolSearchQuery(e.target.value)}
            leadingIcon={<SearchIcon size={14} />}
            trailingIcon={
              symbolSearchQuery ? (
                <button
                  type="button"
                  className="lq-chart__symbol-search-clear"
                  onClick={() => setSymbolSearchQuery("")}
                  aria-label="Effacer la recherche"
                >
                  <CloseIcon size={12} />
                </button>
              ) : undefined
            }
            autoFocus
          />
          {/* Single-select pills, not checkboxes (CheckboxButton) — only one category filters
              the results at a time, same "active" visual convention as the timeframe/
              display-mode menus above. */}
          <div className="lq-chart__symbol-search-categories lq-chart__modal-filter-list--vertical">
            {SYMBOL_SEARCH_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                className={[
                  "lq-chart__symbol-search-category",
                  cat.value === symbolSearchCategory && "lq-chart__symbol-search-category--active",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setSymbolSearchCategory(cat.value)}
                aria-pressed={cat.value === symbolSearchCategory}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
        <div className="lq-chart__modal-split-content lq-chart__symbol-search-results">
          {(symbolSearchResults ?? []).length === 0 ? (
            <p className="lq-chart__symbol-search-empty">Aucun résultat.</p>
          ) : (
            (symbolSearchResults ?? []).map((result, i) => {
              const isFavorite = favoriteSymbolIds?.includes(result.id) ?? false;
              const isOverlayActive = symbolOverlays.some((d) => d.overlaySymbol === result.ticker);
              const isOverlayLoading = addingOverlaySymbols.has(result.ticker);
              return (
                <div className="lq-chart__symbol-search-row" key={result.id}>
                  <button
                    type="button"
                    className="lq-chart__symbol-search-row-main"
                    onClick={() => {
                      onSymbolSelect?.(result);
                      setSymbolSearchOpen(false);
                    }}
                  >
                    <span
                      className="lq-chart__symbol-search-logo"
                      style={result.logoUrl ? undefined : { backgroundColor: result.logoColor ?? defaultSymbolLogoColor(i) }}
                    >
                      {result.logoUrl ? <img src={result.logoUrl} alt="" /> : result.ticker.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="lq-chart__symbol-search-ticker">{result.ticker}</span>
                    <span className="lq-chart__symbol-search-name">{result.name}</span>
                    <span className="lq-chart__symbol-search-source">{result.source}</span>
                  </button>
                  {/* Compare against the main symbol — hover-revealed like the favorite star,
                      but stays visible once active too, same reasoning. Turns into a checkmark
                      (click removes it) once that symbol is already an overlay, and a spinner
                      while onAddSymbolOverlay's own promise is in flight — a plain one-way "add"
                      button couldn't reflect either without the caller tracking that state
                      itself, which returning the data instead lets the chart do here. Only
                      rendered when the caller actually supports it (onAddSymbolOverlay set) —
                      a "+" that silently did nothing would be worse than no button at all. */}
                  {onAddSymbolOverlay && (
                    <button
                      type="button"
                      className={[
                        "lq-chart__symbol-search-overlay",
                        isOverlayActive && "lq-chart__symbol-search-overlay--active",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => (isOverlayActive ? removeSymbolOverlay(result.ticker) : handleAddSymbolOverlay(result))}
                      disabled={isOverlayLoading}
                      aria-label={isOverlayActive ? `Retirer ${result.ticker} de la comparaison` : `Comparer avec ${result.ticker}`}
                      title={isOverlayActive ? `Retirer ${result.ticker} de la comparaison` : `Comparer avec ${result.ticker}`}
                    >
                      {isOverlayLoading ? (
                        <RefreshIcon size={14} className="lq-chart__symbol-search-overlay-spinner" />
                      ) : isOverlayActive ? (
                        <CheckIcon size={14} />
                      ) : (
                        <PlusIcon size={14} />
                      )}
                    </button>
                  )}
                  {/* Invisible until the row is hovered/focused (see charts-shared.css) — unless
                      already favorited, in which case it stays visible so favorited results
                      can actually be told apart from a glance, not just while hovering. Only
                      rendered when the caller actually supports favorites (both props set) — same
                      "no half-working button" reasoning as onAddSymbolOverlay's own "+" above. */}
                  {favoriteSymbolIds && toggleFavoriteSymbol && (
                  <button
                    type="button"
                    className={[
                      "lq-chart__symbol-search-favorite",
                      isFavorite && "lq-chart__symbol-search-favorite--active",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => toggleFavoriteSymbol(result.id)}
                    aria-label={isFavorite ? `Retirer ${result.ticker} des favoris` : `Ajouter ${result.ticker} aux favoris`}
                  >
                    <StarIcon size={14} fill={isFavorite ? "currentColor" : "none"} />
                  </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
