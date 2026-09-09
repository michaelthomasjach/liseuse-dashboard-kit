import { useMemo, useState, type ReactNode } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "../icons";
import "./PeriodTable.css";

/* A table of figures across periods: statements, segments, key statistics — hierarchical rows that
 * fold, a pinned label column, and a decade of period columns scrolling behind it.
 *
 * Named `PeriodTable`, not `DataTable`, and that is not cosmetic: `components/finance` already
 * exports a `DataTable` (a flat, sortable table of holdings and orders — a different component
 * that happened to share the name). `src/index.ts` re-exports both modules with `export *`, and a
 * name provided by two of those is silently *excluded* from the public surface rather than
 * flagged — so exporting this one under the old name would have quietly removed `DataTable` from
 * the package altogether, including the one that works today. The two also shared a CSS namespace
 * until recently, with real consequences (see PeriodTable.css). One name, one component. */

/** One column. The first column is normally the row label's own — pass `sticky` so it stays put
 *  while a decade of year columns scrolls past it. */
export interface PeriodTableColumn {
  key: string;
  label: ReactNode;
  /** A second, quieter line under the label — "Mar 2024" under "2024". */
  sublabel?: ReactNode;
  /** Numbers read right-aligned; text reads left. Default "right", since that is what most of a
   *  financial table is. */
  align?: "left" | "right";
  /** Pins the column against the left edge, over the scrolling ones. */
  sticky?: boolean;
  /** Fixed width in px. Sticky columns need one; the rest size to their content. */
  width?: number;
}

/** One cell. A bare string or number is accepted too — see `PeriodTableRow.cells`. */
export interface PeriodTableCell {
  value: ReactNode;
  /** A smaller line under the value, for the year-on-year change a statement carries under each
   *  figure. */
  note?: ReactNode;
  /** Colours both value and note: profit, loss, or a value that is present but unremarkable. */
  tone?: "up" | "down" | "muted";
}

export interface PeriodTableRow {
  key: string;
  label: ReactNode;
  /** Rows nested under this one, collapsed with it. Any depth. */
  children?: PeriodTableRow[];
  /** A colour chip before the label, tying the row to its own series in a chart above. */
  accent?: string;
  /** Draws the row as a total rather than a line item: filled, heavier. */
  emphasis?: boolean;
  /** `null`, `undefined` or a missing key all render as an em dash — "we have no figure here" is
   *  a real answer and should look the same however it arrives. */
  cells: Record<string, PeriodTableCell | ReactNode | null | undefined>;
}

export interface PeriodTableProps {
  columns: PeriodTableColumn[];
  rows: PeriodTableRow[];
  /** How deep to start expanded. 0 shows only top-level rows; `Infinity` opens everything.
   *  Default `Infinity` — a table whose totals are all you can see hides the numbers. */
  defaultExpandedDepth?: number;
  /** Accessible name for the table. */
  caption?: string;
  className?: string;
}

function isCell(value: PeriodTableCell | ReactNode | null | undefined): value is PeriodTableCell {
  // A React element is an object too, so the `value` key is what tells a described cell from a
  // node passed straight in. Cast through `unknown`: the two types genuinely do not overlap, which
  // is exactly why this guard exists.
  return typeof value === "object" && value !== null && "value" in (value as unknown as Record<string, unknown>);
}

/** Rows flattened to what is currently visible, each carrying its own depth. Collapsing a parent
 *  drops its whole subtree, not just its immediate children. */
function visibleRows(rows: PeriodTableRow[], expanded: Set<string>, depth = 0): { row: PeriodTableRow; depth: number }[] {
  const out: { row: PeriodTableRow; depth: number }[] = [];
  for (const row of rows) {
    out.push({ row, depth });
    if (row.children && row.children.length > 0 && expanded.has(row.key)) {
      out.push(...visibleRows(row.children, expanded, depth + 1));
    }
  }
  return out;
}

function keysToDepth(rows: PeriodTableRow[], maxDepth: number, depth = 0): string[] {
  if (depth >= maxDepth) return [];
  return rows.flatMap((row) => (row.children?.length ? [row.key, ...keysToDepth(row.children, maxDepth, depth + 1)] : []));
}

/** A table for figures across periods: a pinned label column, as many scrolling period columns as
 *  the data has, rows that nest and collapse, and cells that can carry a change underneath.
 *
 *  Built as one component rather than one per statement because every financial view in this
 *  library wants the same table with different rows — an income statement's nesting, a statistics
 *  page's flat groups, a segment breakdown's colour-coded series, an earnings table's
 *  reported/estimate/surprise. Splitting them would have produced four tables that drifted apart
 *  in exactly the details that make a table readable: alignment, sticky behaviour, how a missing
 *  figure looks.
 *
 *  The label column is pinned with `position: sticky` rather than rendered as a second table
 *  beside a scrolling one. Two tables cannot keep their row heights in step without measuring
 *  each other every render, and a row whose label sits a pixel off from its own figures is worse
 *  than no pinning at all. */
export function PeriodTable({ columns, rows, defaultExpandedDepth = Infinity, caption, className }: PeriodTableProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const expandableByDefault = useMemo(
    () => new Set(keysToDepth(rows, defaultExpandedDepth === Infinity ? Number.MAX_SAFE_INTEGER : defaultExpandedDepth)),
    [rows, defaultExpandedDepth]
  );
  // Tracked as "which of the default-open rows has been shut" rather than as the open set, so a
  // table whose rows change (a different statement, another period) keeps sensible defaults for
  // rows it has never seen instead of rendering them all shut.
  const expanded = useMemo(() => {
    const set = new Set(expandableByDefault);
    for (const key of collapsed) set.delete(key);
    return set;
  }, [expandableByDefault, collapsed]);

  const visible = useMemo(() => visibleRows(rows, expanded), [rows, expanded]);

  function toggle(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className={["lq-table", className].filter(Boolean).join(" ")}>
      <table>
        {caption && <caption className="lq-visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={[
                  "lq-table__head",
                  column.sticky && "lq-table__cell--sticky",
                  `lq-table__cell--${column.align ?? "right"}`,
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={column.width === undefined ? undefined : { width: column.width, minWidth: column.width }}
              >
                <span className="lq-table__head-label">{column.label}</span>
                {column.sublabel !== undefined && <span className="lq-table__head-sublabel">{column.sublabel}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map(({ row, depth }) => {
            const hasChildren = (row.children?.length ?? 0) > 0;
            const isOpen = expanded.has(row.key);
            return (
              <tr
                key={row.key}
                // Depth on the row, not just as left padding on its first cell: indentation alone
                // stops carrying the hierarchy the moment a table is more than two levels deep or
                // its labels are long, and the *figures* give no clue at all. The stylesheet reads
                // this to step the whole row down a size per level — see `.lq-table__row[data-depth]`.
                data-depth={Math.min(depth, 3)}
                className={[
                  "lq-table__row",
                  row.emphasis && "lq-table__row--emphasis",
                  hasChildren && "lq-table__row--parent",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {columns.map((column, index) => {
                  const raw = row.cells[column.key];
                  const cell = isCell(raw) ? raw : { value: raw as ReactNode };
                  const missing = cell.value === null || cell.value === undefined || cell.value === "";
                  const className = [
                    "lq-table__cell",
                    column.sticky && "lq-table__cell--sticky",
                    `lq-table__cell--${column.align ?? "right"}`,
                    cell.tone && `lq-table__cell--${cell.tone}`,
                  ]
                    .filter(Boolean)
                    .join(" ");

                  // The first column carries the row's own identity: its indent, its disclosure
                  // triangle and its colour chip, none of which belong to a figure.
                  if (index === 0) {
                    return (
                      <th key={column.key} scope="row" className={className} style={{ paddingLeft: 10 + depth * 16 }}>
                        {hasChildren ? (
                          <button
                            type="button"
                            className="lq-table__disclosure"
                            onClick={() => toggle(row.key)}
                            aria-expanded={isOpen}
                            aria-label={isOpen ? `Replier ${String(row.label)}` : `Déplier ${String(row.label)}`}
                          >
                            {isOpen ? <ChevronDownIcon size={11} /> : <ChevronRightIcon size={11} />}
                          </button>
                        ) : (
                          // Keeps every label on the same left edge whether or not it has a
                          // triangle, so a column of names does not zig-zag.
                          <span className="lq-table__disclosure lq-table__disclosure--empty" aria-hidden="true" />
                        )}
                        {row.accent !== undefined && (
                          <span className="lq-table__accent" style={{ backgroundColor: row.accent }} aria-hidden="true" />
                        )}
                        <span className="lq-table__label">{row.label}</span>
                      </th>
                    );
                  }

                  return (
                    <td key={column.key} className={className}>
                      {missing ? (
                        <span className="lq-table__missing" aria-label="Donnée indisponible">
                          —
                        </span>
                      ) : (
                        <>
                          <span className="lq-table__value">{cell.value}</span>
                          {cell.note !== undefined && <span className="lq-table__note">{cell.note}</span>}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
