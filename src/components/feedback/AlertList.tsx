import type { ReactNode } from "react";
import { AlertTriangleIcon, ErrorIcon, InfoIcon } from "../icons";
import "./AlertList.css";

/**
 * Une liste d'alertes **dans la page** — ce qui ne va pas, du plus grave au plus léger.
 *
 * `Notification` fait surgir un message et le retire ; ici, rien ne surgit : ce sont des lignes qui
 * restent tant que la situation dure — un stock en rupture, un quai saturé, une facture d'énergie qui
 * dérape. Chaque ligne a un **liseré** à gauche et une icône dans la couleur de sa gravité, son
 * message, et au besoin une action (« Voir », « Corriger »). Par défaut, les critiques passent
 * devant, puis les avertissements, puis les informations — l'ordre d'arrivée est gardé à gravité
 * égale.
 *
 * Les critiques sont annoncées aux lecteurs d'écran (`role="alert"`), les autres non : une liste qui
 * se relit à chaque rafraîchissement ne doit pas bavarder.
 */

export type AlertLevel = "info" | "warning" | "critical";

export interface AlertListItem {
  level: AlertLevel;
  message: ReactNode;
  /** Une action au bout de la ligne : un bouton, un lien. */
  action?: ReactNode;
  /** Une clé stable, si les alertes changent d'ordre d'un rendu à l'autre. */
  id?: string;
}

export interface AlertListProps {
  alerts: AlertListItem[];
  /** Trier par gravité, les critiques d'abord. Défaut : oui. */
  sort?: boolean;
  /** Ce qu'on affiche quand il n'y a rien. Défaut : rien du tout. */
  emptyText?: ReactNode;
  /** Des lignes plus serrées. */
  compact?: boolean;
  className?: string;
}

const ORDER: AlertLevel[] = ["critical", "warning", "info"];
const ICON: Record<AlertLevel, ReactNode> = {
  critical: <ErrorIcon size={16} />,
  warning: <AlertTriangleIcon size={16} />,
  info: <InfoIcon size={16} />,
};
const LABEL: Record<AlertLevel, string> = { critical: "Critique", warning: "Avertissement", info: "Information" };

export function AlertList({ alerts, sort = true, emptyText, compact, className }: AlertListProps) {
  const list = sort ? alerts.map((a, i) => ({ a, i })).sort((x, y) => ORDER.indexOf(x.a.level) - ORDER.indexOf(y.a.level) || x.i - y.i).map((x) => x.a) : alerts;
  if (list.length === 0) return emptyText ? <p className={["lq-alerts__empty", className].filter(Boolean).join(" ")}>{emptyText}</p> : null;
  return (
    <ul className={["lq-alerts", compact && "lq-alerts--compact", className].filter(Boolean).join(" ")}>
      {list.map((a, i) => (
        <li key={a.id ?? i} className={`lq-alerts__row lq-alerts__row--${a.level}`} role={a.level === "critical" ? "alert" : undefined}>
          <span className="lq-alerts__icon" aria-label={LABEL[a.level]} role="img">
            {ICON[a.level]}
          </span>
          <span className="lq-alerts__message">{a.message}</span>
          {a.action && <span className="lq-alerts__action">{a.action}</span>}
        </li>
      ))}
    </ul>
  );
}
