import { useEffect, useRef, type ReactNode } from "react";
import "./Checkbox.css";

export interface CheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  /** Visual "some but not all" state (e.g. a parent row for a partially-selected group). Doesn't affect `checked`. */
  indeterminate?: boolean;
  disabled?: boolean;
  /** Nom accessible quand la case n'a pas de `label` visible (une case de sélection de ligne dans
   *  un tableau, par exemple) — sans lui, un lecteur d'écran n'annonce que « case à cocher ». */
  ariaLabel?: string;
  className?: string;
}

/** Checkbox with an animated checkmark draw-in. The native input stays in the DOM
 *  (visually hidden) so keyboard nav, focus rings and form semantics all work as expected. */
export function Checkbox({ checked, onChange, label, indeterminate = false, disabled, ariaLabel, className }: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label className={["lq-checkbox", disabled && "lq-checkbox--disabled", className].filter(Boolean).join(" ")}>
      <input
        ref={inputRef}
        type="checkbox"
        className="lq-checkbox__input"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className={["lq-checkbox__box", (checked || indeterminate) && "lq-checkbox__box--checked"].filter(Boolean).join(" ")}>
        <svg className="lq-checkbox__mark" viewBox="0 0 16 16" aria-hidden="true">
          {indeterminate ? <line x1="3.5" y1="8" x2="12.5" y2="8" /> : <polyline points="3.5 8.4 6.6 11.5 12.5 4.5" />}
        </svg>
      </span>
      {label && <span className="lq-checkbox__label">{label}</span>}
    </label>
  );
}
