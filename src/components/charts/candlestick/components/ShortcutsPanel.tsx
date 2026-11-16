import { useMemo, useState } from "react";
import "./ShortcutsPanel.css";
import { Input } from "../../../forms/Input";
import { Modal } from "../../../primitives/Modal";
import { ShortcutKeys } from "../../../primitives/ShortcutKeys";
import { SearchIcon } from "../../../icons";
import { IS_APPLE_PLATFORM } from "../../internal/platformShortcut";
import { CHART_SHORTCUT_GROUPS, CHART_SHORTCUTS, filterChartShortcuts, type ChartShortcut } from "../chartShortcuts";

export interface ShortcutsPanelProps {
  /** La liste à montrer ; par défaut, tous les raccourcis du kit (`CHART_SHORTCUTS`). */
  shortcuts?: ChartShortcut[];
  /** Force l'affichage Mac (⌘, ⌥) ou PC (Ctrl, Alt) ; détecté depuis le navigateur sinon. */
  platform?: "mac" | "pc";
  /** Donne le focus au champ de recherche à l'ouverture. */
  autoFocusSearch?: boolean;
}

/** Tous les raccourcis, rangés par groupe, avec un champ de recherche : l'onglet « Raccourcis » de l'aide de
 *  l'espace de travail, et le contenu de la fenêtre des raccourcis d'un graphique seul. */
export function ShortcutsPanel({ shortcuts = CHART_SHORTCUTS, platform, autoFocusSearch }: ShortcutsPanelProps) {
  const [query, setQuery] = useState("");
  const apple = platform ? platform === "mac" : IS_APPLE_PLATFORM;
  const shown = useMemo(() => filterChartShortcuts(shortcuts, query, apple), [shortcuts, query, apple]);
  return (
    <div className="lq-shortcuts">
      <Input
        type="search"
        size="small"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un raccourci (« dessin », « Ctrl », « molette »…)"
        aria-label="Rechercher un raccourci"
        leadingIcon={<SearchIcon size={14} />}
        autoFocus={autoFocusSearch}
        containerClassName="lq-shortcuts__search"
      />
      {shown.length === 0 && <p className="lq-shortcuts__empty">Aucun raccourci ne correspond à « {query} ».</p>}
      {CHART_SHORTCUT_GROUPS.map((group) => {
        const rows = shown.filter((s) => s.group === group);
        if (rows.length === 0) return null;
        return (
          <section className="lq-shortcuts__group" key={group} aria-label={group}>
            <h3 className="lq-shortcuts__group-title">{group}</h3>
            <ul className="lq-shortcuts__list">
              {rows.map((s) => (
                <li className="lq-shortcuts__row" key={s.id} data-shortcut-id={s.id}>
                  <ShortcutKeys keys={s.keys} platform={apple ? "mac" : "pc"} className="lq-shortcuts__keys" />
                  <span className="lq-shortcuts__text">
                    {s.description}
                    {s.context && <span className="lq-shortcuts__context"> — {s.context}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

/** La fenêtre des raccourcis d'un graphique utilisé seul, hors `ChartWorkspace` (entrée « Voir les raccourcis… » du
 *  menu du clic droit, action de barre d'outils personnalisée). Dans un espace de travail, la même entrée ouvre
 *  l'aide de l'espace de travail sur son onglet « Raccourcis ». */
export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  if (!open) return null;
  return (
    <Modal open onClose={onClose} title="Raccourcis" size="wide">
      <ShortcutsPanel autoFocusSearch />
    </Modal>
  );
}
