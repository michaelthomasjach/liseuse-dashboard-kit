import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = {
  title: "Primitives/Badge",
  component: Badge,
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Tones: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Badge tone="neutral">En attente</Badge>
      <Badge tone="up">Exécuté</Badge>
      <Badge tone="down">Annulé</Badge>
      <Badge tone="warning">Marge faible</Badge>
      <Badge tone="info">KYC en cours</Badge>
    </div>
  ),
};
