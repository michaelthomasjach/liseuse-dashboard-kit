import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { MatrixChart, type MatrixCell } from "./MatrixChart";

const meta: Meta<typeof MatrixChart> = {
  title: "Charts/MatrixChart",
  component: MatrixChart,
};
export default meta;
type Story = StoryObj<typeof MatrixChart>;

/** The symbol being charted comes first, then whatever the caller added to the comparison — the
 *  order a correlation panel is read in: "what am I looking at, and what does it move with". */
const SYMBOLS = [
  { id: "msft", label: "MSFT" },
  { id: "aapl", label: "AAPL" },
  { id: "nvda", label: "NVDA" },
  { id: "amzn", label: "AMZN" },
  { id: "xom", label: "XOM" },
  { id: "gld", label: "GLD" },
  { id: "tlt", label: "TLT" },
];

/** Pearson correlations over the same window, upper triangle written once and mirrored below.
 *  Plausible rather than real: the tech names move together, energy barely tracks them, gold is
 *  near zero against everything, and long bonds run negative — which is what makes the colour
 *  ramp worth looking at instead of a wall of one hue. */
const PAIRS: Record<string, number> = {
  "msft aapl": 0.82,
  "msft nvda": 0.76,
  "msft amzn": 0.71,
  "msft xom": 0.18,
  "msft gld": -0.04,
  "msft tlt": -0.43,
  "aapl nvda": 0.68,
  "aapl amzn": 0.66,
  "aapl xom": 0.12,
  "aapl gld": 0.02,
  "aapl tlt": -0.38,
  "nvda amzn": 0.61,
  "nvda xom": 0.09,
  "nvda gld": -0.11,
  "nvda tlt": -0.52,
  "amzn xom": 0.07,
  "amzn gld": 0.05,
  "amzn tlt": -0.29,
  "xom gld": 0.21,
  "xom tlt": -0.16,
  "gld tlt": 0.34,
};

const OBSERVATIONS = 252;

function correlation(a: string, b: string): number | null {
  if (a === b) return null;
  return PAIRS[a + " " + b] ?? PAIRS[b + " " + a] ?? null;
}

/** Fisher's z transform gives a confidence interval for a correlation; the two-sided p-value comes
 *  from the same z. Computed here rather than hard-coded so the detail panel shows numbers that
 *  actually belong to the cell you clicked. */
function interval(r: number, n: number): { low: number; high: number; p: string } {
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);
  const back = (v: number) => (Math.exp(2 * v) - 1) / (Math.exp(2 * v) + 1);
  const stat = Math.abs(z) / se;
  return {
    low: back(z - 1.96 * se),
    high: back(z + 1.96 * se),
    p: stat > 3.9 ? "< 0,001" : stat > 2.58 ? "< 0,01" : stat > 1.96 ? "< 0,05" : "non significatif",
  };
}

function buildCells(withNotes: boolean): MatrixCell[] {
  const cells: MatrixCell[] = [];
  for (const row of SYMBOLS) {
    for (const column of SYMBOLS) {
      const r = correlation(row.id, column.id);
      if (r === null) {
        cells.push({ row: row.id, column: column.id, value: null });
        continue;
      }
      const ci = interval(r, OBSERVATIONS);
      cells.push({
        row: row.id,
        column: column.id,
        value: r,
        note: withNotes ? "n=" + OBSERVATIONS : undefined,
        details: [
          { label: "Observations", value: OBSERVATIONS + " séances" },
          { label: "Intervalle à 95 %", value: ci.low.toFixed(2) + " … " + ci.high.toFixed(2) },
          { label: "p", value: ci.p },
          { label: "R carré", value: (r * r).toFixed(2) },
          { label: "Lecture", value: Math.abs(r) < 0.2 ? "aucun lien" : Math.abs(r) < 0.5 ? "lien faible" : Math.abs(r) < 0.75 ? "lien net" : "lien fort" },
        ],
      });
    }
  }
  return cells;
}

export const Correlation: Story = {
  name: "Matrice de corrélation (cliquez une case)",
  render: () => (
    <div style={{ maxWidth: 760 }}>
      <MatrixChart rows={SYMBOLS} columns={SYMBOLS} cells={buildCells(false)} height={330} />
    </div>
  ),
};

/** The ramp, laid bare: one row per tenth from -1 to +1 so the two halves can be compared against
 *  each other rather than described. */
export const Ramp: Story = {
  name: "Le dégradé automatique",
  render: () => {
    const steps = Array.from({ length: 11 }, (_, i) => ({ id: String(i), label: (i * 10) + " %" }));
    const cells: MatrixCell[] = steps.flatMap((step, i) => [
      { row: "pos", column: step.id, value: i / 10, details: [{ label: "Opacité", value: (i / 10).toFixed(1) }] },
      { row: "neg", column: step.id, value: -i / 10, details: [{ label: "Opacité", value: (i / 10).toFixed(1) }] },
    ]);
    return (
      <div style={{ maxWidth: 760 }}>
        <MatrixChart
          rows={[
            { id: "pos", label: "Positif" },
            { id: "neg", label: "Négatif" },
          ]}
          columns={steps}
          cells={cells}
          height={120}
          zoomable={false}
        />
      </div>
    );
  },
};

/** Colours are props, and so is the domain. A score out of 100 with its own palette reads exactly
 *  like the correlation above, because the ramp only ever needs to know which side of zero a value
 *  sits on and how far along its side it is. */
export const CustomPalette: Story = {
  name: "Palette et domaine sur mesure",
  render: () => {
    const criteria = [
      { id: "growth", label: "Croissance" },
      { id: "margin", label: "Marge" },
      { id: "debt", label: "Dette" },
      { id: "cash", label: "Trésorerie" },
    ];
    const companies = [
      { id: "msft", label: "MSFT" },
      { id: "aapl", label: "AAPL" },
      { id: "nvda", label: "NVDA" },
      { id: "xom", label: "XOM" },
    ];
    const scores: Record<string, number> = {
      "msft growth": 68, "msft margin": 82, "msft debt": 41, "msft cash": 90,
      "aapl growth": 34, "aapl margin": 74, "aapl debt": -22, "aapl cash": 61,
      "nvda growth": 96, "nvda margin": 88, "nvda debt": 12, "nvda cash": 55,
      "xom growth": -48, "xom margin": 27, "xom debt": -64, "xom cash": 18,
    };
    return (
      <div style={{ maxWidth: 620 }}>
        <MatrixChart
          rows={companies}
          columns={criteria}
          cells={companies.flatMap((c) =>
            criteria.map((k) => ({
              row: c.id,
              column: k.id,
              value: scores[c.id + " " + k.id],
              details: [
                { label: "Score", value: scores[c.id + " " + k.id] + " / 100" },
                { label: "Rang du secteur", value: Math.max(1, Math.round((100 - scores[c.id + " " + k.id]) / 12)) + "e" },
              ],
            })),
          )}
          domain={[-100, 100]}
          positiveColor="var(--lq-color-sky)"
          negativeColor="var(--lq-color-amber)"
          formatValue={(v) => String(Math.round(v))}
          height={210}
        />
      </div>
    );
  },
};

/** `onCellClick` reports outward; the panel underneath is the component's own. A caller that wants
 *  its own layout passes `renderDetail` instead and gets the cell, its row and its column. */
export const OwnDetail: Story = {
  name: "Détail rendu par l'appelant",
  render: () => {
    const [log, setLog] = useState<string[]>([]);
    return (
      <div style={{ maxWidth: 760, display: "grid", gap: 12 }}>
        <MatrixChart
          rows={SYMBOLS.slice(0, 5)}
          columns={SYMBOLS.slice(0, 5)}
          cells={buildCells(true)}
          height={260}
          onCellClick={(cell) => setLog((prev) => [cell.row + " × " + cell.column + " = " + cell.value?.toFixed(2), ...prev].slice(0, 4))}
          renderDetail={(cell, row, column) => (
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <strong>
                {row.label} contre {column.label}
              </strong>{" "}
              — {cell.value === null ? "–" : cell.value.toFixed(2)}. {cell.details?.find((d) => d.label === "Lecture")?.value}, sur{" "}
              {OBSERVATIONS} séances.
            </div>
          )}
        />
        <div style={{ fontSize: 12, color: "var(--lq-color-text-muted)" }}>
          {log.length === 0 ? "onCellClick n'a encore rien reçu." : log.map((l) => <div key={l}>{l}</div>)}
        </div>
      </div>
    );
  },
};
