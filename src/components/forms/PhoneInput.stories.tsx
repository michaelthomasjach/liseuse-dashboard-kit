import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { PhoneInput } from "./PhoneInput";
import { Text } from "../primitives/Text";

/**
 * Le numéro de téléphone : un `MaskedInput` réglé sur le mobile français, avec son icône.
 */
const meta = {
  title: "Forms/Input/PhoneInput",
  component: PhoneInput,
  parameters: {
    docs: {
      description: {
        component: [
          "Champ de numéro de téléphone. C'est un `MaskedInput` préréglé : motif `## ## ## ## ##` (dix chiffres groupés par deux, le format français), `type=\"tel\"`, et une icône de combiné en tête — remplaçable par `leadingIcon`.",
          "",
          "**Quand l'utiliser** — la saisie d'un numéro dans une fiche client, un formulaire de contact, un profil. Pour un autre format national ou international, passez votre propre `mask` ; pour un identifiant qui n'est pas un numéro de téléphone, prenez `MaskedInput`.",
          "",
          "**Valeur** — composant **contrôlé**, qui ne connaît que les chiffres : `value=\"0612345678\"`, jamais les espaces. C'est la forme à stocker ; l'affichage groupé est recalculé à chaque rendu.",
          "",
          "**Comportement** — les caractères non numériques sont ignorés, y compris au collage d'un numéro déjà formaté (`06.12.34.56.78` donne `0612345678`). La saisie s'arrête quand le motif est plein. Aucune vérification de validité : l'appelant décide de l'erreur. Pour un indicatif international, mettez le `+` dans le motif mais **pas** les chiffres de l'indicatif (`+## # ## ## ## ##`) : un chiffre écrit dans le motif serait relu comme une saisie.",
          "",
          "**Thème** — celui de tous les champs : `--lq-control-height`, `--lq-control-padding-x`, `--lq-control-font-size`, `--lq-control-color`, `--lq-field-label-size`, `--lq-field-label-weight`, `--lq-field-helper-offset`.",
        ].join("\n"),
      },
    },
  },
  args: { label: "Téléphone", value: "0612345678", onChange: fn() },
  argTypes: {
    value: { control: false },
    onChange: { control: false },
    leadingIcon: { control: false },
    trailingIcon: { control: false },
  },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <div style={{ maxWidth: 360, display: "flex", flexDirection: "column", gap: 8 }}>
        <PhoneInput
          {...args}
          value={value}
          onChange={(raw) => {
            setValue(raw);
            args.onChange(raw);
          }}
        />
        <Text size="sm" muted>
          Valeur stockée : {value || "—"}
        </Text>
      </div>
    );
  },
} satisfies Meta<typeof PhoneInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Défaut" };

export const Empty: Story = {
  name: "Vide",
  args: { label: "Téléphone du gérant", value: "", helperText: "Un mobile de préférence, pour les alertes par SMS." },
  parameters: { docs: { description: { story: "Vide, le champ montre déjà tout le motif : on voit combien de chiffres sont attendus." } } },
};

export const International: Story = {
  name: "Format international",
  args: { label: "Téléphone (international)", mask: "+## # ## ## ## ##", value: "33612345678" },
  parameters: { docs: { description: { story: "Le `+` est un littéral du motif ; l'indicatif `33` est saisi comme le reste et fait partie de la valeur stockée." } } },
};

export const WithError: Story = {
  name: "En erreur",
  args: { label: "Téléphone", value: "06123" },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <div style={{ maxWidth: 360 }}>
        <PhoneInput
          {...args}
          value={value}
          onChange={(raw) => {
            setValue(raw);
            args.onChange(raw);
          }}
          error={value.length === 10 ? undefined : "Le numéro compte 10 chiffres."}
        />
      </div>
    );
  },
};

export const Disabled: Story = {
  name: "Désactivé",
  args: { label: "Ligne du standard", disabled: true, value: "0478000000" },
};
