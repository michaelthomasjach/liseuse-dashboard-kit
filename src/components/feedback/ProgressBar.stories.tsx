import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ProgressBar } from "./ProgressBar";
import { Card } from "../primitives/Card";

const meta: Meta<typeof ProgressBar> = {
  title: "Feedback/ProgressBar",
  component: ProgressBar,
};
export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Default: Story = {
  name: "Défaut (label en haut — comportement d'origine)",
  render: () => (
    <div style={{ maxWidth: 420 }}>
      <ProgressBar value={62} label="Import des transactions" />
    </div>
  ),
};

export const Indeterminate: Story = {
  render: () => (
    <div style={{ maxWidth: 420 }}>
      <ProgressBar label="Synchronisation…" />
    </div>
  ),
};

// Label left, value right — a compact metrics-row layout.
export const LabelLeftValueRight: Story = {
  name: "Label à gauche, valeur à droite",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 420 }}>
      <ProgressBar label="Momentum" value={90} labelPosition="left" showValue />
      <ProgressBar label="Trend" value={84} labelPosition="left" showValue />
      <ProgressBar label="Volume" value={71} labelPosition="left" showValue />
      <ProgressBar label="Volatility" value={52} labelPosition="left" showValue />
    </div>
  ),
};

export const Inside: Story = {
  name: "Label et valeur à l'intérieur",
  render: () => (
    <div style={{ maxWidth: 420 }}>
      <ProgressBar label="Téléchargement" value={73} labelPosition="inside" valuePosition="inside" showValue />
    </div>
  ),
};

export const ThicknessAndBorder: Story = {
  name: "Épaisseur et bordure",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 420 }}>
      <ProgressBar label="Défaut (6px, sans bordure)" value={62} />
      <ProgressBar label="Épaisse (16px)" value={62} thickness={16} />
      <ProgressBar label="Avec bordure" value={62} bordered />
      <ProgressBar label="Épaisse avec bordure" value={62} thickness={16} bordered />
    </div>
  ),
};

export const Segmented: Story = {
  name: "Segmentée (répartition sectorielle)",
  render: () => (
    <div style={{ maxWidth: 600 }}>
      <Card title="Sector allocation" meta="SHARE OF MARKET VALUE">
        <ProgressBar
          segments={[
            { id: "tech", value: 38, color: "#e8391c", label: "Technologie" },
            { id: "health", value: 22, color: "#1a1a1a", label: "Santé" },
            { id: "finance", value: 16, color: "#6b6b6b", label: "Finance" },
            { id: "industry", value: 12, color: "#9c9c9c", label: "Industrie" },
            { id: "energy", value: 7, color: "#c4c4c4", label: "Énergie" },
            { id: "other", value: 5, color: "#dcdcdc", label: "Autres" },
          ]}
        />
      </Card>
    </div>
  ),
};

/** A value that actually moves. The transition on the fill is the whole point of this story: every
 *  other one here shows the bar at rest, where a 42 % that arrived by jumping and one that arrived
 *  by travelling look identical. */
export const Animated: Story = {
  name: "Valeur qui change",
  render: () => {
    function Demo() {
      const [value, setValue] = useState(12);
      // Deliberately uneven steps, and one step backwards: a bar that only ever creeps forward by
      // the same amount could be a CSS animation rather than a value being re-rendered.
      const steps = [12, 38, 44, 71, 68, 95, 100];
      useEffect(() => {
        let i = 0;
        const id = setInterval(() => {
          i = (i + 1) % steps.length;
          setValue(steps[i]);
        }, 1100);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 420 }}>
          <ProgressBar value={value} label="Import des transactions" showValue formatValue={(v) => `${Math.round(v)} %`} />
          <ProgressBar value={value} label="Épaisse" showValue valuePosition="inside" thickness={22} />
          <div style={{ display: "flex", gap: 8 }}>
            {[0, 25, 50, 75, 100].map((v) => (
              <button key={v} type="button" onClick={() => setValue(v)} style={{ font: "inherit", fontSize: "0.75rem", padding: "3px 9px" }}>
                {v} %
              </button>
            ))}
          </div>
        </div>
      );
    }
    return <Demo />;
  },
};

/** The segmented bar moving too — segments are laid out as shares of their own total, so changing
 *  one value re-proportions every other segment at the same time. */
export const AnimatedSegments: Story = {
  name: "Segments qui changent",
  render: () => {
    function Demo() {
      const [tick, setTick] = useState(0);
      useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1400);
        return () => clearInterval(id);
      }, []);
      const mixes = [
        [42, 28, 18, 12],
        [20, 46, 22, 12],
        [31, 19, 38, 12],
        [12, 24, 20, 44],
      ];
      const mix = mixes[tick % mixes.length];
      const labels = ["Actions", "Obligations", "Immobilier", "Liquidités"];
      return (
        <div style={{ maxWidth: 420 }}>
          <ProgressBar
            label="Répartition du portefeuille"
            thickness={16}
            segments={mix.map((value, i) => ({ id: labels[i], value, label: labels[i] }))}
          />
        </div>
      );
    }
    return <Demo />;
  },
};
