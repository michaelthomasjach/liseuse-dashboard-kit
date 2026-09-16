import type { ReactNode } from "react";

/** One optional, toggleable value column in a workspace's own docked watchlist table (see
 *  `ChartWorkspaceWatchlist.columns`) — the ticker itself is always shown and isn't one of these. */
export interface ChartWorkspaceWatchlistColumn {
  id: string;
  /** Shown as this column's own header, and as its label in the "..." visibility toggle. */
  label: string;
  /** The column's comparable value for one row. Two things read it, and they are the same
   *  question: sorting, and telling a figure that rose from one that fell between two updates (see
   *  `ChartWorkspaceWatchlistRow.price`). Only a *number* can do the second — a `sortValue`
   *  returning a string is a label, and that column simply never flashes.
   *
   *  Clicking this column's own header sorts every list's rows by this — `values[id]` (see
   *  `ChartWorkspaceWatchlistRow.values`) is a `ReactNode`, not necessarily a plain comparable
   *  value (a colored "+1.24%" `<span>`, say), so a column whose own cell is anything beyond a
   *  bare string/number needs this to say what it should actually sort by. Omit it and the
   *  column simply isn't sortable — its header click does nothing. Whether the column's first
   *  click sorts ascending or descending is inferred from this function's own return type on the
   *  first row (string → A→Z first, matching "Symbole"'s own always-ascending-first behavior;
   *  number → highest-first, matching how a "Variation" column would read best). */
  sortValue?: (row: ChartWorkspaceWatchlistRow) => string | number;
}

/** One row (one symbol) in a workspace's own docked watchlist table. */
export interface ChartWorkspaceWatchlistRow {
  id: string;
  ticker: string;
  /** Rendered content per optional column (see `ChartWorkspaceWatchlist.columns`), keyed by
   *  column id — whatever the caller wants shown there for this row (a formatted price, a
   *  colored % change, …). A column with no entry here for a given row simply renders blank. */
  values: Record<string, ReactNode>;
  /** Small logo shown next to the ticker — an image, or (with no `logoUrl`) a solid-color circle
   *  the ticker's own first two letters render against, same fallback `SymbolSearchModal`'s own
   *  results already use. Omit both for no logo at all. */
  logoUrl?: string;
  logoColor?: string;
  /** Freeform asset class ("Stock", "Crypto", "Index", …), sector ("Technology Services", …), and
   *  geographic region ("US", "EU", …) — all three entirely caller-defined (no closed union,
   *  unlike `SymbolSearchResult.category`), read by the list's own exposure/concentration modal
   *  (see `WatchlistExposureModal`) for its three breakdown donuts. A row missing any of these
   *  just lands in that donut's own "Autre" bucket rather than being left out. */
  assetType?: string;
  sector?: string;
  region?: string;
  /** Whether this symbol can be traded right now — its market is open. Shown as a small dot beside
   *  the ticker: pale green open, pale red closed. Left undefined, no dot at all, which is the
   *  right answer for a caller who does not track session hours: an absent fact stated as "closed"
   *  would be a lie every weekday morning. */
  marketOpen?: boolean;
  /** The row's own price as a number, when the caller has one.
   *
   *  `values` already carries what is *displayed* — a formatted string, or a coloured node — and
   *  a formatted string cannot be compared against the previous one to tell a rise from a fall
   *  without parsing it back, which no amount of care makes safe across locales and currencies.
   *  This is the comparable value, used for one thing: flashing a figure when it moves.
   *
   *  It is the fallback, not the first choice. Each column flashes on its own
   *  `ChartWorkspaceWatchlistColumn.sortValue` when that returns a number, because the columns do
   *  not move together — a price can rise on a day whose variation is still negative, and tinting
   *  every column by the price would paint that variation green. A column declaring no numeric
   *  `sortValue` falls back to this; with neither, that figure simply never flashes. */
  price?: number;
}

/** A named sub-group of rows within one list (see `ChartWorkspaceWatchlist.sections`) — e.g.
 *  "Indices"/"Forex"/"US" inside a broader "Mes favoris" list. Collapsible in the UI (view-only
 *  state, not tracked here); rows can be dragged into, out of, and between sections (see
 *  `ChartWorkspaceProps.onMoveWatchlistRow`). */
export interface ChartWorkspaceWatchlistSection {
  id: string;
  name: string;
  rows: ChartWorkspaceWatchlistRow[];
}

/** One named list for the workspace's own docked watchlist tab (see `ChartWorkspaceProps.watchlists`). */
export interface ChartWorkspaceWatchlist {
  id: string;
  /** Shown as the panel's own clickable title while this list is active. */
  name: string;
  /** Optional value columns beyond the always-shown ticker (e.g. "Prix", "Variation") — visibility
   *  toggled via the panel's own "..." button, shared across every list (so the same selection
   *  carries over when switching lists) rather than tracked per list. */
  columns: ChartWorkspaceWatchlistColumn[];
  /** Rows not organized into any section — rendered first, above `sections`. */
  rows: ChartWorkspaceWatchlistRow[];
  /** Optional named sub-groups within this list — see `ChartWorkspaceWatchlistSection`'s own doc. */
  sections?: ChartWorkspaceWatchlistSection[];
}
