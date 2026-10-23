import { useEffect, useRef, useState } from "react";
import type { SymbolSearchCategory } from "../interfaces/SymbolSearchCategory.interface";

export interface UseSymbolSearchStateArgs {
  defaultFavoriteSymbolIds: string[] | undefined;
  onFavoriteSymbolIdsChange: ((ids: string[]) => void) | undefined;
  onSymbolSearchChange: ((query: string, category: SymbolSearchCategory) => void) | undefined;
}

/** The symbol-search modal's own open/query/category state, plus favorited result ids — see
 *  `CandlestickChartProps.symbolSearch`/`symbolSearchResults`/`defaultFavoriteSymbolIds`. Kept
 *  separate from `useDrawingState` (which owns `onAddSymbolOverlay`/the resulting `symbolOverlay`
 *  drawings themselves): this hook is purely the modal's own UI state, the drawings hook is what a
 *  row's "+" button actually commits. */
export function useSymbolSearchState({ defaultFavoriteSymbolIds, onFavoriteSymbolIdsChange, onSymbolSearchChange }: UseSymbolSearchStateArgs) {
  const [symbolSearchOpen, setSymbolSearchOpenState] = useState(false);
  // "select" : un résultat remplace le symbole (onSymbolSelect) ; "add" : il s'ajoute au graphique
  // (onAddSymbolOverlay) — bouton « + Symbole » de l'en-tête et entrée du menu contextuel ;
  // "replace" : il remplace un symbole comparé (clic sur son nom dans la légende), dont l'id est gardé.
  const [symbolSearchMode, setSymbolSearchMode] = useState<"select" | "add" | "replace">("select");
  const [symbolSearchReplaceId, setSymbolSearchReplaceId] = useState<string | null>(null);
  const setSymbolSearchOpen = (open: boolean) => {
    setSymbolSearchOpenState(open);
    if (!open) {
      setSymbolSearchMode("select");
      setSymbolSearchReplaceId(null);
    }
  };
  /** Ouvre la fenêtre de recherche dans le mode demandé (« replace » : avec le dessin à remplacer). */
  const openSymbolSearch = (mode: "select" | "add" | "replace", replaceId: string | null = null) => {
    setSymbolSearchMode(mode);
    setSymbolSearchReplaceId(mode === "replace" ? replaceId : null);
    setSymbolSearchOpenState(true);
  };
  const [symbolSearchQuery, setSymbolSearchQuery] = useState("");
  const [symbolSearchCategory, setSymbolSearchCategory] = useState<SymbolSearchCategory>("all");
  const [favoriteSymbolIds, setFavoriteSymbolIds] = useState<string[]>(defaultFavoriteSymbolIds ?? []);

  function toggleFavoriteSymbol(id: string) {
    setFavoriteSymbolIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      onFavoriteSymbolIdsChange?.(next);
      return next;
    });
  }

  // `onSymbolSearchChange` deliberately isn't a dependency below — a typical caller passes an
  // inline (non-memoized) handler, which is a fresh function identity on every one of *its own*
  // renders; if this effect re-ran every time that identity changed, and that handler calls back
  // into state (e.g. setResults after searching, exactly what the story demonstrating this does),
  // the resulting re-render would produce yet another fresh identity — an infinite loop. A ref
  // always holding the latest callback sidesteps this while still calling the current version.
  const onSymbolSearchChangeRef = useRef(onSymbolSearchChange);
  useEffect(() => {
    onSymbolSearchChangeRef.current = onSymbolSearchChange;
  });

  // Fires once right when the modal opens (query/category at their defaults) and again on every
  // later change — searching/filtering itself (including resolving "favorites") is entirely the
  // caller's job, this just reports what the modal's own controls are currently asking for.
  useEffect(() => {
    if (!symbolSearchOpen) return;
    onSymbolSearchChangeRef.current?.(symbolSearchQuery, symbolSearchCategory);
  }, [symbolSearchOpen, symbolSearchQuery, symbolSearchCategory]);

  return {
    symbolSearchOpen,
    setSymbolSearchOpen,
    symbolSearchMode,
    symbolSearchReplaceId,
    openSymbolSearch,
    symbolSearchQuery,
    setSymbolSearchQuery,
    symbolSearchCategory,
    setSymbolSearchCategory,
    favoriteSymbolIds,
    toggleFavoriteSymbol,
  };
}
