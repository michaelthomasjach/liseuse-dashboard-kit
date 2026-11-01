import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { FloatingActionButton, type FloatingAction } from "./FloatingActionButton";
import { CalendarIcon, FileIcon, PencilIcon, UploadCloudIcon, UserIcon, CommentIcon } from "../icons";

const meta: Meta<typeof FloatingActionButton> = {
  title: "Primitives/FloatingActionButton",
  component: FloatingActionButton,
};
export default meta;
type Story = StoryObj<typeof FloatingActionButton>;

/** Un cadre qui tient lieu d'écran : `position: relative` pour `position="absolute"`, et un
 *  `transform` pour que `position="fixed"` s'y accroche au lieu de la fenêtre de Storybook. */
function Frame({ children, height = 340 }: { children: ReactNode; height?: number }) {
  return (
    <div
      style={{
        position: "relative",
        transform: "translateZ(0)",
        height,
        maxWidth: 560,
        border: "1px dashed var(--lq-color-border-subtle)",
        background: "var(--lq-color-bg)",
        overflow: "hidden",
      }}
    >
      <p style={{ margin: 16, color: "var(--lq-color-text-muted)", fontSize: "0.85rem" }}>Contenu de l'écran…</p>
      {children}
    </div>
  );
}

const ACTIONS: FloatingAction[] = [
  { id: "doc", label: "Nouveau document", icon: <FileIcon /> },
  { id: "event", label: "Planifier un rendez-vous", icon: <CalendarIcon /> },
  { id: "contact", label: "Ajouter un contact", icon: <UserIcon /> },
  { id: "import", label: "Importer", icon: <UploadCloudIcon />, disabled: true },
];

/** Le bouton seul, collé au coin bas-droit de son conteneur (`position="absolute"`). */
export const Default: Story = {
  render: () => (
    <Frame>
      <FloatingActionButton position="absolute" ariaLabel="Nouvelle commande" />
    </Frame>
  ),
};

/** Le « speed dial » : un clic déplie les actions (ici ouvertes d'emblée), Échap ou un clic ailleurs referme. */
export const SpeedDial: Story = {
  render: function Render() {
    const [last, setLast] = useState<string | null>(null);
    const actions = ACTIONS.map((a) => ({ ...a, onSelect: () => setLast(a.label) }));
    return (
      <Frame>
        <p style={{ margin: 16 }}>{last ? `Dernière action : ${last}` : "Aucune action choisie"}</p>
        <FloatingActionButton position="absolute" ariaLabel="Créer" actions={actions} defaultOpen />
      </Frame>
    );
  },
};

/** Les quatre coins : les actions se déplient toujours vers l'intérieur. */
export const Placements: Story = {
  render: () => (
    <Frame height={460}>
      {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map((placement) => (
        <FloatingActionButton
          key={placement}
          position="absolute"
          placement={placement}
          size="sm"
          offset={16}
          ariaLabel={`Actions ${placement}`}
          actions={ACTIONS.slice(0, 2)}
          defaultOpen={placement === "top-left" || placement === "bottom-right"}
        />
      ))}
    </Frame>
  ),
};

/** `tone` : les tons pleins du kit, et `"default"` cerclé d'un filet. `size="sm"` à droite. */
export const Tones: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 16, alignItems: "center", padding: 8 }}>
      {(["accent", "success", "info", "danger", "warning", "dark", "default"] as const).map((tone) => (
        <FloatingActionButton key={tone} position="static" tone={tone} ariaLabel={`Ton ${tone}`} />
      ))}
      <FloatingActionButton position="static" size="sm" icon={<PencilIcon />} ariaLabel="Modifier" />
      <FloatingActionButton position="static" disabled icon={<CommentIcon />} ariaLabel="Commenter" />
    </div>
  ),
};

/** `position="fixed"` (défaut) : collé au coin de la fenêtre — ici, du cadre, qui en tient lieu. */
export const Fixed: Story = {
  render: () => (
    <Frame>
      <FloatingActionButton icon={<CommentIcon />} ariaLabel="Ouvrir la messagerie" tone="info" />
    </Frame>
  ),
};
