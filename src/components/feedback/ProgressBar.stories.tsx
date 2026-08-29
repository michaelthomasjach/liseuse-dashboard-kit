import type { Meta, StoryObj } from "@storybook/react";
import { ProgressBar } from "./ProgressBar";

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
