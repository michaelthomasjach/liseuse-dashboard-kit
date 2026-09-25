import { useId, type CSSProperties, type ReactNode } from "react";
import "./AllocationSlider.css";

/**
 * Partager un temps — ou tout ce qui se compte en pour cent — entre plusieurs postes : le temps d'un
 * chariot entre déchargement, rangement et approvisionnement ; un budget entre des lignes.
 *
 * ## La lecture
 *
 *  En haut, **une barre** qui fait au plus 100 % : un segment par poste, dans sa couleur, puis ce
 *  qui reste « Libre ». En dessous, **une ligne par poste** : son nom, un curseur qu'on fait glisser,
 *  sa valeur. La barre dit l'ensemble d'un coup d'œil ; les lignes se règlent une à une.
 *
 * ## La règle
 *
 *  Monter un poste prend d'abord sur ce qui est libre. Au-delà :
 *  - `mode="cap"` (défaut) : le poste s'arrête à ce qui était libre — rien n'est pris aux autres ;
 *  - `mode="steal"` : il prend aux autres, à proportion de ce qu'ils ont.
 *
 *  Baisser un poste rend sa part à « Libre ». Les valeurs vont de `step` en `step` (5 par défaut).
 *
 * ## Au clavier et au doigt
 *
 *  Chaque curseur est un vrai curseur du navigateur : flèches (± `step`), Page haut / bas (± 10 ×
 *  `step`), Début / Fin ; il annonce sa valeur et ce qui reste. Au doigt, la zone de prise fait 44 px
 *  de haut.
 */

export interface AllocationItem {
  id: string;
  label: ReactNode;
  /** La couleur du segment. Défaut : une teinte du thème, par rang. */
  color?: string;
  icon?: ReactNode;
}

export interface AllocationSliderProps {
  items: AllocationItem[];
  /** La part de chaque poste, de 0 à `max`. */
  values: Record<string, number>;
  onChange: (values: Record<string, number>) => void;
  /** Le total à partager. Défaut : 100. */
  max?: number;
  /** Le pas, en points. Défaut : 5. */
  step?: number;
  /** Le nom de ce qui reste. Défaut : « Libre ». */
  unallocatedLabel?: ReactNode;
  /** Au-delà de ce qui est libre : s'arrêter (`cap`, défaut) ou prendre aux autres (`steal`). */
  mode?: "cap" | "steal";
  disabled?: boolean;
  /** L'unité affichée après les valeurs. Défaut : « % ». */
  unit?: string;
  className?: string;
  /** Un nom pour l'ensemble, lu par les lecteurs d'écran. */
  ariaLabel?: string;
}

const TONES = ["var(--lq-color-accent)", "var(--lq-color-green)", "var(--lq-color-amber)", "var(--lq-color-violet)", "var(--lq-color-sky)", "var(--lq-color-rose)"];

/** La nouvelle répartition quand `id` passe à `want`, selon la règle. */
export function allocate(values: Record<string, number>, ids: string[], id: string, want: number, opts: { max?: number; step?: number; mode?: "cap" | "steal" } = {}): Record<string, number> {
  const max = opts.max ?? 100;
  const step = Math.max(1, opts.step ?? 5);
  const snap = (v: number) => Math.max(0, Math.min(max, Math.round(v / step) * step));
  const next: Record<string, number> = {};
  for (const k of ids) next[k] = snap(values[k] ?? 0);
  const old = next[id] ?? 0;
  const target = snap(want);
  if (target <= old) {
    next[id] = target;
    return next;
  }
  const used = ids.reduce((s, k) => s + (k === id ? 0 : next[k]), 0);
  const free = Math.max(0, max - used - old);
  const extra = target - old;
  if (extra <= free || opts.mode !== "steal") {
    next[id] = old + Math.min(extra, free);
    return next;
  }
  // Prendre aux autres ce qui manque, à proportion de ce qu'ils ont, pas à pas.
  let need = extra - free;
  next[id] = old + free;
  const others = ids.filter((k) => k !== id);
  while (need > 0) {
    const rich = others.filter((k) => next[k] > 0).sort((a, b) => next[b] - next[a]);
    if (!rich.length) break;
    const k = rich[0];
    const take = Math.min(step, next[k], need);
    next[k] -= take;
    next[id] += take;
    need -= take;
  }
  return next;
}

export function AllocationSlider({ items, values, onChange, max = 100, step = 5, unallocatedLabel = "Libre", mode = "cap", disabled = false, unit = "%", className, ariaLabel }: AllocationSliderProps) {
  const base = useId();
  const ids = items.map((i) => i.id);
  const total = ids.reduce((s, k) => s + Math.max(0, values[k] ?? 0), 0);
  const free = Math.max(0, max - total);
  const colorOf = (i: number) => items[i].color ?? TONES[i % TONES.length];
  const pct = (v: number) => `${(Math.max(0, v) / max) * 100}%`;
  return (
    <div className={["lq-alloc", disabled && "lq-alloc--disabled", className].filter(Boolean).join(" ")} role="group" aria-label={ariaLabel}>
      <div className="lq-alloc__bar" aria-hidden="true">
        {items.map((it, i) =>
          (values[it.id] ?? 0) > 0 ? (
            <span key={it.id} className="lq-alloc__seg" style={{ width: pct(values[it.id] ?? 0), "--lq-alloc-color": colorOf(i) } as CSSProperties} title={`${values[it.id]} ${unit}`}>
              {(values[it.id] ?? 0) >= max * 0.12 && <span className="lq-alloc__seg-label">{values[it.id]}</span>}
            </span>
          ) : null
        )}
        {free > 0 && (
          <span className="lq-alloc__seg lq-alloc__seg--free" style={{ width: pct(free) }}>
            {free >= max * 0.12 && <span className="lq-alloc__seg-label">{free}</span>}
          </span>
        )}
      </div>
      <div className="lq-alloc__rows">
        {items.map((it, i) => {
          const v = values[it.id] ?? 0;
          const id = `${base}-${it.id}`;
          // Ce que ce poste peut atteindre sans prendre aux autres : ce qu'il a, et ce qui est libre.
          const reach = mode === "steal" ? max : v + free;
          return (
            <div key={it.id} className="lq-alloc__row" style={{ "--lq-alloc-color": colorOf(i), "--lq-alloc-fill": pct(v), "--lq-alloc-reach": pct(reach) } as CSSProperties}>
              <label htmlFor={id} className="lq-alloc__label">
                <span className="lq-alloc__swatch" aria-hidden="true">
                  {it.icon}
                </span>
                {it.label}
              </label>
              <input
                id={id}
                className="lq-alloc__range"
                type="range"
                min={0}
                max={max}
                step={step}
                value={v}
                disabled={disabled}
                aria-valuetext={`${v} ${unit}, ${free} ${unit} libres`}
                onChange={(e) => onChange(allocate(values, ids, it.id, Number(e.target.value), { max, step, mode }))}
              />
              <output htmlFor={id} className="lq-alloc__value">
                {v}
                <small> {unit}</small>
              </output>
            </div>
          );
        })}
        <div className="lq-alloc__row lq-alloc__row--free">
          <span className="lq-alloc__label">
            <span className="lq-alloc__swatch lq-alloc__swatch--free" aria-hidden="true" />
            {unallocatedLabel}
          </span>
          <span />
          <output className="lq-alloc__value" aria-live="polite">
            {free}
            <small> {unit}</small>
          </output>
        </div>
      </div>
    </div>
  );
}
