import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./Input";
import { SearchIcon } from "../icons";

const meta: Meta<typeof Input> = {
  title: "Forms/Input/Input",
  component: Input,
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState("");
    return (
      <div style={{ maxWidth: 280 }}>
        <Input label="Nom du portefeuille" placeholder="Mon portefeuille" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
    );
  },
};

export const WithIconAndHelper: Story = {
  render: () => (
    <div style={{ maxWidth: 280 }}>
      <Input label="Rechercher un actif" placeholder="AAPL, MSFT…" leadingIcon={<SearchIcon size={16} />} helperText="Symbole ou nom de société" />
    </div>
  ),
};

export const WithError: Story = {
  render: () => (
    <div style={{ maxWidth: 280 }}>
      <Input label="Email" defaultValue="pas-un-email" error="Adresse email invalide" />
    </div>
  ),
};

export const Sizes: Story = {
  name: "Tailles (small / normal)",
  render: () => (
    <div style={{ maxWidth: 280, display: "flex", flexDirection: "column", gap: 16 }}>
      <Input size="small" label="Small" placeholder="Compact" leadingIcon={<SearchIcon size={14} />} />
      <Input label="Normal (défaut)" placeholder="40px" leadingIcon={<SearchIcon size={16} />} />
    </div>
  ),
};

/** Le libellé dans la boîte : il rétrécit au focus et une fois le champ rempli ; `required` pose
 *  l'astérisque dans le coin. */
export const LabelInside: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 480 }}>
      <Input labelPosition="inside" label="Projet" required />
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Input labelPosition="inside" label="Prénom" required />
        </div>
        <div style={{ flex: 1 }}>
          <Input labelPosition="inside" label="Nom" />
        </div>
      </div>
      <Input labelPosition="inside" label="Courriel" placeholder="ex. : nom@exemple.fr" required />
      <Input labelPosition="inside" label="Désactivé" placeholder="Rien à saisir ici" disabled />
    </div>
  ),
};
