import type { Meta, StoryObj } from "@storybook/react";
import { Heading } from "./Heading";
import { PanelRow } from "./Panel";

/**
 * Le titre sémantique, sur l'échelle typographique du thème. Volontairement courte : sur un
 * tableau de bord, le plus gros texte de l'écran doit être une valeur, pas un titre.
 */
const meta = {
  title: "Primitives/Heading",
  component: Heading,
  parameters: {
    docs: {
      description: {
        component: [
          "Titre de `<h1>` à `<h6>`, choisi par `level` (2 par défaut). Le niveau dit la **place dans le plan du document**, pas la taille voulue : un écran a un `h1`, ses sections des `h2`, et ainsi de suite, sans sauter de niveau.",
          "",
          "**En-tête de section** — avec `meta` ou `divider`, le titre devient une rangée : le titre à gauche, une méta en petites capitales atténuées à droite (une date, un compte, « mis à jour il y a 4 min »), et avec `divider` un filet épais dessous. Sans l'un ni l'autre, c'est une balise de titre nue.",
          "",
          "**Niveau 6** — rendu comme un intitulé : petites capitales, police et graisse des libellés du thème. Il sert à nommer un groupe à l'intérieur d'une carte.",
          "",
          "**Quand l'utiliser** — pour structurer un écran ou une colonne. Une carte nomme déjà son contenu avec son propre `title` (`Card`, `Panel`) : inutile d'y ajouter un `Heading`. Pour du texte courant, `Text`.",
          "",
          "**Thème** — `--lq-text-h1` à `--lq-text-h6`, `--lq-font-weight-heading`, `--lq-line-height-heading`, `--lq-color-text` ; la méta et le niveau 6 suivent `--lq-label-font`, `--lq-label-size`, `--lq-label-weight`, `--lq-label-tracking` ; le filet `--lq-color-border`.",
        ].join("\n"),
      },
    },
  },
  args: { level: 2, children: "Commandes du mois" },
  argTypes: { children: { control: "text" }, meta: { control: "text" } },
} satisfies Meta<typeof Heading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Défaut" };

export const Levels: Story = {
  name: "Six niveaux",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Heading level={1}>Chiffre d'affaires</Heading>
      <Heading level={2}>Commandes du mois</Heading>
      <Heading level={3}>Clients actifs</Heading>
      <Heading level={4}>Relances en cours</Heading>
      <Heading level={5}>Factures à émettre</Heading>
      <Heading level={6}>Notes internes</Heading>
    </div>
  ),
};

export const SectionHeader: Story = {
  name: "En-tête de section",
  args: { level: 3, children: "Activité récente", meta: "mis à jour il y a 4 min", divider: true },
  render: (args) => (
    <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 4 }}>
      <Heading {...args} />
      <PanelRow label="Lemoine SAS a réglé C-4821" value="14 400 €" />
      <PanelRow label="Groupe Vallée a ouvert un devis" value="48 000 €" />
      <PanelRow label="Cabinet Roux a renouvelé" value="6 000 €" />
    </div>
  ),
  parameters: { docs: { description: { story: "`meta` à droite et `divider` dessous : l'en-tête d'une section de liste." } } },
};

export const MetaOnly: Story = {
  name: "Méta sans filet",
  args: { level: 4, children: "Encours clients", meta: "au 31 oct. 2026" },
};
