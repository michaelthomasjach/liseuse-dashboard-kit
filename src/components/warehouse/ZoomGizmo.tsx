import { useEffect, type RefObject } from "react";
import "./ZoomGizmo.css";

/**
 * Deux loupes, et la molette.
 *
 * Le zoom est une opération de **vue**, pas de modèle : il ne touche ni aux cotes des pièces, ni à
 * la taille d'une case, ni à l'ordre de peinture. Agrandir en augmentant `cellSize` reviendrait à
 * redessiner toute la scène à chaque cran — chaque module recalculant sa `viewBox`, ses contours et
 * son ombre — pour un résultat identique à l'œil. Ici c'est l'affichage qui grossit, et le dessin
 * reste vectoriel : net à tous les grossissements, sans un seul recalcul.
 *
 * `zoom` plutôt qu'une transformation : la propriété CSS `zoom` agit sur la **mise en page**, donc
 * une scène agrandie prend réellement plus de place, reste centrée par son conteneur et devient
 * atteignable au défilement. Une `transform: scale()` ne change que la peinture : la scène déborde
 * de son conteneur sans que rien ne permette d'aller chercher ce qui sort de l'écran.
 */

/** Les bornes, et le pas d'un cran de molette.
 *
 *  Multiplicatif et non additif : d'un cran, on veut « un quart de plus », pas « 0,25 de plus » —
 *  sinon le même cran double la taille en bas de l'échelle et ne fait presque rien en haut. */
export const ZOOM_MIN = 0.35;
export const ZOOM_MAX = 4;
const ZOOM_STEP = 1.15;
/** Le pas des boutons, plus franc que celui de la molette : on clique moins souvent qu'on ne
 *  déroule. */
const BUTTON_STEP = 1.3;

export const clampZoom = (value: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));

export interface ZoomGizmoProps {
  value: number;
  onChange: (zoom: number) => void;
  className?: string;
}

export function ZoomGizmo({ value, onChange, className }: ZoomGizmoProps) {
  return (
    <div className={["lq-zoom", className].filter(Boolean).join(" ")} role="group" aria-label="Zoom">
      <button
        type="button"
        className="lq-zoom__button"
        onClick={() => onChange(clampZoom(value * BUTTON_STEP))}
        disabled={value >= ZOOM_MAX}
        aria-label="Agrandir"
        title="Agrandir"
      >
        <MagnifierIcon sign="plus" />
      </button>
      <button
        type="button"
        className="lq-zoom__button"
        onClick={() => onChange(clampZoom(value / BUTTON_STEP))}
        disabled={value <= ZOOM_MIN}
        aria-label="Réduire"
        title="Réduire"
      >
        <MagnifierIcon sign="minus" />
      </button>
    </div>
  );
}

/** La loupe, dessinée ici plutôt que prise dans la bibliothèque d'icônes : il en faut deux qui ne
 *  diffèrent que par le signe dans la lentille, et les tracer ensemble est ce qui garantit qu'elles
 *  se ressemblent. */
function MagnifierIcon({ sign }: { sign: "plus" | "minus" }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <circle cx="6.8" cy="6.8" r="4.6" fill="none" />
      <line x1="10.2" y1="10.2" x2="14" y2="14" />
      <line x1="4.4" y1="6.8" x2="9.2" y2="6.8" />
      {sign === "plus" && <line x1="6.8" y1="4.4" x2="6.8" y2="9.2" />}
    </svg>
  );
}

/**
 * La molette, sur une surface donnée.
 *
 *  En écouteur natif **non passif**, et c'est la seule façon : un navigateur enregistre les
 *  écouteurs de molette en mode passif par défaut, et un écouteur passif ne peut pas annuler le
 *  défilement de la page. Sans ça, dérouler sur la scène la fait grossir *et* fait défiler la page
 *  dessous — le zoom marche et la page part.
 *
 *  Le cran est lu sur le signe de `deltaY` et non sur sa valeur : la même molette rend des deltas
 *  de 3, de 53 ou de 120 selon le navigateur, le système et le réglage de défilement, et un facteur
 *  proportionnel donnerait un zoom trois fois plus vif ici que là.
 */
export function useWheelZoom(target: RefObject<HTMLElement | null>, onZoom: (next: (current: number) => number) => void) {
  useEffect(() => {
    const el = target.current;
    if (el === null) return;
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      onZoom((current) => clampZoom(current * factor));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [target, onZoom]);
}
