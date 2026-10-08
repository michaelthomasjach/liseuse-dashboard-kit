import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Panel, PanelCollapse, PanelRow } from "./Panel";

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

/** Repliable : bouton +/− centré sur l'en-tête (même sur deux lignes), ouverture animée. */
export const Collapsible: Story = {
  name: "Repliable",
  render: () => (
    <div style={{ maxWidth: 360, display: "grid", gap: 12 }}>
      <Panel title="Intérieur" meta="6 pièces" collapsible>
        <PanelRow label="Salon" value="21,5°" />
        <PanelRow label="Bureau" value="20,0°" />
      </Panel>
      <Panel title="Fed : prochaine décision" meta="3,75 %–4,00 % · réunion du 28 octobre" collapsible defaultOpen={false}>
        <PanelRow label="Maintien" value="78 %" />
        <PanelRow label="Baisse de 25 pb" value="22 %" />
      </Panel>
    </div>
  ),
};

function AccordionDemo() {
  const [open, setOpen] = useState<string | null>("a");
  const fold = (id: string) => ({ open: open === id, onOpenChange: (o: boolean) => setOpen(o ? id : null) });
  return (
    <div style={{ maxWidth: 360, display: "grid", gap: 12 }}>
      <PanelCollapse {...fold("a")}>
        <Panel title="Impact global">
          <PanelRow label="Score" value="+0,15" />
        </Panel>
      </PanelCollapse>
      <PanelCollapse {...fold("b")}>
        <Panel title="Courbe des taux" meta="États-Unis">
          <PanelRow label="10 ans" value="4,12 %" />
        </Panel>
      </PanelCollapse>
      <PanelCollapse {...fold("c")}>
        <Panel title="Scénarios rapides">
          <PanelRow label="Inflation +0,2 pt" value="+8 pb" />
        </Panel>
      </PanelCollapse>
    </div>
  );
}

/** Accordéon : PanelCollapse rend repliables des cartes toutes faites ; une seule ouverte à la fois. */
export const Accordion: Story = {
  name: "Accordéon (PanelCollapse)",
  render: () => <AccordionDemo />,
};
