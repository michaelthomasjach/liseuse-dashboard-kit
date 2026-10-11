import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { ErrorIcon } from "../icons";
import "./field.css";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  helperText?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  containerClassName?: string;
  /** Control height/padding/font-size. Default "normal" (40px). */
  size?: "small" | "normal";
}

/** Base text input: label, leading/trailing icon slots, and an error state that
 *  every other form control in this library (Select, MaskedInput, DatePicker) shares visually. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helperText, leadingIcon, trailingIcon, className, containerClassName, id, disabled, size = "normal", ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className={["lq-field", containerClassName].filter(Boolean).join(" ")}>
      {label && (
        <label htmlFor={inputId} className="lq-field__label">
          {label}
        </label>
      )}
      <div
        className={[
          "lq-field__control",
          size === "small" && "lq-field__control--small",
          error && "lq-field__control--error",
          disabled && "lq-field__control--disabled",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {leadingIcon && <span className="lq-field__icon">{leadingIcon}</span>}
        <input
          ref={ref}
          id={inputId}
          className={["lq-field__input", size === "small" && "lq-field__input--small", className].filter(Boolean).join(" ")}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...rest}
        />
        {trailingIcon && <span className="lq-field__icon">{trailingIcon}</span>}
      </div>
      {error ? (
        <span id={`${inputId}-error`} className="lq-field__error">
          <ErrorIcon size={14} />
          {error}
        </span>
      ) : helperText ? (
        <span id={`${inputId}-helper`} className="lq-field__helper">
          {helperText}
        </span>
      ) : null}
    </div>
  );
});
