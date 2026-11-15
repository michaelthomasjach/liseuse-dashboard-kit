import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { IndicatorKind } from "../interfaces/IndicatorKind.interface";
import { hasIndicatorHelp, indicatorHelpPage } from "../indicatorHelp";
import { Modal } from "../../../primitives/Modal";
import { IndicatorHelpArticle } from "./IndicatorHelpArticle";
import "./IndicatorHelpArticle.css";

/** Ouvre la page d'aide d'un indicateur intégré. Fourni par le graphique (voir
 *  `IndicatorHelpProvider`) à tous ses boutons « ? » : sélecteur d'indicateurs, légende, en-têtes de
 *  panneau, fenêtre de paramètres — sans faire descendre une prop de plus à travers chacun. */
const IndicatorHelpContext = createContext<((kind: IndicatorKind) => void) | null>(null);

export function useOpenIndicatorHelp(): ((kind: IndicatorKind) => void) | null {
  return useContext(IndicatorHelpContext);
}

export interface IndicatorHelpProviderProps {
  /** Navigation décidée par l'application (sa propre page d'aide, un nouvel onglet…). Absente :
   *  la page s'ouvre dans une fenêtre du graphique. */
  onOpenIndicatorHelp?: (kind: IndicatorKind) => void;
  children: ReactNode;
}

/** Le graphique entier s'y trouve : chaque « ? » ouvre la page d'aide, soit par
 *  `onOpenIndicatorHelp`, soit dans une fenêtre intégrée (démo, application sans page d'aide). */
export function IndicatorHelpProvider({ onOpenIndicatorHelp, children }: IndicatorHelpProviderProps) {
  const [openKind, setOpenKind] = useState<IndicatorKind | null>(null);
  const open = useCallback(
    (kind: IndicatorKind) => {
      if (!hasIndicatorHelp(kind)) return;
      if (onOpenIndicatorHelp) onOpenIndicatorHelp(kind);
      else setOpenKind(kind);
    },
    [onOpenIndicatorHelp]
  );
  const page = openKind ? indicatorHelpPage(openKind) : null;
  return (
    <IndicatorHelpContext.Provider value={open}>
      {children}
      {page && (
        <Modal open onClose={() => setOpenKind(null)} title={`Aide — ${page.label}`} size="wide" footer={null}>
          <IndicatorHelpArticle kind={page.kind} showTitle={false} onOpenIndicator={setOpenKind} />
        </Modal>
      )}
    </IndicatorHelpContext.Provider>
  );
}

export interface IndicatorHelpButtonProps {
  kind: string;
  /** Classe du bouton : celle des actions voisines (en-tête de panneau, légende…). */
  className?: string;
  label?: string;
}

/** Le bouton « ? » d'un indicateur intégré. Rien pour un indicateur sans page d'aide (script,
 *  indicateur personnalisé) ou hors d'un graphique. */
export function IndicatorHelpButton({ kind, className = "lq-chart__pane-header-action", label }: IndicatorHelpButtonProps) {
  const open = useOpenIndicatorHelp();
  const name = useMemo(() => indicatorHelpPage(kind)?.label, [kind]);
  if (!open || !name || !hasIndicatorHelp(kind)) return null;
  return (
    <button
      type="button"
      className={[className, "lq-indicator-help-button"].join(" ")}
      // Dans l'en-tête d'une fenêtre : ne pas armer son glisser-déposer (voir `ModalProps.headerActions`).
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        open(kind);
      }}
      aria-label={label ?? `Aide : ${name}`}
      title="Aide : définition, formule, paramètres"
    >
      ?
    </button>
  );
}
