/** "table" only: a live inline edit for one specific cell of an already-placed table, not a
 *  brand-new drawing in progress the way TextEntryState is (see useDrawingState's own
 *  `editingCell`/`commitCellEntry`/`cancelCellEntry`) — `drawingId`/`cellIndex` identify which
 *  cell of which existing `drawings` entry to write `value` into on commit. Unlike a text/comment
 *  entry, an empty value still commits (clearing the cell) rather than discarding anything, since
 *  there's no whole drawing here to cancel creating. */
export interface EditingCellState {
  drawingId: string;
  cellIndex: number;
  value: string;
}
