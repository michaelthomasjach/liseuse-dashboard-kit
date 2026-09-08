import { useMemo, useState } from "react";
import { DataTable, type DataTableColumn, type DataTableRow } from "../../primitives/DataTable";
import type { FinancialFact, FinancialRow, FinancialShare, FinancialTable, SymbolFinancials } from "./SymbolFinancials.interface";
import "./SymbolFinancialsView.css";

export interface SymbolFinancialsViewProps {
  financials: SymbolFinancials;
}

type TabId = "overview" | "statements" | "statistics" | "dividends" | "earnings" | "segments";

const TAB_LABELS: Record<TabId, string> = {
  overview: "Vue d'ensemble",
  statements: "États financiers",
  statistics: "Statistiques",
  dividends: "Dividendes",
  earnings: "Résultats",
  segments: "Segments",
};

/** The change from the period before, as the note that sits under a figure. Returns nothing where
 *  a percentage would be meaningless — no previous figure, a previous zero, or a sign flip, where
 *  "−480 %" says less than leaving it blank. */
function growthNote(current: number | null | undefined, previous: number | null | undefined) {
  if (current === null || current === undefined || previous === null || previous === undefined) return undefined;
  if (previous === 0 || Math.sign(previous) !== Math.sign(current)) return undefined;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return { note: `${pct >= 0 ? "+" : ""}${pct.toFixed(2)} %`, tone: pct >= 0 ? ("up" as const) : ("down" as const) };
}

/** A row's own figure for a period: the app's own wording when it gave one, the raw number
 *  otherwise, and nothing at all when it has neither. */
function figure(row: FinancialRow, periodKey: string): { text: string | null; value: number | null } {
  const display = row.display?.[periodKey];
  const value = row.values?.[periodKey] ?? null;
  if (display !== undefined && display !== null) return { text: display, value };
  if (value === null) return { text: null, value: null };
  return { text: String(value), value };
}

function toDataRows(rows: FinancialRow[], table: FinancialTable): DataTableRow[] {
  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    accent: row.accent,
    emphasis: row.emphasis,
    children: row.children ? toDataRows(row.children, table) : undefined,
    cells: Object.fromEntries(
      table.periods.map((period, index) => {
        const { text, value } = figure(row, period.key);
        if (text === null) return [period.key, null];
        const previous = index === 0 ? undefined : figure(row, table.periods[index - 1].key).value;
        return [period.key, { value: text, ...(table.showGrowth ? growthNote(value, previous) : {}) }];
      })
    ),
  }));
}

function FinancialDataTable({ table }: { table: FinancialTable }) {
  const columns = useMemo<DataTableColumn[]>(
    () => [
      { key: "__label", label: table.title ?? "", sticky: true, align: "left", width: 260 },
      ...table.periods.map((p) => ({ key: p.key, label: p.label, sublabel: p.sublabel })),
    ],
    [table]
  );
  const rows = useMemo(() => toDataRows(table.rows, table), [table]);
  return <DataTable caption={table.title} columns={columns} rows={rows} defaultExpandedDepth={table.defaultExpandedDepth} />;
}

function FactGrid({ facts }: { facts: FinancialFact[] }) {
  return (
    <div className="lq-financials__facts">
      {facts.map((fact) => (
        <div key={fact.label} className="lq-financials__fact">
          <span className="lq-financials__fact-label">{fact.label}</span>
          <span className="lq-financials__fact-value">
            {fact.href ? (
              <a href={fact.href} target="_blank" rel="noreferrer">
                {fact.value}
              </a>
            ) : (
              fact.value
            )}
            {fact.unit !== undefined && <span className="lq-financials__fact-unit">{fact.unit}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Proportions as one stacked bar with a legend beside it. A bar rather than a ring: two or three
 *  shares are compared by length, which a bar makes directly readable and a ring turns into an
 *  angle-estimation exercise. */
function ShareBar({ title, shares }: { title?: string; shares: FinancialShare[] }) {
  const total = shares.reduce((sum, s) => sum + Math.abs(s.value), 0);
  return (
    <div className="lq-financials__shares">
      {title !== undefined && <h4 className="lq-financials__subtitle">{title}</h4>}
      <div className="lq-financials__share-bar">
        {total > 0 &&
          shares.map((share) => (
            <span
              key={share.label}
              className="lq-financials__share-slice"
              style={{ width: `${(Math.abs(share.value) / total) * 100}%`, backgroundColor: share.color }}
              title={`${share.label} — ${share.display ?? share.value}`}
            />
          ))}
      </div>
      <ul className="lq-financials__share-legend">
        {shares.map((share) => (
          <li key={share.label}>
            <span className="lq-financials__share-chip" style={{ backgroundColor: share.color }} aria-hidden="true" />
            <span className="lq-financials__share-label">{share.label}</span>
            <span className="lq-financials__share-value">{share.display ?? share.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function About({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  // Clamped rather than truncated in JS: a clamp reflows with the panel's own width, where a
  // character count would cut at a different place every time the modal is resized.
  return (
    <div className="lq-financials__about">
      <p className={expanded ? undefined : "lq-financials__about-text--clamped"}>{text}</p>
      <button type="button" className="lq-financials__more" onClick={() => setExpanded((v) => !v)}>
        {expanded ? "Réduire" : "Afficher plus"}
      </button>
    </div>
  );
}

/** A switch between several tables — the income statement / balance sheet / cash flow trio, and
 *  whatever else a caller groups the same way. Rendered only when there is more than one. */
function TableSwitcher({ tables }: { tables: FinancialTable[] }) {
  const [activeId, setActiveId] = useState(tables[0]?.id);
  const active = tables.find((t) => t.id === activeId) ?? tables[0];
  if (active === undefined) return null;
  return (
    <>
      {tables.length > 1 && (
        <div className="lq-financials__switch">
          {tables.map((table) => (
            <button
              key={table.id}
              type="button"
              className={["lq-financials__switch-option", table.id === active.id && "lq-financials__switch-option--active"]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setActiveId(table.id)}
            >
              {table.title ?? table.id}
            </button>
          ))}
        </div>
      )}
      <FinancialDataTable table={active} />
    </>
  );
}

/** The financial detail of one symbol, in tabs.
 *
 *  Every section is optional and its tab simply does not appear when the application supplied no
 *  data for it — this library owns no data source, the same stance `data` and `events` already
 *  take, so a caller with only an income statement gets one tab rather than five empty ones. */
export function SymbolFinancialsView({ financials }: SymbolFinancialsViewProps) {
  const tabs = useMemo(() => {
    const present: TabId[] = [];
    if (financials.overview) present.push("overview");
    if (financials.statements?.length) present.push("statements");
    if (financials.statistics?.length) present.push("statistics");
    if (financials.dividends) present.push("dividends");
    if (financials.earnings) present.push("earnings");
    if (financials.segments?.length) present.push("segments");
    return present;
  }, [financials]);

  const [active, setActive] = useState<TabId | undefined>(tabs[0]);
  const current = active !== undefined && tabs.includes(active) ? active : tabs[0];

  if (tabs.length === 0) {
    return <p className="lq-financials__empty">Aucune donnée financière fournie pour ce symbole.</p>;
  }

  return (
    <div className="lq-financials">
      <nav className="lq-financials__tabs" aria-label="Sections financières">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={["lq-financials__tab", tab === current && "lq-financials__tab--active"].filter(Boolean).join(" ")}
            onClick={() => setActive(tab)}
            aria-pressed={tab === current}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>

      <div className="lq-financials__body">
        {current === "overview" && financials.overview && (
          <>
            {financials.overview.keyFacts && <FactGrid facts={financials.overview.keyFacts} />}
            {financials.overview.about && <About text={financials.overview.about} />}
            <div className="lq-financials__columns">
              {financials.overview.ownership && <ShareBar {...financials.overview.ownership} />}
              {financials.overview.capitalStructure && <ShareBar {...financials.overview.capitalStructure} />}
            </div>
          </>
        )}

        {current === "statements" && financials.statements && <TableSwitcher tables={financials.statements} />}

        {current === "statistics" &&
          financials.statistics?.map((table) => (
            <section key={table.id} className="lq-financials__section">
              {table.title && <h4 className="lq-financials__subtitle">{table.title}</h4>}
              <FinancialDataTable table={table} />
            </section>
          ))}

        {current === "dividends" && financials.dividends && (
          <>
            {financials.dividends.facts && <FactGrid facts={financials.dividends.facts} />}
            {financials.dividends.emptyMessage !== undefined && !financials.dividends.tables?.length ? (
              <p className="lq-financials__empty">{financials.dividends.emptyMessage}</p>
            ) : (
              financials.dividends.tables?.map((table) => (
                <section key={table.id} className="lq-financials__section">
                  {table.title && <h4 className="lq-financials__subtitle">{table.title}</h4>}
                  <FinancialDataTable table={table} />
                </section>
              ))
            )}
          </>
        )}

        {current === "earnings" && financials.earnings && (
          <>
            {financials.earnings.facts && <FactGrid facts={financials.earnings.facts} />}
            {financials.earnings.tables?.map((table) => (
              <section key={table.id} className="lq-financials__section">
                {table.title && <h4 className="lq-financials__subtitle">{table.title}</h4>}
                <FinancialDataTable table={table} />
              </section>
            ))}
          </>
        )}

        {current === "segments" &&
          financials.segments?.map((table) => (
            <section key={table.id} className="lq-financials__section">
              {table.title && <h4 className="lq-financials__subtitle">{table.title}</h4>}
              <FinancialDataTable table={table} />
            </section>
          ))}
      </div>
    </div>
  );
}
