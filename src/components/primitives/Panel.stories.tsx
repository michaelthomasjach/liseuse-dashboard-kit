import type { Meta, StoryObj } from "@storybook/react";
import { Panel, PanelRow } from "./Panel";

const meta: Meta<typeof Panel> = {
  title: "Primitives/Panel",
  component: Panel,
};
export default meta;
type Story = StoryObj<typeof Panel>;

export const RoomTemperatures: Story = {
  render: () => (
    <Panel title="Intérieur" meta="6 pièces" style={{ maxWidth: 360 }}>
      <PanelRow label="Salon" value="21,5°" />
      <PanelRow label="Chambre Ewenn" value="19,7°" />
      <PanelRow label="Bureau" value="20,0°" />
      <PanelRow label="Chambre parentale" value="19,0°" />
      <PanelRow label="Cuisine" value="20,8°" />
      <PanelRow label="Salle de bain" value="22,1°" />
    </Panel>
  ),
};

export const Bare: Story = {
  render: () => (
    <Panel bare style={{ maxWidth: 360 }}>
      <PanelRow label="Sans bordure ni fond" value="—" />
    </Panel>
  ),
};

/** Une méta longue dans une carte étroite (un téléphone) : elle passe sous le titre et s'y replie. */
export const LongMeta: Story = {
  name: "Méta longue, carte étroite",
  render: () => (
    <div style={{ maxWidth: 340 }}>
      <Panel title="Entrepôt de Lyon" meta="3 alertes · 12 commandes en attente · mis à jour à 14 h 32">
        <PanelRow label="Quai 1" value="Ouvert" />
        <PanelRow label="Quai 2" value="Fermé" />
      </Panel>
    </div>
  ),
};
