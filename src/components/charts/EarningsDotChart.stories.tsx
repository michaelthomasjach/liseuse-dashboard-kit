import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { EarningsDotChart } from "./EarningsDotChart";
import type { SymbolProfileEarningsPoint } from "./workspace/SymbolProfile.interface";
import { StatCard } from "../finance/StatCard";

const meta: Meta<typeof EarningsDotChart> = {
  title: "Charts/EarningsDotChart",
  component: EarningsDotChart,
};
export default meta;
type Story = StoryObj<typeof EarningsDotChart>;

// Every story renders full width. The component's own CSS is `width: 100%` (it fills whatever
// column it sits in), so `width`/`height` are really an aspect ratio rather than a size — hence a
// wide, short viewBox here instead of the panel's near-square one, which at full width would draw
// a chart as tall as the canvas.

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

/** The hovered quarter, banded, and read somewhere else entirely.
 *
 *  Two things at once, and they are separate props on purpose. `highlightOnHover` bands the column
 *  under the pointer and switches the chart's own readout to it — that much is self-contained.
 *  `onQuarterHover` reports the same quarter outward, which is what lets a panel beside the drawing
 *  follow the pointer, as the cards below do here.
 *
 *  Hovering asks and clicking decides: a quarter clicked stays selected while another is merely
 *  hovered, and the cards fall back to the selection when the pointer leaves. Without that, moving
 *  the mouse off the chart would wipe the very reading the reader had just clicked to keep. */
export const Hovered: Story = {
  name: "Survol : bande et lecture liée",
  render: () => {
    const [hovered, setHovered] = useState<SymbolProfileEarningsPoint | null>(null);
    const [clicked, setClicked] = useState<SymbolProfileEarningsPoint | null>(null);
    const shown = hovered ?? clicked;
    const surprise =
      shown && shown.estimateEps !== undefined && shown.actualEps !== undefined ? shown.actualEps - shown.estimateEps : undefined;
    const two = (v: number | undefined) => (v === undefined ? "—" : v.toFixed(2));

    return (
      <div style={{ padding: 16, display: "grid", gap: 16 }}>
        <EarningsDotChart
          points={BEATS}
          width={1200}
          height={260}
          scale={1.6}
          highlightOnHover
          onQuarterHover={(point) => setHovered(point)}
          onQuarterSelect={(point) => setClicked(point)}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <StatCard label="Trimestre" value={shown?.date ?? "—"} />
          <StatCard label="Estimé" value={two(shown?.estimateEps)} />
          <StatCard label="Réalisé" value={two(shown?.actualEps)} />
          {/* Pas de `delta` : StatCard le rend en pourcentage, et une surprise de résultats est un
              montant par action, pas un taux. */}
          <StatCard
            label="Surprise"
            value={surprise === undefined ? "—" : `${surprise >= 0 ? "+" : "−"}${Math.abs(surprise).toFixed(2)}`}
          />
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--lq-color-text-muted)" }}>
          Survolez un trimestre : la colonne se colore et les quatre valeurs suivent. Cliquez-en un
          pour le garder — la lecture y revient quand le pointeur quitte le graphique.
        </p>
      </div>
    );
  },
};

export const Default: Story = {
  name: "Par défaut",
  render: () => (
    <div style={{ padding: 16 }}>
      <EarningsDotChart points={BEATS} width={1200} height={260} scale={1.6} />
    </div>
  ),
};

export const Interactive: Story = {
  name: "Sélection d'un trimestre",
  render: () => (
    <div style={{ padding: 16 }}>
      <p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.7 }}>
        Cliquez (ou touchez) une colonne pour lire l'estimé, le réalisé et l'écart entre les deux. Un second clic désélectionne. La cible est
        la colonne entière, pas le point : deux cercles de 4 px ne sont pas atteignables au doigt.
      </p>
      <EarningsDotChart points={BEATS} width={1200} height={260} scale={1.6} />
    </div>
  ),
};

export const Enlarged: Story = {
  name: "Agrandi (modale)",
  render: () => (
    <div style={{ padding: 16 }}>
      <p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.7 }}>
        Ce que le bouton d'agrandissement du panneau symbole ouvre. `scale` grossit les points avec la boîte, pas les libellés — sans lui, des
        cercles de 4 px disparaîtraient dans un dessin trois fois plus haut.
      </p>
      <EarningsDotChart points={BEATS} width={1200} height={480} scale={2.4} />
    </div>
  ),
};

export const BelowZero: Story = {
  name: "Résultats manqués et trimestre en perte",
  render: () => (
    <div style={{ padding: 16 }}>
      <EarningsDotChart points={MISSES} width={1200} height={260} scale={1.6} />
    </div>
  ),
};

export const AwaitingResult: Story = {
  name: "Trimestre non publié",
  render: () => (
    <div style={{ padding: 16 }}>
      <p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.7 }}>
        Le dernier trimestre n'a qu'une estimation (cercle creux) : rien n'est encore publié. Sélectionnez-le — le réalisé s'affiche « — »
        plutôt que zéro, et aucun écart n'est calculé.
      </p>
      <EarningsDotChart points={BEATS.slice(-3)} width={1200} height={260} scale={1.6} />
    </div>
  ),
};
