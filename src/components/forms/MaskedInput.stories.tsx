import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { MaskedInput } from "./MaskedInput";
import { Text } from "../primitives/Text";

/**
 * Le champ à motif générique. `PhoneInput`, `CreditCardInput` et `DateInput` n'en sont que des
 * préréglages : pour tout autre format de chiffres (IBAN, SIRET, code postal…), c'est lui.
 */
const meta = {
  title: "Forms/Input/MaskedInput",
  component: MaskedInput,
  parameters: {
    docs: {
      description: {
        component: [
          "Champ de saisie qui range des **chiffres** dans un motif. Dans `mask`, chaque `#` est une case pour un chiffre ; tout autre caractère est un littéral posé automatiquement (espace, tiret, barre, lettres). Le motif entier reste visible, les cases encore vides affichant `maskChar` (`_` par défaut).",
          "",
          "**Quand l'utiliser** — un identifiant de longueur fixe qu'on recopie depuis un document : IBAN, SIRET, code postal, numéro de contrat. Pour un téléphone, une carte ou une date tapée, prenez directement `PhoneInput`, `CreditCardInput` ou `DateInput`. Pour une quantité ou un montant (un nombre sur lequel on calcule), c'est `InputNumber` ; pour du texte libre, `Input`.",
          "",
          "**Valeur** — composant **contrôlé**. `value` et `onChange` ne portent que les chiffres bruts, sans littéraux (`\"69003\"`, pas `\"69 003\"`) : c'est ce que l'application doit stocker, l'affichage étant recalculé à chaque rendu. Les zéros de tête sont donc conservés, ce qu'un champ numérique perdrait.",
          "",
          "**Comportement** — tout ce qui n'est pas un chiffre est ignoré, à la frappe comme au collage, et la saisie s'arrête quand toutes les cases sont pleines ; le curseur se replace juste après le dernier chiffre. Sur mobile, le clavier numérique s'ouvre (`inputMode=\"numeric\"`). Le champ ne vérifie pas que le motif est complet : c'est à l'appelant de le faire et de passer `error`.",
          "",
          "**Deux pièges** — un littéral ne doit pas contenir de chiffre (`+33 …` serait relu comme une saisie : écrivez `+## …`). Et le champ n'est jamais vide, puisque le motif s'affiche : `placeholder` ne se voit pas, et un libellé intégré (`labelPosition=\"inside\"`) reste en position réduite.",
          "",
          "**Anatomie** — c'est un `Input` : libellé, icônes de tête et de queue, texte d'aide, erreur, `size`, `labelPosition`, et tous les attributs d'un `<input>`.",
          "",
          "**Thème** — les variables du champ texte : `--lq-control-height`, `--lq-control-padding-x`, `--lq-control-font-size`, `--lq-control-color`, `--lq-control-border-width`, `--lq-field-label-size`, `--lq-field-label-weight`, `--lq-field-helper-offset`, `--lq-color-danger` pour l'erreur.",
        ].join("\n"),
      },
    },
  },
  args: {
    label: "IBAN",
    mask: "FR## #### #### #### #### #### ###",
    value: "7630006000011234567890189",
    onChange: fn(),
  },
  argTypes: {
    value: { control: false },
    onChange: { control: false },
    leadingIcon: { control: false },
    trailingIcon: { control: false },
  },
  // La story tient la valeur ; `args.value` n'en est que la valeur de départ.
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <div style={{ maxWidth: 420, display: "flex", flexDirection: "column", gap: 8 }}>
        <MaskedInput
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
} satisfies Meta<typeof MaskedInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Défaut" };

export const PostalCode: Story = {
  name: "Code postal",
  args: { label: "Code postal", mask: "## ###", value: "69003", helperText: "Cinq chiffres, sans le nom de la ville." },
  parameters: { docs: { description: { story: "Un motif court. La valeur stockée garde son zéro de tête quand il y en a un (`01000`), ce qu'un champ numérique perdrait." } } },
};

export const WithError: Story = {
  name: "En erreur",
  args: { label: "SIRET", mask: "### ### ### #####", value: "552100554" },
  parameters: { docs: { description: { story: "Le champ ne valide rien : l'erreur est calculée par l'appelant sur la valeur brute, ici tant que les 14 chiffres ne sont pas tous saisis." } } },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return (
      <div style={{ maxWidth: 420 }}>
        <MaskedInput
          {...args}
          value={value}
          onChange={(raw) => {
            setValue(raw);
            args.onChange(raw);
          }}
          error={value.length === 14 ? undefined : `Le SIRET compte 14 chiffres (${value.length} saisis).`}
        />
      </div>
    );
  },
};

export const CustomMaskChar: Story = {
  name: "Caractère de case personnalisé",
  args: { label: "Numéro de contrat", mask: "####-####-##", maskChar: "·", value: "2026" },
  parameters: { docs: { description: { story: "`maskChar` change le caractère des cases vides — un point médian se lit moins comme un champ « à trous » que le tiret bas." } } },
};

export const Small: Story = {
  name: "Petit",
  args: { label: "Code postal", mask: "## ###", value: "", size: "small" },
};

export const Disabled: Story = {
  name: "Désactivé",
  args: { label: "IBAN enregistré", disabled: true, helperText: "Modifiable par l'administrateur seulement." },
};
