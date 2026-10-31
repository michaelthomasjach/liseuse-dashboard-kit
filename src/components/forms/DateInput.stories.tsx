import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { DateInput } from "./DateInput";
import { Text } from "../primitives/Text";

/** Les huit chiffres jjmmaaaa → une vraie date, ou `null` si elle n'existe pas (31/02…). Écrit ici
 *  pour la story : le composant ne valide rien. */
function parseJJMMAAAA(raw: string): Date | null {
  if (raw.length !== 8) return null;
  const j = Number(raw.slice(0, 2));
  const m = Number(raw.slice(2, 4));
  const a = Number(raw.slice(4));
  const d = new Date(a, m - 1, j);
  return d.getFullYear() === a && d.getMonth() === m - 1 && d.getDate() === j ? d : null;
}

/**
 * La date tapée au clavier, sans calendrier : un `MaskedInput` au motif jj/mm/aaaa.
 */
const meta = {
  title: "Forms/DateInput",
  component: DateInput,
  parameters: {
    docs: {
      description: {
        component: [
          "Champ de date **tapée** : un `MaskedInput` préréglé sur `##/##/####` (jj/mm/aaaa), avec une icône de calendrier en tête. Les barres se posent seules, on ne tape que les chiffres.",
          "",
          "**Quand l'utiliser** — une date qu'on recopie et qu'on connaît déjà, souvent loin du jour présent : une date de naissance, une date de création d'entreprise, la date d'une pièce justificative. Feuilleter un calendrier jusqu'en 1987 serait pénible. Pour une date proche, ou à choisir en voyant les jours de la semaine (une échéance, un rendez-vous), prenez `DatePicker` ; pour une période, `DateRangePicker`.",
          "",
          "**Valeur** — composant **contrôlé**, qui ne manipule que des **chiffres** : `value=\"14031987\"` pour le 14 mars 1987, pas un objet `Date`. Le composant ne vérifie ni que la date est complète ni qu'elle existe (31/02) : convertissez et validez côté appelant, puis passez `error`. `mask` permet un autre ordre (`##/####` pour un mois et une année, `####-##-##` pour l'ISO).",
          "",
          "**Comportement** — celui de `MaskedInput` : non-chiffres ignorés, au collage aussi (`14.03.1987` donne `14031987`) ; saisie arrêtée à huit chiffres ; clavier numérique sur mobile. Le champ n'est jamais vide, puisque le motif s'affiche.",
          "",
          "**Thème** — celui des champs : `--lq-control-height`, `--lq-control-padding-x`, `--lq-control-font-size`, `--lq-control-color`, `--lq-field-label-size`, `--lq-field-helper-offset`, `--lq-color-danger`.",
        ].join("\n"),
      },
    },
  },
  args: { label: "Date de naissance du gérant", value: "14031987", helperText: "Chiffres seulement : les barres se placent seules.", onChange: fn() },
  argTypes: {
    value: { control: false },
    onChange: { control: false },
    leadingIcon: { control: false },
    trailingIcon: { control: false },
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    const date = parseJJMMAAAA(value);
    return (
      <div style={{ maxWidth: 320, display: "flex", flexDirection: "column", gap: 8 }}>
        <DateInput
          {...args}
          value={value}
          onChange={(raw) => {
            setValue(raw);
            args.onChange(raw);
          }}
        />
        <Text size="sm" muted>
          Valeur stockée : {value || "—"}
          {date ? ` · ${date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}` : ""}
        </Text>
      </div>
    );
  },
} satisfies Meta<typeof DateInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Défaut" };

export const Empty: Story = {
  name: "Vide",
  args: { label: "Date de la pièce", value: "", helperText: undefined },
};

export const WithValidation: Story = {
  name: "Avec validation",
  args: { label: "Date de création de la société", value: "3102", helperText: undefined },
  parameters: { docs: { description: { story: "La validation est écrite par l'appelant : date incomplète, puis inexistante (essayez `31022020`), puis dans le futur." } } },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    const date = parseJJMMAAAA(value);
    const error =
      value.length < 8
        ? "Date incomplète."
        : !date
          ? "Cette date n'existe pas."
          : date > new Date(2026, 9, 31)
            ? "La date ne peut pas être dans le futur."
            : undefined;
    return (
      <div style={{ maxWidth: 320 }}>
        <DateInput
          {...args}
          value={value}
          onChange={(raw) => {
            setValue(raw);
            args.onChange(raw);
          }}
          error={error}
          helperText={error ? undefined : "Date valide."}
        />
      </div>
    );
  },
};

export const MonthYear: Story = {
  name: "Mois et année",
  args: { label: "Date d'expiration", mask: "##/####", value: "092028", helperText: "Mois et année, comme sur la carte." },
  parameters: { docs: { description: { story: "`mask` change le motif : ici six chiffres, mmaaaa." } } },
};

export const Small: Story = {
  name: "Petit",
  args: { label: "Du", size: "small", value: "01102026", helperText: undefined },
};

export const Disabled: Story = {
  name: "Désactivé",
  args: { label: "Date d'immatriculation", value: "12032024", disabled: true, helperText: "Reprise du Kbis." },
};
