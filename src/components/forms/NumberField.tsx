import { forwardRef, useEffect, useRef, useState } from "react";
import { TextField, type TextFieldProps } from "./TextField";
import "./NumberField.css";

export interface NumberFieldProps extends Omit<TextFieldProps, "type" | "onChange" | "value"> {
  value: number | "";
  onChange: (value: number | "") => void;
  min?: number;
  max?: number;
  step?: number;
  /** Prefix/suffix shown inline, e.g. "€" or "%". */
  prefix?: string;
  suffix?: string;
}

// Every +/-, on every NumberField anywhere in this library, adds/subtracts `step` in plain
// floating point — a handful of clicks on a step like 0.1 routinely lands on something like
// 2.5000000000000004 rather than 2.5 (a textbook IEEE754 rounding artifact, not anything specific
// to this field). Rounding to 4 decimals, the same precision this library's own drawing price
// fields already settle on (see drawingGeometry.ts's own round4), is generous enough that no
// legitimate setting anywhere in this library (a period, a %, a multiplier, a threshold…) ever
// actually needs a 5th decimal — it exists purely to absorb float noise, not to cap real
// precision. Applied at both the sole two places a numeric value can ever actually change here
// (the steppers below, and typing/pasting straight into the field) so the constraint holds
// regardless of how the value arrived, not just for one interaction style.
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Turns whatever the field displays into a value `Number()` can parse — accepting a comma as a
 *  decimal separator alongside a period, since it's the actual character a French AZERTY numpad's
 *  own decimal key types (not a locale quirk to work around, a second valid spelling to accept).
 *  Only the *first* comma/period becomes the decimal point; any further one is dropped rather than
 *  rejecting the whole string, so a stray double-tap doesn't wipe out an otherwise-valid edit. */
function normalizeDecimal(raw: string): string {
  let seenSeparator = false;
  let out = "";
  for (const ch of raw) {
    if (ch === "." || ch === ",") {
      if (seenSeparator) continue;
      seenSeparator = true;
      out += ".";
    } else {
      out += ch;
    }
  }
  return out;
}

/** Numeric input with optional +/- steppers and a prefix/suffix (currency, percent…). Every value
 *  this can ever actually produce — typed, pasted, or via the steppers — is rounded to 4 decimal
 *  places (see round4's own doc) before reaching `onChange`, so a caller never has to guard
 *  against float noise on its own end.
 *
 *  A plain text input under the hood, not `type="number"`: a native number input's own displayed
 *  text is locale-formatted by the browser itself — under French, typing "." is silently redrawn
 *  as "," (confirmed bug report), and there is no way for this component to opt out of that from
 *  the outside. Rendering as text and parsing by hand (see normalizeDecimal) sidesteps it
 *  entirely — what's typed is what's shown, "." and "," both parse, and the displayed value is
 *  never at the mercy of whatever locale the browser happens to be running under. */
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  { value, onChange, min, max, step = 1, prefix, suffix, leadingIcon, trailingIcon, onFocus, onBlur, ...rest },
  ref
) {
  const clamp = (n: number) => {
    let v = round4(n);
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  };

  const formatted = value === "" ? "" : String(round4(value));
  // The field's own text while the user is actively editing it — `null` means "not being edited
  // right now, just mirror `value`". Diverges from `formatted` mid-edit on purpose: a fully
  // controlled `value={formatted}` would collapse "3." back down to "3" (its own trailing decimal
  // point stripped) on every keystroke, the exact reason a native number input is normally used
  // for this in the first place — this recreates that same forgiving behavior by hand instead,
  // since `type="number"` itself is what introduces the locale bug above.
  const [draft, setDraft] = useState<string | null>(null);
  const focusedRef = useRef(false);

  // A `value` change that didn't come from this field's own typing (a reset button, another
  // control driving the same setting, the caller's own `value` prop changing) has to win over
  // a stale draft — but only while not focused, so it doesn't fight the user's own edit in
  // progress by re-syncing out from under them mid-keystroke.
  useEffect(() => {
    if (focusedRef.current) return;
    setDraft(null);
  }, [formatted]);

  const displayValue = draft ?? formatted;

  return (
    <TextField
      ref={ref}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onFocus={(e) => {
        focusedRef.current = true;
        onFocus?.(e);
      }}
      onBlur={(e) => {
        focusedRef.current = false;
        setDraft(null);
        onBlur?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        if (raw === "" || raw === "-") {
          onChange("");
          return;
        }
        const n = Number(normalizeDecimal(raw));
        // Genuinely unparseable input (a bare "-" partway through "-5", a stray letter) leaves
        // `onChange` uncalled — the draft set above still shows exactly what was typed, `onChange`
        // just doesn't fire again until it resolves back to a real number. A parseable-but-out-of-
        // range one (typing "5" into a max=1 field) still commits, clamped — the *reported* value
        // never exceeds min/max even mid-edit, only the draft text keeps showing what was actually
        // typed until blur resyncs it to the clamped value.
        if (Number.isFinite(n)) onChange(clamp(n));
      }}
      leadingIcon={prefix ? <span className="lq-number-field__affix">{prefix}</span> : leadingIcon}
      trailingIcon={
        suffix ? (
          <span className="lq-number-field__affix">{suffix}</span>
        ) : (
          trailingIcon ?? (
            <span className="lq-number-field__steppers">
              <button
                type="button"
                tabIndex={-1}
                className="lq-number-field__stepper"
                onClick={() => onChange(clamp((typeof value === "number" ? value : 0) + step))}
                aria-label="Augmenter"
              >
                +
              </button>
              <button
                type="button"
                tabIndex={-1}
                className="lq-number-field__stepper"
                onClick={() => onChange(clamp((typeof value === "number" ? value : 0) - step))}
                aria-label="Diminuer"
              >
                −
              </button>
            </span>
          )
        )
      }
      {...rest}
    />
  );
});
