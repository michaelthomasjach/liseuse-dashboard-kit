import type { SymbolSearchCategory } from "./SymbolSearchCategory.interface";

/** One row in the symbol-search modal's results list — see `CandlestickChartProps.symbolSearchResults`. */
export interface SymbolSearchResult {
  id: string;
  ticker: string;
  name: string;
  category: Exclude<SymbolSearchCategory, "all" | "favorites">;
  /** Exchange/data source, e.g. "NASDAQ", "EURONEXT" — shown right-aligned, just before the
   *  favorite star. */
  source: string;
  /** Small square logo. Omit to fall back to a colored placeholder (`logoColor`, or one cycled
   *  from a small palette) showing the ticker's first 1-2 letters instead. */
  logoUrl?: string;
  logoColor?: string;
  /** Une icône à droite du nom qui appelle ceci (ex. la composition d'un symbole personnalisé), sans choisir la ligne. */
  onInfo?: () => void;
  /** Infobulle de cette icône. */
  infoLabel?: string;
}
