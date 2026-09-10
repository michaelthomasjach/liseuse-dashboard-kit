import type { ScriptReport, ScriptReportBlock } from "../interfaces/ScriptReport.interface";

/** Caps. A report is a document a person reads, not a data dump: past these the output stops being
 *  a report and starts being a way to hang the browser that renders it. */
const MAX_BLOCKS = 200;
const MAX_TABLE_ROWS = 400;
const MAX_SERIES_POINTS = 400;
const MAX_TEXT = 20000;

export interface ReportApi {
  /** Names the report. Called more than once, the last one wins — a script that computes its own
   *  title from the data it just read should not have to know the title first. */
  title(title: string, options?: { subtitle?: string; symbol?: string }): void;
  heading(text: string, options?: { level?: 2 | 3 }): void;
  text(text: string): void;
  metrics(metrics: { label: string; value: string; note?: string; tone?: "up" | "down" | "neutral" }[]): void;
  table(columns: string[], rows: (string | number | null)[][], options?: { title?: string }): void;
  series(title: string, labels: string[], values: (number | null)[], options?: { unit?: string }): void;
  callout(tone: "positive" | "negative" | "neutral", title: string, text: string): void;
}

/** `report.*` — what a `@report` script writes into.
 *
 *  A report script produces a *document*, not a drawing: it has no pane and no overlay, exactly
 *  like a `@quant` analysis, and for the same reason — what it makes is read, printed and kept,
 *  not laid over candles. Blocks accumulate in the order they are written, which is the order they
 *  are read, so the script's own shape is the document's shape.
 *
 *  Every method is total: a bad argument is coerced or dropped rather than thrown, because a
 *  report that dies on its ninth section has wasted everything before it. */
export function buildReportApi(): { api: ReportApi; getResult: () => ScriptReport | null } {
  const blocks: ScriptReportBlock[] = [];
  let title: string | null = null;
  let subtitle: string | undefined;
  let symbol: string | undefined;

  const push = (block: ScriptReportBlock) => {
    if (blocks.length < MAX_BLOCKS) blocks.push(block);
  };
  const asText = (value: unknown) => String(value ?? "").slice(0, MAX_TEXT);

  const api: ReportApi = {
    title: (value, options) => {
      title = asText(value);
      if (options?.subtitle !== undefined) subtitle = asText(options.subtitle);
      if (options?.symbol !== undefined) symbol = asText(options.symbol);
    },
    heading: (text, options) => push({ kind: "heading", text: asText(text), level: options?.level === 3 ? 3 : 2 }),
    text: (text) => push({ kind: "text", text: asText(text) }),
    metrics: (metrics) =>
      push({
        kind: "metrics",
        metrics: (Array.isArray(metrics) ? metrics : []).slice(0, 24).map((metric) => ({
          label: asText(metric?.label),
          value: asText(metric?.value),
          note: metric?.note === undefined ? undefined : asText(metric.note),
          tone: metric?.tone === "up" || metric?.tone === "down" ? metric.tone : "neutral",
        })),
      }),
    table: (columns, rows, options) =>
      push({
        kind: "table",
        title: options?.title === undefined ? undefined : asText(options.title),
        columns: (Array.isArray(columns) ? columns : []).map(asText),
        rows: (Array.isArray(rows) ? rows : [])
          .slice(0, MAX_TABLE_ROWS)
          .map((row) => (Array.isArray(row) ? row.map((cell) => (typeof cell === "number" ? cell : cell === null ? null : asText(cell))) : [])),
      }),
    series: (name, labels, values, options) =>
      push({
        kind: "series",
        title: asText(name),
        labels: (Array.isArray(labels) ? labels : []).slice(0, MAX_SERIES_POINTS).map(asText),
        values: (Array.isArray(values) ? values : [])
          .slice(0, MAX_SERIES_POINTS)
          .map((value) => (typeof value === "number" && Number.isFinite(value) ? value : null)),
        unit: options?.unit === undefined ? undefined : asText(options.unit),
      }),
    callout: (tone, name, text) =>
      push({
        kind: "callout",
        tone: tone === "positive" || tone === "negative" ? tone : "neutral",
        title: asText(name),
        text: asText(text),
      }),
  };

  return {
    api,
    // A script that wrote nothing at all produced no report — distinct from one that produced an
    // empty one, and the difference is what lets the panel say "rien à afficher" honestly.
    getResult: () => (title === null && blocks.length === 0 ? null : { title: title ?? "Rapport", subtitle, symbol, generatedAt: Date.now(), blocks }),
  };
}
