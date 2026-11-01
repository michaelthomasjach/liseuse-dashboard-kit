import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Toolbar } from "./Toolbar";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import { ButtonGroup } from "./ButtonGroup";
import { Input } from "../forms/Input";
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  BulletListIcon,
  OrderedListIcon,
  LinkIcon,
  UndoIcon,
  RedoIcon,
  SaveIcon,
  SearchIcon,
  RefreshIcon,
  TrashIcon,
  PlusIcon,
  CursorArrowIcon,
  TrendLineIcon,
  HorizontalLineIcon,
  RectangleShapeIcon,
  TextIcon,
  MeasureIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "../icons";

const meta: Meta<typeof Toolbar> = {
  title: "Primitives/Toolbar",
  component: Toolbar,
};
export default meta;
type Story = StoryObj<typeof Toolbar>;

function Editor({ density }: { density?: "normal" | "compact" }) {
  const [marks, setMarks] = useState<string[]>(["bold"]);
  const [align, setAlign] = useState("left");
  return (
    <Toolbar
      ariaLabel="Mise en forme"
      density={density}
      start={[
        <>
          <IconButton icon={<UndoIcon />} ariaLabel="Annuler" />
          <IconButton icon={<RedoIcon />} ariaLabel="Rétablir" />
        </>,
        <ButtonGroup
          ariaLabel="Style"
          selection="multiple"
          size={density === "compact" ? "sm" : "md"}
          items={[
            { value: "bold", icon: <BoldIcon />, ariaLabel: "Gras" },
            { value: "italic", icon: <ItalicIcon />, ariaLabel: "Italique" },
            { value: "underline", icon: <UnderlineIcon />, ariaLabel: "Souligné" },
          ]}
          value={marks}
          onChange={setMarks}
        />,
        <ButtonGroup
          ariaLabel="Alignement"
          size={density === "compact" ? "sm" : "md"}
          items={[
            { value: "left", icon: <AlignLeftIcon />, ariaLabel: "Aligner à gauche" },
            { value: "center", icon: <AlignCenterIcon />, ariaLabel: "Centrer" },
            { value: "right", icon: <AlignRightIcon />, ariaLabel: "Aligner à droite" },
          ]}
          value={align}
          onChange={setAlign}
        />,
        <>
          <IconButton icon={<BulletListIcon />} ariaLabel="Liste à puces" />
          <IconButton icon={<OrderedListIcon />} ariaLabel="Liste numérotée" />
          <IconButton icon={<LinkIcon />} ariaLabel="Insérer un lien" />
        </>,
      ]}
      end={<Button icon={<SaveIcon size={16} />}>Enregistrer</Button>}
    />
  );
}

/** Un éditeur : groupes séparés par un filet (`start` en tableau), l'action principale à droite (`end`).
 *  Tabulez dans la barre : un seul arrêt, puis ←/→, Origine et Fin d'un contrôle à l'autre. */
export const Default: Story = {
  render: () => <Editor />,
};

/** `density="compact"` : marges et boutons resserrés (IconButton à 32 px, `Button` à la marge réduite). */
export const Compact: Story = {
  render: () => <Editor density="compact" />,
};

/** Un champ dans la barre : il garde ←/→ pour son curseur, Tab en sort comme d'ordinaire. */
export const WithSearch: Story = {
  render: () => (
    <Toolbar
      ariaLabel="Actions du tableau"
      start={[
        <div style={{ width: 240 }}>
          <Input size="small" placeholder="Rechercher une commande" leadingIcon={<SearchIcon size={16} />} aria-label="Rechercher" />
        </div>,
        <>
          <IconButton icon={<RefreshIcon />} ariaLabel="Actualiser" />
          <IconButton icon={<TrashIcon />} ariaLabel="Supprimer la sélection" disabled />
        </>,
      ]}
      end={[
        <Button>Exporter</Button>,
        <Button selected icon={<PlusIcon size={16} />}>
          Nouvelle commande
        </Button>,
      ]}
    />
  ),
};

/** `orientation="vertical"` : la palette d'outils au flanc d'un graphique ; ↑/↓ naviguent. */
export const Vertical: Story = {
  render: function Render() {
    const [tool, setTool] = useState("cursor");
    return (
      <Toolbar
        ariaLabel="Outils de dessin"
        orientation="vertical"
        density="compact"
        start={[
          <ButtonGroup
            orientation="vertical"
            ariaLabel="Outil"
            items={[
              { value: "cursor", icon: <CursorArrowIcon />, ariaLabel: "Curseur" },
              { value: "trend", icon: <TrendLineIcon />, ariaLabel: "Ligne de tendance" },
              { value: "hline", icon: <HorizontalLineIcon />, ariaLabel: "Ligne horizontale" },
              { value: "rect", icon: <RectangleShapeIcon />, ariaLabel: "Rectangle" },
              { value: "text", icon: <TextIcon />, ariaLabel: "Texte" },
            ]}
            value={tool}
            onChange={setTool}
          />,
          <IconButton icon={<MeasureIcon />} ariaLabel="Mesurer" />,
        ]}
        end={
          <>
            <IconButton icon={<ZoomInIcon />} ariaLabel="Zoom avant" />
            <IconButton icon={<ZoomOutIcon />} ariaLabel="Zoom arrière" />
          </>
        }
      />
    );
  },
};

/** `plain` : ni cadre ni fond, pour une barre posée dans l'en-tête d'une carte. */
export const Plain: Story = {
  render: () => (
    <Toolbar
      ariaLabel="Filtres"
      plain
      start={
        <ButtonGroup
          size="sm"
          ariaLabel="Statut"
          items={[
            { value: "toutes", label: "Toutes" },
            { value: "ouvertes", label: "Ouvertes" },
            { value: "closes", label: "Closes" },
          ]}
          defaultValue="toutes"
        />
      }
      end={<IconButton size="sm" icon={<RefreshIcon />} ariaLabel="Actualiser" />}
    />
  ),
};
