import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Quickview, type QuickviewProps, type QuickviewTab } from "./Quickview";
import { Button } from "../primitives/Button";
import { Text } from "../primitives/Text";
import { PanelRow } from "../primitives/Panel";
import { Avatar } from "../finance/Avatar";
import { Badge } from "../finance/Badge";
import { Input } from "../forms/Input";
import { Checkbox } from "../forms/Checkbox";

/**
 * Panneau latéral qui glisse depuis le bord de l'écran par-dessus la page : notes, alertes,
 * conversation… Modal par défaut (voile, focus piégé), non modal avec `modal={false}`.
 * Échap ferme dans les deux cas. Sans animation en e-ink.
 */
const meta: Meta<typeof Quickview> = {
  title: "Widgets/Quickview",
  component: Quickview,
};
export default meta;
type Story = StoryObj<typeof Quickview>;

const NOTES = [
  { titre: "Relancer Lemoine SAS", texte: "Facture d'octobre toujours impayée, relance par téléphone jeudi.", date: "29 oct." },
  { titre: "Atelier utilisateurs", texte: "Recherche, export, lisibilité sur tablette : à prioriser.", date: "26 oct." },
  { titre: "Recette lot 1", texte: "Prévoir deux demi-journées avec Hugo.", date: "22 oct." },
];

const ALERTES: { titre: string; detail: string; tone: "down" | "warning" | "info" }[] = [
  { titre: "Serveur de recette injoignable", detail: "depuis 08:12", tone: "down" },
  { titre: "Stock bas : ruban adhésif", detail: "12 unités", tone: "warning" },
  { titre: "Sauvegarde terminée", detail: "03:00", tone: "info" },
];

const CONTACTS = ["Camille Roux", "Hugo Lambert", "Inès Morel", "Léa Fontaine", "Nathan Girard"];

const TABS: QuickviewTab[] = [
  {
    id: "notes",
    label: "Notes",
    content: NOTES.map((n) => (
      <div key={n.titre} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Text weight="bold" size="sm">
          {n.titre}
        </Text>
        <Text size="sm">{n.texte}</Text>
        <Text size="xs" muted>
          {n.date}
        </Text>
      </div>
    )),
  },
  {
    id: "alertes",
    label: "Alertes",
    content: (
      <div>
        {ALERTES.map((a) => (
          <PanelRow key={a.titre} label={a.titre} value={<Badge tone={a.tone}>{a.detail}</Badge>} />
        ))}
      </div>
    ),
  },
  {
    id: "discussion",
    label: "Discussion",
    content: CONTACTS.map((name) => (
      <div key={name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar name={name} size={32} />
        <div>
          <Text size="sm" weight="medium">
            {name}
          </Text>
          <Text size="xs" muted>
            En ligne
          </Text>
        </div>
      </div>
    )),
  },
];

/** Un bouton qui ouvre le panneau ; la story l'ouvre d'elle-même au chargement du canevas. */
function Demo({ label, children, ...props }: Omit<QuickviewProps, "open" | "onClose"> & { label: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ minHeight: 320 }}>
      <Button onClick={() => setOpen(true)}>{label}</Button>
      <Quickview {...props} open={open} onClose={() => setOpen(false)}>
        {children}
      </Quickview>
    </div>
  );
}

const openFirstButton = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  canvasElement.querySelector<HTMLButtonElement>("button")?.click();
};

/** Le panneau du gabarit : trois onglets dans la barre de tête, voile, focus piégé. */
export const Default: Story = {
  name: "Onglets",
  render: () => <Demo label="Ouvrir le panneau" ariaLabel="Panneau rapide" tabs={TABS} />,
  play: openFirstButton,
};

/** `modal={false}` : pas de voile, la page reste utilisable et le panneau ne retient pas le focus. */
export const NonModal: Story = {
  name: "Non modal",
  render: () => (
    <Demo label="Afficher les alertes" title="Alertes" modal={false} width={300}>
      <div>
        {ALERTES.map((a) => (
          <PanelRow key={a.titre} label={a.titre} value={<Badge tone={a.tone}>{a.detail}</Badge>} />
        ))}
      </div>
    </Demo>
  ),
  play: openFirstButton,
};

/** `side="left"` : le panneau glisse depuis le bord gauche. */
export const LeftSide: Story = {
  name: "Bord gauche",
  render: () => (
    <Demo label="Ouvrir les notes" title="Notes" side="left">
      {TABS[0].content}
    </Demo>
  ),
  play: openFirstButton,
};

/** Un titre, un petit formulaire et un pied d'actions fixe sous le corps qui défile. */
export const WithFooter: Story = {
  name: "Avec pied",
  render: function Render() {
    const [open, setOpen] = useState(false);
    const [notify, setNotify] = useState(true);
    return (
      <div style={{ minHeight: 320 }}>
        <Button onClick={() => setOpen(true)}>Modifier le client</Button>
        <Quickview
          open={open}
          onClose={() => setOpen(false)}
          title="Lemoine SAS"
          width={380}
          footer={
            <>
              <Button onClick={() => setOpen(false)}>Annuler</Button>
              <Button selected onClick={() => setOpen(false)}>
                Enregistrer
              </Button>
            </>
          }
        >
          <Input label="Raison sociale" defaultValue="Lemoine SAS" />
          <Input label="Contact" defaultValue="Paul Lemoine" />
          <Input label="Adresse électronique" type="email" defaultValue="paul@lemoine.exemple" />
          <Checkbox checked={notify} onChange={setNotify} label="Envoyer les factures par courriel" />
        </Quickview>
      </div>
    );
  },
  play: openFirstButton,
};
