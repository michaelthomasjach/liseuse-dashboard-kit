import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckIcon, ChevronDownIcon, CloseIcon } from "../icons";
import "./ObjectiveTracker.css";

/**
 * Le **suivi des objectifs** d'un jeu — les « quêtes » d'une prise en main : ce qui est fait, ce
 * qu'on fait maintenant, ce qui vient après.
 *
 * ## Une carte qui flotte
 *
 * Le composant est une petite carte ; l'application la place où elle veut — en bas à gauche du plan,
 * par-dessus la scène. En tête : le titre, « 3 / 7 », une barre d'avancement fine, un chevron qui
 * replie la carte sur sa tête (et, si l'application le permet, une croix pour la fermer). Dessous, les
 * étapes :
 *
 * - **faites** : cochées, en retrait, barrées ;
 * - **en cours** : la seule mise en avant — un liseré à l'accent, sa description, un indice, et au
 *   besoin un bouton qui mène au geste à faire ;
 * - **à venir** : estompées, réduites à leur titre — on voit le chemin sans être noyé.
 *
 * Quand une étape passe à « faite », sa ligne s'illumine un instant : le joueur voit ce qu'il vient
 * d'accomplir. Toutes faites, la carte le fête : « Terminé ! ».
 *
 * La liste est une vraie liste ordonnée ; l'étape en cours porte `aria-current="step"`, et le compte
 * est annoncé poliment quand il change.
 *
 * ## Sur un téléphone
 *
 * La carte garde sa largeur de 300 px mais ne dépasse jamais son conteneur, et les mots trop longs
 * passent à la ligne plutôt que de la faire déborder. Sous un doigt (ou sous 640 px de large), chaque
 * bouton — le chevron, la croix, l'action de l'étape en cours — devient une cible de 44 px, et le
 * texte grossit d'un cran. Pour la poser en bas d'un écran de téléphone, l'application peut lui
 * donner toute la largeur (`className` avec `width: 100%`).
 */

export type ObjectiveState = "done" | "current" | "todo";

export interface Objective {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  state: ObjectiveState;
  /** Un indice, sous la description de l'étape en cours. */
  hint?: ReactNode;
  /** Un bouton sous l'étape en cours : ce qui mène au geste à faire. */
  action?: { label: string; onClick: () => void };
}

export interface ObjectiveTrackerProps {
  title: ReactNode;
  subtitle?: ReactNode;
  objectives: Objective[];
  /** Replié sur sa tête. Contrôlé si `onCollapsedChange` est donné avec lui. */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Une croix pour fermer la carte. */
  onDismiss?: () => void;
  /** Ce qu'on dit quand tout est fait. Défaut : « Terminé ! ». */
  doneText?: ReactNode;
  className?: string;
}

/** Combien de temps une étape tout juste faite reste illuminée, en millisecondes. */
const FLASH_MS = 1400;

export function ObjectiveTracker({ title, subtitle, objectives, collapsed, onCollapsedChange, onDismiss, doneText = "Terminé !", className }: ObjectiveTrackerProps) {
  const [ownCollapsed, setOwnCollapsed] = useState(false);
  const folded = collapsed ?? ownCollapsed;
  const setFolded = (c: boolean) => {
    setOwnCollapsed(c);
    onCollapsedChange?.(c);
  };
  const total = objectives.length;
  const done = objectives.filter((o) => o.state === "done").length;
  const complete = total > 0 && done === total;

  // Les étapes qui viennent de passer à « faite » : on les compare à l'état précédent.
  const previous = useRef(new Map<string, ObjectiveState>());
  const [flash, setFlash] = useState<string[]>([]);
  const stateKey = objectives.map((o) => `${o.id}:${o.state}`).join("|");
  useEffect(() => {
    const fresh = objectives.filter((o) => o.state === "done" && previous.current.has(o.id) && previous.current.get(o.id) !== "done").map((o) => o.id);
    previous.current = new Map(objectives.map((o) => [o.id, o.state]));
    if (fresh.length === 0) return;
    setFlash((f) => [...f, ...fresh]);
    const t = window.setTimeout(() => setFlash((f) => f.filter((id) => !fresh.includes(id))), FLASH_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey]);

  const bodyId = useRef(`lq-objectives-${Math.random().toString(36).slice(2, 9)}`).current;

  return (
    <section className={["lq-objectives", folded && "lq-objectives--collapsed", complete && "lq-objectives--complete", className].filter(Boolean).join(" ")} aria-label={typeof title === "string" ? title : "Objectifs"}>
      <header className="lq-objectives__head">
        <div className="lq-objectives__titles">
          <span className="lq-objectives__title">{title}</span>
          {subtitle && <span className="lq-objectives__subtitle">{subtitle}</span>}
        </div>
        <span className="lq-objectives__count" aria-live="polite">
          {done} / {total}
        </span>
        <button type="button" className="lq-objectives__icon-btn lq-objectives__fold" aria-expanded={!folded} aria-controls={bodyId} aria-label={folded ? "Déplier les objectifs" : "Replier les objectifs"} onClick={() => setFolded(!folded)}>
          <ChevronDownIcon size={14} />
        </button>
        {onDismiss && (
          <button type="button" className="lq-objectives__icon-btn" aria-label="Fermer" onClick={onDismiss}>
            <CloseIcon size={13} />
          </button>
        )}
      </header>
      <div className="lq-objectives__bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label="Avancement">
        <span className="lq-objectives__fill" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
      <div id={bodyId} className="lq-objectives__body" hidden={folded}>
        {complete ? (
          <div className="lq-objectives__done" role="status">
            <span className="lq-objectives__done-badge">
              <CheckIcon size={18} />
            </span>
            <span className="lq-objectives__done-text">{doneText}</span>
          </div>
        ) : (
          <ol className="lq-objectives__list">
            {objectives.map((o) => {
              const current = o.state === "current";
              return (
                <li
                  key={o.id}
                  className={["lq-objectives__step", `lq-objectives__step--${o.state}`, flash.includes(o.id) && "lq-objectives__step--flash"].filter(Boolean).join(" ")}
                  aria-current={current ? "step" : undefined}
                >
                  <span className="lq-objectives__mark" aria-hidden>
                    {o.state === "done" ? <CheckIcon size={11} /> : null}
                  </span>
                  <div className="lq-objectives__content">
                    <span className="lq-objectives__step-title">
                      {o.title}
                      {o.state === "done" && <span className="lq-objectives__sr"> (fait)</span>}
                    </span>
                    {current && o.description && <span className="lq-objectives__desc">{o.description}</span>}
                    {current && o.hint && <span className="lq-objectives__hint">{o.hint}</span>}
                    {current && o.action && (
                      <button type="button" className="lq-objectives__action" onClick={o.action.onClick}>
                        {o.action.label}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
