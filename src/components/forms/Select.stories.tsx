import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Select } from "./Select";

const meta: Meta<typeof Select> = {
  title: "Forms/Input/Select",
  component: Select,
};
export default meta;
type Story = StoryObj<typeof Select>;

const OPTIONS = [
  { value: "eur", label: "Euro (€)" },
  { value: "usd", label: "Dollar US ($)" },
  { value: "gbp", label: "Livre sterling (£)" },
  { value: "chf", label: "Franc suisse (CHF)" },
];

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>("eur");
    return (
      <div style={{ maxWidth: 260 }}>
        <Select label="Devise" options={OPTIONS} value={value} onChange={setValue} />
      </div>
    );
  },
};

export const NearBottomEdge: Story = {
  name: "Flip vers le haut (peu d'espace en bas)",
  render: () => {
    const [value, setValue] = useState<string | null>(null);
    return (
      <div style={{ maxWidth: 260, marginTop: "70vh" }}>
        <Select options={OPTIONS} value={value} onChange={setValue} placeholder="Ouvrir ici — proche du bas" />
      </div>
    );
  },
};

export const WithError: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>(null);
    return (
      <div style={{ maxWidth: 260 }}>
        <Select label="Devise" options={OPTIONS} value={value} onChange={setValue} error="Sélection requise" />
      </div>
    );
  },
};

export const Sizes: Story = {
  name: "Tailles (small / normal)",
  render: () => {
    const [value, setValue] = useState<string | null>("eur");
    return (
      <div style={{ maxWidth: 260, display: "flex", flexDirection: "column", gap: 16 }}>
        <Select size="small" label="Small" options={OPTIONS} value={value} onChange={setValue} />
        <Select label="Normal (défaut)" options={OPTIONS} value={value} onChange={setValue} />
      </div>
    );
  },
};
