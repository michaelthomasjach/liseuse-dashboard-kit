import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { ExpandableCard } from "./ExpandableCard";
import { PanelRow } from "./Panel";
import { Button } from "./Button";
import { Text } from "./Text";

/**
 * La carte repliable : l'en-tête reste, le corps se replie derrière un chevron.
 */
const meta = {
  title: "Primitives/ExpandableCard",
  component: ExpandableCard,
  parameters: {
    docs: {
      description: {
        component: [
          "Une `Card` dont le corps se replie : l'en-tête entier est le bouton (`aria-expanded`), un chevron à droite dit l'état, et le corps s'ouvre en glissant. C'est `Card` avec `expandable` toujours actif ; toutes ses autres props restent disponibles.",
          "",
          "**Quand l'utiliser** — un détail qu'on consulte de temps en temps sans vouloir qu'il occupe l'écran : le détail d'une facture, un historique, des réglages avancés. Seul le corps se replie : l'en-tête, le `summary` et le `footer` restent visibles — servez-vous du résumé pour dire ce qu'il y a dessous. Pour un groupe de lignes compact, `Panel collapsible` ; pour plusieurs blocs dont un seul ouvert à la fois, `PanelCollapse` en accordéon.",
          "",
          "**État** — non contrôlé par défaut, **fermé** (`defaultOpen`) ; contrôlé avec `open` et `onOpenChange(open)`. Un `title` est indispensable : c'est lui qu'on clique.",
          "",
          "**Clavier** — l'en-tête est un bouton : Tab l'atteint, Entrée ou Espace ouvre et ferme.",
          "",
          "**Thème** — celui de `Card` ; l'en-tête survolé prend `--lq-color-hover`, le chevron `--lq-color-text-muted`, l'animation `--lq-transition-base`.",
        ].join("\n"),
      },
    },
  },
  args: {
    title: "Détail de la facture F-2026-0412",
    meta: "14 400 €",
    children: (
      <>
        <PanelRow label="Abonnement annuel × 12" value="12 000 €" />
        <PanelRow label="TVA 20 %" value="2 400 €" />
        <PanelRow label="Échéance" value="30 nov. 2026" />
      </>
    ),
    onOpenChange: fn(),
  },
  argTypes: {
    title: { control: "text" },
    meta: { control: "text" },
    summary: { control: "text" },
    children: { control: false },
    footer: { control: false },
    open: { control: false },
    // Lu au premier rendu seulement : le changer ensuite ne ferait rien.
    defaultOpen: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 440 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ExpandableCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Défaut" };

export const OpenByDefault: Story = {
  name: "Ouverte au départ",
  args: {
    title: "Historique des relances",
    meta: "3",
    defaultOpen: true,
    children: (
      <>
        <PanelRow label="12 oct." value="courriel" />
        <PanelRow label="19 oct." value="courriel" />
        <PanelRow label="26 oct." value="appel" />
      </>
    ),
  },
};

export const WithSummary: Story = {
  name: "Avec résumé",
  args: {
    title: "Réglages avancés",
    summary: "Arrondis, devise d'affichage et format des exports.",
    meta: undefined,
    children: (
      <>
        <PanelRow label="Arrondi des montants" value="à l'euro" />
        <PanelRow label="Devise d'affichage" value="EUR" />
        <PanelRow label="Séparateur CSV" value="point-virgule" />
      </>
    ),
    footer: <Button>Réinitialiser</Button>,
  },
  parameters: { docs: { description: { story: "Replié, seul le corps disparaît : le résumé et le pied restent visibles." } } },
};

export const Controlled: Story = {
  name: "Contrôlée",
  render: function Render(args) {
    const [open, setOpen] = useState(false);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ExpandableCard
          {...args}
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            args.onOpenChange?.(next);
          }}
        />
        <Text size="sm" muted>
          État tenu par le parent : {open ? "ouverte" : "fermée"}
        </Text>
      </div>
    );
  },
  parameters: { docs: { description: { story: "Avec `open` et `onOpenChange`, le parent sait à tout moment si la carte est ouverte." } } },
};
