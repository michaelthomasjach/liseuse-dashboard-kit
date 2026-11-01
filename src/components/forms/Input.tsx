import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { ErrorIcon } from "../icons";
import { IconBase } from "../icons/IconBase";
import "./field.css";

/** Pendant de `ErrorIcon` pour l'état de succès : même cercle, une coche au lieu du point
 *  d'exclamation. Local, non exporté. */
const SuccessIcon = ({ size = 14 }: { size?: number }) => (
  <IconBase size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.3 10.8 15 16 9.3" />
  </IconBase>
);

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  /**
   * État de succès, en pendant exact de `error` : filet et anneau de focus en `--lq-color-up`.
   * Une chaîne s'affiche sous le champ avec une icône (« Identifiant disponible ») ; `true` ne
   * colore que le filet, et le texte d'aide reste. `error` l'emporte si les deux sont posés.
   */
  success?: string | boolean;
  helperText?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  containerClassName?: string;
  /** Control height/padding/font-size. Default "normal" (40px). */
  size?: "small" | "normal";
  /**
   * `"above"` (défaut) : le libellé au-dessus du champ.
   *
   * `"inside"` : le libellé dans la boîte, au-dessus de la saisie. Il rétrécit quand le champ prend
   * le focus ou contient une valeur, et un champ `required` porte un astérisque dans son coin.
   * L'état « rempli » est lu en CSS (`:placeholder-shown`) : il suit aussi bien un champ contrôlé
   * que libre, sans état React.
   */
  labelPosition?: "above" | "inside";
}

/** Base text input: label, leading/trailing icon slots, and an error state that
 *  every other form control in this library (Select, MaskedInput, DatePicker) shares visually. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, success, helperText, leadingIcon, trailingIcon, className, containerClassName, id, disabled, size = "normal", labelPosition = "above", ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const inside = labelPosition === "inside" && Boolean(label);
  // L'erreur prime : un champ ne peut pas être à la fois refusé et validé.
  const successState = !error && Boolean(success);
  const successText = !error && typeof success === "string" && success ? success : undefined;

  const input = (
    <input
      ref={ref}
      id={inputId}
      className={["lq-field__input", size === "small" && "lq-field__input--small", className].filter(Boolean).join(" ")}
      disabled={disabled}
      aria-invalid={Boolean(error)}
      aria-describedby={
        error ? `${inputId}-error` : successText ? `${inputId}-success` : helperText ? `${inputId}-helper` : undefined
      }
      {...rest}
      // Sans indication, `:placeholder-shown` ne s'applique jamais et le libellé ne saurait pas
      // qu'il est vide : une espace invisible lui en tient lieu.
      placeholder={inside ? (rest.placeholder ?? " ") : rest.placeholder}
    />
  );

  return (
    <div className={["lq-field", containerClassName].filter(Boolean).join(" ")}>
      {label && !inside && (
        <label htmlFor={inputId} className="lq-field__label">
          {label}
        </label>
      )}
      <div
        className={[
          "lq-field__control",
          size === "small" && "lq-field__control--small",
          error && "lq-field__control--error",
          successState && "lq-field__control--success",
          disabled && "lq-field__control--disabled",
          inside && "lq-field__control--inset",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {leadingIcon && <span className="lq-field__icon">{leadingIcon}</span>}
        {inside ? (
          // Le libellé suit la saisie dans le DOM, et la colonne inversée le remonte : c'est ce qui
          // permet de le réduire depuis l'état du champ (`input:focus + label`) en CSS seul.
          <span className="lq-field__inset">
            {input}
            <label htmlFor={inputId} className="lq-field__inset-label">
              {label}
            </label>
          </span>
        ) : (
          input
        )}
        {trailingIcon && <span className="lq-field__icon">{trailingIcon}</span>}
        {inside && rest.required && (
          <span className="lq-field__required" aria-hidden="true">
            *
          </span>
        )}
      </div>
      {/* role="alert" : l'erreur qui apparaît (ou change) sous le champ focalisé est lue sans
          déplacer le focus. Le champ la référence aussi par aria-describedby, qui ne la relit qu'à
          la prise de focus : une annonce par événement, pas deux. Un appelant n'ajoute donc pas sa
          propre annonce de la même erreur. */}
      {error ? (
        <span id={`${inputId}-error`} className="lq-field__error" role="alert">
          <ErrorIcon size={14} />
          {error}
        </span>
      ) : successText ? (
        <span id={`${inputId}-success`} className="lq-field__success">
          <SuccessIcon size={14} />
          {successText}
        </span>
      ) : helperText ? (
        <span id={`${inputId}-helper`} className="lq-field__helper">
          {helperText}
        </span>
      ) : null}
    </div>
  );
});
