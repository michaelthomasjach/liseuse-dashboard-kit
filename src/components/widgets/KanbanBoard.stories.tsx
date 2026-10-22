import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { KanbanBoard, type KanbanCard, type KanbanColumn, type KanbanMove } from "./KanbanBoard";

/**
 * Tableau Kanban : glisser-déposer une carte (avec le repère d'insertion), ou les flèches ← → pour la passer à la
 * colonne voisine. « Terminé » est rangé par date : on y dépose une carte, sa place est ignorée.
 */
const meta: Meta<typeof KanbanBoard> = {
  title: "Widgets/KanbanBoard",
  component: KanbanBoard,
};
export default meta;
type Story = StoryObj<typeof KanbanBoard>;

const COLUMNS: KanbanColumn[] = [
  { id: "todo", title: "À faire", hint: "Idées et demandes à ne pas oublier", tone: "info" },
  { id: "doing", title: "En cours", hint: "En développement", tone: "warning" },
  { id: "done", title: "Terminé", hint: "Le plus récent d'abord", tone: "success", sortable: false },
];

const CARDS: KanbanCard[] = [
  { id: 1, columnId: "todo", title: "Carte en globe", tag: "Carte", description: "Une deuxième version de la carte, en globe, au choix avec le planisphère." },
  { id: 2, columnId: "todo", title: "Taux chinois", tag: "Banques centrales", description: "Taux directeur de la PBoC et anticipations." },
  { id: 3, columnId: "doing", title: "Placement automatique entrée / stop / objectif", tag: "Analyse technique" },
  { id: 4, columnId: "done", title: "Recherche d'un symbole depuis le fil d'Ariane", tag: "Symboles", meta: "livré le 22 oct. 2026", group: "jeudi 22 octobre 2026" },
  { id: 5, columnId: "done", title: "Graphique plein écran sur toute la hauteur", tag: "Graphiques", meta: "livré le 22 oct. 2026", group: "jeudi 22 octobre 2026" },
  { id: 6, columnId: "done", title: "Barre de chargement détaillée", tag: "Interface", meta: "livré le 21 oct. 2026", group: "mercredi 21 octobre 2026" },
];

/** Applique un déplacement : la carte change de colonne et prend sa place (en tête de « Terminé »). */
function applyMove(cards: KanbanCard[], m: KanbanMove): KanbanCard[] {
  const moved: KanbanCard = { ...m.card, columnId: m.toColumnId, ...(m.toColumnId === "done" ? { meta: "livré aujourd'hui", group: "aujourd'hui" } : { meta: undefined, group: undefined }) };
  const rest = cards.filter((c) => c.id !== m.card.id);
  const target = rest.filter((c) => c.columnId === m.toColumnId);
  const anchor = target[m.index];
  const at = anchor ? rest.indexOf(anchor) : rest.length;
  return [...rest.slice(0, at), moved, ...rest.slice(at)];
}

export const Evolutions: Story = {
  name: "Évolutions d'un produit",
  render: function Render() {
    const [cards, setCards] = useState(CARDS);
    return (
      <KanbanBoard
        columns={COLUMNS}
        cards={cards}
        onMove={(m) => setCards((list) => applyMove(list, m))}
        onEdit={(c) => window.alert(`Modifier « ${c.title} »`)}
        onDelete={(c) => setCards((list) => list.filter((x) => x.id !== c.id))}
      />
    );
  },
};

export const LectureSeule: Story = {
  name: "Lecture seule",
  args: { columns: COLUMNS, cards: CARDS },
};

export const Vide: Story = {
  args: { columns: COLUMNS, cards: [], emptyLabel: "Aucune carte." },
};
