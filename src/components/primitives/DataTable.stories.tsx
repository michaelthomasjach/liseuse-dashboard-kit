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
            {
              key: "dep",
              label: "Depreciation/depletion",
              cells: cells(39e6, 20e6),
              children: [
                { key: "dep-ppe", label: "Property, plant & equipment", cells: cells(24e6, 13e6) },
                { key: "dep-rou", label: "Right-of-use assets", cells: cells(11e6, 5e6) },
                { key: "dep-depl", label: "Depletion", cells: cells(4e6, 2e6) },
              ],
            },
            {
              key: "amo",
              label: "Amortization",
              cells: cells(225e6, 10e6),
              children: [
                { key: "amo-intang", label: "Acquired intangibles", cells: cells(180e6, 6e6) },
                { key: "amo-soft", label: "Capitalised software", cells: cells(45e6, 4e6) },
              ],
            },
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

/** Three levels, all open, so the depth stepping is visible in one glance: each level is a shade
 *  smaller than the one above it, and only a row that *has* children carries any weight. Indent
 *  alone used to do this job and stopped working exactly here — at the third level, against long
 *  labels, with figures that looked identical whatever their depth. */
export const DeepNesting: Story = {
  name: "Trois niveaux d'imbrication",
  render: () => (
    <div style={{ maxWidth: 1100 }}>
      <DataTable caption="Flux de trésorerie détaillé" columns={yearColumns(2021, 2025)} rows={cashFlowRows()} />
    </div>
  ),
};

/** A balance sheet: the same shape as a cash-flow statement, but every line is a stock rather than
 *  a flow, and the two halves have to add up — which is what the two `emphasis` totals are for. */
export const BalanceSheet: Story = {
  name: "Bilan",
  render: () => {
    const years = [2021, 2022, 2023, 2024, 2025];
    const line = (base: number, step: number) =>
      Object.fromEntries(
        years.map((y, i) => {
          const values = years.map((_, j) => base + step * j);
          return [String(y), { value: money(values[i]), ...growthNote(values[i], values[i - 1]) }];
        }),
      );
    const rows: DataTableRow[] = [
      {
        key: "assets",
        label: "Total actif",
        emphasis: true,
        cells: line(4.2e9, 380e6),
        children: [
          {
            key: "current",
            label: "Actif circulant",
            cells: line(2.1e9, 190e6),
            children: [
              { key: "cash", label: "Trésorerie et équivalents", cells: line(1.1e9, 90e6) },
              { key: "recv", label: "Créances clients", cells: line(620e6, 55e6) },
              { key: "inv", label: "Stocks", cells: line(380e6, 45e6) },
            ],
          },
          {
            key: "noncurrent",
            label: "Actif immobilisé",
            cells: line(2.1e9, 190e6),
            children: [
              { key: "ppe", label: "Immobilisations corporelles", cells: line(1.4e9, 120e6) },
              { key: "goodwill", label: "Écarts d'acquisition", cells: line(700e6, 70e6) },
            ],
          },
        ],
      },
      {
        key: "liabilities",
        label: "Total passif et capitaux propres",
        emphasis: true,
        cells: line(4.2e9, 380e6),
        children: [
          { key: "debt", label: "Dettes financières", cells: line(1.3e9, 60e6) },
          { key: "payables", label: "Dettes fournisseurs", cells: line(540e6, 40e6) },
          { key: "equity", label: "Capitaux propres", cells: line(2.36e9, 280e6) },
        ],
      },
    ];
    return (
      <div style={{ maxWidth: 1000 }}>
        <DataTable caption="Bilan" columns={yearColumns(2021, 2025)} rows={rows} />
      </div>
    );
  },
};

/** No period columns at all — just a label and a value. The narrowest thing this component is
 *  asked to be, and worth a story precisely because it is the case where a table risks looking
 *  like an over-engineered list: no nesting, no notes, no scroll. */
export const KeyValue: Story = {
  name: "Clé / valeur",
  render: () => {
    const columns: DataTableColumn[] = [
      { key: "label", label: "Caractéristique", sticky: true, align: "left", width: 260 },
      { key: "value", label: "Valeur", align: "right" },
    ];
    const rows: DataTableRow[] = [
      { key: "isin", label: "Code ISIN", cells: { value: "FR0000131104" } },
      { key: "mic", label: "Place de cotation", cells: { value: "XPAR" } },
      { key: "currency", label: "Devise", cells: { value: "EUR" } },
      { key: "lot", label: "Quotité", cells: { value: "1" } },
      { key: "sector", label: "Secteur", cells: { value: "Services financiers" } },
      { key: "employees", label: "Effectif", cells: { value: "191 000" } },
    ];
    return (
      <div style={{ maxWidth: 520 }}>
        <DataTable caption="Fiche instrument" columns={columns} rows={rows} />
      </div>
    );
  },
};

/** Twenty years of columns against a pinned label column — the case the horizontal scroll and the
 *  sticky first column exist for. Scroll the table sideways: the labels stay put. */
export const ManyPeriods: Story = {
  name: "Vingt exercices (défilement)",
  render: () => (
    <div style={{ maxWidth: 760 }}>
      <DataTable caption="Historique long" columns={yearColumns(2006, 2025)} rows={cashFlowRows()} defaultExpandedDepth={1} />
    </div>
  ),
};

/** Tone and note used for something other than growth: a comparison against a benchmark, where
 *  "up" and "down" mean better and worse rather than more and less. The component has no opinion
 *  on what a tone means — that is the caller's to decide, which this story exists to show. */
export const Comparison: Story = {
  name: "Comparaison à un indice",
  render: () => {
    const columns: DataTableColumn[] = [
      { key: "label", label: "", sticky: true, align: "left", width: 220 },
      { key: "fund", label: "Fonds" },
      { key: "bench", label: "Indice" },
      { key: "delta", label: "Écart" },
    ];
    const row = (key: string, label: string, fund: string, bench: string, delta: number): DataTableRow => ({
      key,
      label,
      cells: {
        fund,
        bench,
        delta: { value: `${delta >= 0 ? "+" : ""}${delta.toFixed(2)} pt`, tone: delta >= 0 ? "up" : "down" },
      },
    });
    const rows: DataTableRow[] = [
      row("1m", "1 mois", "+2.40 %", "+1.90 %", 0.5),
      row("3m", "3 mois", "+5.10 %", "+6.30 %", -1.2),
      row("ytd", "Depuis le 1er janvier", "+11.80 %", "+9.40 %", 2.4),
      row("1y", "1 an", "+14.20 %", "+15.05 %", -0.85),
      { key: "since", label: "Depuis création", emphasis: true, cells: { fund: "+68.30 %", bench: "+59.10 %", delta: { value: "+9.20 pt", tone: "up" } } },
    ];
    return (
      <div style={{ maxWidth: 720 }}>
        <DataTable caption="Performance comparée" columns={columns} rows={rows} />
      </div>
    );
  },
};
