import type { ReactNode } from "react";
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
  className?: string;
}

/** Full-page login layout: a full-bleed image over 3/4 of the width, and a
 *  vertically centered credentials panel in the remaining quarter. Below the
 *  tablet breakpoint the image is dropped and the panel takes the full page. */
export function LoginPage({ imageSrc, imageAlt = "", logo, title, subtitle, children, footer, className }: LoginPageProps) {
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
          {footer && <div className="lq-login-page__footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
