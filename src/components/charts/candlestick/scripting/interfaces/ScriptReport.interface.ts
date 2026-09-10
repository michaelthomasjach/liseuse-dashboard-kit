/** One block of a generated report. Deliberately a short list: a report is prose, figures and
 *  tables, and every extra shape is one more thing the PDF, the panel and the model all have to
 *  agree on. Anything richer belongs in the text. */
export type ScriptReportBlock =
  | { kind: "heading"; text: string; level?: 2 | 3 }
  | { kind: "text"; text: string }
  /** A grid of headline figures — what a reader looks at before reading anything. */
  | { kind: "metrics"; metrics: { label: string; value: string; note?: string; tone?: "up" | "down" | "neutral" }[] }
  | { kind: "table"; title?: string; columns: string[]; rows: (string | number | null)[][] }
  /** A short series drawn as a sparkline — revenue over eight years, say. Not a full chart: a
   *  report is read, and a reader who wants to interrogate a series has the chart itself. */
  | { kind: "series"; title: string; labels: string[]; values: (number | null)[]; unit?: string }
  /** A verdict, set apart: the one place a report is allowed to conclude rather than report. */
  | { kind: "callout"; tone: "positive" | "negative" | "neutral"; title: string; text: string };

export interface ScriptReport {
  title: string;
  subtitle?: string;
  /** The symbol this report is about, as the script named it. */
  symbol?: string;
  /** When it was produced, epoch ms. */
  generatedAt: number;
  blocks: ScriptReportBlock[];
}
