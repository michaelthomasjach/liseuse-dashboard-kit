import { DetachedWindow } from "../../components/DetachedWindow";
import { ScriptEditorWindow } from "./ScriptEditorWindow";

/** One thing the no-code canvas can be told to do, and how.
 *
 *  **Every keyboard shortcut the canvas gains must be added here.** That is the whole reason this
 *  list exists rather than living in a tooltip somewhere: a shortcut nobody can discover is a
 *  shortcut nobody has, and the `?` is the one place a reader will look for the answer. */
const SHORTCUTS: { keys: string; what: string }[] = [
  { keys: "Espace", what: "Recadre la vue sur tout le graphe — blocs et groupes compris." },
  { keys: "Molette", what: "Zoome et dézoome, centré sur le pointeur." },
  { keys: "Ctrl / ⌘ + molette", what: "La même chose : c'est ce qu'envoie un pincement sur pavé tactile." },
];

const GESTURES: { what: string; how: string }[] = [
  { what: "Déplacer la vue", how: "Glisser sur le fond du plan de travail." },
  { what: "Déplacer un bloc", how: "Glisser le bloc." },
  { what: "Ouvrir le code d'un bloc", how: "Cliquer le bloc sans le déplacer." },
  { what: "Relier deux blocs", how: "Glisser du point de sortie de l'un vers le point d'entrée de l'autre." },
  { what: "Ajouter un bloc", how: "Glisser une carte depuis la palette, ou cliquer dessus." },
  { what: "Ajouter un groupe", how: "Le bouton « Groupe » de la barre d'outils." },
  { what: "Modifier un groupe", how: "Cliquer le cadre : titre, couleur et suppression apparaissent en bas." },
  { what: "Redimensionner un groupe", how: "Glisser la poignée de son coin bas-droit, une fois le cadre sélectionné." },
];

export interface ScriptGraphHelpProps {
  open: boolean;
  onClose: () => void;
  /** The window the reader tore this off into, or null. */
  detachedWindow: Window | null;
  onDetach: () => void;
  onDetachedClose: () => void;
  themeSource: HTMLElement | null;
}

/** What the no-code canvas can do, and how to ask it — in a window that can be dragged out of the
 *  way or off into a browser window of its own.
 *
 *  A floating window rather than a modal, deliberately: the answer to "how do I resize a group" is
 *  useless while the thing it describes is behind a backdrop. `ScriptEditorWindow` is the library's
 *  floating-window primitive despite its name — draggable, resizable, portaled, and already able to
 *  render itself flat inside a detached browser window. */
export function ScriptGraphHelp({ open, onClose, detachedWindow, onDetach, onDetachedClose, themeSource }: ScriptGraphHelpProps) {
  if (!open) return null;

  const body = (
    <div className="lq-script-graph-help">
      <p className="lq-script-graph-help__lead">
        Le plan de travail montre le script tel qu'il est écrit : chaque bloc est une cellule{" "}
        <code>@block</code>, chaque flèche un <code>after</code>. Tout ce qui est fait ici est écrit
        dans le texte du script, et inversement — il n'y a pas de second format.
      </p>

      <h4 className="lq-script-graph-help__title">Clavier</h4>
      <dl className="lq-script-graph-help__list">
        {SHORTCUTS.map((entry) => (
          <div key={entry.keys} className="lq-script-graph-help__row">
            <dt>
              <kbd>{entry.keys}</kbd>
            </dt>
            <dd>{entry.what}</dd>
          </div>
        ))}
      </dl>

      <h4 className="lq-script-graph-help__title">Souris</h4>
      <dl className="lq-script-graph-help__list">
        {GESTURES.map((entry) => (
          <div key={entry.what} className="lq-script-graph-help__row">
            <dt>{entry.what}</dt>
            <dd>{entry.how}</dd>
          </div>
        ))}
      </dl>

      <h4 className="lq-script-graph-help__title">Groupes</h4>
      <p className="lq-script-graph-help__lead">
        Un groupe est un cadre coloré posé <em>derrière</em> les blocs. Il ne possède rien et ne
        capture rien : déplacer un bloc au travers ne l'y met pas, et supprimer le cadre ne supprime
        que le cadre. C'est ce qui permet d'en tracer un autour de n'importe quoi sans conséquence —
        il est là pour se lire, pas pour structurer. La structure, ce sont les flèches.
      </p>
    </div>
  );

  if (detachedWindow !== null) {
    return (
      <DetachedWindow target={detachedWindow} themeSource={themeSource} title="Aide du plan de travail" onClose={onDetachedClose} layout="page">
        {body}
      </DetachedWindow>
    );
  }

  return (
    <ScriptEditorWindow open onClose={onClose} title="Aide du plan de travail" onRequestDetach={onDetach}>
      {body}
    </ScriptEditorWindow>
  );
}
