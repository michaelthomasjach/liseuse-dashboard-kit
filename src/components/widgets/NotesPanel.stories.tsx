import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { NotesPanel, type Note } from "./NotesPanel";

/**
 * Le carnet d'un chef d'équipe d'entrepôt. L'heure de référence est fixée au samedi 31 octobre 2026,
 * 14 h 30 : les dates de la liste ne bougent pas d'un jour à l'autre.
 */
const meta: Meta<typeof NotesPanel> = {
  title: "Widgets/NotesPanel",
  component: NotesPanel,
};
export default meta;
type Story = StoryObj<typeof NotesPanel>;

const NOW = "2026-10-31T14:30:00";

const NOTES: Note[] = [
  {
    id: "inventaire",
    title: "Inventaire de fin de mois",
    body: "Compter les allées A à F samedi matin, avant l'ouverture.\n\nPrévoir deux scanners de plus : ceux du quai 2 ont les batteries fatiguées.\nRapprocher les écarts avec le stock théorique avant lundi.",
    updatedAt: "2026-10-31T11:20:00",
  },
  {
    id: "froid",
    title: "Chambre froide",
    body: "La porte ferme mal depuis mardi. Technicien prévenu, passage jeudi entre 8 h et 10 h.",
    updatedAt: "2026-10-30T17:45:00",
  },
  {
    id: "planning",
    title: "Planning des congés",
    body: "Karim : du 21 au 28 décembre. Léa : 2 et 3 janvier. Personne d'autre la semaine de Noël.",
    updatedAt: "2026-10-12T09:00:00",
  },
  { id: "brouillon", title: "", body: "Idée : un marquage au sol jaune pour les zones de préparation.", updatedAt: "2025-12-04T15:10:00" },
];

export const Default: Story = {
  name: "Bloc-notes",
  render: () => (
    <div style={{ height: 520 }}>
      <NotesPanel notes={NOTES} now={NOW} />
    </div>
  ),
};

/** L'application tient les notes et la note ouverte ; on voit sous le composant ce qu'elle reçoit. */
export const Controlled: Story = {
  name: "Piloté par l'application",
  render: function Render() {
    const [notes, setNotes] = useState(NOTES);
    const [active, setActive] = useState<string | null>("froid");
    const [last, setLast] = useState("—");
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ height: 480 }}>
          <NotesPanel
            notes={notes}
            activeNoteId={active}
            now={NOW}
            onSelectNote={setActive}
            onChange={(note) => {
              setNotes((ns) => ns.map((n) => (n.id === note.id ? note : n)));
              setLast(`modifiée : ${note.id}`);
            }}
            onCreate={(note) => {
              setNotes((ns) => [note, ...ns]);
              setLast(`créée : ${note.id}`);
            }}
            onDelete={(id) => {
              setNotes((ns) => ns.filter((n) => n.id !== id));
              setLast(`supprimée : ${id}`);
            }}
          />
        </div>
        <span style={{ fontSize: 12 }}>
          {notes.length} notes · ouverte : {active ?? "aucune"} · dernier rappel : {last}
        </span>
      </div>
    );
  },
};

/** Sans note : la liste le dit, le bouton « + » en crée une et l'ouvre, le curseur dans le titre. */
export const Empty: Story = {
  name: "Vide",
  render: () => (
    <div style={{ height: 380 }}>
      <NotesPanel notes={[]} now={NOW} emptyText="Aucune note. Créez-en une avec « + »." />
    </div>
  ),
};

/** Dans 380 px, une colonne à la fois : la liste, puis la note touchée avec « Retour ». */
export const Narrow: Story = {
  name: "Cadre étroit",
  render: () => (
    <div style={{ width: 380, height: 520 }}>
      <NotesPanel notes={NOTES} now={NOW} />
    </div>
  ),
};
