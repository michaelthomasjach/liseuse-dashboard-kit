import { useId, useRef, useState, type KeyboardEvent } from "react";
import { rovingTarget } from "../../internal/rovingFocus";
import { useFieldLabelPosition, type LqFieldLabelPosition } from "../../theme/ThemeProvider";
import { Popover } from "./Popover";
import { ChevronDownIcon, CheckIcon, ErrorIcon } from "../icons";
import "./field.css";
import "./Select.css";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string = string> {
  options: SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  label?: string;
  placeholder?: string;
  placement?: "bottom" | "top";
  disabled?: boolean;
  error?: string;
  helperText?: string;
  ariaLabel?: string;
  className?: string;
  /** Control height/padding/font-size. Default "normal" (40px). */
  size?: "small" | "normal";
  /** `"above"` : libellé au-dessus du champ ; `"inside"` : dans la boîte, en petit au-dessus de la
   *  valeur. Sans valeur : celle du thème (`LqThemeProvider fieldLabelPosition`), sinon `"above"`. */
  labelPosition?: LqFieldLabelPosition;
}

/** Adapted dropdown select: opens below the trigger by default, flips above
 *  and shifts horizontally when the viewport doesn't have room (see `Popover`).
 *
 *  Clavier : ↓ / ↑ (ou Entrée, Espace) sur le déclencheur ouvrent la liste, le focus va sur
 *  l'option choisie (la première sinon). Dans la liste, ↑ ↓ circulent en sautant les options
 *  désactivées, Début / Fin vont aux extrémités, une lettre tapée saute à l'option suivante qui
 *  commence ainsi (plusieurs lettres à la suite affinent), Entrée ou Espace choisissent, Échap et
 *  Tab referment ; le focus revient au déclencheur. */
export function Select<T extends string = string>({
  options,
  value,
  onChange,
  label,
  placeholder = "Sélectionner…",
  placement = "bottom",
  disabled,
  error,
  helperText,
  ariaLabel,
  className,
  size = "normal",
  labelPosition: ownLabelPosition,
}: SelectProps<T>) {
  const inside = useFieldLabelPosition(ownLabelPosition) === "inside" && Boolean(label);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);
  const typeahead = useRef({ text: "", at: 0 });

  function optionButtons(): HTMLButtonElement[] {
    return Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onListKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    const buttons = optionButtons();
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Tab") {
      // Le panneau vit en fin de document : on rend la main au déclencheur, et Tab poursuit
      // depuis lui au lieu de partir de la fin de la page.
      anchorRef.current?.focus();
      setOpen(false);
      return;
    }
    const target = rovingTarget(e.key, current < 0 ? 0 : current, options.length, "vertical", (i) => !!options[i].disabled);
    if (target !== null) {
      e.preventDefault();
      buttons[target]?.focus();
      return;
    }
    // Saisie pour sauter : les lettres tapées à moins d'une demi-seconde d'écart s'additionnent.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== " ") {
      const now = Date.now();
      const state = typeahead.current;
      state.text = now - state.at > 500 ? e.key.toLowerCase() : state.text + e.key.toLowerCase();
      state.at = now;
      const n = options.length;
      // Une seule lettre répétée fait défiler les options qui commencent par elle.
      const from = state.text.length === 1 ? current + 1 : Math.max(current, 0);
      for (let k = 0; k < n; k++) {
        const i = (from + k) % n;
        if (!options[i].disabled && options[i].label.toLowerCase().startsWith(state.text)) {
          e.preventDefault();
          buttons[i]?.focus();
          break;
        }
      }
    }
  }

  return (
    <div className={["lq-field", "lq-select", className].filter(Boolean).join(" ")}>
      {label && !inside && <span className="lq-field__label">{label}</span>}
      <button
        ref={anchorRef}
        type="button"
        className={[
          "lq-field__control",
          "lq-select__trigger",
          size === "small" && "lq-field__control--small",
          error && "lq-field__control--error",
          disabled && "lq-field__control--disabled",
          inside && "lq-field__control--inset",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel ?? label}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        {inside ? (
          <span className="lq-field__inset lq-field__inset--fixed">
            <span className={selected ? "lq-select__value" : "lq-select__placeholder"}>
              {selected ? selected.label : placeholder}
            </span>
            <span className="lq-field__inset-label" aria-hidden="true">
              {label}
            </span>
          </span>
        ) : (
          <span className={selected ? "lq-select__value" : "lq-select__placeholder"}>
            {selected ? selected.label : placeholder}
          </span>
        )}
        <ChevronDownIcon size={16} className={open ? "lq-select__chevron lq-select__chevron--open" : "lq-select__chevron"} />
      </button>
      {error ? (
        <span className="lq-field__error">
          <ErrorIcon size={14} />
          {error}
        </span>
      ) : helperText ? (
        <span className="lq-field__helper">{helperText}</span>
      ) : null}

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        placement={placement}
        matchAnchorWidth
        initialFocus={(panel) =>
          panel.querySelector<HTMLElement>('[role="option"][aria-selected="true"]:not(:disabled)') ??
          panel.querySelector<HTMLElement>('[role="option"]:not(:disabled)')
        }
      >
        <ul ref={listRef} id={listId} className="lq-select__list" role="listbox" aria-label={ariaLabel ?? label} onKeyDown={onListKeyDown}>
          {options.map((opt) => (
            <li key={opt.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={opt.value === value}
                disabled={opt.disabled}
                tabIndex={-1}
                className="lq-select__option"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {opt.value === value && <CheckIcon size={16} />}
              </button>
            </li>
          ))}
        </ul>
      </Popover>
    </div>
  );
}
