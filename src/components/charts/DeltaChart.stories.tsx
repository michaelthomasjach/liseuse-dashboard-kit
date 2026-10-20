import type { Meta, StoryObj } from "@storybook/react";
import { DeltaChart } from "./DeltaChart";

const meta: Meta<typeof DeltaChart> = {
  title: "Charts/DeltaChart",
  component: DeltaChart,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof DeltaChart>;

const formatB = (v: number) => `${v.toFixed(2)}B`;

export const CapitalStructure: Story = {
  name: "Structure du capital (cf. maquette)",
  render: () => (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <DeltaChart
        formatValue={formatB}
        items={[
          { id: "market-cap", label: "Market cap", value: 169.64 },
          { id: "debt", label: "Debt", value: 19.2 },
          { id: "minority", label: "Minority interest", value: 0.273 },
          { id: "cash", label: "Cash & equivalents", value: -4.52 },
          { id: "ev", label: "Enterprise value", value: 184.59, isTotal: true },
        ]}
      />
    </div>
  ),
};

export const RevenueBridge: Story = {
  name: "Pont de revenu (plusieurs sous-totaux)",
  render: () => (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <DeltaChart
        formatValue={(v) => `${v.toFixed(1)} M€`}
        items={[
          { id: "start", label: "T1", value: 42.0, isTotal: true },
          { id: "new", label: "Nouveaux clients", value: 8.4 },
          { id: "churn", label: "Attrition", value: -3.1 },
          { id: "upsell", label: "Upsell", value: 2.6 },
          { id: "end", label: "T2", value: 49.9, isTotal: true },
        ]}
      />
    </div>
  ),
};

export const HiddenYAxisLine: Story = {
  name: "Sans ligne d'axe Y (hideYAxisLine)",
  args: { hideYAxisLine: true },
  argTypes: { hideYAxisLine: { control: "boolean" } },
  render: (args) => (
    <div style={{ maxWidth: 700 }}>
      <DeltaChart
        {...args}
        formatValue={(v) => `${v.toFixed(1)} M€`}
        items={[
          { id: "start", label: "T1", value: 42.0, isTotal: true },
          { id: "new", label: "Nouveaux clients", value: 8.4 },
          { id: "churn", label: "Attrition", value: -3.1 },
          { id: "upsell", label: "Upsell", value: 2.6 },
          { id: "end", label: "T2", value: 49.9, isTotal: true },
        ]}
      />
    </div>
  ),
};
