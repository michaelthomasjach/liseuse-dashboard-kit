import type { FormEvent, ReactNode } from "react";
import "./LoginPage.css";

export interface LoginPageProps {
  imageSrc: string;
  imageAlt?: string;
  logo?: ReactNode;
  title?: string;
  subtitle?: string;
  /** The actual form — Input/InputPassword/Button etc. Left fully to the consumer. */
  children: ReactNode;
  footer?: ReactNode;
  /** Fait du bloc de formulaire un vrai `<form>` : Entrée dans un champ l'envoie, et un bouton
   *  `type="submit"` parmi les enfants le déclenche. L'envoi natif (rechargement de la page) est
   *  annulé avant l'appel. Sans `onSubmit`, le bloc reste un simple conteneur — passez alors votre
   *  propre `<form>` en enfant : il reçoit le même espacement. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  /** Vrai (défaut) : la page occupe au moins toute la hauteur de la fenêtre et bascule en
   *  disposition étroite selon la largeur de la fenêtre. Faux : elle remplit son conteneur
   *  (`min-height: 100%`, à poser dans un parent de hauteur définie) et bascule selon **sa propre**
   *  largeur — pour la montrer dans un cadre, un aperçu, une modale. */
  fullHeight?: boolean;
  className?: string;
}

/** Full-page login layout: a full-bleed image over 3/4 of the width, and a
 *  vertically centered credentials panel in the remaining quarter. Below the
 *  tablet breakpoint the image is dropped and the panel takes the full page. */
export function LoginPage({ imageSrc, imageAlt = "", logo, title, subtitle, children, footer, onSubmit, fullHeight = true, className }: LoginPageProps) {
  return (
    <div className={["lq-login-page", !fullHeight && "lq-login-page--contained", className].filter(Boolean).join(" ")}>
      <div className="lq-login-page__image">
        <img src={imageSrc} alt={imageAlt} />
      </div>
      <div className="lq-login-page__panel">
        <div className="lq-login-page__panel-inner">
          {logo && <div className="lq-login-page__logo">{logo}</div>}
          {(title || subtitle) && (
            <div className="lq-login-page__heading">
              {title && <h1>{title}</h1>}
              {subtitle && <p>{subtitle}</p>}
            </div>
          )}
          {onSubmit ? (
            <form
              className="lq-login-page__form"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit(e);
              }}
            >
              {children}
            </form>
          ) : (
            <div className="lq-login-page__form">{children}</div>
          )}
          {footer && <div className="lq-login-page__footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
