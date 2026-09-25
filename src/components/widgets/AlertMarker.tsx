import type { ReactNode } from "react";
import { AlertTriangleIcon } from "../icons";
import { Tooltip } from "../primitives/Tooltip";
import "./AlertMarker.css";

/**
 * Le **marqueur d'alerte** — l'épingle qu'un jeu de gestion plante sur la scène à l'endroit d'un
 * problème : un quai engorgé, un rack plein, une machine en panne. On la voit de loin, on clique, on
 * est emmené au problème.
 *
 * ## Une épingle, et où elle pointe
 *
 * Une pastille ronde à la couleur de la gravité — rouge de danger pour `critical`, ambre pour
 * `warning`, accent pour `info` —, le triangle d'alerte du kit au centre, cerclée de la couleur du
 * panneau pour se détacher de n'importe quel fond, et prolongée vers le bas d'une petite pointe.
 *
 * **Le point d'ancrage est le milieu du bord inférieur de l'élément** : le bout de la pointe. Pour
 * planter l'épingle sur un point `(x, y)` de sa scène, l'application la place en
 * `position: absolute; left: x; top: y` et la décale de `transform: translate(-50%, -100%)`. Rien
 * dans le composant ne déborde de ce bord : l'ombre portée au sol est dessinée *sur* lui.
 *
 * ## Mouvement
 *
 * Par défaut l'épingle **rebondit** doucement, à intervalles — assez pour attirer l'œil sur une
 * scène chargée, pas assez pour agacer —, et son ombre au sol se resserre quand elle monte. Au survol
 * et au focus, elle grossit un peu, depuis sa pointe, pour que l'ancrage ne bouge pas. `bounce={false}`
 * la fige ; `prefers-reduced-motion` aussi, tout comme la palette e-ink.
 *
 * ## Compte, nom, accessibilité
 *
 * `count` au-delà de 1 ajoute une bulle chiffrée (plafonnée à « 99+ ») : plusieurs problèmes au même
 * endroit. `label` est à la fois l'infobulle (le `Tooltip` du kit) et le nom accessible du bouton,
 * complété du compte (« Quai 3 engorgé (4) »). La gravité, elle, n'est dite que par la couleur et la
 * forme : c'est à `label` de la nommer si elle compte (« Critique : … »).
 *
 * Sur un pointeur grossier, la zone cliquable déborde de la pastille (par un pseudo-élément, sans
 * changer la taille de l'élément ni son ancrage) pour offrir au moins 40 px au doigt.
 *
 * ## La pile
 *
 * `AlertMarkerStack` range dans un coin de son conteneur les alertes qui n'ont pas d'endroit — un
 * contrat en retard, une trésorerie à sec. Au-delà de `max`, les suivantes se replient en une
 * pastille « +N » dont l'infobulle liste les noms. L'ordre est celui du tableau : à l'application de
 * mettre le plus grave en premier.
 */

export type AlertSeverity = "critical" | "warning" | "info";

export interface AlertMarkerProps {
  severity: AlertSeverity;
  /** Nombre de problèmes à cet endroit ; une bulle chiffrée au-delà de 1. */
  count?: number;
  /** Infobulle et nom accessible. */
  label: string;
  onClick: () => void;
  /** `sm` : pastille de 24 px ; `md` : 32 px. Défaut : `"md"`. */
  size?: "sm" | "md";
  /** Rebond d'appel. Défaut : `true`. */
  bounce?: boolean;
  className?: string;
}

/** Placement de l'infobulle : du côté où il y a de la place. Interne — la pile le fixe selon son coin. */
interface InternalProps extends AlertMarkerProps {
  tooltipPlacement?: "top" | "left" | "right";
}

function MarkerButton({ severity, count, label, onClick, size = "md", bounce = true, className, tooltipPlacement = "top" }: InternalProps) {
  const many = typeof count === "number" && count > 1;
  const countText = many ? (count > 99 ? "99+" : String(count)) : null;
  return (
    <Tooltip content={label} placement={tooltipPlacement} anchorClassName="lq-alert-marker__anchor">
      <button
        type="button"
        className={["lq-alert-marker", `lq-alert-marker--${severity}`, `lq-alert-marker--${size}`, bounce && "lq-alert-marker--bounce", className].filter(Boolean).join(" ")}
        aria-label={many ? `${label} (${count})` : label}
        onClick={onClick}
      >
        <span className="lq-alert-marker__ground" aria-hidden="true" />
        <span className="lq-alert-marker__scale" aria-hidden="true">
          <span className="lq-alert-marker__body">
            <span className="lq-alert-marker__tail" />
            <span className="lq-alert-marker__head">
              <AlertTriangleIcon />
            </span>
            {countText && <span className="lq-alert-marker__count">{countText}</span>}
          </span>
        </span>
      </button>
    </Tooltip>
  );
}

export function AlertMarker(props: AlertMarkerProps) {
  return <MarkerButton {...props} />;
}

export type AlertStackCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface AlertMarkerStackProps {
  alerts: (AlertMarkerProps & { id: string })[];
  /** Coin du conteneur (qui doit être positionné). Défaut : `"top-right"`. */
  corner?: AlertStackCorner;
  /** Nombre de marqueurs affichés ; les suivants se replient en « +N ». Défaut : 5. */
  max?: number;
  /** Nom du groupe. Défaut : « Alertes ». */
  "aria-label"?: string;
  className?: string;
}

export function AlertMarkerStack({ alerts, corner = "top-right", max = 5, "aria-label": ariaLabel = "Alertes", className }: AlertMarkerStackProps) {
  const shown = alerts.slice(0, Math.max(0, max));
  const rest = alerts.slice(shown.length);
  const side = corner.endsWith("left") ? "right" : "left";
  const restList: ReactNode = (
    <span className="lq-alert-stack__list">
      {rest.map((a) => (
        <span key={a.id}>{a.label}</span>
      ))}
    </span>
  );
  if (alerts.length === 0) return null;
  return (
    <div role="group" aria-label={ariaLabel} className={["lq-alert-stack", `lq-alert-stack--${corner}`, className].filter(Boolean).join(" ")}>
      {shown.map(({ id, ...a }) => (
        <MarkerButton key={id} {...a} tooltipPlacement={side} />
      ))}
      {rest.length > 0 && (
        <Tooltip content={restList} placement={side}>
          <span className="lq-alert-stack__more" role="img" tabIndex={0} aria-label={`${rest.length} autre${rest.length > 1 ? "s" : ""} alerte${rest.length > 1 ? "s" : ""}`}>
            +{rest.length}
          </span>
        </Tooltip>
      )}
    </div>
  );
}
