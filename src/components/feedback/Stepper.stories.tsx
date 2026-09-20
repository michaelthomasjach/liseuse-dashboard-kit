import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Stepper } from "./Stepper";
import { Card } from "../primitives/Card";
import { Button } from "../primitives/Button";

const LIVRAISON = [
  { id: "commande", label: "Commande" },
  { id: "paiement", label: "Paiement" },
  { id: "preparation", label: "Préparation" },
  { id: "expedition", label: "Expédition" },
  { id: "livraison", label: "Livraison" },
];

const meta: Meta<typeof Stepper> = {
  title: "Feedback/Stepper",
  component: Stepper,
};
export default meta;
type Story = StoryObj<typeof Stepper>;

export const Default: Story = {
  name: "Défaut (horizontal)",
  render: () => (
    <div style={{ maxWidth: 560 }}>
      <Stepper steps={LIVRAISON} active={2} />
    </div>
  ),
};

export const Vertical: Story = {
  name: "Vertical (texte à côté du carré)",
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <Stepper orientation="vertical" steps={LIVRAISON} active={2} />
    </div>
  ),
};

/** The whole point of the component: watch the squares *and* each line segment re-shade one gap at
 *  a time as `active` moves. */
export const Progression: Story = {
  name: "Progression automatique",
  render: function Render() {
    const [active, setActive] = useState(0);
    useEffect(() => {
      const id = setInterval(() => setActive((a) => (a >= LIVRAISON.length ? 0 : a + 1)), 1400);
      return () => clearInterval(id);
    }, []);
    return (
      <div style={{ maxWidth: 560 }}>
        <Stepper steps={LIVRAISON} active={active} />
      </div>
    );
  },
};

export const Controlled: Story = {
  name: "Piloté (précédent / suivant)",
  render: function Render() {
    const [active, setActive] = useState(1);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 560 }}>
        <Stepper steps={LIVRAISON} active={active} />
        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={() => setActive((a) => Math.max(0, a - 1))}>Précédent</Button>
          <Button onClick={() => setActive((a) => Math.min(LIVRAISON.length, a + 1))}>Suivant</Button>
        </div>
      </div>
    );
  },
};

/** `active === steps.length` — nothing is in progress any more, so the trailing segment lights up
 *  too and the whole line reads as travelled. */
export const Termine: Story = {
  name: "Terminé (active = steps.length)",
  render: () => (
    <div style={{ maxWidth: 560 }}>
      <Stepper steps={LIVRAISON} active={LIVRAISON.length} />
    </div>
  ),
};

export const TexteLong: Story = {
  name: "Textes longs (deux lignes)",
  render: () => (
    <div style={{ maxWidth: 620 }}>
      <Stepper
        steps={[
          { id: "1", label: "Dépôt du dossier" },
          { id: "2", label: "Vérification des pièces justificatives" },
          { id: "3", label: "Décision de la commission" },
          { id: "4", label: "Notification" },
        ]}
        active={1}
      />
    </div>
  ),
};

export const Tailles: Story = {
  name: "Taille des carrés et épaisseur du trait",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, maxWidth: 560 }}>
      <Stepper steps={LIVRAISON} active={2} markerSize={8} thickness={1} />
      <Stepper steps={LIVRAISON} active={2} />
      <Stepper steps={LIVRAISON} active={2} markerSize={20} thickness={4} />
    </div>
  ),
};

export const Opacites: Story = {
  name: "Opacités personnalisées",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, maxWidth: 560 }}>
      <Stepper steps={LIVRAISON} active={2} />
      {/* Passé et à venir au même niveau : seule l'étape courante ressort. */}
      <Stepper steps={LIVRAISON} active={2} completedOpacity={0.25} upcomingOpacity={0.25} />
      <Stepper steps={LIVRAISON} active={2} completedOpacity={0.8} upcomingOpacity={0.4} />
    </div>
  ),
};

export const DansUneCarte: Story = {
  name: "Dans une carte",
  render: () => (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 260px", alignItems: "start" }}>
      <Card title="Commande #4912" meta="EXPÉDIÉE LE 18 SEPT.">
        <div style={{ paddingBlock: 8 }}>
          <Stepper steps={LIVRAISON} active={3} />
        </div>
      </Card>
      <Card title="Onboarding" meta="3 ÉTAPES SUR 4">
        <Stepper
          orientation="vertical"
          active={2}
          steps={[
            { id: "compte", label: "Compte créé" },
            { id: "profil", label: "Profil complété" },
            { id: "banque", label: "Compte bancaire relié" },
            { id: "premier", label: "Premier versement" },
          ]}
        />
      </Card>
    </div>
  ),
};
