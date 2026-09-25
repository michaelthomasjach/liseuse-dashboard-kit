import type { CSSProperties, ReactNode } from "react";
import { Tooltip } from "../primitives/Tooltip";
import "./DemandMeters.css";

/**
 * Les **jauges de demande** — la rangée de petites barres qu'un jeu de gestion garde en bas de
 * l'écran, par-dessus la scène, pour dire d'un coup d'œil ce qui manque : de la place au stock, des
 * bras au quai, de l'énergie.
 *
 * ## Une jauge
 *
 * Une petite icône, un nom court, une barre fine qui se remplit en proportion de `value` — de gauche
 * à droite en orientation horizontale, de bas en haut en orientation verticale (les barres dressées
 * côte à côte des city-builders). La barre s'anime quand la valeur change, pour que le joueur voie
 * la tendance et pas seulement l'état.
 *
 * `value` est une fraction : 0 vide, 1 pleine. Au-delà de 1, la barre reste pleine — elle ne peut
 * pas l'être plus — et un **signal de débordement** s'allume à son extrémité : des chevrons qui
 * battent doucement (fixes si l'utilisateur a demandé moins d'animations). C'est la demande qui
 * excède ce que l'entrepôt peut offrir, le moment où il faut agir.
 *
 * Le **ton** colore le remplissage : `good` en vert, `warning` en ambre, `critical` au rouge de
 * danger, `neutral` à l'accent. En e-ink, où toutes ces couleurs se replient sur l'encre, le ton
 * critique garde une trame hachurée et le débordement ses chevrons : l'information ne repose jamais
 * sur la couleur seule.
 *
 * ## Le détail
 *
 * `detail` s'affiche dans une infobulle (le `Tooltip` du kit) au survol et au focus : chaque jauge est
 * atteignable au clavier (`tabIndex={0}`). Sans `detail`, l'infobulle rappelle le nom et le
 * pourcentage — utile surtout en mode `compact`, où le nom disparaît derrière l'icône.
 *
 * ## Accessibilité
 *
 * Chaque jauge est un `role="meter"` exprimé **en pourcentage** : `aria-valuemin` 0,
 * `aria-valuemax` 100, `aria-valuenow` la valeur brute ×100 arrondie — qui peut donc dépasser 100 en
 * cas de débordement : c'est voulu, on ne ment pas sur la demande — et `aria-valuetext` la même
 * chose en clair (« 112 % »), qui fait foi pour les lecteurs d'écran qui bornent `valuenow`.
 *
 * ## Sur un téléphone
 *
 * En orientation horizontale, les jauges passent à la ligne quand la place manque ; `compact`
 * masque les noms (il faut alors une icône), resserre les barres et en tient cinq ou six sur 360 px.
 */

export interface DemandMeter {
  id: string;
  /** Nom court : le nom accessible de la jauge, et son libellé visible hors mode compact. */
  label: string;
  icon?: ReactNode;
  /** Fraction remplie : 0 à 1, au-delà = débordement. */
  value: number;
  /** Défaut : `"neutral"`. */
  tone?: "neutral" | "good" | "warning" | "critical";
  /** Contenu de l'infobulle. */
  detail?: ReactNode;
}

export interface DemandMetersProps {
  meters: DemandMeter[];
  /** Sens de remplissage des barres. Défaut : `"horizontal"`. */
  orientation?: "horizontal" | "vertical";
  /** Noms masqués (restent le nom accessible et l'infobulle), barres resserrées. */
  compact?: boolean;
  className?: string;
}

export function DemandMeters({ meters, orientation = "horizontal", compact, className }: DemandMetersProps) {
  return (
    <div
      role="group"
      aria-label="Demande"
      className={["lq-demand", `lq-demand--${orientation}`, compact && "lq-demand--compact", className].filter(Boolean).join(" ")}
    >
      {meters.map((m) => {
        const safe = Number.isFinite(m.value) ? Math.max(0, m.value) : 0;
        const pct = Math.round(safe * 100);
        const overflow = safe > 1;
        const tone = m.tone ?? "neutral";
        const text = `${pct} %`;
        return (
          <Tooltip
            key={m.id}
            content={
              m.detail ?? (
                <>
                  {m.label} — {text}
                </>
              )
            }
            placement="top"
            anchorClassName="lq-demand__slot"
          >
            <div
              role="meter"
              tabIndex={0}
              aria-label={m.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-valuetext={overflow ? `${text}, au-delà de la capacité` : text}
              className={["lq-demand__meter", `lq-demand__meter--${tone}`, overflow && "lq-demand__meter--overflow"].filter(Boolean).join(" ")}
              style={{ "--lq-demand-fill": Math.min(1, safe) } as CSSProperties}
            >
              <span className="lq-demand__head">
                {m.icon && (
                  <span className="lq-demand__icon" aria-hidden="true">
                    {m.icon}
                  </span>
                )}
                <span className="lq-demand__label">{m.label}</span>
              </span>
              <span className="lq-demand__bar" aria-hidden="true">
                <span className="lq-demand__track">
                  <span className="lq-demand__fill" />
                </span>
                {overflow && (
                  <span className="lq-demand__cap">
                    <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2.5 2.5 6 6l-3.5 3.5M6.5 2.5 10 6l-3.5 3.5" />
                    </svg>
                  </span>
                )}
              </span>
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
}
