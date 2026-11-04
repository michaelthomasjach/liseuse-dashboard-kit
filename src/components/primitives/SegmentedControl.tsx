import { useRef, type KeyboardEvent } from "react";
import { rovingTarget } from "../../internal/rovingFocus";
import "./SegmentedControl.css";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
  /** Nom accessible de l'option quand le libellé visible ne suffit pas (une flèche « ↑ » → « Sens long »). */
  ariaLabel?: string;
  /** Infobulle native de l'option. */
  title?: string;
}

export interface SegmentedControlProps<T extends string> {
  label?: string;
  /** Nom accessible du groupe sans libellé visible (sinon `label` le nomme). */
  ariaLabel?: string;
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** `"inline"` (default): small uppercase label to the left, compact options — a settings switch.
   *  `"top"`: the label sits above like an `Input`'s, and the options take the input height
   *  (`--lq-control-height`, 40px by default),
   *  so a SegmentedControl lines up with `Input`/`InputDropdown` in the same filter bar. */
  labelPosition?: "inline" | "top";
}

/** Row of exclusive options, e.g. the PALETTE / SURFACE / TYPO switches in the reference design.
 *
 *  Clavier (groupe radio) : un seul arrêt de tabulation, l'option choisie ; les quatre flèches
 *  choisissent l'option voisine en bouclant, Début et Fin les extrémités. */
export function SegmentedControl<T extends string>({
  label,
  ariaLabel,
  options,
  value,
  onChange,
  className,
  labelPosition = "inline",
}: SegmentedControlProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const tabStop = options.some((o) => o.value === value) ? value : options[0]?.value;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const current = options.findIndex((o) => o.value === value);
    const target = rovingTarget(e.key, current < 0 ? 0 : current, options.length, "both");
    if (target === null) return;
    e.preventDefault();
    groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[target]?.focus();
    if (options[target].value !== value) onChange(options[target].value);
  }

  return (
    <div className={["lq-segmented", labelPosition === "top" ? "lq-segmented--top" : null, className].filter(Boolean).join(" ")}>
      {label && <span className="lq-segmented__label">{label}</span>}
      <div ref={groupRef} className="lq-segmented__options" role="radiogroup" aria-label={label ?? ariaLabel} onKeyDown={onKeyDown}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={opt.value === value}
            aria-label={opt.ariaLabel}
            title={opt.title}
            tabIndex={opt.value === tabStop ? 0 : -1}
            className={
              opt.value === value ? "lq-segmented__option lq-segmented__option--active" : "lq-segmented__option"
            }
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
