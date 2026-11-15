import { ChevronLeftIcon, ChevronRightIcon, RefreshIcon, ZoomInIcon, ZoomOutIcon } from "../../../icons";
import type { ChartButtonsVisibility } from "../chartStyle";
import "./ChartCanvasOptions.css";

export interface ChartNavigationButtonsProps {
  /** Paramètres système → Toile → Boutons → Navigation. `hidden` (défaut) : rien n'est rendu. */
  visibility: ChartButtonsVisibility | undefined;
  /** Centre horizontal et bas (dans le repère de `.lq-chart__plot`) du panneau des prix. */
  centerX: number;
  bottom: number;
  zoomBy: (factor: number) => void;
  scrollBy: (bars: number) => void;
  reset: () => void;
}

/** Nombre de bougies par clic sur une flèche de défilement. */
const SCROLL_STEP = 10;

/**
 * Boutons de navigation en bas du panneau des prix, comme sur une plateforme de marché : zoom arrière, zoom avant,
 * défilement vers le passé et vers les plus récentes, remise à zéro de la vue. Toujours visibles, ou seulement au
 * survol du graphique ; masqués par défaut.
 */
export function ChartNavigationButtons({ visibility, centerX, bottom, zoomBy, scrollBy, reset }: ChartNavigationButtonsProps) {
  if (!visibility || visibility === "hidden") return null;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <div
      className={["lq-chart__nav-buttons", visibility === "hover" && "lq-chart__nav-buttons--hover"].filter(Boolean).join(" ")}
      style={{ left: centerX, top: bottom }}
      role="toolbar"
      aria-label="Navigation du graphique"
      onPointerDown={stop}
      onClick={stop}
      onDoubleClick={stop}
      onContextMenu={stop}
    >
      <button type="button" className="lq-chart__nav-button" onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom arrière" title="Zoom arrière">
        <ZoomOutIcon size={14} />
      </button>
      <button type="button" className="lq-chart__nav-button" onClick={() => zoomBy(1.25)} aria-label="Zoom avant" title="Zoom avant">
        <ZoomInIcon size={14} />
      </button>
      <button type="button" className="lq-chart__nav-button" onClick={() => scrollBy(-SCROLL_STEP)} aria-label="Défiler vers le passé" title="Défiler vers le passé">
        <ChevronLeftIcon size={14} />
      </button>
      <button type="button" className="lq-chart__nav-button" onClick={() => scrollBy(SCROLL_STEP)} aria-label="Défiler vers les plus récentes" title="Défiler vers les plus récentes">
        <ChevronRightIcon size={14} />
      </button>
      <button type="button" className="lq-chart__nav-button" onClick={reset} aria-label="Réinitialiser la vue" title="Réinitialiser la vue">
        <RefreshIcon size={14} />
      </button>
    </div>
  );
}
