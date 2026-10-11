import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Popover } from "./Popover";
import { CheckIcon, ChevronDownIcon, CloseIcon, ErrorIcon } from "../icons";
import "./field.css";
import "./Select.css";
import "./InputDropdown.css";

export interface InputDropdownOption<T extends string = string> {
  value: T;
  label: string;
  /** Second line, smaller (a code, an exchange, a category…). Searched too. */
  description?: string;
  /** Options sharing a group are listed under its heading, in the order they appear. */
  group?: string;
  disabled?: boolean;
}

export interface InputDropdownProps<T extends string = string> {
  options: InputDropdownOption<T>[];
  value: T | null;
  onChange: (value: T, option: InputDropdownOption<T>) => void;
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
  /** How typed text filters the list. Default: case- and accent-insensitive match on the label,
   *  description and value. Pass `false` when the caller filters the options itself (results of a
   *  server search driven by `onInputChange`) — the list is then shown as given. */
  filter?: ((option: InputDropdownOption<T>, query: string) => boolean) | false;
  /** Fired on every keystroke with the typed text (e.g. to run a server search). */
  onInputChange?: (query: string) => void;
  /** Shows a "searching…" line at the top of the list. */
  loading?: boolean;
  /** Shown when nothing matches. Default "Aucun résultat". */
  emptyMessage?: string;
  /** Shows a clear button while a value is selected. */
  onClear?: () => void;
  /** Caps how many options are rendered after filtering (long lists stay fast). Default 200. */
  maxResults?: number;
  /** Leading icon inside the control (e.g. a magnifier). */
  leadingIcon?: ReactNode;
}

const fold = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const defaultFilter = <T extends string>(o: InputDropdownOption<T>, q: string): boolean => {
  const query = fold(q.trim());
  if (!query) return true;
  return [o.label, o.description ?? "", o.value].some((s) => fold(s).includes(query));
};

/** Label with the typed text highlighted (first match, accent-insensitive). */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = fold(query.trim());
  const i = q ? fold(text).indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="lq-input-dropdown__mark">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/**
 * A text input combined with a dropdown list (combobox): typing filters the options as you go,
 * arrow keys move through them, Enter picks, Escape closes and restores the current value. Built on
 * the same `Popover` and field styles as `Select`, so the two read as one family. For a server-side
 * search, pass `filter={false}`, run the query from `onInputChange` and feed the results back
 * through `options` (with `loading` while it runs).
 */
export function InputDropdown<T extends string = string>({
  options,
  value,
  onChange,
  label,
  placeholder = "Rechercher…",
  placement = "bottom",
  disabled,
  error,
  helperText,
  ariaLabel,
  className,
  size = "normal",
  filter,
  onInputChange,
  loading = false,
  emptyMessage = "Aucun résultat",
  onClear,
  maxResults = 200,
  leadingIcon,
}: InputDropdownProps<T>) {
  const id = useId();
  const listId = `${id}-list`;
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.value === value) ?? null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [typing, setTyping] = useState(false);
  const [active, setActive] = useState(0);

  const visible = useMemo(() => {
    const list = filter === false || !typing ? options : options.filter((o) => (filter ?? defaultFilter)(o, query));
    return list.slice(0, maxResults);
  }, [options, filter, typing, query, maxResults]);

  // L'option active reste sur la sélection à l'ouverture, sinon sur la première option disponible.
  useEffect(() => {
    if (!open) return;
    const sel = visible.findIndex((o) => o.value === value);
    const first = visible.findIndex((o) => !o.disabled);
    setActive(!typing && sel >= 0 ? sel : Math.max(0, first));
  }, [open, visible, value, typing]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const close = (): void => {
    setOpen(false);
    setTyping(false);
    setQuery("");
  };

  const pick = (o: InputDropdownOption<T>): void => {
    if (o.disabled) return;
    onChange(o.value, o);
    close();
  };

  const move = (dir: 1 | -1): void => {
    if (visible.length === 0) return;
    let i = active;
    for (let n = 0; n < visible.length; n++) {
      i = (i + dir + visible.length) % visible.length;
      if (!visible[i]?.disabled) break;
    }
    setActive(i);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      else move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter") {
      if (open && visible[active]) {
        e.preventDefault();
        pick(visible[active] as InputDropdownOption<T>);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        close();
      }
    } else if (e.key === "Tab") {
      close();
    }
  };

  const text = typing ? query : (selected?.label ?? "");
  let lastGroup: string | undefined;

  return (
    <div className={["lq-field", "lq-input-dropdown", className].filter(Boolean).join(" ")}>
      {label && (
        <label htmlFor={id} className="lq-field__label">
          {label}
        </label>
      )}
      <div
        ref={anchorRef}
        className={[
          "lq-field__control",
          size === "small" && "lq-field__control--small",
          error && "lq-field__control--error",
          disabled && "lq-field__control--disabled",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => {
          if (disabled) return;
          inputRef.current?.focus();
          setOpen(true);
        }}
      >
        {leadingIcon && <span className="lq-field__icon">{leadingIcon}</span>}
        <input
          ref={inputRef}
          id={id}
          className={["lq-field__input", size === "small" && "lq-field__input--small"].filter(Boolean).join(" ")}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && visible[active] ? `${id}-opt-${active}` : undefined}
          aria-label={label ? undefined : ariaLabel}
          aria-invalid={Boolean(error)}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={selected && !typing ? selected.label : placeholder}
          value={text}
          onFocus={(e) => {
            setOpen(true);
            e.currentTarget.select();
          }}
          onChange={(e) => {
            setTyping(true);
            setQuery(e.target.value);
            setOpen(true);
            onInputChange?.(e.target.value);
          }}
          onKeyDown={onKeyDown}
        />
        {onClear && selected && !disabled && (
          <button
            type="button"
            className="lq-input-dropdown__clear"
            aria-label="Effacer"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
              close();
            }}
          >
            <CloseIcon size={14} />
          </button>
        )}
        <ChevronDownIcon size={16} className={open ? "lq-select__chevron lq-select__chevron--open" : "lq-select__chevron"} />
      </div>
      {error ? (
        <span className="lq-field__error">
          <ErrorIcon size={14} />
          {error}
        </span>
      ) : helperText ? (
        <span className="lq-field__helper">{helperText}</span>
      ) : null}

      <Popover open={open} onClose={close} anchorRef={anchorRef} placement={placement} matchAnchorWidth>
        <ul ref={listRef} id={listId} className="lq-select__list lq-input-dropdown__list" role="listbox" aria-label={label ?? ariaLabel}>
          {loading && <li className="lq-input-dropdown__status">Recherche…</li>}
          {!loading && visible.length === 0 && <li className="lq-input-dropdown__status">{emptyMessage}</li>}
          {visible.map((o, i) => {
            const heading = o.group && o.group !== lastGroup ? o.group : null;
            lastGroup = o.group;
            return [
              heading ? (
                <li key={`g-${heading}`} className="lq-input-dropdown__group" role="presentation">
                  {heading}
                </li>
              ) : null,
              <li
                key={o.value}
                id={`${id}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                aria-disabled={o.disabled || undefined}
                className={["lq-select__option", "lq-input-dropdown__option", i === active && "is-active", o.disabled && "is-disabled"].filter(Boolean).join(" ")}
                // Garde le focus dans le champ : le clic choisit sans fermer le clavier.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => !o.disabled && setActive(i)}
                onClick={() => pick(o)}
              >
                <span className="lq-input-dropdown__text">
                  <span>
                    <Highlight text={o.label} query={typing ? query : ""} />
                  </span>
                  {o.description && (
                    <span className="lq-input-dropdown__desc">
                      <Highlight text={o.description} query={typing ? query : ""} />
                    </span>
                  )}
                </span>
                {o.value === value && <CheckIcon size={16} />}
              </li>,
            ];
          })}
        </ul>
      </Popover>
    </div>
  );
}
