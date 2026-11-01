import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Radio, RadioGroup, type RadioOption } from "./RadioGroup";

const meta: Meta<typeof RadioGroup> = {
  title: "Forms/RadioGroup",
  component: RadioGroup,
};
export default meta;
type Story = StoryObj<typeof RadioGroup>;

type Frequency = "daily" | "weekly" | "monthly";

const FREQUENCIES: RadioOption<Frequency>[] = [
  { value: "daily", label: "Chaque jour, après la clôture" },
  { value: "weekly", label: "Chaque lundi matin" },
  { value: "monthly", label: "Le premier jour ouvré du mois" },
];

const PLANS: RadioOption[] = [
  { value: "essentiel", label: "Essentiel", description: "Un portefeuille, cotations différées de 15 minutes." },
  { value: "pro", label: "Pro", description: "Portefeuilles illimités, cotations en temps réel et alertes de cours." },
  { value: "equipe", label: "Équipe", description: "Tout Pro, plus les espaces partagés et le journal d'audit." },
  { value: "institutionnel", label: "Institutionnel", description: "Sur devis uniquement.", disabled: true },
];

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState<Frequency>("weekly");
    return <RadioGroup label="Fréquence du relevé" options={FREQUENCIES} value={value} onChange={setValue} />;
  },
};

/** Une description par option, et une option désactivée — les flèches la sautent. */
export const WithDescriptions: Story = {
  name: "Avec descriptions",
  render: () => (
    <div style={{ maxWidth: 420 }}>
      <RadioGroup label="Formule" options={PLANS} defaultValue="pro" helperText="Changement possible à tout moment." />
    </div>
  ),
};

export const Horizontal: Story = {
  name: "Horizontal",
  render: () => (
    <RadioGroup
      label="Période"
      orientation="horizontal"
      defaultValue="1m"
      options={[
        { value: "1j", label: "1 jour" },
        { value: "1s", label: "1 semaine" },
        { value: "1m", label: "1 mois" },
        { value: "1a", label: "1 an" },
      ]}
    />
  ),
};

export const WithError: Story = {
  name: "En erreur",
  render: () => {
    const [value, setValue] = useState<Frequency | null>(null);
    return (
      <RadioGroup
        label="Fréquence du relevé"
        options={FREQUENCIES}
        value={value}
        onChange={setValue}
        required
        error={value ? undefined : "Choisissez une fréquence."}
      />
    );
  },
};

export const Disabled: Story = {
  name: "Désactivé",
  render: () => <RadioGroup label="Fréquence du relevé" options={FREQUENCIES} defaultValue="daily" disabled />,
};

/** `Radio` seul, pour une mise en page que `RadioGroup` ne couvre pas : c'est le `name` partagé
 *  qui rend le choix exclusif et donne les flèches. */
export const StandaloneRadio: Story = {
  name: "Radio seul",
  render: () => {
    const [value, setValue] = useState("csv");
    return (
      <div role="radiogroup" aria-label="Format d'export" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Radio name="export" value="csv" label="CSV" checked={value === "csv"} onChange={setValue} />
        <Radio name="export" value="xlsx" label="Excel" checked={value === "xlsx"} onChange={setValue} />
        <Radio name="export" value="pdf" label="PDF" description="Mise en page A4, une page par compte." checked={value === "pdf"} onChange={setValue} />
      </div>
    );
  },
};
