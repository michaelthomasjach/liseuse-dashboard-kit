import type { Meta, StoryObj } from "@storybook/react";
import { AlertList } from "./AlertList";
import { Button } from "../primitives/Button";

/** Des alertes dans la page, triées de la plus grave à la plus légère, chacune avec son liseré. */
const meta: Meta<typeof AlertList> = {
  title: "Feedback/AlertList",
  component: AlertList,
};
export default meta;
type Story = StoryObj<typeof AlertList>;

export const Alertes: Story = {
  name: "Alertes d'un entrepôt",
  args: {
    alerts: [
      { level: "info", message: "Livraison fournisseur attendue à 14:00." },
      { level: "warning", message: "Quai d'expédition saturé : 3 camions en attente.", action: <Button>Voir le quai</Button> },
      { level: "critical", message: "Rupture de stock : 12 références en attente de réassort.", action: <Button>Commander</Button> },
      { level: "warning", message: "Facture d'énergie en hausse de 18 % cette semaine." },
    ],
  },
  render: (args) => (
    <div style={{ maxWidth: 560 }}>
      <AlertList {...args} />
    </div>
  ),
};

export const Compactes: Story = {
  name: "Compactes, dans l'ordre donné",
  render: () => (
    <div style={{ maxWidth: 420 }}>
      <AlertList
        compact
        sort={false}
        alerts={[
          { level: "info", message: "Nouvelle compétence disponible." },
          { level: "critical", message: "Transformateur surchargé." },
        ]}
      />
    </div>
  ),
};

export const Vide: Story = {
  name: "Rien à signaler",
  render: () => <AlertList alerts={[]} emptyText="Aucune alerte : tout tourne." />,
};
