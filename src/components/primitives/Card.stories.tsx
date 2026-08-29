import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./Card";
import { Highlight } from "./Highlight";
import { PanelRow } from "./Panel";
import { Sparkline } from "../charts/Sparkline";

const meta: Meta<typeof Card> = {
  title: "Primitives/Card",
  component: Card,
};
export default meta;
type Story = StoryObj<typeof Card>;

export const Static: Story = {
  name: "Statique (toujours visible)",
  render: () => (
    <div style={{ maxWidth: 400 }}>
      <Card title="Détail de l'ordre" meta="Exécuté">
        <PanelRow label="Type" value="Marché" />
        <PanelRow label="Frais" value="1,99 €" />
        <PanelRow label="Compte" value="PEA" />
      </Card>
    </div>
  ),
};

export const WithFooter: Story = {
  name: "Avec pied de carte",
  render: () => (
    <div style={{ maxWidth: 400 }}>
      <Card title="Frais et conditions" footer={<span style={{ fontSize: 12, opacity: 0.7 }}>Mis à jour le 11/06/2026</span>}>
        <PanelRow label="Frais de courtage" value="0,5 %" />
        <PanelRow label="Frais de tenue de compte" value="0 €" />
      </Card>
    </div>
  ),
};

export const NoHeader: Story = {
  name: "Sans en-tête",
  render: () => (
    <div style={{ maxWidth: 400 }}>
      <Card>
        <PanelRow label="Type" value="Marché" />
        <PanelRow label="Frais" value="1,99 €" />
      </Card>
    </div>
  ),
};

export const Bare: Story = {
  name: "Bare (sans bordure)",
  render: () => (
    <div style={{ maxWidth: 400 }}>
      <Card title="Résumé" bare>
        <PanelRow label="Type" value="Marché" />
      </Card>
    </div>
  ),
};

export const ExpandableOpen: Story = {
  name: "expandable — ouverte par défaut",
  render: () => (
    <div style={{ maxWidth: 400 }}>
      <Card title="Détail de l'ordre" meta="Exécuté" summary="12 AAPL @ 226,34 € — 2 714,08 €" expandable defaultOpen>
        <PanelRow label="Type" value="Marché" />
        <PanelRow label="Frais" value="1,99 €" />
        <PanelRow label="Compte" value="PEA" />
        <PanelRow label="Date" value="11/06/2026 09:34" />
      </Card>
    </div>
  ),
};

export const ExpandableCollapsed: Story = {
  name: "expandable — repliée par défaut",
  render: () => (
    <div style={{ maxWidth: 400 }}>
      <Card title="Frais et conditions" meta="voir le détail" expandable>
        <PanelRow label="Frais de courtage" value="0,5 %" />
        <PanelRow label="Frais de tenue de compte" value="0 €" />
      </Card>
    </div>
  ),
};

export const HighlightTile: Story = {
  name: "highlight — tuile KPI (Highlight)",
  render: () => (
    <div style={{ maxWidth: 220 }}>
      <Highlight title="52-week high">
        <div style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: 2 }}>191,22 $</div>
        <div style={{ fontSize: "0.8rem", opacity: 0.65, marginTop: 4 }}>3,6 % en dessous</div>
        <div style={{ marginTop: 12 }}>
          <Sparkline data={[142, 148, 145, 151, 157, 154, 162, 168, 165, 172, 178, 175, 183, 188, 191]} width={220} height={36} area />
        </div>
      </Highlight>
    </div>
  ),
};
