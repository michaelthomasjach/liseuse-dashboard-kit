import type { ReactNode } from "react";
import "./LoginPage.css";

export interface SignUpPageProps {
  imageSrc: string;
  imageAlt?: string;
  logo?: ReactNode;
  title?: string;
  subtitle?: string;
  /** The actual form — Input/InputPassword/Checkbox/Button etc. Left fully to the consumer. */
  children: ReactNode;
  /** Terms-of-service checkbox or similar, rendered between the form and the footer. */
  terms?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Full-page sign-up layout — same shell as `LoginPage` (image over 3/4 of the width, a vertically
 *  centered panel in the remaining quarter, image dropped below the tablet breakpoint), with an
 *  extra slot for a terms-of-service acknowledgement above the footer. */
export function SignUpPage({ imageSrc, imageAlt = "", logo, title, subtitle, children, terms, footer, className }: SignUpPageProps) {
  return (
    <div className={["lq-login-page", className].filter(Boolean).join(" ")}>
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
          <div className="lq-login-page__form">{children}</div>
          {terms && <div className="lq-login-page__terms">{terms}</div>}
          {footer && <div className="lq-login-page__footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
