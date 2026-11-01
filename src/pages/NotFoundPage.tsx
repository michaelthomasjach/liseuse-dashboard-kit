import type { ReactNode } from "react";
import { Button } from "../components/primitives/Button";
import "./NotFoundPage.css";

export interface NotFoundPageProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  illustration?: ReactNode;
  /** Vrai (défaut) : au moins toute la hauteur de la fenêtre. Faux : remplit son conteneur
   *  (`min-height: 100%`), et la taille du code suit sa largeur, pas celle de la fenêtre. */
  fullHeight?: boolean;
  className?: string;
}

/** Centered 404 page with an optional custom illustration and a way back. */
export function NotFoundPage({
  title = "404",
  message = "Cette page n'existe pas ou a été déplacée.",
  actionLabel = "Retour à l'accueil",
  onAction,
  actionHref = "/",
  illustration,
  fullHeight = true,
  className,
}: NotFoundPageProps) {
  return (
    <div className={["lq-not-found-page", !fullHeight && "lq-not-found-page--contained", className].filter(Boolean).join(" ")}>
      {illustration && <div className="lq-not-found-page__illustration">{illustration}</div>}
      {/* Le titre de la page : un <h1>, pour qu'un lecteur d'écran sache d'emblée où il est tombé. */}
      <h1 className="lq-not-found-page__code">{title}</h1>
      <p className="lq-not-found-page__message">{message}</p>
      {onAction ? (
        <Button onClick={onAction}>{actionLabel}</Button>
      ) : (
        <a href={actionHref} className="lq-button">
          {actionLabel}
        </a>
      )}
    </div>
  );
}
