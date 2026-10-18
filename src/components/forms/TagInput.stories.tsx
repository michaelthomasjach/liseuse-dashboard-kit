import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { TagInput } from "./TagInput";

const meta: Meta<typeof TagInput> = {
  title: "Forms/Input/TagInput",
  component: TagInput,
};
export default meta;
type Story = StoryObj<typeof TagInput>;

export const Default: Story = {
  render: () => {
    const [tags, setTags] = useState<string[]>(["AAPL", "MSFT"]);
    return (
      <div style={{ maxWidth: 360 }}>
        <TagInput
          label="Symboles suivis"
          value={tags}
          onChange={setTags}
          placeholder="Ajouter un symbole…"
          helperText="Virgule ou Entrée pour ajouter, Retour arrière pour retirer le dernier"
        />
      </div>
    );
  },
};

export const MaxFive: Story = {
  name: "Limité à 5 tags",
  render: () => {
    const [tags, setTags] = useState<string[]>(["Actions", "Obligations", "Immobilier"]);
    return (
      <div style={{ maxWidth: 360 }}>
        <TagInput label="Catégories" value={tags} onChange={setTags} maxTags={5} helperText={`${tags.length} / 5`} />
      </div>
    );
  },
};

export const WithError: Story = {
  render: () => {
    const [tags, setTags] = useState<string[]>([]);
    return (
      <div style={{ maxWidth: 360 }}>
        <TagInput label="Symboles suivis" value={tags} onChange={setTags} error="Ajoutez au moins un symbole" />
      </div>
    );
  },
};

export const Sizes: Story = {
  name: "Tailles (small / normal)",
  render: () => {
    const [tags, setTags] = useState<string[]>(["AAPL", "MSFT"]);
    return (
      <div style={{ maxWidth: 360, display: "flex", flexDirection: "column", gap: 16 }}>
        <TagInput size="small" label="Small" value={tags} onChange={setTags} placeholder="Ajouter…" />
        <TagInput label="Normal (défaut)" value={tags} onChange={setTags} placeholder="Ajouter…" />
      </div>
    );
  },
};

/** Choix multiple dans une liste connue (`suggestions` + `restrictToSuggestions`) : filtrée à la saisie, ↑/↓ et Entrée. */
export const WithSuggestions: Story = {
  name: "Avec suggestions (choix multiple d'indices)",
  render: () => {
    const [value, setValue] = useState<string[]>(["sp500"]);
    return (
      <div style={{ maxWidth: 420 }}>
        <TagInput
          label="Indices"
          placeholder="Ajouter un indice…"
          value={value}
          onChange={setValue}
          restrictToSuggestions
          suggestions={[
            { value: "sp500", label: "S&P 500", description: "États-Unis · 500 sociétés" },
            { value: "ndx", label: "Nasdaq-100", description: "États-Unis · 100 sociétés" },
            { value: "dji", label: "Dow Jones", description: "États-Unis · 30 sociétés" },
            { value: "cac40", label: "CAC 40", description: "France · 40 sociétés" },
            { value: "dax", label: "DAX", description: "Allemagne · 40 sociétés" },
          ]}
        />
      </div>
    );
  },
};
