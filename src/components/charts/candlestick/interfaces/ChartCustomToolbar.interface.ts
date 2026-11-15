/** Une barre d'outils personnalisée du graphique (clic droit → « Ajouter une toolbar personnalisée »).
 *
 *  Fermée par sa croix, elle reste enregistrée (`visible: false`) : on la rouvre depuis le sous-menu
 *  « Toolbars personnalisées » du clic droit. */
export interface ChartCustomToolbar {
  /** Identifiant stable. */
  id: string;
  /** Nom affiché sur la barre (et son nom accessible). */
  name: string;
  /** Les outils, dans l'ordre de la barre. Identifiants du catalogue : `draw:<outil de dessin>`
   *  (`draw:trendline`, `draw:fibonacci`, `draw:measure`…), `tf:<valeur de l'unité de temps>`,
   *  `ind:<type d'indicateur>` (`ind:rsi`…), et les actions `action:magnet`, `action:hideDrawings`,
   *  `action:lockDrawings`, `action:zoomIn`, `action:resetZoom`, `action:captureCopy`,
   *  `action:captureDownload`, `action:replay`, `action:indicators`, `action:drawingsManager`,
   *  `action:marketState`, `action:settings`, `action:fullscreen`. Un identifiant inconnu (unité de temps
   *  qui n'est plus proposée…) est gardé mais n'est pas affiché. */
  tools: string[];
  /** Affichée (true) ou fermée par sa croix (false). */
  visible: boolean;
  /** Bord du tracé auquel elle est aimantée : horizontale en haut et en bas, verticale à gauche et à
   *  droite ; null ou absent : elle flotte librement. */
  dock?: "top" | "bottom" | "left" | "right" | null;
  /** Position en pixels dans le graphique (le long du bord quand elle est aimantée). */
  x?: number;
  y?: number;
}
