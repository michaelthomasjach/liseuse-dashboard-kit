import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { LqThemeProvider } from "../../theme";
import { Input } from "./Input";
import { InputDropdown } from "./InputDropdown";
import { InputNumber } from "./InputNumber";
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

/** Libellés dans la boîte pour tout un sous-arbre : `LqThemeProvider fieldLabelPosition="inside"`.
 *  `Select`, `InputDropdown`, `Input`, `InputNumber`… le suivent sans `labelPosition` ; un champ qui
 *  reçoit le sien le garde. Dans une liste, le libellé reste en petit au-dessus de la valeur. */
export const LabelInsideFromTheme: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>("eur");
    const [pair, setPair] = useState<string | null>(null);
    const [amount, setAmount] = useState<number | "">(1000);
    return (
      <LqThemeProvider fieldLabelPosition="inside">
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 320, padding: 8 }}>
          <Select label="Devise" options={OPTIONS} value={value} onChange={setValue} />
          <InputDropdown label="Paire" options={OPTIONS} value={pair} onChange={setPair} placeholder="Rechercher une devise…" />
          <InputNumber label="Montant" value={amount} onChange={setAmount} suffix="€" />
          <Input label="Commentaire" />
          <Input label="Libellé au-dessus (choix du champ)" labelPosition="above" />
        </div>
      </LqThemeProvider>
    );
  },
};
