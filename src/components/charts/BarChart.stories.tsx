import type { Meta, StoryObj } from "@storybook/react";
import { BarChart } from "./BarChart";

const meta: Meta<typeof BarChart> = {
  title: "Charts/BarChart",
  component: BarChart,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof BarChart>;

const MONTHLY_RETURN = [
  { id: "j", label: "Jan", value: 2.1 },
  { id: "f", label: "Fév", value: -1.4 },
  { id: "m", label: "Mar", value: 3.4 },
  { id: "a", label: "Avr", value: 0.8 },
  { id: "ma", label: "Mai", value: -2.6 },
  { id: "ju", label: "Juin", value: 4.2 },
];

export const MonthlyReturns: Story = {
  name: "Rendement mensuel (couleur par signe)",
  render: () => (
    <div style={{ padding: 24 }}>
      <BarChart data={MONTHLY_RETURN} colorByValue formatValue={(v) => `${v.toFixed(1)} %`} />
    </div>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <div style={{ padding: 24 }}>
      <BarChart
        orientation="horizontal"
        data={[
          { id: "eq", label: "Actions", value: 48 },
          { id: "bo", label: "Obligations", value: 22 },
          { id: "re", label: "Immobilier", value: 14 },
          { id: "ca", label: "Liquidités", value: 10 },
          { id: "cr", label: "Crypto", value: 6 },
        ]}
        formatValue={(v) => `${v} %`}
      />
    </div>
  ),
};

const REVENUE_VS_PROFIT_SERIES = [
  { id: "revenue", label: "Chiffre d'affaires" },
  { id: "profit", label: "Bénéfice" },
];

const REVENUE_VS_PROFIT_DATA = [
  { id: "q1", label: "T1 2025", values: { revenue: 120, profit: 18 } },
  { id: "q2", label: "T2 2025", values: { revenue: 145, profit: 22 } },
  { id: "q3", label: "T3 2025", values: { revenue: 132, profit: 14 } },
  // Missing "profit" here on purpose — proves a category can omit one series' own bar entirely
  // (still-unreported quarter) instead of drawing a misleading zero-height one.
  { id: "q4", label: "T4 2025", values: { revenue: 158 } },
];

export const MultiSeries: Story = {
  name: "Plusieurs séries (barres groupées)",
  render: () => (
    <div style={{ padding: 24 }}>
      <BarChart data={REVENUE_VS_PROFIT_DATA} series={REVENUE_VS_PROFIT_SERIES} formatValue={(v) => `${v} M€`} />
    </div>
  ),
};

export const MultiSeriesHorizontal: Story = {
  name: "Plusieurs séries — horizontal",
  render: () => (
    <div style={{ padding: 24 }}>
      <BarChart orientation="horizontal" data={REVENUE_VS_PROFIT_DATA} series={REVENUE_VS_PROFIT_SERIES} formatValue={(v) => `${v} M€`} />
    </div>
  ),
};
