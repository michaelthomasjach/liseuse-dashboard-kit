import type { Meta, StoryObj } from "@storybook/react";
import { DataTable, type DataTableColumn, type DataTableRow } from "./DataTable";

const meta: Meta<typeof DataTable> = {
  title: "Primitives/DataTable",
  component: DataTable,
  parameters: {
    docs: {
      description: {
        component:
          "Un tableau de chiffres par période : colonne d'intitulés épinglée, autant de colonnes de périodes que la donnée en contient, lignes qui s'imbriquent et se replient, et cellules qui peuvent porter une variation en dessous. Les quatre histoires ci-dessous sont les quatre formes qu'en prend une page « Financials » — c'est pour ça qu'il n'y a qu'un composant et non quatre.",
      },
    },
  },
};
export default meta;

/** Year columns, oldest first, the way a statement reads. */
function yearColumns(from: number, to: number, extra?: { key: string; label: string }[]): DataTableColumn[] {
  const years: DataTableColumn[] = [{ key: "label", label: "", sticky: true, align: "left", width: 260 }];
  for (let y = from; y <= to; y++) years.push({ key: String(y), label: String(y), sublabel: `Mar ${y}` });
  for (const c of extra ?? []) years.push({ key: c.key, label: c.label });
  return years;
}

const money = (v: number) => (Math.abs(v) >= 1e9 ? `${(v / 1e9).toFixed(2)} B` : `${(v / 1e6).toFixed(2)} M`);

/** Year-on-year change between two figures, or nothing for the first year and for a sign flip —
 *  a percentage change across zero is a number without a meaning. */
function growthNote(current: number, previous: number | undefined) {
  if (previous === undefined || previous === 0 || Math.sign(previous) !== Math.sign(current)) return undefined;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return { note: `${pct >= 0 ? "+" : ""}${pct.toFixed(2)} %`, tone: pct >= 0 ? ("up" as const) : ("down" as const) };
}

function cashFlowRows(): DataTableRow[] {
  const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
  const cells = (base: number, step: number) => {
    const values = years.map((_, i) => base + step * i);
    return Object.fromEntries(
      years.map((y, i) => [String(y), { value: money(values[i]), ...growthNote(values[i], values[i - 1]) }])
    );
  };
  return [
    {
      key: "op",
      label: "Cash flow from operating activities",
      emphasis: true,
      cells: cells(843e6, -90e6),
      children: [
        { key: "ffo", label: "Funds from operations", cells: cells(957e6, -20e6) },
        {
          key: "da",
          label: "Depreciation & amortization",
          cells: cells(264e6, 30e6),
          children: [
            { key: "dep", label: "Depreciation/depletion", cells: cells(39e6, 20e6) },
            { key: "amo", label: "Amortization", cells: cells(225e6, 10e6) },
          ],
        },
        { key: "wc", label: "Changes in working capital", cells: cells(-114e6, -100e6) },
      ],
    },
    {
      key: "inv",
      label: "Cash flow from investing activities",
      emphasis: true,
      cells: cells(-223e6, -60e6),
      children: [
        { key: "capex", label: "Capital expenditures", cells: cells(-66e6, -20e6) },
        { key: "acq", label: "Purchase/sale of business (net)", cells: cells(-28e6, -12e6) },
      ],
    },
    { key: "fcf", label: "Free cash flow", emphasis: true, cells: cells(776e6, -110e6) },
  ];
}

type Story = StoryObj<typeof DataTable>;

/** A statement: nesting several levels deep, totals filled, a growth figure under every value. */
export const Statement: Story = {
  name: "Compte de flux de trésorerie",
  render: () => (
    <div style={{ maxWidth: 1100 }}>
      <DataTable caption="Flux de trésorerie" columns={yearColumns(2019, 2025, [{ key: "ttm", label: "TTM" }])} rows={cashFlowRows()} />
    </div>
  ),
};

/** Segments: one colour per series, tying each row to its own band in the chart above it. */
export const Segments: Story = {
  name: "Segments (pastilles de couleur)",
  render: () => {
    const years = [2021, 2022, 2023, 2024, 2025];
    const columns: DataTableColumn[] = [
      { key: "label", label: "", sticky: true, align: "left", width: 240 },
      ...years.map((y) => ({ key: String(y), label: String(y) })),
    ];
    const rows: DataTableRow[] = [
      { key: "mobile", label: "Mobile", accent: "#2f7fe0", cells: { 2021: "403.44 M", 2022: "2.54 B", 2023: "2.75 B", 2024: "2.94 B", 2025: "3.33 B" } },
      { key: "console", label: "Console", accent: "#38bdd0", cells: { 2021: "2.53 B", 2022: "2.30 B", 2023: "2.17 B", 2024: "2.10 B", 2025: "2.60 B" } },
      { key: "pc", label: "Personal Computers and Other", accent: "#e8853a", cells: { 2021: "572.51 M", 2022: "507.50 M", 2023: "434.30 M", 2024: "592.50 M", 2025: "726.10 M" } },
      { key: "handheld", label: "Handheld", accent: "#9b6cd0", cells: {} },
      { key: "publishing", label: "Publishing", accent: "#d05a8c", cells: {} },
    ];
    return (
      <div style={{ maxWidth: 900 }}>
        <DataTable caption="Revenu par segment" columns={columns} rows={rows} />
      </div>
    );
  },
};

/** Earnings: reported against estimate, and the surprise between them coloured by sign. */
export const Earnings: Story = {
  name: "Résultats (réalisé / estimé / surprise)",
  render: () => {
    const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
    const columns: DataTableColumn[] = [
      { key: "label", label: "Metrics", sticky: true, align: "left", width: 200 },
      ...years.map((y) => ({ key: String(y), label: String(y) })),
    ];
    const reported = [6.92, 5.06, 3.48, 2.47, 2.52, 4.1, null];
    const estimate = [6.27, 4.96, 3.58, 2.29, 2.51, 3.91, 6.94];
    const rows: DataTableRow[] = [
      { key: "rep", label: "Reported", emphasis: true, cells: Object.fromEntries(years.map((y, i) => [String(y), reported[i]?.toFixed(2)])) },
      { key: "est", label: "Estimate", cells: Object.fromEntries(years.map((y, i) => [String(y), estimate[i].toFixed(2)])) },
      {
        key: "sur",
        label: "Surprise",
        cells: Object.fromEntries(
          years.map((y, i) => {
            const r = reported[i];
            if (r === null) return [String(y), null];
            const pct = ((r - estimate[i]) / estimate[i]) * 100;
            return [String(y), { value: `${pct >= 0 ? "+" : ""}${pct.toFixed(2)} %`, tone: pct >= 0 ? ("up" as const) : ("down" as const) }];
          })
        ),
      },
    ];
    return (
      <div style={{ maxWidth: 900 }}>
        <DataTable caption="Résultats" columns={columns} rows={rows} />
      </div>
    );
  },
};

/** Statistics: flat rows, and a trailing "Current" column beside the fiscal years. */
export const Statistics: Story = {
  name: "Statistiques (colonne « Actuel »)",
  render: () => {
    const columns = yearColumns(2021, 2025, [{ key: "current", label: "Actuel" }]);
    const row = (key: string, label: string, values: (number | null)[]): DataTableRow => ({
      key,
      label,
      cells: Object.fromEntries([...values.map((v, i) => [String(2021 + i), v === null ? null : v.toFixed(2)])]),
    });
    return (
      <div style={{ maxWidth: 900 }}>
        <DataTable
          caption="Statistiques"
          columns={columns}
          rows={[
            row("pe", "Price to earnings ratio", [42.95, null, null, null, null, null]),
            row("ps", "Price to sales ratio", [5.12, 3.57, 4.72, 6.44, 5.46, 5.96]),
            row("pb", "Price to book ratio", [4.66, 2.23, 4.47, 17.17, 10.43, 11.1]),
            row("roe", "Return on equity %", [11.71, -17.5, -50.91, -114.76, -10.56, -9.04]),
            row("gm", "Gross margin %", [56.16, 44.97, 50.06, 53.51, 53.12, 57.22]),
          ]}
        />
      </div>
    );
  },
};

/** Deep nesting starting collapsed — how a long statement is read when only the totals matter. */
export const CollapsedByDefault: Story = {
  name: "Replié par défaut",
  render: () => (
    <div style={{ maxWidth: 1100 }}>
      <DataTable caption="Flux de trésorerie replié" columns={yearColumns(2019, 2025)} rows={cashFlowRows()} defaultExpandedDepth={0} />
    </div>
  ),
};
