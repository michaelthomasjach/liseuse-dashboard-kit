import { Sparkline } from "../../../Sparkline";
import type { ScriptReport } from "../interfaces/ScriptReport.interface";
import "./ReportView.css";

export interface ReportViewProps {
  report: ScriptReport;
  /** Rendered without the panel chrome — what the print window mounts. */
  print?: boolean;
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" });

/** A `@report` script's own document.
 *
 *  One component for both the panel and the printed page: the print window mounts this same tree,
 *  so what is exported is what was read, rather than a second renderer that could drift from it.
 *  Everything it needs to look right on paper lives in `ReportView.css`'s own `@media print`. */
export function ReportView({ report, print = false }: ReportViewProps) {
  return (
    <article className={["lq-report", print && "lq-report--print"].filter(Boolean).join(" ")}>
      <header className="lq-report__header">
        <h1 className="lq-report__title">{report.title}</h1>
        {report.subtitle && <p className="lq-report__subtitle">{report.subtitle}</p>}
        <p className="lq-report__meta">
          {report.symbol ? `${report.symbol} · ` : ""}
          {dateFormat.format(new Date(report.generatedAt))}
        </p>
      </header>

      {report.blocks.map((block, i) => {
        if (block.kind === "heading") {
          return block.level === 3 ? (
            <h3 key={i} className="lq-report__h3">
              {block.text}
            </h3>
          ) : (
            <h2 key={i} className="lq-report__h2">
              {block.text}
            </h2>
          );
        }
        if (block.kind === "text") {
          return (
            <p key={i} className="lq-report__text">
              {block.text}
            </p>
          );
        }
        if (block.kind === "metrics") {
          return (
            <div key={i} className="lq-report__metrics">
              {block.metrics.map((metric, j) => (
                <div key={j} className="lq-report__metric">
                  <span className="lq-report__metric-label">{metric.label}</span>
                  <span className={`lq-report__metric-value lq-report__metric-value--${metric.tone ?? "neutral"}`}>{metric.value}</span>
                  {metric.note && <span className="lq-report__metric-note">{metric.note}</span>}
                </div>
              ))}
            </div>
          );
        }
        if (block.kind === "table") {
          return (
            <section key={i} className="lq-report__table-block">
              {block.title && <h4 className="lq-report__table-title">{block.title}</h4>}
              {/* Its own scroller on screen; on paper the rule is `overflow: visible` so nothing is
                  cut off at the page edge — see the print block in the stylesheet. */}
              <div className="lq-report__table-wrap">
                <table className="lq-report__table">
                  <thead>
                    <tr>
                      {block.columns.map((column, j) => (
                        <th key={j}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, j) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td key={k}>{cell === null ? "—" : String(cell)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        }
        if (block.kind === "series") {
          const values = block.values.map((v) => v ?? 0);
          const last = block.values[block.values.length - 1];
          return (
            <section key={i} className="lq-report__series">
              <div className="lq-report__series-head">
                <h4 className="lq-report__table-title">{block.title}</h4>
                {last !== null && last !== undefined && (
                  <span className="lq-report__series-last">
                    {last.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                    {block.unit ? ` ${block.unit}` : ""}
                  </span>
                )}
              </div>
              <Sparkline data={values} width={520} height={72} area colorByTrend className="lq-report__sparkline" />
              <div className="lq-report__series-labels">
                {block.labels.map((label, j) => (
                  <span key={j}>{label}</span>
                ))}
              </div>
            </section>
          );
        }
        return (
          <aside key={i} className={`lq-report__callout lq-report__callout--${block.tone}`}>
            <strong className="lq-report__callout-title">{block.title}</strong>
            <p className="lq-report__callout-text">{block.text}</p>
          </aside>
        );
      })}
    </article>
  );
}
