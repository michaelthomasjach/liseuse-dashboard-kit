import "./SegmentedControl.css";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  label?: string;
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** `"inline"` (default): small uppercase label to the left, compact options — a settings switch.
   *  `"top"`: the label sits above like an `Input`'s, and the options take the input height (40px),
   *  so a SegmentedControl lines up with `Input`/`InputDropdown` in the same filter bar. */
  labelPosition?: "inline" | "top";
}

/** Row of exclusive options, e.g. the PALETTE / SURFACE / TYPO switches in the reference design. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  labelPosition = "inline",
}: SegmentedControlProps<T>) {
  return (
    <div className={["lq-segmented", labelPosition === "top" ? "lq-segmented--top" : null, className].filter(Boolean).join(" ")}>
      {label && <span className="lq-segmented__label">{label}</span>}
      <div className="lq-segmented__options" role="radiogroup" aria-label={label}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={opt.value === value}
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
