import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "../primitives/Card";
import { DashboardGrid, DashboardGridItem } from "./DashboardGrid";
import { MetricListWidget } from "./MetricListWidget";
import { Text } from "../primitives/Text";
import { INDOOR_TEMPERATURES, SERVICES } from "../../test-data/storyDemoData";

const SERVICES_PANEL = <MetricListWidget title="Services" meta="disponibilité sur 30 jours" rows={SERVICES} />;
const ROOMS_PANEL = <MetricListWidget title="Intérieur" meta="5 pièces" rows={INDOOR_TEMPERATURES} />;

/** Une carte de remplissage : elle dit sa propre place dans la grille. */
const Filler = ({ title, note }: { title: string; note: string }) => (
  <Card title={title} meta={note}>
    <Text size="sm" muted>
      Un widget de la page.
    </Text>
  </Card>
);

/**
 * La grille qui range les widgets d'une page de tableau de bord. Une simple grille CSS : on lui
 * donne ses colonnes, elle donne l'écart du thème.
 */
const meta = {
  title: "Widgets/DashboardGrid",
  component: DashboardGrid,
  parameters: {
    docs: {
      description: {
        component: [
          "La **grille d'une page de tableau de bord** : une grille CSS dont on fixe les colonnes (`columns`, une valeur de `grid-template-columns`) et dont l'écart vient du thème. Chaque cellule est un `DashboardGridItem`, qui peut s'étendre sur plusieurs colonnes ou lignes.",
          "",
          "**Quand l'utiliser** — pour poser des panneaux de largeurs différentes sur une page : une colonne large pour un graphique, deux colonnes étroites pour des listes. Pour une simple pile de cartes, une `flex` suffit. La disposition est fixe, décidée par l'application : le kit n'a pas de grille dont l'utilisateur déplace ou redimensionne les panneaux.",
          "",
          "**Colonnes** — par défaut `\"2fr 1.3fr 1.3fr\"` : une colonne large à gauche et deux colonnes latérales, la disposition de l'écran de référence du kit. Toute valeur CSS est admise : `\"repeat(3, minmax(0, 1fr))\"` pour trois colonnes égales qui ne débordent pas, `\"repeat(auto-fill, minmax(280px, 1fr))\"` pour une grille qui se replie toute seule.",
          "",
          "**Comportement** — les cellules s'alignent en haut (`align-items: start`) : un panneau court ne s'étire pas à la hauteur de son voisin. La grille **ne se replie pas d'elle-même** sur un petit écran avec ses colonnes par défaut : c'est à l'application de passer une autre valeur de `columns` selon la largeur, ou d'utiliser `auto-fill`.",
          "",
          "**Thème** — `--lq-space-6` est l'écart entre cellules ; `gap` le remplace pour une grille, par exemple `\"var(--lq-space-3)\"` pour une page dense.",
        ].join("\n"),
      },
    },
  },
  args: {
    children: (
      <>
        <DashboardGridItem>{SERVICES_PANEL}</DashboardGridItem>
        <DashboardGridItem>{ROOMS_PANEL}</DashboardGridItem>
        <DashboardGridItem>
          <Filler title="Troisième colonne" note="1 colonne" />
        </DashboardGridItem>
      </>
    ),
  },
  argTypes: {
    columns: { control: "text" },
    gap: { control: "text" },
    children: { control: false },
    style: { control: false },
  },
} satisfies Meta<typeof DashboardGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Défaut",
  parameters: { docs: { description: { story: "Les colonnes par défaut, `2fr 1.3fr 1.3fr` : la première est plus large." } } },
};

export const EqualColumns: Story = {
  name: "Colonnes égales et étendues",
  args: {
    columns: "repeat(3, minmax(0, 1fr))",
    children: (
      <>
        <DashboardGridItem colSpan={2}>{SERVICES_PANEL}</DashboardGridItem>
        <DashboardGridItem>{ROOMS_PANEL}</DashboardGridItem>
        <DashboardGridItem colSpan={3}>
          <Filler title="Élément sur trois colonnes" note="colSpan={3}" />
        </DashboardGridItem>
      </>
    ),
  },
  parameters: { docs: { description: { story: "Trois colonnes égales ; `colSpan` étend un élément sur deux, puis sur toute la largeur." } } },
};

export const Dense: Story = {
  name: "Écart resserré",
  args: {
    columns: "repeat(4, minmax(0, 1fr))",
    gap: "var(--lq-space-3)",
    children: (
      <>
        {["Nord", "Sud", "Est", "Ouest"].map((zone) => (
          <DashboardGridItem key={zone}>
            <Filler title={`Zone ${zone}`} note="1 colonne" />
          </DashboardGridItem>
        ))}
      </>
    ),
  },
  parameters: { docs: { description: { story: "`gap` remplace l'écart du thème, ici par `--lq-space-3`." } } },
};

export const AutoFill: Story = {
  name: "Repli automatique",
  args: {
    columns: "repeat(auto-fill, minmax(260px, 1fr))",
    children: (
      <>
        {["Ventes", "Stocks", "Livraisons", "Support", "Facturation"].map((name) => (
          <DashboardGridItem key={name}>
            <Filler title={name} note="auto-fill" />
          </DashboardGridItem>
        ))}
      </>
    ),
  },
  parameters: { docs: { description: { story: "Avec `auto-fill`, la grille tient autant de colonnes de 260 px que la largeur en permet : réduisez la fenêtre." } } },
};
