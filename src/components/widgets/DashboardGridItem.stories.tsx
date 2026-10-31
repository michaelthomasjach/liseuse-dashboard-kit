import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "../primitives/Card";
import { DashboardGrid, DashboardGridItem } from "./DashboardGrid";
import { MetricListWidget } from "./MetricListWidget";
import { Text } from "../primitives/Text";
import { INDOOR_TEMPERATURES, SERVICES } from "../../test-data/storyDemoData";

/** Une carte de voisinage : elle occupe une cellule pour qu'on voie l'élément réglé se déplacer. */
const Neighbour = ({ n }: { n: number }) => (
  <DashboardGridItem>
    <Card title={`Voisin ${n}`} meta="1 cellule">
      <Text size="sm" muted>
        Une cellule simple.
      </Text>
    </Card>
  </DashboardGridItem>
);

/**
 * Une cellule de `DashboardGrid`. Elle s'étend sur plusieurs colonnes ou lignes, et empile ce
 * qu'on y met avec l'écart du thème.
 */
const meta = {
  title: "Widgets/DashboardGridItem",
  component: DashboardGridItem,
  parameters: {
    docs: {
      description: {
        component: [
          "Une **cellule de `DashboardGrid`**. Elle n'a de sens qu'enfant direct de la grille : seule, c'est une colonne flexible sans plus.",
          "",
          "**Étendue** — `colSpan` l'étend sur plusieurs colonnes (`grid-column: span n`), `rowSpan` sur plusieurs lignes. Sans eux, elle occupe une cellule. Une étendue plus large que la grille crée des colonnes implicites : avec `columns` à trois pistes, gardez `colSpan` à 3 au plus.",
          "",
          "**Pile** — la cellule est une colonne flexible : plusieurs widgets posés dedans **s'empilent** avec le même écart que celui de la grille. C'est le moyen de mettre deux panneaux courts l'un sous l'autre dans une colonne, sans `rowSpan`.",
          "",
          "**Comportement** — `min-width: 0` est posé sur la cellule : un tableau ou un graphique large défile ou se rétrécit au lieu d'élargir sa colonne et de casser la grille.",
          "",
          "**Thème** — `--lq-space-6` (écart de la pile). `className` et `style` passent à l'élément.",
        ].join("\n"),
      },
    },
  },
  args: {
    colSpan: 2,
    children: <MetricListWidget title="Services" meta="élément réglé par les contrôles" rows={SERVICES} />,
  },
  argTypes: {
    colSpan: { control: { type: "number", min: 1, max: 3 } },
    rowSpan: { control: { type: "number", min: 1, max: 3 } },
    children: { control: false },
    style: { control: false },
  },
  // L'élément réglé par les contrôles, entouré de voisins dans une grille de trois colonnes égales.
  render: (args) => (
    <DashboardGrid columns="repeat(3, minmax(0, 1fr))">
      <DashboardGridItem {...args} />
      <Neighbour n={1} />
      <Neighbour n={2} />
      <Neighbour n={3} />
    </DashboardGrid>
  ),
} satisfies Meta<typeof DashboardGridItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Défaut" };

export const TwoRows: Story = {
  name: "Sur deux lignes",
  args: { colSpan: 1, rowSpan: 2 },
  parameters: { docs: { description: { story: "`rowSpan={2}` : l'élément occupe la hauteur de deux rangées de voisins." } } },
};

export const Stacked: Story = {
  name: "Deux panneaux empilés",
  args: {
    colSpan: 1,
    children: (
      <>
        <MetricListWidget title="Intérieur" meta="5 pièces" rows={INDOOR_TEMPERATURES.slice(0, 3)} />
        <MetricListWidget title="Services" meta="30 jours" rows={SERVICES.slice(0, 3)} />
      </>
    ),
  },
  parameters: { docs: { description: { story: "Deux widgets dans la même cellule s'empilent, à l'écart de la grille." } } },
};

export const FullWidth: Story = {
  name: "Pleine largeur",
  args: { colSpan: 3 },
};
