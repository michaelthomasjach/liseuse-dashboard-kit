import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { CreditCardInput } from "./CreditCardInput";
import { Text } from "../primitives/Text";

/** La clé de Luhn : le contrôle que tout numéro de carte doit passer. Écrite ici pour la story —
 *  le composant ne la vérifie pas. */
function luhnOk(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return digits.length > 0 && sum % 10 === 0;
}

/**
 * Le numéro de carte de paiement : un `MaskedInput` à seize chiffres groupés par quatre.
 */
const meta = {
  title: "Forms/Input/CreditCardInput",
  component: CreditCardInput,
  parameters: {
    docs: {
      description: {
        component: [
          "Champ de numéro de carte. C'est un `MaskedInput` au motif **fixe** `#### #### #### ####` — seize chiffres en quatre groupes, celui des cartes Visa et Mastercard —, avec une icône de carte en tête (remplaçable par `leadingIcon`).",
          "",
          "**Quand l'utiliser** — une maquette de tunnel de paiement, un back-office qui saisit des numéros de test ou de carte d'entreprise. Pour un vrai paiement, le numéro ne doit pas transiter par votre application : c'est le champ hébergé du prestataire de paiement qui le reçoit (exigence PCI DSS).",
          "",
          "**Valeur** — composant **contrôlé** : `value` et `onChange` portent les seize chiffres bruts, sans espaces.",
          "",
          "**Ce qu'il ne fait pas** — il ne reconnaît pas le réseau de la carte, ne vérifie pas la clé de Luhn et ne s'adapte pas aux longueurs atypiques : une American Express (15 chiffres, `#### ###### #####`) demande un `MaskedInput` à son motif. La validation revient à l'appelant, par `error` — la story « En erreur » montre un contrôle de Luhn écrit à côté.",
          "",
          "**Thème** — celui de tous les champs : `--lq-control-height`, `--lq-control-padding-x`, `--lq-control-font-size`, `--lq-control-color`, `--lq-field-label-size`, `--lq-field-helper-offset`, `--lq-color-danger`.",
        ].join("\n"),
      },
    },
  },
  args: { label: "Carte de paiement", value: "4242424242424242", onChange: fn() },
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
        <CreditCardInput
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
} satisfies Meta<typeof CreditCardInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Défaut" };

export const Empty: Story = {
  name: "Vide",
  args: { label: "Carte d'entreprise", value: "", helperText: "Les seize chiffres au recto de la carte." },
};

export const WithError: Story = {
  name: "En erreur",
  args: { value: "4242424242424241" },
  parameters: { docs: { description: { story: "L'erreur vient de l'appelant : ici un numéro complet mais dont la clé de Luhn est fausse. Corrigez le dernier chiffre en `2` pour la faire disparaître." } } },
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    const error = value.length < 16 ? "Numéro incomplet." : luhnOk(value) ? undefined : "Ce numéro de carte n'est pas valide.";
    return (
      <div style={{ maxWidth: 360 }}>
        <CreditCardInput
          {...args}
          value={value}
          onChange={(raw) => {
            setValue(raw);
            args.onChange(raw);
          }}
          error={error}
        />
      </div>
    );
  },
};

export const Small: Story = {
  name: "Petit",
  args: { size: "small", value: "5555555555554444" },
};

export const Disabled: Story = {
  name: "Désactivé",
  args: { label: "Carte enregistrée", disabled: true, helperText: "Expire en 09/2028." },
};
