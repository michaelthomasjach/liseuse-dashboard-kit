import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { InputNumber } from "./InputNumber";

const meta: Meta<typeof InputNumber> = {
  title: "Forms/Input/InputNumber",
  component: InputNumber,
};
export default meta;
type Story = StoryObj<typeof InputNumber>;

export const Currency: Story = {
  render: () => {
    const [value, setValue] = useState<number | "">(1000);
    return (
      <div style={{ maxWidth: 220 }}>
        <InputNumber label="Montant à investir" value={value} onChange={setValue} prefix="€" min={0} step={100} />
      </div>
    );
  },
};

export const Percentage: Story = {
  render: () => {
    const [value, setValue] = useState<number | "">(2.5);
    return (
      <div style={{ maxWidth: 220 }}>
        <InputNumber label="Taux annuel" value={value} onChange={setValue} suffix="%" step={0.1} min={0} max={100} />
      </div>
    );
  },
};

export const Quantity: Story = {
  render: () => {
    const [value, setValue] = useState<number | "">(10);
    return (
      <div style={{ maxWidth: 220 }}>
        <InputNumber label="Quantité" value={value} onChange={setValue} min={0} step={1} />
      </div>
    );
  },
};

export const Sizes: Story = {
  name: "Tailles (small / normal)",
  render: () => {
    const [value, setValue] = useState<number | "">(1000);
    return (
      <div style={{ maxWidth: 220, display: "flex", flexDirection: "column", gap: 16 }}>
        <InputNumber size="small" label="Small" value={value} onChange={setValue} prefix="€" min={0} step={100} />
        <InputNumber label="Normal (défaut)" value={value} onChange={setValue} prefix="€" min={0} step={100} />
      </div>
    );
  },
};
