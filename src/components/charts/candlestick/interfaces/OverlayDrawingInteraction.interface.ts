/** Makes one of the app-owned `overlayDrawings` grabbable: dragged vertically (a level moved to another price — a
 *  horizontal line, or a rectangle shifted as a whole, its height kept) and/or deleted from a small bubble shown
 *  when it is clicked. The chart never changes the drawing itself: it reports the move or the delete and the app
 *  updates its own `overlayDrawings`, which stay the single source of truth. */
export interface OverlayDrawingInteraction {
  /** The `id` of the overlay drawing (a `lineType: "horizontal"` line or a `"rectangle"`). */
  id: string;
  /** Title of the selection bubble (defaults to the drawing's own text). */
  label?: string;
  /** Called once on drop with the vertical shift, in price units (new price = old price + delta). Omit to keep
   *  the drawing fixed. */
  onMove?: (deltaPrice: number) => void;
  /** Shows « Supprimer » in the selection bubble (and the Delete key while selected). */
  onDelete?: () => void;
}
