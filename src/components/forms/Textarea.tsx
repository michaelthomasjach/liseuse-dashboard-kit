import {
  forwardRef,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type TextareaHTMLAttributes,
} from "react";
import { ErrorIcon } from "../icons";
import { IconBase } from "../icons/IconBase";
import "./field.css";
import "./Textarea.css";

/** Même coche que celle d'`Input` pour l'état de succès. Locale, non exportée. */
const SuccessIcon = ({ size = 14 }: { size?: number }) => (
  <IconBase size={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.3 10.8 15 16 9.3" />
  </IconBase>
);

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  /** Pendant de `error`, comme sur `Input` : une chaîne s'affiche sous le champ, `true` ne colore que le filet. */
  success?: string | boolean;
  helperText?: string;
  containerClassName?: string;
  /** `"above"` (défaut) : libellé au-dessus. `"inside"` : dans la boîte, réduit dès que le champ a le
   *  focus ou une valeur — la même mécanique qu'`Input`. */
  labelPosition?: "above" | "inside";
  /** Hauteur de départ, en lignes. Défaut 3 (`minRows` quand `autoResize`). */
  rows?: number;
  /** Le champ grandit avec son contenu, de `minRows` à `maxRows` lignes, puis défile. */
  autoResize?: boolean;
  /** Plancher de `autoResize`, en lignes. Défaut `rows`, sinon 1. */
  minRows?: number;
  /** Plafond de `autoResize`, en lignes. Défaut 8. */
  maxRows?: number;
  /** Affiche le nombre de caractères sous le champ — « 42 / 280 » avec `maxLength`. */
  showCount?: boolean;
  /** Poignée de redimensionnement : `"vertical"` (défaut) ou `"none"`. Toujours `"none"` avec `autoResize`. */
  resize?: "none" | "vertical";
}

function lengthOf(value: TextareaHTMLAttributes<HTMLTextAreaElement>["value"]): number {
  if (value == null) return 0;
  return Array.isArray(value) ? value.join(",").length : String(value).length;
}

/**
 * Zone de texte sur plusieurs lignes, de la même famille qu'`Input` : mêmes classes `lq-field*`,
 * même libellé, même aide, mêmes états d'erreur et de succès. En plus : hauteur en lignes, croissance
 * automatique bornée, compteur de caractères.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    error,
    success,
    helperText,
    className,
    containerClassName,
    id,
    disabled,
    labelPosition = "above",
    rows,
    autoResize = false,
    minRows,
    maxRows = 8,
    showCount = false,
    resize = "vertical",
    maxLength,
    value,
    defaultValue,
    onChange,
    style,
    ...rest
  },
  ref
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const inside = labelPosition === "inside" && Boolean(label);
  const successState = !error && Boolean(success);
  const successText = !error && typeof success === "string" && success ? success : undefined;
  const floorRows = minRows ?? rows ?? (autoResize ? 1 : 3);

  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  // Le compteur suit `value` quand le champ est contrôlé, sa propre saisie sinon.
  const [ownLength, setOwnLength] = useState(() => lengthOf(defaultValue));
  const length = value !== undefined ? lengthOf(value) : ownLength;

  const fit = useCallback(() => {
    const el = innerRef.current;
    if (!el || !autoResize) return;
    const cs = getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
    const chrome = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const min = floorRows * line + chrome;
    const max = Math.max(min, maxRows * line + chrome);
    el.style.height = "auto";
    const next = Math.min(max, Math.max(min, el.scrollHeight));
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > max + 1 ? "auto" : "hidden";
  }, [autoResize, floorRows, maxRows]);

  useLayoutEffect(fit, [fit, value]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    if (value === undefined) setOwnLength(event.target.value.length);
    if (value === undefined) fit();
    onChange?.(event);
  };

  const describedBy =
    [error ? `${fieldId}-error` : successText ? `${fieldId}-success` : helperText ? `${fieldId}-helper` : undefined, showCount ? `${fieldId}-count` : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  const nearLimit = maxLength !== undefined && maxLength > 0 && length >= maxLength * 0.9;

  const textarea = (
    <textarea
      ref={setRefs}
      id={fieldId}
      className={[
        "lq-field__input",
        "lq-textarea__input",
        (autoResize || resize === "none") && "lq-textarea__input--fixed",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      rows={autoResize ? floorRows : (rows ?? 3)}
      disabled={disabled}
      maxLength={maxLength}
      value={value}
      defaultValue={defaultValue}
      onChange={handleChange}
      aria-invalid={Boolean(error)}
      aria-describedby={describedBy}
      style={style}
      {...rest}
      // Sans indication, `:placeholder-shown` ne s'applique jamais : une espace en tient lieu (voir Input).
      placeholder={inside ? (rest.placeholder ?? " ") : rest.placeholder}
    />
  );

  // role="alert", comme sur Input : l'erreur est annoncée quand elle apparaît, aria-describedby ne la
  // relit qu'au focus.
  const message = error ? (
    <span id={`${fieldId}-error`} className="lq-field__error" role="alert">
      <ErrorIcon size={14} />
      {error}
    </span>
  ) : successText ? (
    <span id={`${fieldId}-success`} className="lq-field__success">
      <SuccessIcon size={14} />
      {successText}
    </span>
  ) : helperText ? (
    <span id={`${fieldId}-helper`} className="lq-field__helper">
      {helperText}
    </span>
  ) : null;

  return (
    <div className={["lq-field", "lq-textarea", containerClassName].filter(Boolean).join(" ")}>
      {label && !inside && (
        <label htmlFor={fieldId} className="lq-field__label">
          {label}
        </label>
      )}
      <div
        className={[
          "lq-field__control",
          "lq-textarea__control",
          error && "lq-field__control--error",
          successState && "lq-field__control--success",
          disabled && "lq-field__control--disabled",
          inside && "lq-field__control--inset",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {inside ? (
          <span className="lq-field__inset">
            {textarea}
            <label htmlFor={fieldId} className="lq-field__inset-label">
              {label}
            </label>
          </span>
        ) : (
          textarea
        )}
        {inside && rest.required && (
          <span className="lq-field__required" aria-hidden="true">
            *
          </span>
        )}
      </div>
      {message || showCount ? (
        <div className="lq-textarea__foot">
          {message ?? <span />}
          {showCount ? (
            <span id={`${fieldId}-count`} className={["lq-textarea__count", nearLimit && "lq-textarea__count--limit"].filter(Boolean).join(" ")}>
              {maxLength !== undefined ? `${length} / ${maxLength}` : length}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
