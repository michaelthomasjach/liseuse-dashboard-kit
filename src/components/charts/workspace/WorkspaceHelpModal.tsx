import { Modal } from "../../primitives/Modal";

/** One entry per global feature the rail's own "?" button explains, in the order they read most
 *  naturally (layout, then focus, then protection) rather than the order their own buttons sit in
 *  the rail. */
const HELP_ITEMS: { title: string; description: string }[] = [
  { title: "Écran divisé", description: "Affiche 1, 2, 4, 6 ou 8 graphiques à la fois, répartis en grille." },
  {
    title: "Focus fenêtre active",
    description: "Une fois plusieurs graphiques affichés, agrandit celui survolé pour qu'il occupe toute la grille — les autres restent ouverts en dessous, juste masqués. Recliquer restaure la disposition.",
  },
  { title: "Plein écran de l'espace de travail", description: "Fait passer l'ensemble de l'espace de travail (grille, liste de surveillance et alertes comprises) en plein écran." },
  { title: "Graphiques liés", description: "Synchronise le curseur (survol) entre plusieurs graphiques d'un même groupe." },
  {
    title: "Éditeur de script",
    description:
      "Ouvre l'éditeur de script partagé de l'espace de travail — un script y choisit sur quel panneau s'exécuter. Visible uniquement si ce ChartWorkspace a activé la prop `scripting`.",
  },
  {
    title: "Verrouillage",
    description:
      "Un appui maintenu trois secondes sur la grille la verrouille : elle s'estompe et devient protégée contre toute interaction, un curseur en forme de cadenas apparaît au survol. Le même appui la déverrouille. Après une seconde, une jauge et un cadenas apparaissent au centre pour montrer la progression — relâcher ou faire glisser le doigt avant la fin annule. Le geste est sans effet tant qu'un outil de dessin est actif, pour ne pas se confondre avec la pose d'un point.",
  },
];

export interface WorkspaceHelpModalProps {
  open: boolean;
  onClose: () => void;
}

/** What every workspace-wide control does, in words — reached from the rail's own "?" button.
 *
 *  A component of its own because it is almost entirely copy: nineteen lines of French prose that
 *  have to be kept true as the rail changes, and that have no business being read past on the way
 *  to the workspace's actual logic. */
export function WorkspaceHelpModal({ open, onClose }: WorkspaceHelpModalProps) {
  if (!open) return null;
  return (
    <Modal open onClose={onClose} title="Fonctionnalités de l'espace de travail">
      <div className="lq-chart-workspace__help-list">
        {HELP_ITEMS.map((item) => (
          <div className="lq-chart-workspace__help-item" key={item.title}>
            <p className="lq-chart-workspace__help-item-title">{item.title}</p>
            <p className="lq-chart__indicator-info-text">{item.description}</p>
          </div>
        ))}
      </div>
    </Modal>
  );
}
