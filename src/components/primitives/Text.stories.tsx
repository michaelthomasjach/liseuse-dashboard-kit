import type { Meta, StoryObj } from "@storybook/react";
import { Text } from "./Text";

/**
 * Le texte courant, sur l'échelle typographique du thème : paragraphes, légendes, aides.
 */
const meta = {
  title: "Primitives/Text",
  component: Text,
  parameters: {
    docs: {
      description: {
        component: [
          "Texte courant posé sur l'échelle du thème : un paragraphe, une légende sous un chiffre, une source, une phrase d'aide. Il rend un `<p>` par défaut ; `as=\"span\"` pour du texte en ligne, `as=\"div\"` pour un bloc qui contient d'autres blocs.",
          "",
          "**Tailles** — `xs`, `sm`, `md` (défaut), `lg`, `xl`. Elles suivent `--lq-text-xs` à `--lq-text-xl`, interligne `--lq-line-height-body`. Une valeur mise en avant (un montant, un compte) se pose en `xl` et `bold`.",
          "",
          "**Graisses** — `regular` (400, défaut), `medium` et `bold`, qui suivent `--lq-font-weight-semibold` et `--lq-font-weight-bold`.",
          "",
          "**Atténué** — `muted` passe à la couleur secondaire : légendes, sources, dates.",
          "",
          "**Quand l'utiliser** — partout où il y a du texte dans un écran plutôt qu'un `<p>` nu, pour qu'il suive le thème. Pour un titre, `Heading` ; pour un intitulé de champ ou de groupe, le `label` du composant concerné.",
          "",
          "**Thème** — `--lq-text-xs` à `--lq-text-xl`, `--lq-line-height-body`, `--lq-color-text`, `--lq-color-text-muted`, `--lq-font-weight-semibold`, `--lq-font-weight-bold`.",
        ].join("\n"),
      },
    },
  },
  args: { children: "Le revenu progresse de 12,4 % sur un mois, porté par les abonnements annuels." },
  argTypes: { children: { control: "text" } },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Défaut" };

export const Muted: Story = {
  name: "Atténué",
  args: { size: "sm", muted: true, children: "Chiffres consolidés au 31 octobre 2026, hors taxes." },
};

export const Sizes: Story = {
  name: "Tailles",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Text size="xl">xl — Revenu récurrent mensuel</Text>
      <Text size="lg">lg — Revenu récurrent mensuel</Text>
      <Text size="md">md — Revenu récurrent mensuel</Text>
      <Text size="sm">sm — Revenu récurrent mensuel</Text>
      <Text size="xs">xs — Revenu récurrent mensuel</Text>
    </div>
  ),
};

export const Weights: Story = {
  name: "Graisses",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Text weight="regular">regular — 80 000 € de revenu mensuel</Text>
      <Text weight="medium">medium — 80 000 € de revenu mensuel</Text>
      <Text weight="bold">bold — 80 000 € de revenu mensuel</Text>
    </div>
  ),
};

export const KeyFigure: Story = {
  name: "Chiffre clé et légende",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Text size="sm" muted as="span">
        Revenu récurrent mensuel
      </Text>
      <Text size="xl" weight="bold">
        80 000 €
      </Text>
      <Text size="xs" muted as="span">
        Source : facturation · export automatique
      </Text>
    </div>
  ),
  parameters: { docs: { description: { story: "La combinaison la plus courante d'un tableau de bord : une valeur en `xl bold`, encadrée de deux légendes atténuées." } } },
};
