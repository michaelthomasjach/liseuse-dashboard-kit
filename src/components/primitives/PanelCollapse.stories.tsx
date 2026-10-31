import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { PanelCollapse, Panel, PanelRow } from "./Panel";
import { Button } from "./Button";

/**
 * L'enveloppe qui rend repliable un panneau tout fait, sans toucher au composant qui le rend.
 */
const meta = {
  title: "Primitives/PanelCollapse",
  component: PanelCollapse,
  parameters: {
    docs: {
      description: {
        component: [
          "Enveloppe qui rend repliable **le premier `Panel` qu'elle contient**, sans modifier le composant qui le rend : l'en-tête du panneau devient cliquable et porte le bouton +/−, comme avec la prop `collapsible`.",
          "",
          "**Quand l'utiliser** — quand le panneau vient d'un composant déjà écrit (un widget, une carte métier) dont on ne veut pas toucher les props, et surtout pour ranger plusieurs panneaux en **accordéon** : le parent tient quel panneau est ouvert et n'en ouvre qu'un à la fois. Pour un panneau que vous écrivez vous-même, `collapsible` sur le `Panel` suffit.",
          "",
          "**Toujours contrôlé** — `open` et `onOpenChange(open)` sont obligatoires : c'est ce qui permet l'accordéon.",
          "",
          "**Comportement** — le même que `Panel collapsible` : en-tête entier cliquable, bouton +/− annoncé aux lecteurs d'écran, ouverture animée, sans animation si le système demande moins de mouvement.",
          "",
          "**Thème** — celui de `Panel` : `--lq-color-panel`, `--lq-color-panel-border`, `--lq-radius-lg`, `--lq-shadow-panel`, `--lq-label-*`.",
        ].join("\n"),
      },
    },
  },
  args: {
    open: true,
    onOpenChange: fn(),
    children: (
      <Panel title="Facturation" meta="annuelle">
        <PanelRow label="Formule" value="Équipe — 12 postes" />
        <PanelRow label="Prochaine échéance" value="1er janv. 2027" />
        <PanelRow label="Moyen de paiement" value="Prélèvement SEPA" />
      </Panel>
    ),
  },
  argTypes: { children: { control: false } },
  render: function Render(args) {
    const [open, setOpen] = useState(args.open);
    useEffect(() => setOpen(args.open), [args.open]);
    return (
      <div style={{ maxWidth: 420 }}>
        <PanelCollapse
          {...args}
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            args.onOpenChange(next);
          }}
        />
      </div>
    );
  },
} satisfies Meta<typeof PanelCollapse>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Défaut" };

export const Closed: Story = {
  name: "Fermé",
  args: { open: false },
};

export const Accordion: Story = {
  name: "Accordéon",
  render: function Render() {
    const [openId, setOpenId] = useState<string | null>("facturation");
    const fold = (id: string) => ({ open: openId === id, onOpenChange: (o: boolean) => setOpenId(o ? id : null) });
    return (
      <div style={{ maxWidth: 420, display: "flex", flexDirection: "column", gap: 12 }}>
        <PanelCollapse {...fold("compte")}>
          <Panel title="Compte">
            <PanelRow label="Raison sociale" value="Lemoine SAS" />
            <PanelRow label="SIRET" value="812 345 678 00019" />
          </Panel>
        </PanelCollapse>
        <PanelCollapse {...fold("facturation")}>
          <Panel title="Facturation" meta="annuelle">
            <PanelRow label="Formule" value="Équipe — 12 postes" />
            <PanelRow label="Prochaine échéance" value="1er janv. 2027" />
          </Panel>
        </PanelCollapse>
        <PanelCollapse {...fold("contacts")}>
          <Panel title="Contacts" meta="2">
            <PanelRow label="Comptabilité" value="compta@lemoine.fr" />
            <PanelRow label="Technique" value="it@lemoine.fr" />
          </Panel>
        </PanelCollapse>
      </div>
    );
  },
  parameters: { docs: { description: { story: "Un seul panneau ouvert à la fois : ouvrir l'un referme l'autre." } } },
};

export const ExternalControl: Story = {
  name: "Piloté de l'extérieur",
  render: function Render() {
    const [open, setOpen] = useState(false);
    return (
      <div style={{ maxWidth: 420, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
        <Button onClick={() => setOpen((o) => !o)}>{open ? "Masquer le détail" : "Afficher le détail"}</Button>
        <div style={{ alignSelf: "stretch" }}>
          <PanelCollapse open={open} onOpenChange={setOpen}>
            <Panel title="Détail de la facture" meta="F-2026-0412">
              <PanelRow label="Abonnement annuel × 12" value="12 000 €" />
              <PanelRow label="TVA 20 %" value="2 400 €" />
              <PanelRow label="Total TTC" value="14 400 €" />
            </Panel>
          </PanelCollapse>
        </div>
      </div>
    );
  },
  parameters: { docs: { description: { story: "L'état vit dans le parent : un bouton ailleurs dans la page peut ouvrir et fermer le panneau." } } },
};
