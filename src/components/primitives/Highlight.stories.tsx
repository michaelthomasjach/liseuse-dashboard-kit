import type { Meta, StoryObj } from "@storybook/react";
import { Highlight } from "./Highlight";
import { Text } from "./Text";
import { Sparkline } from "../charts/Sparkline";
import { REVENUE_TREND, SIGNUPS_TREND, CHURN_TREND } from "../../test-data/storyDemoData";

/**
 * La tuile KPI discrète : un filet épais en haut, un intitulé en petites capitales, la valeur au
 * premier plan, et pas de boîte.
 */
const meta = {
  title: "Primitives/Highlight",
  component: Highlight,
  parameters: {
    docs: {
      description: {
        component: [
          "Tuile d'indicateur sans cadre : un filet épais le long du bord supérieur, `title` réduit à un petit intitulé en capitales atténuées, et le contenu collé aux bords — une grande valeur, une ligne de variation, une `Sparkline`.",
          "",
          "**Ce que c'est** — un `Card` avec `highlight` toujours actif : il en accepte toutes les autres props (`meta`, `summary`, `footer`, `expandable`…). Le composant `Card` l'implémente ; cet export existe pour être trouvé.",
          "",
          "**Composition libre** — rien n'est imposé dans le corps : posez la valeur en `Text size=\"xl\" weight=\"bold\"`, la variation en `Text size=\"sm\" muted`, et une courbe si elle aide.",
          "",
          "**Quand l'utiliser** — une rangée de chiffres clés en tête d'écran, sans alourdir la page de boîtes. Pour une tuile tout faite (libellé, valeur, sous-texte, courbe) sans composer, `HighlightStatCard` ; pour un indicateur encadré avec étiquette de variation et icône, `StatCard`.",
          "",
          "**Thème** — le filet de 3 px prend `--lq-color-text` ; l'intitulé suit `--lq-label-font`, `--lq-label-size`, `--lq-label-weight`, `--lq-label-tracking` en `--lq-color-text-muted` ; les écarts `--lq-space-2` et `--lq-space-3`.",
        ].join("\n"),
      },
    },
  },
  args: {
    title: "Revenu mensuel",
    children: (
      <>
        <Text size="xl" weight="bold">
          80 000 €
        </Text>
        <Text size="sm" muted>
          +12,7 % sur un mois
        </Text>
        <Sparkline data={REVENUE_TREND} width={200} height={36} area />
      </>
    ),
  },
  argTypes: {
    title: { control: "text" },
    meta: { control: "text" },
    children: { control: false },
    summary: { control: false },
    footer: { control: false },
  },
  render: (args) => (
    <div style={{ maxWidth: 260 }}>
      <Highlight {...args} />
    </div>
  ),
} satisfies Meta<typeof Highlight>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Défaut" };

export const WithoutChart: Story = {
  name: "Sans courbe",
  args: {
    title: "Délai de paiement",
    children: (
      <>
        <Text size="xl" weight="bold">
          18 j
        </Text>
        <Text size="sm" muted>
          −2 j sur le trimestre
        </Text>
      </>
    ),
  },
};

export const Row: Story = {
  name: "Rangée de chiffres clés",
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 220px))", gap: 24 }}>
      <Highlight title="Revenu mensuel">
        <Text size="xl" weight="bold">
          80 000 €
        </Text>
        <Text size="sm" muted>
          +12,7 % sur un mois
        </Text>
        <Sparkline data={REVENUE_TREND} width={200} height={32} area />
      </Highlight>
      <Highlight title="Inscriptions">
        <Text size="xl" weight="bold">
          31
        </Text>
        <Text size="sm" muted>
          −2 sur un mois
        </Text>
        <Sparkline data={SIGNUPS_TREND} width={200} height={32} area />
      </Highlight>
      <Highlight title="Résiliations">
        <Text size="xl" weight="bold">
          4
        </Text>
        <Text size="sm" muted>
          −1 sur un mois
        </Text>
        <Sparkline data={CHURN_TREND} width={200} height={32} area />
      </Highlight>
    </div>
  ),
  parameters: { docs: { description: { story: "Côte à côte, sans boîte : l'œil va aux valeurs, pas aux cadres." } } },
};

export const WithMeta: Story = {
  name: "Avec méta",
  args: { meta: "oct. 2026" },
  parameters: { docs: { description: { story: "Les props de `Card` restent disponibles : ici une méta à droite de l'intitulé." } } },
};
