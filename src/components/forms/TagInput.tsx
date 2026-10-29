import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Tag } from "./Tag";
import { ErrorIcon } from "../icons";
import "./field.css";
import "./TagInput.css";

/** A pickable value for `TagInput.suggestions`: `value` goes into `value[]`, `label` is what the tag and the list show. */
export interface TagInputSuggestion {
  value: string;
  label: string;
  /** Second, muted line in the suggestion list (e.g. "États-Unis · 500 sociétés"). */
  description?: string;
}

export interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  /** Ignores a new tag if it's already present (case-sensitive). Default true. */
  preventDuplicates?: boolean;
  maxTags?: number;
  className?: string;
  /** Control min-height/padding/font-size. Default "normal" (40px). */
  size?: "small" | "normal";
  /** Values to pick from: a list opens under the field while it has focus, filtered by what is typed (label or
   *  description), navigable with ↑/↓ and Enter, or by clicking. Tags show the suggestion's `label`. */
  suggestions?: TagInputSuggestion[];
  /** Only values from `suggestions` can be added (free text is ignored). Default false. */
  restrictToSuggestions?: boolean;
  /** With `suggestions` and free text allowed: label of the last list entry that adds what was typed as a new tag
   *  (Enter on it, or click). Default `(text) => \`Ajouter « ${text} »\``. */
  createLabel?: (text: string) => string;
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Tag/chip input: type and press comma or Enter to add a tag, Backspace on an empty field to drop the last one, or
 *  click a tag's × to remove it directly. With `suggestions`, a filtered list of pickable values opens under the
 *  field (multi-selection from a known list, e.g. stock indices). */
export function TagInput({
  value,
  onChange,
  label,
  placeholder,
  error,
  helperText,
  disabled,
  preventDuplicates = true,
  maxTags,
  className,
  size = "normal",
  suggestions,
  restrictToSuggestions = false,
  createLabel = (text) => `Ajouter « ${text} »`,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const atMax = maxTags !== undefined && value.length >= maxTags;
  const labelOf = (v: string) => suggestions?.find((s) => s.value === v)?.label ?? v;

  const matches = useMemo(() => {
    if (!suggestions) return [];
    const q = fold(inputValue.trim());
    return suggestions.filter((s) => !value.includes(s.value) && (!q || fold(s.label).includes(q) || fold(s.description ?? "").includes(q)));
  }, [suggestions, inputValue, value]);
  // Saisie libre permise : une dernière entrée « Ajouter « … » » quand le texte ne correspond exactement à aucune suggestion.
  const typed = inputValue.trim();
  const canCreate =
    Boolean(suggestions) && !restrictToSuggestions && typed !== "" && !(preventDuplicates && value.includes(typed)) && !suggestions?.some((s) => fold(s.label) === fold(typed) || s.value === typed);
  const count = matches.length + (canCreate ? 1 : 0);

  function add(v: string) {
    if (preventDuplicates && value.includes(v)) {
      setInputValue("");
      return;
    }
    if (maxTags !== undefined && value.length >= maxTags) return;
    onChange([...value, v]);
    setInputValue("");
    setActive(0);
  }

  function commitTag() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    // Texte saisi qui correspond exactement à une suggestion : c'est elle qu'on ajoute.
    const exact = suggestions?.find((s) => fold(s.label) === fold(trimmed) || s.value === trimmed);
    if (exact) return add(exact.value);
    if (restrictToSuggestions) {
      setInputValue("");
      return;
    }
    add(trimmed);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const listShown = open && count > 0;
    if (listShown && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setActive((i) => (e.key === "ArrowDown" ? (i + 1) % count : (i - 1 + count) % count));
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "," || e.key === "Enter") {
      e.preventDefault();
      const idx = Math.min(active, count - 1);
      if (listShown && canCreate && idx === matches.length) return add(typed);
      const pick = listShown ? matches[idx] : undefined;
      if (pick && (inputValue.trim() || e.key === "Enter")) add(pick.value);
      else commitTag();
      return;
    }
    if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  const showList = Boolean(suggestions) && open && !disabled && !atMax && count > 0;

  return (
    <div className={["lq-field", "lq-tag-input-field", className].filter(Boolean).join(" ")}>
      {label && <span className="lq-field__label">{label}</span>}
      <div
        className={[
          "lq-field__control",
          "lq-tag-input",
          size === "small" && "lq-tag-input--small",
          error && "lq-field__control--error",
          disabled && "lq-field__control--disabled",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag, i) => (
          <Tag key={`${tag}-${i}`} onRemove={disabled ? undefined : () => onChange(value.filter((_, idx) => idx !== i))}>
            {labelOf(tag)}
          </Tag>
        ))}
        <input
          ref={inputRef}
          className="lq-tag-input__field"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            setOpen(false);
            commitTag();
          }}
          placeholder={value.length === 0 ? placeholder : undefined}
          disabled={disabled || atMax}
          role={suggestions ? "combobox" : undefined}
          aria-expanded={suggestions ? showList : undefined}
          aria-controls={suggestions ? listId : undefined}
          aria-autocomplete={suggestions ? "list" : undefined}
        />
      </div>
      {showList && (
        <ul className="lq-tag-input__list" id={listId} role="listbox">
          {matches.map((s, i) => (
            <li
              key={s.value}
              role="option"
              aria-selected={i === active}
              className={["lq-tag-input__option", i === active && "is-active"].filter(Boolean).join(" ")}
              // mousedown (pas click) : le champ ne perd pas le focus avant l'ajout.
              onMouseDown={(e) => {
                e.preventDefault();
                add(s.value);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="lq-tag-input__option-label">{s.label}</span>
              {s.description && <span className="lq-tag-input__option-desc">{s.description}</span>}
            </li>
          ))}
          {canCreate && (
            <li
              role="option"
              aria-selected={active === matches.length}
              className={["lq-tag-input__option", "lq-tag-input__option--create", active === matches.length && "is-active"].filter(Boolean).join(" ")}
              onMouseDown={(e) => {
                e.preventDefault();
                add(typed);
              }}
              onMouseEnter={() => setActive(matches.length)}
            >
              <span className="lq-tag-input__option-label">{createLabel(typed)}</span>
            </li>
          )}
        </ul>
      )}
      {error ? (
        <span className="lq-field__error">
          <ErrorIcon size={14} />
          {error}
        </span>
      ) : helperText ? (
        <span className="lq-field__helper">{helperText}</span>
      ) : null}
    </div>
  );
}
