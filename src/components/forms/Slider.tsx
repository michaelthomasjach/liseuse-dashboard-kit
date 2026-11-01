import { useCallback, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { keyTarget, resolveMarks, hasMarkLabels as marksHaveLabels, snapToStep as snap } from "./internal/sliderMath";
import { SliderMarks } from "./internal/SliderMarks";
import "./field.css";
import "./Slider.css";

/** Une graduation : une position sur la piste, et un libellé facultatif affiché sous elle
 *  (à sa droite en vertical). Un clic sur le libellé y amène la valeur. */
export interface SliderMark {
  value: number;
  label?: ReactNode;
}

export interface SliderProps {
  /** Borne basse. Défaut 0. */
  min?: number;
  /** Borne haute. Défaut 100. */
  max?: number;
  /** Pas : toute valeur produite est un multiple de `step` compté depuis `min`. Défaut 1. */
  step?: number;
  /** Saut de PageUp / PageDown. Défaut : un dixième de l'étendue, arrondi au pas (au moins un pas). */
  pageStep?: number;
  /** Valeur contrôlée. Sans elle, le curseur garde sa valeur lui-même (voir `defaultValue`). */
  value?: number;
  /** Valeur de départ en mode libre. Défaut `min`. */
  defaultValue?: number;
  /** Appelé à chaque changement : pendant le glissé, à chaque touche. */
  onChange?: (value: number) => void;
  /** Appelé une fois le geste fini : au lâcher du glissé, après chaque touche — pour une requête. */
  onChangeEnd?: (value: number) => void;
  /** Défaut "horizontal". En vertical, le minimum est en bas. */
  orientation?: "horizontal" | "vertical";
  /** Longueur de la piste en vertical (nombre = px). Défaut 160. Ignoré en horizontal, où le
   *  curseur prend toute la largeur de son conteneur. */
  height?: number | string;
  /** Graduations : une liste de positions (avec libellé facultatif), ou `true` pour une par pas. */
  marks?: boolean | SliderMark[];
  /** La bulle de valeur au-dessus de la poignée : "auto" (au survol, au focus clavier et pendant le
   *  glissé), "always" (en permanence) ou "never". Défaut "auto". */
  showValue?: "auto" | "always" | "never";
  /** Couleur du remplissage et de la poignée. Défaut "accent". */
  tone?: "accent" | "success" | "info" | "danger" | "warning";
  disabled?: boolean;
  /** Libellé visible au-dessus du curseur, relié à la poignée par `aria-labelledby`. */
  label?: string;
  /** Nom accessible quand il n'y a pas de `label` visible. */
  "aria-label"?: string;
  /** Mise en forme de la valeur — bulle, graduations sans libellé et `aria-valuetext`. */
  formatValue?: (value: number) => string;
  /** Avec un nom, un `<input type="hidden">` porte la valeur dans un `<form>` natif. */
  name?: string;
  id?: string;
  className?: string;
}

/** Curseur à une valeur — un volume, un seuil, une luminosité. Pour un intervalle à deux poignées,
 *  voir `RangeSlider`. */
export function Slider({
  min = 0,
  max = 100,
  step = 1,
  pageStep,
  value: controlled,
  defaultValue,
  onChange,
  onChangeEnd,
  orientation = "horizontal",
  height = 160,
  marks,
  showValue = "auto",
  tone = "accent",
  disabled = false,
  label,
  "aria-label": ariaLabel,
  formatValue,
  name,
  id,
  className,
}: SliderProps) {
  const [inner, setInner] = useState(() => snap(defaultValue ?? min, min, max, step));
  const value = snap(controlled ?? inner, min, max, step);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const vertical = orientation === "vertical";
  const fmt = formatValue ?? ((v: number) => String(v));

  const commit = useCallback(
    (next: number) => {
      if (controlled === undefined) setInner(next);
      if (next !== value) onChange?.(next);
    },
    [controlled, value, onChange]
  );

  const valueFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const track = trackRef.current;
      if (!track) return value;
      const r = track.getBoundingClientRect();
      const ratio = vertical ? (r.bottom - clientY) / r.height : (clientX - r.left) / r.width;
      return snap(min + Math.min(1, Math.max(0, ratio)) * (max - min), min, max, step);
    },
    [vertical, min, max, step, value]
  );

  // Le geste se capture sur toute la zone (piste, poignée, graduations) : un clic n'importe où y
  // amène la poignée et enchaîne sur le glissé, comme un curseur natif.
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    thumbRef.current?.focus({ preventScroll: true });
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    setDragging(true);
    // Sur un libellé de graduation, on prend la valeur exacte de la graduation plutôt que celle du
    // point cliqué, que le pas aurait arrondie à côté.
    const mark = (e.target as HTMLElement).closest<HTMLElement>("[data-mark-value]");
    let last = mark ? Number(mark.dataset.markValue) : valueFromPointer(e.clientX, e.clientY);
    commit(last);
    const onMove = (ev: PointerEvent) => {
      const next = valueFromPointer(ev.clientX, ev.clientY);
      if (next === last) return;
      last = next;
      if (controlled === undefined) setInner(next);
      onChange?.(next);
    };
    const onUp = () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      setDragging(false);
      onChangeEnd?.(last);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    const next = keyTarget(e.key, value, { min, max, step, pageStep });
    if (next === null) return;
    e.preventDefault();
    commit(next);
    onChangeEnd?.(next);
  }

  const span = max - min || 1;
  const toPct = (v: number) => ((v - min) / span) * 100;
  const pct = toPct(value);

  const markList = resolveMarks(marks, min, max, step);
  const hasMarkLabels = marksHaveLabels(markList);

  const rootStyle = {
    "--lq-slider-pos": `${pct}%`,
    ...(vertical ? { "--lq-slider-length": typeof height === "number" ? `${height}px` : height } : {}),
  } as CSSProperties;

  return (
    <div
      id={id}
      className={["lq-slider", disabled && "lq-slider--disabled", className].filter(Boolean).join(" ")}
      data-orientation={orientation}
      data-tone={tone}
      data-show-value={showValue}
      data-dragging={dragging || undefined}
      data-mark-labels={hasMarkLabels || undefined}
      style={rootStyle}
    >
      {label && (
        <span id={labelId} className="lq-field__label lq-slider__label">
          {label}
        </span>
      )}
      <div className="lq-slider__control" onPointerDown={handlePointerDown}>
        <div ref={trackRef} className="lq-slider__track">
          <div className="lq-slider__fill" />
          <div
            ref={thumbRef}
            className="lq-slider__thumb"
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-valuetext={fmt(value)}
            aria-orientation={orientation}
            aria-disabled={disabled || undefined}
            aria-labelledby={label ? labelId : undefined}
            aria-label={label ? undefined : ariaLabel}
            onKeyDown={handleKeyDown}
          >
            {showValue !== "never" && (
              <span className="lq-slider__bubble" aria-hidden="true">
                {fmt(value)}
              </span>
            )}
          </div>
        </div>
        <SliderMarks marks={markList} min={min} max={max} isActive={(v) => v <= value} />
      </div>
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
