import type { FormEvent, ReactNode } from "react";
import "./LoginPage.css";

export interface SignUpPageProps {
  imageSrc: string;
  imageAlt?: string;
  logo?: ReactNode;
  title?: string;
  subtitle?: string;
  /** The actual form — Input/InputPassword/Checkbox/Button etc. Left fully to the consumer. */
  children: ReactNode;
  /** Terms-of-service checkbox or similar, rendered between the form and the footer — inside the
   *  `<form>` when `onSubmit` is set, so a required checkbox there takes part in its validation. */
  terms?: ReactNode;
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

/** Full-page sign-up layout — same shell as `LoginPage` (image over 3/4 of the width, a vertically
 *  centered panel in the remaining quarter, image dropped below the tablet breakpoint), with an
 *  extra slot for a terms-of-service acknowledgement above the footer. */
export function SignUpPage({
  imageSrc,
  imageAlt = "",
  logo,
  title,
  subtitle,
  children,
  terms,
  footer,
  onSubmit,
  fullHeight = true,
  className,
}: SignUpPageProps) {
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
            // Un seul <form> pour les champs et les conditions : le bouton d'envoi, dans les
            // enfants, et la case des conditions, dessous, appartiennent au même formulaire.
            <form
              className="lq-login-page__form-group"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmit(e);
              }}
            >
              <div className="lq-login-page__form">{children}</div>
              {terms && <div className="lq-login-page__terms">{terms}</div>}
            </form>
          ) : (
            <>
              <div className="lq-login-page__form">{children}</div>
              {terms && <div className="lq-login-page__terms">{terms}</div>}
            </>
          )}
          {footer && <div className="lq-login-page__footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
