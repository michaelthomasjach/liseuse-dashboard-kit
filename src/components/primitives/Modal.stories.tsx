import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { FieldGroup } from "./FieldGroup";
import { ColorSwatchButton } from "./ColorSwatchButton";

const meta: Meta<typeof Modal> = {
  title: "Primitives/Modal",
  component: Modal,
};
export default meta;
type Story = StoryObj<typeof Modal>;

export const LightDetail: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Ouvrir la modale</Button>
        <Modal open={open} onClose={() => setOpen(false)} title="Cuisine">
          <FieldGroup label="Allumage">
            <Button selected>Allumer</Button>
            <Button>Éteindre</Button>
          </FieldGroup>
          <FieldGroup label="Température">
            <Button selected>Blanc chaud</Button>
            <Button>Blanc doux</Button>
            <Button>Blanc neutre</Button>
            <Button>Blanc froid</Button>
          </FieldGroup>
          <FieldGroup label="Couleur">
            <ColorSwatchButton label="Rouge" color="#ef4444" />
            <ColorSwatchButton label="Ambre" color="#f59e0b" selected />
            <ColorSwatchButton label="Vert" color="#22c55e" />
          </FieldGroup>
        </Modal>
      </>
    );
  },
};

export const Fullscreen: Story = {
  name: "Plein écran (quasi-total)",
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Ouvrir la modale plein écran</Button>
        <Modal open={open} onClose={() => setOpen(false)} title="Éditeur" size="fullscreen">
          <p style={{ color: "var(--lq-color-text-muted)" }}>
            `size="fullscreen"` occupe presque tout le viewport (96vw × 92vh) au lieu de la petite boîte centrée par
            défaut — pour un éditeur ou une vue de détail qui a besoin de place.
          </p>
        </Modal>
      </>
    );
  },
};

/**
 * Sur un téléphone, la modale devient une page entière : pas d'arrondi, les encoches respectées, et
 * l'en-tête collé en haut — la croix, agrandie au doigt, reste à portée pendant qu'on fait défiler un
 * contenu plus long que l'écran. La story s'ouvre dans le cadre « mobile » de Storybook ; ouverte
 * seule (`iframe.html`) sur un vrai téléphone, c'est la largeur de l'écran qui décide.
 */
export const Mobile: Story = {
  name: "Sur un téléphone",
  globals: { viewport: { value: "mobile2", isRotated: false } },
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Ouvrir la modale</Button>
        <Modal open={open} onClose={() => setOpen(false)} title="Quai de réception n° 2">
          <FieldGroup label="Allumage">
            <Button selected>Allumer</Button>
            <Button>Éteindre</Button>
          </FieldGroup>
          <FieldGroup label="Température">
            <Button selected>Blanc chaud</Button>
            <Button>Blanc doux</Button>
            <Button>Blanc neutre</Button>
            <Button>Blanc froid</Button>
          </FieldGroup>
          {Array.from({ length: 8 }, (_, i) => (
            <p key={i} style={{ margin: 0, color: "var(--lq-color-text-muted)", lineHeight: 1.5 }}>
              Paragraphe {i + 1} — un contenu plus long que l'écran, pour voir l'en-tête rester en place pendant le
              défilement et le bouton « Fermer » attendre en bas de la page.
            </p>
          ))}
        </Modal>
      </>
    );
  },
};
