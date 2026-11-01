import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { observeElementSize } from "../../internal/observeElementSize";
import "./LevelMeter.css";

export interface LevelMeterChannel {
  id: string;
  /** Drawn beside the meter — "L", "R", "Mono", a bus name. */
  label?: string;
  /** Current level, in whatever unit `range` is expressed in. */
  value: number;
  /** A held peak, drawn as a thin line above the bar. A meter without one is unreadable on real
   *  signal: the bar itself spends most of its time somewhere below the transient that actually
   *  mattered, and the number you need is the one that just went past. Decaying it is the
   *  caller's job — this only draws where it is told. */
  peak?: number;
}

export interface LevelMeterProps {
  channels: LevelMeterChannel[];
  /** Default "vertical", the shape a mixer strip has. */
  orientation?: "vertical" | "horizontal";
  /** [floor, ceiling] in dBFS. Default [-60, 0] — below −60 there is nothing anyone acts on, and
   *  0 is full scale by definition. Pass [0, 100] for a percentage meter and set `unit` to "". */
  range?: [number, number];
  /** Appended to the read-out. Default "dB". */
  unit?: string;
  /** Level from which the meter reads as hot. Default −6 dB. */
  warnAt?: number;
  /** Level from which it reads as clipping, and at which the clip light comes on. Default −1 dB. */
  clipAt?: number;
  /** How many blocks the bar is cut into; 0 draws it continuous. Default 24.
   *
   *  Blocks rather than a smooth gradient by default, for two reasons that happen to agree: a
   *  segmented meter is the one everybody has already learnt to read, and under the e-ink palette
   *  — where the warn and clip colours collapse into the same ink as everything else — the block
   *  count is the only thing left that says how loud it is. */
  segments?: number;
  /** Draws the dB scale alongside. Default false. */
  showScale?: boolean;
  /** Draws each channel's current figure. Default false. */
  showValue?: boolean;
  /** Bar thickness in px (width when vertical, height when horizontal). Default 10. */
  thickness?: number;
  /** Bar length in px. Default 140 vertical / 100 % of the container horizontal. */
  length?: number;
  /** Locale of the figures (read-out, scale). Default `"fr-FR"`: "−14,0", with a true minus sign. */
  locale?: string;
  /** Replaces the default formatting of the read-out and of the accessible value — one decimal in
   *  `locale`. The scale keeps whole numbers in `locale`. */
  formatValue?: (value: number) => string;
  className?: string;
}

const DEFAULT_TICKS = [0, -3, -6, -12, -18, -24, -36, -48, -60];

/** Smallest distance kept between two scale figures, in ems of the scale's own font: one line of
 *  text when stacked (vertical), a figure's width side by side (horizontal). */
const TICK_GAP_EM = { vertical: 1.25, horizontal: 3 };

/** `formatter`'s output with a true minus sign (U+2212) — `Intl` writes a hyphen in most locales. */
function withMinus(formatter: Intl.NumberFormat, value: number): string {
  return formatter.format(value).replace(/^-/, "−");
}

/** Signal level meters — one bar per channel, with held peaks, a hot zone, a clip light and an
 *  optional dB scale.
 *
 *  Deliberately a *display*: it takes the numbers it is given and draws them. Ballistics — how
 *  fast the bar falls, how long a peak is held — belong to whatever is producing the signal, and
 *  every audio host already has its own opinion about them; a meter that invented its own would
 *  disagree with the thing it is metering. */
export function LevelMeter({
  channels,
  orientation = "vertical",
  range = [-60, 0],
  unit = "dB",
  warnAt = -6,
  clipAt = -1,
  segments = 24,
  showScale = false,
  showValue = false,
  thickness,
  length,
  locale = "fr-FR",
  formatValue,
  className,
}: LevelMeterProps) {
  const formatters = useMemo(
    () => ({
      value: new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      tick: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    }),
    [locale],
  );
  const fmt = formatValue ?? ((value: number) => withMinus(formatters.value, value));

  // The scale's drawn length and font size, so figures that would overlap can be dropped — on a
  // 150 px meter 0, −3 and −6 sat within 15 px of each other and printed on top of one another.
  const scaleRef = useRef<HTMLDivElement>(null);
  const [scaleBox, setScaleBox] = useState<{ length: number; fontPx: number } | null>(null);
  useEffect(() => {
    const el = scaleRef.current;
    if (el === null) return;
    const read = () => {
      const rect = el.getBoundingClientRect();
      const next = { length: orientation === "vertical" ? rect.height : rect.width, fontPx: parseFloat(getComputedStyle(el).fontSize) || 10 };
      setScaleBox((current) => (current !== null && current.length === next.length && current.fontPx === next.fontPx ? current : next));
    };
    read();
    return observeElementSize(el, read);
  }, [orientation, showScale]);
  const [floor, ceiling] = range;
  const span = ceiling - floor || 1;
  const ratioOf = (level: number) => Math.min(1, Math.max(0, (level - floor) / span));

  const style: Record<string, string> = {};
  if (thickness !== undefined) style["--lq-meter-thickness"] = `${thickness}px`;
  if (length !== undefined) style["--lq-meter-length"] = `${length}px`;

  const inRange = DEFAULT_TICKS.filter((tick) => tick <= ceiling && tick >= floor);
  // From the top of the scale down, a figure is kept only if it clears the last one kept.
  const ticks: number[] = [];
  if (scaleBox === null || scaleBox.length <= 0) ticks.push(...inRange);
  else {
    const minGap = TICK_GAP_EM[orientation] * scaleBox.fontPx;
    let lastAt: number | null = null;
    for (const tick of inRange) {
      const at = ratioOf(tick) * scaleBox.length;
      if (lastAt !== null && Math.abs(lastAt - at) < minGap) continue;
      ticks.push(tick);
      lastAt = at;
    }
  }

  /** Which zone a point along the bar falls in. Taken on the level the block *represents*, not on
   *  the channel's current value, so the hot and clip bands sit at fixed heights on the scale the
   *  way they do on hardware — a meter whose red zone moves with the signal tells you nothing. */
  const zoneAt = (level: number) => (level >= clipAt ? "clip" : level >= warnAt ? "warn" : "ok");

  return (
    <div
      className={["lq-meter", `lq-meter--${orientation}`, className].filter(Boolean).join(" ")}
      style={style as CSSProperties}
    >
      {showScale && (
        <div ref={scaleRef} className="lq-meter__scale" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} className="lq-meter__tick" style={{ [orientation === "vertical" ? "bottom" : "left"]: `${ratioOf(tick) * 100}%` } as CSSProperties}>
              {withMinus(formatters.tick, tick)}
            </span>
          ))}
        </div>
      )}

      <div className="lq-meter__channels">
        {channels.map((channel) => {
          const filled = ratioOf(channel.value);
          const clipping = channel.value >= clipAt;
          return (
            <div key={channel.id} className="lq-meter__channel">
              <div
                className="lq-meter__bar"
                role="meter"
                aria-label={channel.label ?? channel.id}
                aria-valuemin={floor}
                aria-valuemax={ceiling}
                aria-valuenow={Math.min(ceiling, Math.max(floor, channel.value))}
                aria-valuetext={`${fmt(channel.value)} ${unit}`.trim()}
              >
                {segments > 0 ? (
                  Array.from({ length: segments }, (_, i) => {
                    // The block's own position on the scale, bottom block first.
                    const blockRatio = (i + 1) / segments;
                    const blockLevel = floor + blockRatio * span;
                    const lit = filled >= blockRatio - 1 / segments / 2;
                    return (
                      <span
                        key={i}
                        className={["lq-meter__block", `lq-meter__block--${zoneAt(blockLevel)}`, lit && "lq-meter__block--lit"]
                          .filter(Boolean)
                          .join(" ")}
                      />
                    );
                  })
                ) : (
                  <span
                    className={`lq-meter__fill lq-meter__fill--${zoneAt(channel.value)}`}
                    style={{ [orientation === "vertical" ? "height" : "width"]: `${filled * 100}%` } as CSSProperties}
                  />
                )}

                {channel.peak !== undefined && (
                  <span
                    className={`lq-meter__peak lq-meter__peak--${zoneAt(channel.peak)}`}
                    style={{ [orientation === "vertical" ? "bottom" : "left"]: `${ratioOf(channel.peak) * 100}%` } as CSSProperties}
                  />
                )}
              </div>

              {channel.label && <span className="lq-meter__channel-label">{channel.label}</span>}
              {showValue && (
                <span className={["lq-meter__channel-value", clipping && "lq-meter__channel-value--clip"].filter(Boolean).join(" ")}>
                  {channel.value <= floor ? "−∞" : fmt(channel.value)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
