import type { ScriptTableOutput } from "../scripting/interfaces/ScriptRunResult.interface";

export interface ScriptTableOverlayProps {
  tables: ScriptTableOutput[];
}

const POSITIONS: NonNullable<ScriptTableOutput["position"]>[] = ["topLeft", "topRight", "bottomLeft", "bottomRight"];

/** Renders every active script's own `plot.table(...)` output (see that function's own doc) as a
 *  small floating box anchored to a corner of the price pane — a plain DOM overlay, not SVG/canvas
 *  (unlike `ChartPlotOverlays`' own drawings), since a table needs real text layout. Positioned via
 *  plain CSS corner offsets rather than `ChartLegend`'s own `dims.margin`-derived inline style: a
 *  script-authored table doesn't need to line up exactly with the price axis the way that header
 *  does, and staying `dims`-free is what lets `ScriptInteractiveTutorial.tsx` mount this same
 *  component over its own preview chart without needing that chart's internal measurements (see
 *  that component's own doc on why it can't go through `CandlestickChart`'s public `scripts` prop
 *  at all). `pointer-events: none` throughout — purely informational, nothing here is interactive. */
export function ScriptTableOverlay({ tables }: ScriptTableOverlayProps) {
  if (tables.length === 0) return null;
  return (
    <>
      {POSITIONS.map((position) => {
        const atPosition = tables.filter((t) => (t.position ?? "topRight") === position);
        if (atPosition.length === 0) return null;
        return (
          <div key={position} className={`lq-chart__script-table-corner lq-chart__script-table-corner--${position}`}>
            {atPosition.map((table, i) => (
              <div key={i} className="lq-chart__script-table">
                {table.title && <div className="lq-chart__script-table-title">{table.title}</div>}
                <div className="lq-chart__script-table-grid">
                  {table.columns && table.columns.length > 0 && (
                    <div className="lq-chart__script-table-row lq-chart__script-table-row--header">
                      {table.columns.map((col, j) => (
                        <span key={j} className="lq-chart__script-table-cell">
                          {col}
                        </span>
                      ))}
                    </div>
                  )}
                  {table.rows.map((row, r) => (
                    <div key={r} className="lq-chart__script-table-row" style={row.color ? { color: row.color } : undefined}>
                      {row.cells.map((cell, c) => (
                        <span key={c} className="lq-chart__script-table-cell">
                          {cell}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
