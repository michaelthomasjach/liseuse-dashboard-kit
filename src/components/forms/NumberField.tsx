import { forwardRef } from "react";
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

/** Numeric input with optional +/- steppers and a prefix/suffix (currency, percent…). Every value
 *  this can ever actually produce — typed, pasted, or via the steppers — is rounded to 4 decimal
 *  places (see round4's own doc) before reaching `onChange`, so a caller never has to guard
 *  against float noise on its own end. */
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  { value, onChange, min, max, step = 1, prefix, suffix, leadingIcon, trailingIcon, ...rest },
  ref
) {
  const clamp = (n: number) => {
    let v = round4(n);
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  };

  return (
    <TextField
      ref={ref}
      type="number"
      inputMode="decimal"
      // round4 here too — a value can arrive already drifted (data saved before this rounding
      // existed, or set through some other path entirely) rather than only ever drifting via this
      // component's own steppers, and displaying it as-is would show that same float noise
      // regardless of how clean everything is from here on out.
      value={value === "" ? "" : round4(value)}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === "" ? "" : round4(Number(raw)));
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
