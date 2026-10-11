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
