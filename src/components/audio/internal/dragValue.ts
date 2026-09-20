/** Turning a pointer drag along a track into a value — the one piece the balance control and the
 *  equaliser both need, and the only reason this `internal/` folder exists.
 *
 *  Written as a plain function rather than a hook because the equaliser has one track *per band*:
 *  a hook would have to be called in a loop, which React forbids, and threading one hook's state
 *  through N tracks is more machinery than the thirty lines it would save. */

export interface DragValueOptions {
  /** The element whose box the position is measured against. */
  track: HTMLElement;
  /** `"x"` runs left to right, `"y"` runs *bottom to top* — the direction a fader actually moves,
   *  so a caller never has to remember to invert it. */
  axis: "x" | "y";
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

export function snapToStep(raw: number, min: number, max: number, step: number): number {
  if (step <= 0) return Math.min(max, Math.max(min, raw));
  const stepped = Math.round((raw - min) / step) * step + min;
  // Re-rounding kills the float dust `0.1 * 3` leaves behind, which would otherwise show up in a
  // read-out as "4.800000000000001 dB".
  const decimals = (String(step).split(".")[1] ?? "").length;
  return Math.min(max, Math.max(min, Number(stepped.toFixed(decimals))));
}

/** The value a pointer at `clientX`/`clientY` is pointing at. */
export function valueAtPointer(options: DragValueOptions, clientX: number, clientY: number): number {
  const { track, axis, min, max, step } = options;
  const rect = track.getBoundingClientRect();
  const ratio =
    axis === "x"
      ? (clientX - rect.left) / (rect.width || 1)
      : // Screen y grows downward and a fader grows upward, so the ratio is taken from the bottom.
        (rect.bottom - clientY) / (rect.height || 1);
  return snapToStep(min + Math.min(1, Math.max(0, ratio)) * (max - min), min, max, step);
}

/** Begins a drag: reports the value under the pointer straight away — so a plain click on the
 *  track jumps there rather than needing a drag to register — then follows the pointer until it is
 *  released.
 *
 *  The move/up listeners go on `window`, not on the handle, so a fast drag that outruns the
 *  cursor or leaves the element entirely keeps working; pointer capture alone does not cover a
 *  pointer that leaves the document. */
export function beginDrag(event: React.PointerEvent, options: DragValueOptions): void {
  const target = event.currentTarget as HTMLElement;
  if (target.setPointerCapture) {
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // Safari throws for a pointer id it has already released; the window listeners below are
      // what actually drive the drag, so losing capture costs nothing.
    }
  }

  options.onChange(valueAtPointer(options, event.clientX, event.clientY));

  const onMove = (moveEvent: PointerEvent) => {
    moveEvent.preventDefault();
    options.onChange(valueAtPointer(options, moveEvent.clientX, moveEvent.clientY));
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

/** Arrow/Home/End/PageUp/PageDown on a fader, as one shared rule so the balance control and every
 *  equaliser band answer the keyboard identically. Returns `null` when the key is not one of
 *  them, so the caller knows to leave the event alone. */
export function valueForKey(
  key: string,
  current: number,
  options: { min: number; max: number; step: number; home?: number }
): number | null {
  const { min, max, step, home } = options;
  const coarse = step * 10;
  switch (key) {
    case "ArrowUp":
    case "ArrowRight":
      return snapToStep(current + step, min, max, step);
    case "ArrowDown":
    case "ArrowLeft":
      return snapToStep(current - step, min, max, step);
    case "PageUp":
      return snapToStep(current + coarse, min, max, step);
    case "PageDown":
      return snapToStep(current - coarse, min, max, step);
    case "Home":
      // Home is "back to neutral" where there is a neutral — centre for a balance, 0 dB for an
      // equaliser band — and the bottom of the range otherwise.
      return home ?? min;
    case "End":
      return max;
    default:
      return null;
  }
}
