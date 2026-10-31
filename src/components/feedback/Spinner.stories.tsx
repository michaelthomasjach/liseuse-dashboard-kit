import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../primitives/Button";
import { Spinner } from "./Spinner";
import { Text } from "../primitives/Text";

/**
 * L'anneau de chargement indéterminé.
 */
const meta = {
  title: "Feedback/Spinner",
  component: Spinner,
  parameters: {
    docs: {
      description: {
        component: [
          "Un anneau qui tourne : une piste pâle et un arc de l'accent. Il dit « ça travaille », sans dire combien de temps encore.",
          "",
          "**Quand l'utiliser** — une attente courte et de durée inconnue : un bouton qui envoie, un panneau qui se recharge, une synchronisation. Quand la **forme** du contenu à venir est connue (une liste, une carte), un `Skeleton` évite le saut de mise en page à l'arrivée ; quand l'avancement est mesurable (un import, un téléversement), une `ProgressBar` le montre.",
          "",
          "**Anatomie** — un SVG carré de `size` px (20 par défaut), qui s'aligne dans une ligne de texte. Il n'a **pas** de libellé visible : `label` (« Chargement… » par défaut) est son nom accessible (`role=\"status\"`, `aria-label`). Pour un texte à côté de l'anneau, posez un `Text` vous-même — et gardez `label` cohérent avec lui.",
          "",
          "**Mouvement** — un tour en 0,9 s. Si l'utilisateur demande moins d'animations (`prefers-reduced-motion`), l'anneau ne s'arrête pas — immobile, il se lirait comme une décoration — mais ralentit à un tour en 3 s.",
          "",
          "**Thème** — arc `--lq-color-accent`, piste `--lq-color-border-subtle`. Rien d'autre : la taille est une prop.",
        ].join("\n"),
      },
    },
  },
  args: { size: 24, label: "Chargement des commandes" },
  render: (args) => <Spinner {...args} />,
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Défaut" };

export const Sizes: Story = {
  name: "Tailles",
  parameters: { docs: { description: { story: "16 px dans une ligne de texte ou un bouton, 24 px dans un panneau, 40 px au centre d'une zone vide." } } },
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <Spinner size={16} label="Chargement" />
      <Spinner size={24} label="Chargement" />
      <Spinner size={40} label="Chargement" />
      <Spinner size={64} label="Chargement" />
    </div>
  ),
};

export const Inline: Story = {
  name: "Dans une ligne",
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Spinner size={16} label="Synchronisation en cours" />
      <Text size="sm" muted>
        Synchronisation comptable en cours…
      </Text>
    </div>
  ),
  parameters: { docs: { description: { story: "Le texte visible est posé à côté ; `label` dit la même chose aux lecteurs d'écran." } } },
};

export const InButton: Story = {
  name: "Dans un bouton",
  render: () => (
    <Button disabled icon={<Spinner size={16} label="Envoi en cours" />}>
      Envoi en cours
    </Button>
  ),
  parameters: { docs: { description: { story: "L'anneau à la place de l'icône d'un bouton désactivé, le temps de la requête." } } },
};

export const Panel: Story = {
  name: "Zone en chargement",
  render: () => (
    <div
      style={{
        height: 180,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        border: "1px dashed var(--lq-color-border)",
        borderRadius: "var(--lq-radius-lg)",
      }}
    >
      <Spinner size={40} label="Chargement du tableau" />
      <Text size="sm" muted>
        Chargement du tableau…
      </Text>
    </div>
  ),
};
