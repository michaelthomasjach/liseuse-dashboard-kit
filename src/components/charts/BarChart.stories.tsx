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

/** Barres d'incertitude et valeurs : impact estimé avec une bande d'incertitude ±50 %. */
export const WithErrorBars: Story = {
  render: () => (
    <BarChart
      height={300}
      showValueLabels
      formatValue={(v) => `${v > 0 ? "+" : ""}${Math.round(v)}`}
      series={[
        { id: "2a", label: "2 ans" },
        { id: "10a", label: "10 ans" },
        { id: "30a", label: "30 ans" },
      ]}
      data={[
        { id: "fr", label: "France", values: { "2a": 22, "10a": 16, "30a": 12 }, errors: { "2a": [11, 33], "10a": [8, 24], "30a": [6, 18] } },
        { id: "de", label: "Allemagne", values: { "2a": 20, "10a": 13, "30a": 9 }, errors: { "2a": [10, 30], "10a": [6.5, 19.5], "30a": [4.5, 13.5] } },
        { id: "it", label: "Italie", values: { "2a": 24, "10a": 19, "30a": 15 }, errors: { "2a": [12, 36], "10a": [9.5, 28.5], "30a": [7.5, 22.5] } },
      ]}
    />
  ),
};

export const HiddenYAxisLine: Story = {
  name: "Sans ligne d'axe Y, axe X prolongé (hideYAxisLine)",
  args: { hideYAxisLine: true },
  argTypes: { hideYAxisLine: { control: "boolean" } },
  render: (args) => <BarChart {...args} data={MONTHLY_RETURN} colorByValue formatValue={(v) => `${v.toFixed(1)} %`} />,
};

const AXIS_CONTROLS = { showYAxisLine: { control: "boolean" }, extendXAxisLine: { control: "boolean" }, hideYAxisLine: { control: "boolean" } } as const;

/** Ligne de l'axe Y masquée, valeurs et grille gardées ; l'axe X n'est pas prolongé. */
export const YAxisLineOnlyHidden: Story = {
  name: "Ligne d'axe Y masquée seule (showYAxisLine={false})",
  args: { showYAxisLine: false },
  argTypes: AXIS_CONTROLS,
  render: HiddenYAxisLine.render,
};

/** Axe Y gardé, ligne de l'axe X prolongée sous ses valeurs jusqu'au bord gauche. */
export const ExtendedXAxisLine: Story = {
  name: "Axe X prolongé à gauche (extendXAxisLine)",
  args: { extendXAxisLine: true },
  argTypes: AXIS_CONTROLS,
  render: HiddenYAxisLine.render,
};
