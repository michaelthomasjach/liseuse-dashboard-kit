import type { Meta, StoryObj } from "@storybook/react";
import { EarningsDotChart } from "./EarningsDotChart";
import type { SymbolProfileEarningsPoint } from "./workspace/SymbolProfile.interface";

const meta: Meta<typeof EarningsDotChart> = {
  title: "Charts/EarningsDotChart",
  component: EarningsDotChart,
};
export default meta;
type Story = StoryObj<typeof EarningsDotChart>;

/** Eight quarters of a company that mostly beats its estimate — the ordinary case, and the one the
 *  symbol panel shows. The last point has an estimate but no actual: a quarter that hasn't reported
 *  yet, which is exactly why both fields are optional. */
const BEATS: SymbolProfileEarningsPoint[] = [
  { date: "T1 24", estimateEps: 2.55, actualEps: 2.94 },
  { date: "T2 24", estimateEps: 2.93, actualEps: 2.95 },
  { date: "T3 24", estimateEps: 3.1, actualEps: 3.3 },
  { date: "T4 24", estimateEps: 3.11, actualEps: 3.23 },
  { date: "T1 25", estimateEps: 3.22, actualEps: 3.46 },
  { date: "T2 25", estimateEps: 3.35, actualEps: 3.31 },
  { date: "T3 25", estimateEps: 3.6, actualEps: 3.72 },
  { date: "T4 25", estimateEps: 3.74 },
];

/** A run of misses, and one loss-making quarter — the axis has to cross zero, which is why the
 *  scale's lower bound is `min(0, …)` rather than the data's own minimum. */
const MISSES: SymbolProfileEarningsPoint[] = [
  { date: "T1 24", estimateEps: 0.82, actualEps: 0.61 },
  { date: "T2 24", estimateEps: 0.74, actualEps: 0.4 },
  { date: "T3 24", estimateEps: 0.55, actualEps: -0.18 },
  { date: "T4 24", estimateEps: 0.31, actualEps: 0.12 },
  { date: "T1 25", estimateEps: 0.44, actualEps: 0.49 },
  { date: "T2 25", estimateEps: 0.58 },
];

export const Default: Story = {
  name: "Par défaut (panneau symbole)",
  render: () => (
    <div style={{ width: 300, padding: 16 }}>
      <EarningsDotChart points={BEATS} />
    </div>
  ),
};

export const Interactive: Story = {
  name: "Sélection d'un trimestre",
  render: () => (
    <div style={{ width: 340, padding: 16 }}>
      <p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.7 }}>
        Cliquez (ou touchez) une colonne pour lire l'estimé, le réalisé et l'écart entre les deux. Un second clic désélectionne. La cible est
        la colonne entière, pas le point : deux cercles de 4 px ne sont pas atteignables au doigt.
      </p>
      <EarningsDotChart points={BEATS} />
    </div>
  ),
};

export const Enlarged: Story = {
  name: "Agrandi (modale)",
  render: () => (
    <div style={{ padding: 16 }}>
      <p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.7 }}>
        Ce que le bouton d'agrandissement du panneau symbole ouvre. `scale` grossit les points et les libellés avec la boîte — sans lui, des
        cercles de 4 px disparaîtraient dans un dessin trois fois plus haut.
      </p>
      <EarningsDotChart points={BEATS} width={760} height={420} scale={2} />
    </div>
  ),
};

export const BelowZero: Story = {
  name: "Résultats manqués et trimestre en perte",
  render: () => (
    <div style={{ width: 300, padding: 16 }}>
      <EarningsDotChart points={MISSES} />
    </div>
  ),
};

export const AwaitingResult: Story = {
  name: "Trimestre non publié",
  render: () => (
    <div style={{ width: 300, padding: 16 }}>
      <p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.7 }}>
        Le dernier trimestre n'a qu'une estimation (cercle creux) : rien n'est encore publié. Sélectionnez-le — le réalisé s'affiche « — »
        plutôt que zéro, et aucun écart n'est calculé.
      </p>
      <EarningsDotChart points={BEATS.slice(-3)} />
    </div>
  ),
};
