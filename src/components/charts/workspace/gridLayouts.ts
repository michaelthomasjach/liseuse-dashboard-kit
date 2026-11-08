/** Les dispositions de la grille d'un `ChartWorkspace` : combien de fenêtres, et où va chacune.
 *
 *  Chaque disposition est écrite comme un petit dessin, à la manière d'un `grid-template-areas` :
 *  une chaîne par ligne de la grille, un chiffre par colonne, le chiffre désignant la fenêtre qui
 *  occupe cette case (« 1 » = la première fenêtre, celle de l'indice 0). Une fenêtre qui couvre
 *  plusieurs cases est un rectangle de chiffres identiques. Tout le reste en découle : le nombre de
 *  fenêtres, de colonnes et de lignes, et la place de chaque fenêtre (ligne et colonne de départ,
 *  portées). La grille CSS applique cette place (voir `gridAreaValue`), et l'icône du menu
 *  « Disposition des fenêtres » la dessine (voir `GridLayoutIcon`) : une seule source pour les
 *  deux, aucune icône dessinée à la main.
 *
 *  Dans les dispositions « 1 grande + N », la grande est toujours la fenêtre 1 : passer de « grande
 *  à gauche » à « grande à droite » ou « grande en haut » garde le même graphique en grand. Ailleurs,
 *  les fenêtres sont numérotées dans le sens de la lecture. */

/** Nombre de fenêtres d'un espace de travail. */
export type ChartWorkspacePanelCount = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** La place d'une fenêtre dans la grille, en lignes et colonnes de la grille CSS (à partir de 1). */
export interface ChartWorkspaceGridArea {
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
}

const LAYOUT_SOURCES = [
  { id: "1", label: "", template: ["1"] },

  { id: "2-columns", label: "côte à côte", template: ["12"] },
  { id: "2-rows", label: "l'une au-dessus de l'autre", template: ["1", "2"] },

  { id: "3-columns", label: "côte à côte", template: ["123"] },
  { id: "3-rows", label: "empilées", template: ["1", "2", "3"] },
  { id: "3-big-left", label: "1 à gauche, 2 empilées à droite", template: ["12", "13"] },
  { id: "3-big-right", label: "2 empilées à gauche, 1 à droite", template: ["21", "31"] },
  { id: "3-big-top", label: "1 en haut, 2 en bas", template: ["11", "23"] },
  { id: "3-big-bottom", label: "2 en haut, 1 en bas", template: ["23", "11"] },

  { id: "4-grid", label: "grille de 2 colonnes sur 2 lignes", template: ["12", "34"] },
  { id: "4-columns", label: "côte à côte", template: ["1234"] },
  { id: "4-rows", label: "empilées", template: ["1", "2", "3", "4"] },
  { id: "4-big-left", label: "1 à gauche, 3 empilées à droite", template: ["12", "13", "14"] },
  { id: "4-big-right", label: "3 empilées à gauche, 1 à droite", template: ["21", "31", "41"] },
  { id: "4-big-top", label: "1 en haut, 3 en bas", template: ["111", "234"] },
  { id: "4-big-bottom", label: "3 en haut, 1 en bas", template: ["234", "111"] },
  { id: "4-middle-pair", label: "1 en haut, 2 au milieu, 1 en bas", template: ["11", "23", "44"] },
  { id: "4-pair-stack", label: "2 côte à côte à gauche, 2 empilées à droite", template: ["123", "124"] },

  { id: "5-columns", label: "côte à côte", template: ["12345"] },
  { id: "5-rows", label: "empilées", template: ["1", "2", "3", "4", "5"] },
  { id: "5-big-left", label: "1 à gauche, 4 en grille à droite", template: ["123", "145"] },
  { id: "5-big-right", label: "4 en grille à gauche, 1 à droite", template: ["231", "451"] },
  { id: "5-2-over-3", label: "2 en haut, 3 en bas", template: ["111222", "334455"] },
  { id: "5-3-over-2", label: "3 en haut, 2 en bas", template: ["112233", "444555"] },
  { id: "5-big-top", label: "1 en haut, 4 en bas", template: ["1111", "2345"] },
  { id: "5-big-bottom", label: "4 en haut, 1 en bas", template: ["2345", "1111"] },
  { id: "5-big-left-rows", label: "1 à gauche, 4 empilées à droite", template: ["12", "13", "14", "15"] },

  { id: "6-grid-3x2", label: "grille de 3 colonnes sur 2 lignes", template: ["123", "456"] },
  { id: "6-grid-2x3", label: "grille de 2 colonnes sur 3 lignes", template: ["12", "34", "56"] },
  { id: "6-columns", label: "côte à côte", template: ["123456"] },
  { id: "6-rows", label: "empilées", template: ["1", "2", "3", "4", "5", "6"] },
  { id: "6-big-corner", label: "1 grande en haut à gauche, 5 autour", template: ["112", "113", "456"] },
  { id: "6-big-top", label: "1 en haut, 5 en bas", template: ["11111", "23456"] },

  { id: "7-3-over-4", label: "3 en haut, 4 en bas", template: ["111122223333", "444555666777"] },
  { id: "7-4-over-3", label: "4 en haut, 3 en bas", template: ["111222333444", "555566667777"] },
  { id: "7-big-left", label: "1 à gauche, 6 sur 2 colonnes à droite", template: ["123", "145", "167"] },
  { id: "7-big-right", label: "6 sur 2 colonnes à gauche, 1 à droite", template: ["231", "451", "671"] },
  { id: "7-big-top", label: "1 en haut, 6 en grille en bas", template: ["111", "234", "567"] },

  { id: "8-grid-4x2", label: "grille de 4 colonnes sur 2 lignes", template: ["1234", "5678"] },
  { id: "8-grid-2x4", label: "grille de 2 colonnes sur 4 lignes", template: ["12", "34", "56", "78"] },
  { id: "8-columns", label: "côte à côte", template: ["12345678"] },
  { id: "8-rows", label: "empilées", template: ["1", "2", "3", "4", "5", "6", "7", "8"] },
  { id: "8-big-corner", label: "1 grande en haut à gauche, 7 autour", template: ["1112", "1113", "1114", "5678"] },
] as const;

/** Identifiant d'une disposition, par exemple `"3-big-left"` (1 grande à gauche, 2 empilées à
 *  droite). Voir `CHART_WORKSPACE_GRID_LAYOUTS` pour la liste complète. */
export type ChartWorkspaceGridLayoutId = (typeof LAYOUT_SOURCES)[number]["id"];

/** Une disposition : son nombre de fenêtres, sa grille, et la place de chaque fenêtre, dans l'ordre
 *  des fenêtres (`areas[0]` est la fenêtre 1). `label` la décrit en français, sans le nombre de
 *  fenêtres (vide pour la fenêtre unique) — voir `gridLayoutLabel` pour la phrase complète. */
export interface ChartWorkspaceGridLayout {
  id: ChartWorkspaceGridLayoutId;
  panels: ChartWorkspacePanelCount;
  columns: number;
  rows: number;
  areas: readonly ChartWorkspaceGridArea[];
  label: string;
}

/** Lit le dessin d'une disposition : chaque chiffre délimite un rectangle, de sa première à sa
 *  dernière case. Les dessins de la liste ci-dessus sont tous des rectangles pleins, numérotés de 1
 *  à N sans trou. */
function fromTemplate(source: (typeof LAYOUT_SOURCES)[number]): ChartWorkspaceGridLayout {
  const template: readonly string[] = source.template;
  const bounds = new Map<number, { top: number; left: number; bottom: number; right: number }>();
  template.forEach((line, r) => {
    Array.from(line).forEach((cell, c) => {
      const panel = Number(cell);
      const box = bounds.get(panel);
      if (box === undefined) {
        bounds.set(panel, { top: r, left: c, bottom: r, right: c });
      } else {
        box.top = Math.min(box.top, r);
        box.left = Math.min(box.left, c);
        box.bottom = Math.max(box.bottom, r);
        box.right = Math.max(box.right, c);
      }
    });
  });
  const areas = Array.from({ length: bounds.size }, (_, i) => {
    const box = bounds.get(i + 1)!;
    return { row: box.top + 1, column: box.left + 1, rowSpan: box.bottom - box.top + 1, columnSpan: box.right - box.left + 1 };
  });
  return {
    id: source.id,
    panels: bounds.size as ChartWorkspacePanelCount,
    columns: template[0].length,
    rows: template.length,
    areas,
    label: source.label,
  };
}

/** Toutes les dispositions proposées, groupées par nombre de fenêtres croissant. */
export const CHART_WORKSPACE_GRID_LAYOUTS: readonly ChartWorkspaceGridLayout[] = LAYOUT_SOURCES.map(fromTemplate);

/** La disposition prise pour un nombre de fenêtres donné sans disposition précise (`defaultPanels`,
 *  ou un identifiant inconnu). Pour 1, 2, 4, 6 et 8 fenêtres, c'est la grille que l'espace de
 *  travail montrait avant que les dispositions existent : une rangée pour 1 et 2, deux rangées de
 *  2, 3 ou 4 colonnes pour 4, 6 et 8. */
export const DEFAULT_GRID_LAYOUT_BY_PANELS: Record<ChartWorkspacePanelCount, ChartWorkspaceGridLayoutId> = {
  1: "1",
  2: "2-columns",
  3: "3-columns",
  4: "4-grid",
  5: "5-2-over-3",
  6: "6-grid-3x2",
  7: "7-3-over-4",
  8: "8-grid-4x2",
};

/** Les dispositions rangées par nombre de fenêtres, une entrée par ligne du menu. */
export const GRID_LAYOUTS_BY_PANELS: readonly { panels: ChartWorkspacePanelCount; layouts: readonly ChartWorkspaceGridLayout[] }[] = (
  [1, 2, 3, 4, 5, 6, 7, 8] as const
).map((panels) => ({ panels, layouts: CHART_WORKSPACE_GRID_LAYOUTS.filter((layout) => layout.panels === panels) }));

/** La disposition de cet identifiant, ou `undefined` s'il n'en désigne aucune. */
export function findGridLayout(id: string | undefined): ChartWorkspaceGridLayout | undefined {
  return id === undefined ? undefined : CHART_WORKSPACE_GRID_LAYOUTS.find((layout) => layout.id === id);
}

/** La disposition à afficher : celle de `id` s'il en désigne une, sinon celle par défaut pour
 *  `fallbackPanels` (une seule fenêtre si ce nombre n'est pas proposé non plus). Un identifiant
 *  enregistré par une version plus ancienne, ou mal recopié, retombe ainsi sur une grille valable
 *  au lieu de casser l'espace de travail. */
export function resolveGridLayout(id: string | undefined, fallbackPanels: number | undefined): ChartWorkspaceGridLayout {
  const found = findGridLayout(id);
  if (found !== undefined) return found;
  const fallbackId = DEFAULT_GRID_LAYOUT_BY_PANELS[fallbackPanels as ChartWorkspacePanelCount] ?? DEFAULT_GRID_LAYOUT_BY_PANELS[1];
  return findGridLayout(fallbackId)!;
}

/** La phrase qui nomme une disposition, pour un aria-label ou une infobulle :
 *  « 3 fenêtres : 1 à gauche, 2 empilées à droite ». */
export function gridLayoutLabel(layout: ChartWorkspaceGridLayout): string {
  const count = layout.panels === 1 ? "1 fenêtre" : `${layout.panels} fenêtres`;
  return layout.label === "" ? count : `${count} : ${layout.label}`;
}

/** La valeur CSS `grid-area` d'une place : `ligne / colonne / span portée / span portée`. */
export function gridAreaValue(area: ChartWorkspaceGridArea): string {
  return `${area.row} / ${area.column} / span ${area.rowSpan} / span ${area.columnSpan}`;
}
