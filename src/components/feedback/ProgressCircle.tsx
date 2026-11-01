import type { ReactNode } from "react";
import type { SurfaceTone } from "../primitives/tone";
import "./ProgressCircle.css";

/** Les trois tailles nommées, en px : 24 dans une ligne de texte ou un bouton, 48 dans une carte, 96
 *  quand le cercle est le sujet de l'écran (et qu'il porte sa valeur au centre). */
const SIZES = { sm: 24, md: 48, lg: 96 } as const;
export type ProgressCircleSize = keyof typeof SIZES;

export interface ProgressCircleProps {
  /** 0-100. Absent : cercle indéterminé (un arc qui tourne). Hors bornes, la valeur est ramenée à
   *  0 ou 100 — dans le dessin comme dans `aria-valuenow`. */
  value?: number;
  /** `"sm"` (24 px), `"md"` (48 px, défaut) ou `"lg"` (96 px), ou un nombre de px. */
  size?: ProgressCircleSize | number;
  /** Épaisseur du trait en px. Défaut : un douzième du diamètre, au moins 2 px (4 px à 48). */
  thickness?: number;
  /** Couleur de l'arc, du même vocabulaire que les tons pleins de `Card` (voir `tone.ts`) et lue
   *  dans les mêmes variables (`--lq-tone-<ton>`). `"default"` prend la couleur de remplissage du
   *  thème, celle de `ProgressBar`. */
  tone?: SurfaceTone;
  /** Affiche la valeur au centre. Ignoré en mode indéterminé. Prévoir au moins 40 px de diamètre :
   *  en dessous, le chiffre ne tient pas dans l'anneau. */
  showValue?: boolean;
  /** Met en forme la valeur du centre (défaut : l'entier suivi de « % »). Une chaîne rendue sert
   *  aussi de `aria-valuetext`. */
  formatValue?: (value: number) => ReactNode;
  /** Nom accessible. Défaut : « Progression », ou « Chargement… » en mode indéterminé. */
  label?: string;
  className?: string;
}

/**
 * Cercle de progression : un anneau qui se remplit dans le sens des aiguilles d'une montre depuis
 * midi (`value` donné), ou un arc qui tourne quand la durée n'est pas connue (`value` absent).
 *
 * Ce n'est ni une jauge (`GaugeCard`, `LevelGauge` montrent une *mesure* sur une échelle, avec ses
 * bornes et ses seuils) ni un `Spinner` (qui ne dit que « ça travaille », sans rôle `progressbar`) :
 * c'est le pendant circulaire de `ProgressBar`, pour un avancement là où une barre n'a pas la place
 * — une vignette de fichier, une ligne de liste, le centre d'une carte.
 *
 * En palette e-ink et sous `prefers-reduced-motion`, l'indéterminé ne tourne pas : l'anneau passe en
 * pointillés, un état que l'œil ne confond pas avec une valeur (voir ProgressCircle.css).
 */
export function ProgressCircle({ value, size = "md", thickness, tone = "default", showValue = false, formatValue, label, className }: ProgressCircleProps) {
  const px = typeof size === "number" ? size : SIZES[size];
  const stroke = thickness ?? Math.max(2, Math.round(px / 12));
  const radius = Math.max(0, (px - stroke) / 2);
  const circumference = 2 * Math.PI * radius;
  const indeterminate = value === undefined || Number.isNaN(value);
  const clamped = indeterminate ? 0 : Math.min(100, Math.max(0, value));
  const formatted = indeterminate ? null : formatValue ? formatValue(clamped) : `${Math.round(clamped)} %`;
  const center = px / 2;

  return (
    <span
      className={["lq-progress-circle", `lq-progress-circle--${tone}`, indeterminate && "lq-progress-circle--indeterminate", className].filter(Boolean).join(" ")}
      style={{ width: px, height: px }}
      role="progressbar"
      aria-label={label ?? (indeterminate ? "Chargement…" : "Progression")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : clamped}
      aria-valuetext={typeof formatted === "string" ? formatted : undefined}
      aria-busy={indeterminate || undefined}
    >
      <svg className="lq-progress-circle__svg" width={px} height={px} viewBox={`0 0 ${px} ${px}`} aria-hidden="true" focusable="false">
        <circle className="lq-progress-circle__track" cx={center} cy={center} r={radius} fill="none" strokeWidth={stroke} />
        {/* Les pointillés de l'indéterminé immobile : un douzième de tour par tiret, posés une fois
            ici et montrés par la feuille de style seulement quand l'arc s'arrête. */}
        {indeterminate && (
          <circle
            className="lq-progress-circle__dashes"
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeDasharray={`${circumference / 24} ${circumference / 24}`}
          />
        )}
        <circle
          className="lq-progress-circle__arc"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={indeterminate ? `${circumference * 0.28} ${circumference}` : circumference}
          strokeDashoffset={indeterminate ? 0 : circumference * (1 - clamped / 100)}
          // Rien à dessiner à 0 : un trait de longueur nulle à bouts ronds laisserait un point à midi.
          style={!indeterminate && clamped === 0 ? { visibility: "hidden" } : undefined}
        />
      </svg>
      {showValue && !indeterminate && (
        <span className="lq-progress-circle__value" style={{ fontSize: Math.max(10, Math.round((px - 2 * stroke) * 0.28)) }} aria-hidden="true">
          {formatted}
        </span>
      )}
    </span>
  );
}
