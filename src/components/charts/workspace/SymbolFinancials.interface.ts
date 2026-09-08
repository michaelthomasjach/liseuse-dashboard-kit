/** One column of a financial table: a fiscal year, a quarter, or a derived period like TTM.
 *
 *  `key` is what a row's own `values` are keyed by, so the app decides what a period *is* — this
 *  library never infers fiscal calendars, any more than it fetches the figures themselves. */
export interface FinancialPeriod {
  key: string;
  /** What the column head reads — "2024", "Q2 2026", "TTM". */
  label: string;
  /** A quieter second line under it, for the period a fiscal year actually covers: "Mar 2024". */
  sublabel?: string;
}

/** One line of a statement, statistic block or segment breakdown.
 *
 *  `values` carries numbers so this library can compute the year-on-year change under each figure
 *  (see `FinancialTable.showGrowth`); `display` overrides how any of them is written out, for the
 *  many cases where the app formats better than a generic formatter can — a share count, a ratio,
 *  a currency the chart was never told about. A period missing from both renders as "no figure",
 *  which is a real answer and looks the same whichever way it arrives. */
export interface FinancialRow {
  key: string;
  label: string;
  /** A colour chip before the label, tying the row to its own band in a chart above it. */
  accent?: string;
  /** Draws the row as a total rather than a line item. */
  emphasis?: boolean;
  values?: Record<string, number | null>;
  display?: Record<string, string | null>;
  /** Nested lines, collapsed with this one. Any depth. */
  children?: FinancialRow[];
}

export interface FinancialTable {
  /** Stable across renders — it is the React key and, where a view offers a switch between
   *  several tables, the value that switch carries. */
  id: string;
  /** Shown above the table. Omit when the surrounding section already names it. */
  title?: string;
  periods: FinancialPeriod[];
  rows: FinancialRow[];
  /** Writes each figure's change from the period before it underneath, coloured by sign. Only
   *  meaningful where the periods are in order and comparable — a statement, not a statistics
   *  block whose rows are unrelated ratios. Default false. */
  showGrowth?: boolean;
  /** How deep the tree starts open. Default: fully open. */
  defaultExpandedDepth?: number;
}

/** A labelled figure in a summary strip — "Market capitalization / 40.14 B USD". */
export interface FinancialFact {
  label: string;
  value: string;
  /** A quieter suffix after the value: a currency, a unit. */
  unit?: string;
  /** Turns the value into a link — a company's own website, a filing. */
  href?: string;
}

/** A slice of a proportion: ownership, capital structure. Rendered as a labelled bar, not a pie —
 *  two or three shares are read by comparing lengths, which a bar does and a ring does not. */
export interface FinancialShare {
  label: string;
  value: number;
  /** Written out beside the label; falls back to the raw value. */
  display?: string;
  color?: string;
}

/** Everything the "Détails" modal's own tabs render, all of it supplied by the application.
 *
 *  This library owns no data source — the same stance `data`, `events` and `symbolSearchResults`
 *  already take — so every tab here is optional and simply does not appear when its data is
 *  absent. A caller with only an income statement gets a modal with one tab, not five empty ones. */
export interface SymbolFinancials {
  overview?: {
    keyFacts?: FinancialFact[];
    /** Free prose about the company. Long text is clamped with a "show more" toggle. */
    about?: string;
    ownership?: { title?: string; shares: FinancialShare[] };
    capitalStructure?: { title?: string; shares: FinancialShare[] };
  };
  /** One entry per statement. The view offers a switch between whichever are present. */
  statements?: FinancialTable[];
  /** Statistics arrive as several tables so the app controls the grouping — valuation ratios,
   *  returns, liquidity — rather than this library guessing which metric belongs with which. */
  statistics?: FinancialTable[];
  dividends?: {
    /** Shown instead of the tables when there is nothing to show — "TTWO has never paid
     *  dividends". A company that pays none is a fact, not an empty state. */
    emptyMessage?: string;
    facts?: FinancialFact[];
    tables?: FinancialTable[];
  };
  earnings?: {
    facts?: FinancialFact[];
    tables?: FinancialTable[];
  };
  segments?: FinancialTable[];
}
