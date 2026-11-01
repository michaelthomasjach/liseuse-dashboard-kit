import { useId, useState, type ReactNode } from "react";
import { ErrorIcon } from "../icons";
import "./field.css";
import "./RadioGroup.css";

export interface RadioProps {
  /** La valeur que porte ce bouton ; renvoyée par `onChange` quand on le choisit. */
  value: string;
  /** Contrôlé : coché ou non. Sans lui (ni `defaultChecked`), le bouton est libre. */
  checked?: boolean;
  defaultChecked?: boolean;
  /** Appelé avec `value` quand ce bouton devient le choisi (clic, Espace, flèches). */
  onChange?: (value: string) => void;
  /** Le nom partagé par les boutons d'un même groupe : c'est lui qui rend le choix exclusif et
   *  donne la navigation aux flèches. `RadioGroup` le pose tout seul. */
  name?: string;
  label?: ReactNode;
  /** Une ligne d'explication sous le libellé, plus petite et atténuée. */
  description?: ReactNode;
  disabled?: boolean;
  required?: boolean;
  /** Teinte le cercle d'un bouton non choisi en `--lq-color-danger` (groupe en erreur). */
  invalid?: boolean;
  id?: string;
  className?: string;
}

/** Un bouton radio. Comme `Checkbox`, l'`<input type="radio">` natif reste dans le document,
 *  visuellement masqué : Tab, Espace, les flèches entre boutons d'un même `name`, l'anneau de focus
 *  et la sémantique de formulaire viennent du navigateur. Le cercle dessiné n'en est que le reflet. */
export function Radio({
  value,
  checked,
  defaultChecked,
  onChange,
  name,
  label,
  description,
  disabled,
  required,
  invalid,
  id,
  className,
}: RadioProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const descriptionId = description ? `${inputId}-description` : undefined;

  return (
    <label
      htmlFor={inputId}
      className={["lq-radio", disabled && "lq-radio--disabled", invalid && "lq-radio--invalid", className].filter(Boolean).join(" ")}
    >
      <input
        id={inputId}
        type="radio"
        className="lq-radio__input"
        name={name}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        required={required}
        aria-describedby={descriptionId}
        onChange={(e) => {
          if (e.target.checked) onChange?.(value);
        }}
      />
      <span className="lq-radio__circle" aria-hidden="true" />
      {(label || description) && (
        <span className="lq-radio__text">
          {label && <span className="lq-radio__label">{label}</span>}
          {description && (
            <span id={descriptionId} className="lq-radio__description">
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  );
}

export interface RadioOption<V extends string = string> {
  value: V;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps<V extends string = string> {
  options: RadioOption<V>[];
  /** Contrôlé : la valeur choisie, `null` pour aucune. Sans elle, le groupe tient son propre état. */
  value?: V | null;
  /** Libre : la valeur choisie au départ. */
  defaultValue?: V;
  onChange?: (value: V) => void;
  /** Le libellé du groupe, rendu en `<legend>`. */
  label?: ReactNode;
  helperText?: ReactNode;
  /** Message d'erreur sous le groupe ; teinte aussi les cercles non choisis. */
  error?: string;
  /** `"vertical"` (défaut) empile les options — le cas des libellés longs ; `"horizontal"` les
   *  aligne et passe à la ligne quand la place manque. */
  orientation?: "vertical" | "horizontal";
  /** Le `name` partagé par les boutons. Par défaut un identifiant unique. */
  name?: string;
  /** Désactive tout le groupe (chaque option peut aussi l'être seule). */
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
}

/** Un choix exclusif parmi quelques options, chacune avec un libellé souvent long et une
 *  description facultative. Rendu en `<fieldset role="radiogroup">` + `<legend>` : le libellé du
 *  groupe est annoncé avant chaque option, et l'erreur ou l'aide y sont reliées par
 *  `aria-describedby`. La navigation aux flèches est celle, native, des radios d'un même `name`. */
export function RadioGroup<V extends string = string>({
  options,
  value,
  defaultValue,
  onChange,
  label,
  helperText,
  error,
  orientation = "vertical",
  name,
  disabled,
  required,
  id,
  className,
}: RadioGroupProps<V>) {
  const autoId = useId();
  const groupId = id ?? autoId;
  const groupName = name ?? groupId;
  const [internal, setInternal] = useState<V | null>(defaultValue ?? null);
  const controlled = value !== undefined;
  const selected = controlled ? value : internal;

  const messageId = error ? `${groupId}-error` : helperText ? `${groupId}-helper` : undefined;

  return (
    <fieldset
      id={groupId}
      role="radiogroup"
      className={["lq-field", "lq-radio-group", error && "lq-radio-group--error", className].filter(Boolean).join(" ")}
      disabled={disabled}
      aria-describedby={messageId}
      aria-invalid={error ? true : undefined}
      aria-required={required || undefined}
    >
      {label && <legend className="lq-field__label lq-radio-group__legend">{label}</legend>}
      <div className={`lq-radio-group__options lq-radio-group__options--${orientation}`}>
        {options.map((option) => (
          <Radio
            key={option.value}
            id={`${groupId}-${option.value}`}
            name={groupName}
            value={option.value}
            label={option.label}
            description={option.description}
            disabled={disabled || option.disabled}
            required={required}
            invalid={Boolean(error)}
            checked={selected === option.value}
            onChange={() => {
              if (!controlled) setInternal(option.value);
              onChange?.(option.value);
            }}
          />
        ))}
      </div>
      {error ? (
        <span id={messageId} className="lq-field__error">
          <ErrorIcon size={14} />
          {error}
        </span>
      ) : helperText ? (
        <span id={messageId} className="lq-field__helper">
          {helperText}
        </span>
      ) : null}
    </fieldset>
  );
}
