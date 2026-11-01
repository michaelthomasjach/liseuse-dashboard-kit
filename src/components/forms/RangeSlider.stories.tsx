import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { RangeSlider } from "./RangeSlider";

const meta: Meta<typeof RangeSlider> = {
  title: "Forms/RangeSlider",
  component: RangeSlider,
};
export default meta;
type Story = StoryObj<typeof RangeSlider>;

export const PriceRange: Story = {
  name: "Fourchette de prix (glisser le segment pour décaler)",
  render: () => {
    const [value, setValue] = useState<[number, number]>([20, 80]);
    return (
      <div style={{ maxWidth: 320 }}>
        <RangeSlider label="Fourchette de prix" min={0} max={100} value={value} onChange={setValue} formatValue={(v) => `${v} €`} />
      </div>
    );
  },
};

export const MarketCap: Story = {
  name: "Capitalisation (M€, pas de 10)",
  render: () => {
    const [value, setValue] = useState<[number, number]>([100, 500]);
    return (
      <div style={{ maxWidth: 320 }}>
        <RangeSlider label="Capitalisation boursière" min={0} max={1000} step={10} value={value} onChange={setValue} formatValue={(v) => `${v} M€`} />
      </div>
    );
  },
};

export const YearRange: Story = {
  name: "Plage d'années",
  render: () => {
    const [value, setValue] = useState<[number, number]>([2015, 2024]);
    return (
      <div style={{ maxWidth: 320 }}>
        <RangeSlider label="Période d'analyse" min={2000} max={2026} step={1} value={value} onChange={setValue} formatValue={(v) => `${v}`} />
      </div>
    );
  },
};

export const CenteredOnZero: Story = {
  name: "Centré sur zéro (négatif à gauche, positif à droite)",
  render: () => {
    const [value, setValue] = useState<[number, number]>([-25, 40]);
    return (
      <div style={{ maxWidth: 320 }}>
        <RangeSlider
          label="Variation attendue"
          min={-50}
          max={50}
          value={value}
          onChange={setValue}
          formatValue={(v) => `${v > 0 ? "+" : ""}${v} %`}
          centerZero
        />
      </div>
    );
  },
};

export const Disabled: Story = {
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <RangeSlider label="Fourchette de prix" min={0} max={100} value={[30, 70]} onChange={() => {}} disabled />
    </div>
  ),
};

export const WithMarks: Story = {
  name: "Graduations avec libellés",
  render: () => {
    const [value, setValue] = useState<[number, number]>([25, 75]);
    return (
      <div style={{ maxWidth: 360 }}>
        <RangeSlider
          label="Part en actions"
          min={0}
          max={100}
          step={5}
          value={value}
          onChange={setValue}
          formatValue={(v) => `${v} %`}
          marks={[0, 25, 50, 75, 100].map((v) => ({ value: v, label: `${v} %` }))}
        />
      </div>
    );
  },
};

export const ValueBubbles: Story = {
  name: "Bulles de valeur (showValue)",
  render: () => {
    const [a, setA] = useState<[number, number]>([1200, 3400]);
    const [b, setB] = useState<[number, number]>([30, 60]);
    return (
      <div style={{ maxWidth: 360, display: "flex", flexDirection: "column", gap: 24 }}>
        <RangeSlider
          label="Budget (bulles permanentes)"
          min={0}
          max={5000}
          step={100}
          value={a}
          onChange={setA}
          showValue="always"
          formatValue={(v) => `${v.toLocaleString("fr-FR")} €`}
        />
        <RangeSlider label="Heures creuses (bulles au survol)" min={0} max={100} value={b} onChange={setB} showValue="auto" formatValue={(v) => `${v} %`} />
      </div>
    );
  },
};

export const Tones: Story = {
  name: "Tons",
  render: () => {
    const tones = ["accent", "success", "info", "danger", "warning"] as const;
    const [values, setValues] = useState<[number, number][]>(tones.map((_, i) => [10 + i * 8, 60 + i * 6]));
    return (
      <div style={{ maxWidth: 360, display: "flex", flexDirection: "column", gap: 16 }}>
        {tones.map((tone, i) => (
          <RangeSlider
            key={tone}
            label={tone}
            min={0}
            max={100}
            tone={tone}
            value={values[i]}
            onChange={(v) => setValues((prev) => prev.map((p, j) => (j === i ? v : p)))}
          />
        ))}
      </div>
    );
  },
};

export const Vertical: Story = {
  name: "Vertical",
  render: () => {
    const [temp, setTemp] = useState<[number, number]>([18, 22]);
    const [delta, setDelta] = useState<[number, number]>([-20, 30]);
    return (
      <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>
        <RangeSlider
          label="Plage de confort"
          orientation="vertical"
          height={200}
          min={12}
          max={30}
          step={0.5}
          value={temp}
          onChange={setTemp}
          formatValue={(v) => `${v.toLocaleString("fr-FR")} °C`}
          marks={[12, 18, 24, 30].map((v) => ({ value: v, label: `${v} °C` }))}
          tone="info"
        />
        <RangeSlider
          label="Variation"
          orientation="vertical"
          height={200}
          min={-50}
          max={50}
          value={delta}
          onChange={setDelta}
          formatValue={(v) => `${v > 0 ? "+" : ""}${v} %`}
          centerZero
        />
      </div>
    );
  },
};
