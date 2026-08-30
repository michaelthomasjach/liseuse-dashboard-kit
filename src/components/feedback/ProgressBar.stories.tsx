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
