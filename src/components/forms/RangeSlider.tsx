import { useCallback, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { cleanFloat, hasMarkLabels, keyTarget, resolveMarks, snapToStep } from "./internal/sliderMath";
import { SliderMarks } from "./internal/SliderMarks";
import "./field.css";
import "./Slider.css";
import "./RangeSlider.css";

export interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  /** Saut de PageUp / PageDown. Défaut : un dixième de l'étendue, arrondi au pas (au moins un pas). */
  pageStep?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  /** Appelé une fois le geste fini : au lâcher du glissé, après chaque touche — pour une requête. */
  onChangeEnd?: (value: [number, number]) => void;
  /** Mise en forme des valeurs — rangée du haut, bulles et `aria-valuetext`. */
  formatValue?: (value: number) => string;
  disabled?: boolean;
  label?: string;
  /** Marks 0 on the track and colors the fill negative/positive on either side of it —
   *  for a "min/max is negative left, positive right" filter. Requires `min < 0 < max`. */
  centerZero?: boolean;
  /** Défaut "horizontal". En vertical, le minimum est en bas. */
  orientation?: "horizontal" | "vertical";
  /** Longueur de la piste en vertical (nombre = px). Défaut 160. Ignoré en horizontal. */
  height?: number | string;
  /** Graduations : une liste de positions (avec libellé facultatif), ou `true` pour une par pas. */
  marks?: boolean | { value: number; label?: ReactNode }[];
  /** Bulles de valeur sur les poignées : "never" (défaut — la rangée du haut porte déjà les deux
   *  valeurs), "auto" (au survol, au focus clavier, pendant le glissé) ou "always" (la rangée du
   *  haut disparaît alors, les bulles la remplacent). */
  showValue?: "auto" | "always" | "never";
  /** Couleur de la bande et des poignées. Défaut "accent". Sans effet sur la bande de `centerZero`,
   *  qui garde ses couleurs baisse / hausse. */
  tone?: "accent" | "success" | "info" | "danger" | "warning";
  className?: string;
}

type Which = "lo" | "hi";

/** Dual-handle range picker — e.g. a price/date range filter. Drag either handle to resize
 *  the range, drag the filled segment between them to shift the whole range at once, or click the
 *  track to bring the nearest handle there (and keep dragging). */
export function RangeSlider({
  min,
  max,
  step = 1,
  pageStep,
  value,
  onChange,
  onChangeEnd,
  formatValue,
  disabled,
  label,
  centerZero = false,
  orientation = "horizontal",
  height = 160,
  marks,
  showValue = "never",
  tone = "accent",
  className,
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const loRef = useRef<HTMLDivElement>(null);
  const hiRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const vertical = orientation === "vertical";
  const [lo, hi] = value;
  const fmt = formatValue ?? ((v: number) => String(v));

  /** La valeur sous le pointeur, non arrondie — le glissé de la bande compte ses pas lui-même. */
  const rawFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const track = trackRef.current;
      if (!track) return min;
      const r = track.getBoundingClientRect();
      const ratio = vertical ? (r.bottom - clientY) / r.height : (clientX - r.left) / r.width;
      return min + Math.min(1, Math.max(0, ratio)) * (max - min);
    },
    [vertical, min, max]
  );

  function place(which: Which, v: number, cur: [number, number]): [number, number] {
    return which === "lo" ? [Math.min(v, cur[1]), cur[1]] : [cur[0], Math.max(v, cur[0])];
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    setDragging(true);
    const target = e.target as HTMLElement;
    let cur: [number, number] = [lo, hi];
    const emit = (next: [number, number]) => {
      if (next[0] === cur[0] && next[1] === cur[1]) return;
      cur = next;
      onChange(next);
    };

    let onMove: (ev: PointerEvent) => void;
    if (target.closest(".lq-range-slider__fill-hit")) {
      // La bande entière : on compte des pas depuis le point de prise, largeur conservée.
      const startValue = rawFromPointer(e.clientX, e.clientY);
      const [startLo, startHi] = cur;
      const span = startHi - startLo;
      onMove = (ev) => {
        const delta = Math.round((rawFromPointer(ev.clientX, ev.clientY) - startValue) / step) * step;
        const newLo = Math.min(max - span, Math.max(min, startLo + delta));
        emit([cleanFloat(newLo, step, min), cleanFloat(newLo + span, step, min)]);
      };
    } else {
      const thumb = target.closest<HTMLElement>("[data-thumb]");
      const mark = target.closest<HTMLElement>("[data-mark-value]");
      let which: Which | null;
      if (thumb) {
        // Deux poignées superposées : c'est le premier mouvement qui dira laquelle on tire.
        which = cur[0] === cur[1] ? null : (thumb.dataset.thumb as Which);
      } else {
        const v = mark ? Number(mark.dataset.markValue) : snapToStep(rawFromPointer(e.clientX, e.clientY), min, max, step);
        const dLo = Math.abs(v - cur[0]);
        const dHi = Math.abs(v - cur[1]);
        which = dLo < dHi ? "lo" : dHi < dLo ? "hi" : v <= cur[0] ? "lo" : "hi";
        emit(place(which, v, cur));
      }
      (which === "hi" ? hiRef : loRef).current?.focus({ preventScroll: true });
      onMove = (ev) => {
        const v = snapToStep(rawFromPointer(ev.clientX, ev.clientY), min, max, step);
        if (which === null) {
          if (v === cur[0]) return;
          which = v < cur[0] ? "lo" : "hi";
          (which === "hi" ? hiRef : loRef).current?.focus({ preventScroll: true });
        }
        emit(place(which, v, cur));
      };
    }

    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      setDragging(false);
      onChangeEnd?.(cur);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }

  function handleKey(which: Which) {
    return (e: React.KeyboardEvent) => {
      if (disabled) return;
      const next =
        which === "lo"
          ? keyTarget(e.key, lo, { min, max, step, pageStep, low: min, high: hi })
          : keyTarget(e.key, hi, { min, max, step, pageStep, low: lo, high: max });
      if (next === null) return;
      e.preventDefault();
      const pair: [number, number] = which === "lo" ? [next, hi] : [lo, next];
      if (pair[0] !== lo || pair[1] !== hi) onChange(pair);
      onChangeEnd?.(pair);
    };
  }

  const span = max - min || 1;
  const toPct = (v: number) => ((v - min) / span) * 100;
  const loPct = toPct(lo);
  const hiPct = toPct(hi);
  const zeroPct = toPct(0);
  const showZeroTick = centerZero && min < 0 && max > 0;
  const segment = (from: number, to: number) => ({ "--lq-slider-start": `${from}%`, "--lq-slider-pos": `${to}%` }) as CSSProperties;

  const markList = resolveMarks(marks, min, max, step);

  const thumb = (which: Which) => {
    const v = which === "lo" ? lo : hi;
    return (
      <div
        ref={which === "lo" ? loRef : hiRef}
        data-thumb={which}
        className="lq-slider__thumb lq-range-slider__thumb"
        style={{ "--lq-slider-pos": `${toPct(v)}%` } as CSSProperties}
        onKeyDown={handleKey(which)}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-valuemin={which === "lo" ? min : lo}
        aria-valuemax={which === "lo" ? hi : max}
        aria-valuenow={v}
        aria-valuetext={fmt(v)}
        aria-orientation={orientation}
        aria-disabled={disabled || undefined}
        aria-label={
          which === "lo" ? (label ? `${label} — minimum` : "Valeur minimum") : label ? `${label} — maximum` : "Valeur maximum"
        }
      >
        {showValue !== "never" && (
          <span className="lq-slider__bubble" aria-hidden="true">
            {fmt(v)}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      className={["lq-slider", "lq-range-slider", disabled && "lq-slider--disabled lq-range-slider--disabled", className]
        .filter(Boolean)
        .join(" ")}
      data-orientation={orientation}
      data-tone={tone}
      data-show-value={showValue}
      data-dragging={dragging || undefined}
      data-mark-labels={hasMarkLabels(markList) || undefined}
      style={vertical ? ({ "--lq-slider-length": typeof height === "number" ? `${height}px` : height } as CSSProperties) : undefined}
    >
      {label && (
        <span className="lq-field__label">
          {label}
        </span>
      )}
      {showValue !== "always" && (
        <div className="lq-range-slider__values">
          <span>{fmt(lo)}</span>
          <span className="lq-range-slider__values-sep" aria-hidden="true">
            –
          </span>
          <span>{fmt(hi)}</span>
        </div>
      )}
      <div className="lq-slider__control" onPointerDown={handlePointerDown}>
        <div ref={trackRef} className="lq-slider__track">
          {showZeroTick ? (
            <>
              {lo < 0 && <div className="lq-slider__fill lq-range-slider__fill--down" style={segment(loPct, Math.min(hiPct, zeroPct))} />}
              {hi > 0 && <div className="lq-slider__fill lq-range-slider__fill--up" style={segment(Math.max(loPct, zeroPct), hiPct)} />}
              <div className="lq-range-slider__zero-tick" style={{ "--lq-slider-pos": `${zeroPct}%` } as CSSProperties} />
            </>
          ) : (
            <>
              <div className="lq-slider__fill" style={segment(loPct, hiPct)} />
              <div className="lq-range-slider__fill-hit" style={segment(loPct, hiPct)} />
            </>
          )}
          {thumb("lo")}
          {thumb("hi")}
        </div>
        <SliderMarks marks={markList} min={min} max={max} isActive={(v) => v >= lo && v <= hi} />
      </div>
    </div>
  );
}
