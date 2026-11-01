import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ButtonGroup } from "./ButtonGroup";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  UnderlineIcon,
  CopyIcon,
  PencilIcon,
  TrashIcon,
  SaveIcon,
  RefreshIcon,
} from "../icons";

const meta: Meta<typeof ButtonGroup> = {
  title: "Primitives/ButtonGroup",
  component: ButtonGroup,
};
export default meta;
type Story = StoryObj<typeof ButtonGroup>;

/** Juxtaposition : des `Button` quelconques, soudés — bordures fusionnées, coins aux extrémités. */
export const Default: Story = {
  render: () => (
    <ButtonGroup ariaLabel="Période">
      <Button>Jour</Button>
      <Button>Semaine</Button>
      <Button>Mois</Button>
      <Button>Année</Button>
    </ButtonGroup>
  ),
};

/** Des `IconButton` : le groupe leur donne la hauteur d'un `Button`, et ils restent carrés. */
export const IconOnly: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <ButtonGroup ariaLabel="Actions sur la ligne">
        <IconButton icon={<PencilIcon />} ariaLabel="Modifier" />
        <IconButton icon={<CopyIcon />} ariaLabel="Dupliquer" />
        <IconButton icon={<TrashIcon />} ariaLabel="Supprimer" />
      </ButtonGroup>
      <ButtonGroup ariaLabel="Enregistrement">
        <Button icon={<SaveIcon size={16} />}>Enregistrer</Button>
        <IconButton icon={<RefreshIcon />} ariaLabel="Recharger" />
      </ButtonGroup>
    </div>
  ),
};

const ALIGN_ITEMS = [
  { value: "left", icon: <AlignLeftIcon />, ariaLabel: "Aligner à gauche" },
  { value: "center", icon: <AlignCenterIcon />, ariaLabel: "Centrer" },
  { value: "right", icon: <AlignRightIcon />, ariaLabel: "Aligner à droite" },
  { value: "justify", icon: <AlignJustifyIcon />, ariaLabel: "Justifier" },
];

/** `items` + `value` : sélection exclusive, un seul bouton enfoncé (`aria-pressed`). */
export const SingleSelection: Story = {
  render: function Render() {
    const [view, setView] = useState("semaine");
    const [align, setAlign] = useState("left");
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
        <ButtonGroup
          ariaLabel="Vue"
          items={[
            { value: "jour", label: "Jour" },
            { value: "semaine", label: "Semaine" },
            { value: "mois", label: "Mois" },
          ]}
          value={view}
          onChange={setView}
        />
        <ButtonGroup ariaLabel="Alignement" items={ALIGN_ITEMS} value={align} onChange={setAlign} />
      </div>
    );
  },
};

/** `selection="multiple"` : chaque bouton s'enfonce seul, comme une barre de mise en forme. */
export const MultipleSelection: Story = {
  render: function Render() {
    const [marks, setMarks] = useState<string[]>(["bold"]);
    return (
      <ButtonGroup
        ariaLabel="Mise en forme"
        selection="multiple"
        items={[
          { value: "bold", icon: <BoldIcon />, ariaLabel: "Gras" },
          { value: "italic", icon: <ItalicIcon />, ariaLabel: "Italique" },
          { value: "underline", icon: <UnderlineIcon />, ariaLabel: "Souligné" },
          { value: "strike", icon: <StrikethroughIcon />, ariaLabel: "Barré" },
        ]}
        value={marks}
        onChange={setMarks}
      />
    );
  },
};

/** `orientation="vertical"` : empilés, même largeur, libellés à gauche. */
export const Vertical: Story = {
  render: () => (
    <ButtonGroup
      orientation="vertical"
      ariaLabel="Section"
      items={[
        { value: "profil", label: "Profil" },
        { value: "securite", label: "Sécurité" },
        { value: "notifications", label: "Notifications" },
      ]}
      defaultValue="securite"
    />
  ),
};

/** `size="sm"` : un cran plus dense, pour un en-tête de carte. */
export const Small: Story = {
  render: () => (
    <ButtonGroup
      size="sm"
      ariaLabel="Période"
      items={[
        { value: "1j", label: "1 J" },
        { value: "1s", label: "1 S" },
        { value: "1m", label: "1 M" },
        { value: "1a", label: "1 A" },
      ]}
      defaultValue="1m"
    />
  ),
};

/** `block` : toute la largeur, la place partagée entre les boutons ; un bouton désactivé. */
export const Block: Story = {
  render: () => (
    <div style={{ maxWidth: 480 }}>
      <ButtonGroup
        block
        ariaLabel="Livraison"
        items={[
          { value: "standard", label: "Standard" },
          { value: "express", label: "Express" },
          { value: "relais", label: "Point relais", disabled: true },
        ]}
        defaultValue="standard"
      />
    </div>
  ),
};
