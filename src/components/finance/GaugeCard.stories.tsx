import type { Meta, StoryObj } from "@storybook/react";
import { GaugeCard } from "./GaugeCard";

const meta: Meta<typeof GaugeCard> = {
  title: "Finance/GaugeCard",
  component: GaugeCard,
};
export default meta;
type Story = StoryObj<typeof GaugeCard>;

export const RiskScore: Story = {
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <GaugeCard
        title="Score de risque"
        meta="Modéré"
        description="Basé sur la volatilité et la concentration de votre portefeuille."
        value={68}
        formatValue={(v) => `${v}`}
        thresholds={[
          { upTo: 33, color: "var(--lq-color-up)" },
          { upTo: 66, color: "var(--lq-color-warning)" },
          { upTo: 100, color: "var(--lq-color-down)" },
        ]}
      />
    </div>
  ),
};

export const BandLabels: Story = {
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <GaugeCard
        title="Score de risque"
        value={58}
        showBandLabels
        thresholds={[
          { upTo: 33, color: "var(--lq-color-up)", label: "Faible" },
          { upTo: 66, color: "var(--lq-color-warning)", label: "Modéré" },
          { upTo: 100, color: "var(--lq-color-down)", label: "Élevé" },
        ]}
      />
    </div>
  ),
};
