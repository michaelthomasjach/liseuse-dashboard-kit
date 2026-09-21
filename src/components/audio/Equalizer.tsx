import { useRef, type CSSProperties } from "react";
import { beginDrag, snapToStep, valueForKey } from "./internal/dragValue";
import "./Equalizer.css";

export interface EqualizerBand {
  id: string;
  /** Under the fader — "60", "1 k", "16 k". The unit belongs in `unit`, not repeated on each. */
  label: string;
  /** Gain in dB. 0 is flat. */
  gain: number;
}

export interface EqualizerProps {
  bands: EqualizerBand[];
  /** Receives the whole next array — same shape as `RangeSlider`'s own `onChange`, so wiring one
   *  to `useState` is a single line. Omit for a read-only response display. */
  onChange?: (bands: EqualizerBand[]) => void;
  /** Gain range, ± this many dB. Default 12. */
  range?: number;
  step?: number;
  /** Printed under the frequency labels once, not on every band. Default "Hz". */
  unit?: string;
  /** Height of the fader columns in px. Default 150. */
  height?: number;
  /** Joins the handles with a smooth curve — the response the settings add up to, which is the
   *  thing an equaliser is actually for and which a row of independent faders does not show.
   *  Default true. */
  showCurve?: boolean;
  /** dB gridlines behind the faders. Default true. */
  showScale?: boolean;
  /** Each band's own figure above its fader. Default false — with eight bands it is a wall of
   *  numbers, and the curve already says the shape. */
  showValues?: boolean;
  disabled?: boolean;
  className?: string;
}

/** A Catmull-Rom spline through the points, emitted as cubic Béziers.
 *
 *  Written out rather than reached for in `d3-shape`: this module has no other use for d3, and the
 *  whole of what is needed here is the one tangent rule below. Catmull-Rom rather than a monotone
 *  fit because an equaliser curve is expected to overshoot a little between a boosted band and a
 *  cut one — that bulge is what a filter actually does, and a monotone curve would flatten it into
 *  something tidier and less true. */
function splinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    // The 1/6 is the Catmull-Rom → Bézier conversion for a uniform parameterisation.
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** Graphic equaliser — one fader per frequency band, over a dB grid, with the resulting response
 *  drawn through the handles.
 *
 *  Double-click a fader (or Home) flattens that band; the "Réinitialiser" affordance is left to
 *  the caller, since "flat" is not always the preset someone wants to get back to. */
export function Equalizer({
  bands,
  onChange,
  range = 12,
  step = 0.5,
  unit = "Hz",
  height = 150,
  showCurve = true,
  showScale = true,
  showValues = false,
  disabled = false,
  className,
}: EqualizerProps) {
  const trackRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const readOnly = disabled || onChange === undefined;

  const min = -range;
  const max = range;
  const ratioOf = (gain: number) => (Math.min(max, Math.max(min, gain)) - min) / (max - min);

  const setGain = (id: string, gain: number) => {
    onChange?.(bands.map((band) => (band.id === id ? { ...band, gain: snapToStep(gain, min, max, step) } : band)));
  };

  // Gridlines at 0 and at each half of the range — enough to read "about +6" off the curve without
  // turning the background into graph paper.
  const gridlines = [max, max / 2, 0, min / 2, min];

  const curvePoints = bands.map((band, i) => ({
    // Percentages, so the curve follows the columns when the container resizes without this
    // component having to measure anything — and the *centre* of each column, not its edge. The
    // faders share the width equally and each sits in the middle of its share, so band i is at
    // (i + ½)/n. Spacing the points i/(n−1) instead put the first one on the left edge and the
    // last on the right: measured, the curve's ends missed their handles by half a column, 26 px
    // on a ten-band equaliser, and leaned across every one in between.
    x: ((i + 0.5) / bands.length) * 100,
    y: (1 - ratioOf(band.gain)) * 100,
  }));

  return (
    <div
      className={["lq-eq", readOnly && "lq-eq--readonly", disabled && "lq-eq--disabled", className].filter(Boolean).join(" ")}
      style={
        {
          "--lq-eq-height": `${height}px`,
          // The gutter only exists when there is a scale to put in it, so a bare equaliser keeps
          // the whole width for its faders.
          "--lq-eq-scale": showScale ? "30px" : "0px",
        } as CSSProperties
      }
    >
      {showValues && (
        <div className="lq-eq__row lq-eq__values" aria-hidden="true">
          {bands.map((band) => (
            <span key={band.id} className="lq-eq__band-value">
              {band.gain > 0 ? `+${band.gain}` : band.gain}
            </span>
          ))}
        </div>
      )}

      <div className="lq-eq__plot">
        {showScale && (
          <div className="lq-eq__grid" aria-hidden="true">
            {gridlines.map((gain) => (
              <span
                key={gain}
                className={["lq-eq__gridline", gain === 0 && "lq-eq__gridline--zero"].filter(Boolean).join(" ")}
                style={{ bottom: `${ratioOf(gain) * 100}%` }}
              >
                <span className="lq-eq__gridlabel">{gain > 0 ? `+${gain}` : gain}</span>
              </span>
            ))}
          </div>
        )}

        {showCurve && bands.length > 1 && (
          // `preserveAspectRatio="none"` so the 0-100 viewBox stretches to whatever the plot is;
          // the curve is defined in percentages and has no aspect ratio of its own to protect.
          <svg className="lq-eq__curve" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d={splinePath(curvePoints)} vectorEffect="non-scaling-stroke" />
          </svg>
        )}

        <div className="lq-eq__row lq-eq__bands">
          {bands.map((band) => {
            const ratio = ratioOf(band.gain);
            return (
              <div key={band.id} className="lq-eq__band">
                <div
                  ref={(el) => {
                    if (el) trackRefs.current.set(band.id, el);
                    else trackRefs.current.delete(band.id);
                  }}
                  className="lq-eq__track"
                  onPointerDown={(event) => {
                    const track = trackRefs.current.get(band.id);
                    if (readOnly || !track) return;
                    beginDrag(event, { track, axis: "y", min, max, step, onChange: (gain) => setGain(band.id, gain) });
                  }}
                  onDoubleClick={() => {
                    if (!readOnly) setGain(band.id, 0);
                  }}
                >
                  <span className="lq-eq__track-line" />
                  {/* From the 0 dB line outward, not from the bottom: a band at −6 and a band at
                      +6 are equal and opposite, and a bar growing from the floor would draw them
                      as "a quarter full" and "three quarters full". */}
                  <span
                    className={["lq-eq__fill", band.gain < 0 && "lq-eq__fill--cut"].filter(Boolean).join(" ")}
                    style={{
                      bottom: `${Math.min(ratioOf(0), ratio) * 100}%`,
                      height: `${Math.abs(ratio - ratioOf(0)) * 100}%`,
                    }}
                  />
                  <span
                    className="lq-eq__handle"
                    style={{ bottom: `${ratio * 100}%` }}
                    role="slider"
                    tabIndex={readOnly ? -1 : 0}
                    aria-label={`${band.label} ${unit}`.trim()}
                    aria-valuemin={min}
                    aria-valuemax={max}
                    aria-valuenow={band.gain}
                    aria-valuetext={`${band.gain > 0 ? "+" : ""}${band.gain} dB`}
                    aria-disabled={readOnly || undefined}
                    onKeyDown={(event) => {
                      if (readOnly) return;
                      const next = valueForKey(event.key, band.gain, { min, max, step, home: 0 });
                      if (next === null) return;
                      event.preventDefault();
                      setGain(band.id, next);
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="lq-eq__row lq-eq__labels">
        {bands.map((band) => (
          <span key={band.id} className="lq-eq__band-label">
            {band.label}
          </span>
        ))}
      </div>

      {unit && <div className="lq-eq__unit">{unit}</div>}
    </div>
  );
}
