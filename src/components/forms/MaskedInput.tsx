import { useRef, type ChangeEvent } from "react";
import { Input, type InputProps } from "./Input";
import { applyMask, caretIndexForDigitCount, countSlots, digitsOnly } from "./internal/maskEngine";

export interface MaskedInputProps extends Omit<InputProps, "value" | "onChange" | "ref"> {
  /** Pattern where `#` is a digit slot, e.g. "## ## ## ## ##" or "##/##/####". */
  mask: string;
  /** Character shown for not-yet-typed slots. Default "_". */
  maskChar?: string;
  /** Raw digits only (no literals) — the value your app should actually store. */
  value: string;
  onChange: (rawDigits: string) => void;
}

/** Generic masked digit input powering PhoneInput/CreditCardInput/DateInput —
 *  use it directly for any other custom pattern (IBAN, postal code…). */
export function MaskedInput({ mask, maskChar = "_", value, onChange, ...textFieldProps }: MaskedInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const totalSlots = countSlots(mask);
  const digits = digitsOnly(value, totalSlots);
  const display = applyMask(digits, mask, maskChar);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const rawDigits = digitsOnly(e.target.value, totalSlots);
    onChange(rawDigits);
    const caret = caretIndexForDigitCount(mask, rawDigits.length);
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(caret, caret);
    });
  }

  return (
    <Input
      ref={inputRef}
      value={display}
      onChange={handleChange}
      inputMode="numeric"
      autoComplete="off"
      {...textFieldProps}
    />
  );
}
