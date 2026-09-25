import type { Meta, StoryObj } from "@storybook/react";
import { Tooltip } from "./Tooltip";
import { IconButton } from "./IconButton";
import { Button } from "./Button";
import { HelpIcon, RefreshIcon, SettingsIcon, TruckIcon } from "../icons";

/**
 * Une infobulle générique, au survol comme au clavier (Tab jusqu'à un bouton, Échap pour la fermer).
 * Elle est rendue dans un portail : ni un conteneur qui défile ni un `overflow: hidden` ne la coupent,
 * et elle se retourne d'elle-même quand le côté demandé n'a pas la place.
 */
const meta: Meta<typeof Tooltip> = {
  title: "Primitives/Tooltip",
  component: Tooltip,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Placements: Story = {
  name: "Les quatre côtés",
  render: () => (
    <div style={{ display: "flex", gap: 24, padding: 80, justifyContent: "center", flexWrap: "wrap" }}>
      <Tooltip content="Au-dessus" placement="top">
        <Button>top</Button>
      </Tooltip>
      <Tooltip content="En dessous" placement="bottom">
        <Button>bottom</Button>
      </Tooltip>
      <Tooltip content="À gauche" placement="left">
        <Button>left</Button>
      </Tooltip>
      <Tooltip content="À droite" placement="right">
        <Button>right</Button>
      </Tooltip>
    </div>
  ),
};

export const IconButtons: Story = {
  name: "Sur des boutons-icônes",
  render: () => (
    <div style={{ display: "flex", gap: 8, padding: 60 }}>
      <Tooltip content="Réglages">
        <IconButton icon={<SettingsIcon />} ariaLabel="Réglages" />
      </Tooltip>
      <Tooltip content="Nouvelle partie">
        <IconButton icon={<RefreshIcon />} ariaLabel="Nouvelle partie" />
      </Tooltip>
      <Tooltip content="Visite guidée — refaire le tour de l'interface">
        <IconButton icon={<HelpIcon />} ariaLabel="Visite guidée" />
      </Tooltip>
      <Tooltip content="Désactivée" disabled>
        <IconButton icon={<TruckIcon />} ariaLabel="Sans infobulle" />
      </Tooltip>
    </div>
  ),
};

export const Clipped: Story = {
  name: "Dans un conteneur qui rogne",
  render: () => (
    <div style={{ width: 220, height: 64, overflow: "hidden", border: "1px dashed var(--lq-color-border)", padding: 12, marginTop: 60 }}>
      <Tooltip content="Cette bulle sort du cadre sans être coupée, parce qu'elle vit dans un portail." placement="top">
        <Button>Survolez-moi</Button>
      </Tooltip>
    </div>
  ),
};

export const Flip: Story = {
  name: "Retournée au bord de l'écran",
  render: () => (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <Tooltip content="Demandée à gauche, affichée à droite : pas la place" placement="left">
        <Button>Bord gauche</Button>
      </Tooltip>
      <Tooltip content="Demandée à droite, affichée à gauche" placement="right">
        <Button>Bord droit</Button>
      </Tooltip>
    </div>
  ),
};
