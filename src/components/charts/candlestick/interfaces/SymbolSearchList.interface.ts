import type { SymbolSearchResult } from "./SymbolSearchResult.interface";

/** Une liste de l'utilisateur (favoris, surveillance…) proposée dans la recherche de symbole, sous les
 *  catégories : la choisir affiche ses symboles (filtrés par le texte saisi) au lieu des résultats de
 *  l'hôte. `ChartWorkspace` les construit à partir de ses propres `watchlists`. */
export interface SymbolSearchList {
  id: string;
  name: string;
  symbols: SymbolSearchResult[];
}
