import type { Meta, StoryObj } from "@storybook/react";
import { StatCard } from "./StatCard";
import { SolarPanelIcon } from "../icons";

const meta: Meta<typeof StatCard> = {
  title: "Finance/StatCard",
  component: StatCard,
};
export default meta;
type Story = StoryObj<typeof StatCard>;

export const Row: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <div style={{ width: 220 }}>
        <StatCard label="Valeur du portefeuille" value="42 380 €" delta={3.4} sparklineData={[10, 10.4, 10.1, 10.8, 11.2, 11.6, 12.1]} />
      </div>
      <div style={{ width: 220 }}>
        <StatCard label="P&L du jour" value="− 214 €" delta={-1.2} />
      </div>
      <div style={{ width: 220 }}>
        <StatCard label="Rendement solaire" value="1,0 kWh" icon={<SolarPanelIcon size={20} />} />
      </div>
      <div style={{ width: 220 }}>
        <StatCard label="Consommation" value="112 kWh" caption="fond 60 · machines 35 · froid 17" sparklineData={[90, 96, 104, 99, 108, 112]} />
      </div>
    </div>
  ),
};
