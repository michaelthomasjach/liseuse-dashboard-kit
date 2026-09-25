import type { ButtonHTMLAttributes, KeyboardEvent, ReactNode } from "react";
import "./Chip.css";

/**
 * Des **puces de filtre** : de petites pastilles arrondies qu'on allume et qu'on éteint — une
 * catégorie, un statut, une période.
 *
 * `Tag` est une étiquette qu'on retire, `CheckboxButton` une case à cocher qui a l'air d'un bouton,
 * `SegmentedControl` un choix exclusif en rangée soudée. Une puce, elle, est légère : on en aligne une
 * dizaine au-dessus d'une liste sans qu'elles pèsent plus que la liste. Allumée, elle prend l'accent.
 *
 * Chaque puce est un vrai bouton (`aria-pressed`) : Tab y mène, Espace et Entrée la basculent. Dans un
 * `ChipGroup`, les flèches passent de l'une à l'autre.
 */
export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  children: ReactNode;
  /** Allumée. */
  selected?: boolean;
  /** Un compte, en petit, après le libellé. */
  count?: ReactNode;
  icon?: ReactNode;
}

export function Chip({ children, selected = false, count, icon, className, type = "button", ...rest }: ChipProps) {
  return (
    <button type={type} aria-pressed={selected} className={["lq-chip", selected && "lq-chip--on", className].filter(Boolean).join(" ")} {...rest}>
      {icon && <span className="lq-chip__icon">{icon}</span>}
      <span className="lq-chip__label">{children}</span>
      {count !== undefined && count !== null && <span className="lq-chip__count">{count}</span>}
    </button>
  );
}

export interface ChipGroupOption<T extends string = string> {
  value: T;
  label: ReactNode;
  count?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

interface ChipGroupBase<T extends string> {
  options: ChipGroupOption<T>[];
  /** Le nom du groupe, pour les lecteurs d'écran. */
  label?: string;
  /**
   * Une puce de tête qui remet tout à zéro — « Tout » — allumée quand rien ne l'est. Son libellé ;
   * absent, pas de puce de tête.
   */
  allLabel?: ReactNode;
  className?: string;
}

export interface ChipGroupSingleProps<T extends string> extends ChipGroupBase<T> {
  multiple?: false;
  /** La puce allumée, ou `null`. Cliquer la puce allumée l'éteint. */
  value: T | null;
  onChange: (value: T | null) => void;
}

export interface ChipGroupMultipleProps<T extends string> extends ChipGroupBase<T> {
  multiple: true;
  value: T[];
  onChange: (value: T[]) => void;
}

export type ChipGroupProps<T extends string = string> = ChipGroupSingleProps<T> | ChipGroupMultipleProps<T>;

/** Une rangée de puces : une seule allumée à la fois (défaut), ou plusieurs (`multiple`). */
export function ChipGroup<T extends string = string>(props: ChipGroupProps<T>) {
  const { options, label, allLabel, className } = props;
  const isOn = (v: T) => (props.multiple ? props.value.includes(v) : props.value === v);
  const none = props.multiple ? props.value.length === 0 : props.value === null;
  const toggle = (v: T) => {
    if (props.multiple) props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    else props.onChange(props.value === v ? null : v);
  };
  const clear = () => {
    if (props.multiple) props.onChange([]);
    else props.onChange(null);
  };
  // Les flèches passent d'une puce à la voisine, Début et Fin aux bouts.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const chips = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button.lq-chip:not(:disabled)"));
    const i = chips.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    let j = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % chips.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + chips.length) % chips.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = chips.length - 1;
    else return;
    e.preventDefault();
    chips[j].focus();
  };
  return (
    <div className={["lq-chip-group", className].filter(Boolean).join(" ")} role="group" aria-label={label} onKeyDown={onKeyDown}>
      {allLabel !== undefined && (
        <Chip selected={none} onClick={clear}>
          {allLabel}
        </Chip>
      )}
      {options.map((o) => (
        <Chip key={o.value} selected={isOn(o.value)} count={o.count} icon={o.icon} disabled={o.disabled} onClick={() => toggle(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}
