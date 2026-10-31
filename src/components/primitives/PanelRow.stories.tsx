import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { PanelRow, Panel } from "./Panel";
import { Toggle } from "./Toggle";
import { Badge } from "../finance/Badge";
import { LevelGauge } from "./LevelGauge";
import { Text } from "./Text";

/**
 * La ligne d'un panneau : un libellé à gauche, une valeur ou un contrôle à droite, un filet fin
 * dessous.
 */
const meta = {
  title: "Primitives/PanelRow",
  component: PanelRow,
  parameters: {
    docs: {
      description: {
        component: [
          "Une ligne libellé / valeur. `label` à gauche ; à droite, `value` (une valeur de détail, en graisse appuyée) et/ou `children` (un contrôle : `Toggle`, `LevelGauge`, `Button`…). Les lignes s'empilent sans écart ; le filet de la dernière disparaît.",
          "",
          "**Cliquable** — avec `onClick`, la ligne entière devient un bouton : `role=\"button\"`, atteignable au clavier, activée par Entrée ou Espace, légèrement atténuée au survol. Pour ouvrir le détail d'un élément.",
          "",
          "**Quand l'utiliser** — dans un `Panel`, une `Card`, une `Modal` : partout où l'on aligne des valeurs nommées. Pour une ligne de répartition avec pastille de couleur, `LegendRow` ; pour des données tabulaires à plusieurs colonnes, `DataTable`.",
          "",
          "`label` et `value` acceptent des nœuds React : un `Badge`, un lien, un montant coloré.",
          "",
          "**Thème** — `--lq-row-font-size`, `--lq-color-text`, `--lq-font-weight-semibold` (valeur), `--lq-color-border-subtle` (filet), `--lq-space-3`.",
        ].join("\n"),
      },
    },
  },
  args: { label: "Temps de réponse", value: "182 ms" },
  argTypes: {
    label: { control: "text" },
    value: { control: "text" },
    children: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Panel title="Aperçu">
          <Story />
        </Panel>
      </div>
    ),
  ],
} satisfies Meta<typeof PanelRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Défaut" };

export const WithControl: Story = {
  name: "Avec un contrôle",
  render: function Render(args) {
    const [on, setOn] = useState(true);
    return (
      <PanelRow {...args} label="Alertes de paiement" value={undefined}>
        <Toggle checked={on} onChange={setOn} ariaLabel="Alertes de paiement" />
      </PanelRow>
    );
  },
};

export const RichValue: Story = {
  name: "Valeur riche",
  args: { label: "Statut du compte", value: <Badge tone="up">à jour</Badge> },
};

export const Clickable: Story = {
  name: "Cliquable",
  args: { label: "Incidents ouverts", value: "2", onClick: fn() },
  parameters: { docs: { description: { story: "Avec `onClick`, toute la ligne réagit au survol, au clic et au clavier." } } },
};

export const Stack: Story = {
  name: "Lignes empilées",
  render: function Render() {
    const [opened, setOpened] = useState<string | null>(null);
    return (
      <>
        <PanelRow label="Formule" value="Équipe — 12 postes" />
        <PanelRow label="Utilisateurs">
          <LevelGauge value={75} label="9 / 12" ariaLabel="Utilisateurs" size="sm" />
        </PanelRow>
        <PanelRow label="Prochaine échéance" value="1er janv. 2027" />
        <PanelRow label="Factures" value="voir tout" onClick={() => setOpened("Factures")} />
        {opened ? (
          <Text size="sm" muted>
            Ligne ouverte : {opened}
          </Text>
        ) : null}
      </>
    );
  },
  parameters: { docs: { description: { story: "Valeur, contrôle et ligne cliquable se mêlent dans le même panneau." } } },
};
