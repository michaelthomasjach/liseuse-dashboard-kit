import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "../components/primitives/Button";
import { CheckIcon, CopyIcon, HomeIcon, RefreshIcon } from "../components/icons";
import "./ServerErrorPage.css";

export interface ServerErrorPageProps {
  /** Le code affiché en très grand. Défaut « 500 » — 502, 503, 504 conviennent aussi. */
  code?: string;
  /** Le titre de la page, un vrai `<h1>`. */
  title?: string;
  /** La phrase d'explication sous le titre. */
  message?: ReactNode;
  /** Illustration facultative au-dessus du code (n'importe quel `ReactNode`, en couleur atténuée). */
  illustration?: ReactNode;
  /** Ajoute le bouton « Réessayer ». S'il rend une promesse, le bouton reste occupé jusqu'à ce
   *  qu'elle soit tenue ou rompue. */
  onRetry?: () => void | Promise<unknown>;
  retryLabel?: string;
  /** Avec `onHome`, l'action « accueil » est un bouton qui l'appelle (votre routeur navigue) ;
   *  sans, c'est un lien vers `homeHref`. `homeHref={null}` retire l'action. */
  onHome?: () => void;
  homeHref?: string | null;
  homeLabel?: string;
  /** Identifiant d'incident à citer au support ; affiché avec un bouton pour le copier. */
  incidentId?: string;
  incidentLabel?: string;
  copyLabel?: string;
  copiedLabel?: string;
  /** Contenu libre sous les actions — un lien vers la page d'état, l'adresse du support. */
  footer?: ReactNode;
  /** Occupe au moins toute la hauteur de la fenêtre (`100dvh`) — pour une page rendue seule.
   *  Sans, la page remplit son conteneur (`min-height: 100%`) : elle tient dans un cadre. */
  fullHeight?: boolean;
  className?: string;
}

/** Page d'erreur serveur centrée — même famille que `NotFoundPage` : un grand code, un titre, une
 *  explication, de quoi réessayer ou repartir, et l'identifiant d'incident à transmettre au support. */
export function ServerErrorPage({
  code = "500",
  title = "Erreur interne du serveur",
  message = "Une erreur inattendue s'est produite de notre côté. Réessayez dans un instant ; si le problème persiste, contactez le support.",
  illustration,
  onRetry,
  retryLabel = "Réessayer",
  onHome,
  homeHref = "/",
  homeLabel = "Retour à l'accueil",
  incidentId,
  incidentLabel = "Identifiant d'incident",
  copyLabel = "Copier l'identifiant",
  copiedLabel = "Copié",
  footer,
  fullHeight = false,
  className,
}: ServerErrorPageProps) {
  const [retrying, setRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  function retry() {
    if (retrying || !onRetry) return;
    const result = onRetry();
    if (!(result instanceof Promise)) return;
    setRetrying(true);
    void result.finally(() => setRetrying(false));
  }

  function copy() {
    if (!incidentId || !navigator.clipboard) return;
    void navigator.clipboard.writeText(incidentId).then(() => {
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    });
  }

  const home =
    onHome !== undefined ? (
      <Button onClick={onHome} icon={<HomeIcon size={16} />}>
        {homeLabel}
      </Button>
    ) : homeHref !== null ? (
      <a href={homeHref} className="lq-button">
        {homeLabel}
      </a>
    ) : null;

  return (
    <div className={["lq-server-error-page", fullHeight && "lq-server-error-page--full-height", className].filter(Boolean).join(" ")}>
      <div className="lq-server-error-page__inner">
        {illustration && (
          <div className="lq-server-error-page__illustration" aria-hidden="true">
            {illustration}
          </div>
        )}
        <p className="lq-server-error-page__code">{code}</p>
        <h1 className="lq-server-error-page__title">{title}</h1>
        {message && <p className="lq-server-error-page__message">{message}</p>}

        {(onRetry || home) && (
          <div className="lq-server-error-page__actions">
            {onRetry && (
              // `aria-disabled` et non `disabled` : le bouton garde le focus pendant la nouvelle tentative.
              <Button selected onClick={retry} aria-disabled={retrying || undefined} aria-busy={retrying || undefined} icon={<RefreshIcon size={16} />}>
                {retryLabel}
              </Button>
            )}
            {home}
          </div>
        )}

        {incidentId && (
          <div className="lq-server-error-page__incident">
            <span className="lq-server-error-page__incident-label">{incidentLabel}</span>
            <code className="lq-server-error-page__incident-id">{incidentId}</code>
            <button type="button" className="lq-server-error-page__copy" onClick={copy} aria-label={copied ? copiedLabel : copyLabel} title={copied ? copiedLabel : copyLabel}>
              {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            </button>
            <span className="lq-visually-hidden" role="status">
              {copied ? copiedLabel : ""}
            </span>
          </div>
        )}

        {footer && <div className="lq-server-error-page__footer">{footer}</div>}
      </div>
    </div>
  );
}
