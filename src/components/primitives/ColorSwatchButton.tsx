import "./ColorSwatchButton.css";

export interface ColorSwatchButtonProps {
  label: string;
  /** Any valid CSS color; ignored visually (but not semantically) under the e-ink palette. */
  color: string;
  selected?: boolean;
  /**
   * Choix exclusif (une seule teinte parmi plusieurs) : la pastille se présente comme un bouton
   * radio (`role="radio"`) au lieu d'une case à cocher. Enveloppez alors le groupe dans un
   * conteneur `role="radiogroup"` portant un `aria-label`. Faux par défaut (choix multiple).
   */
  exclusive?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Labelled color swatch used for scene/color pickers (e.g. light color selection): a checkbox by
 * default, a radio when `exclusive`.
 */
export function ColorSwatchButton({ label, color, selected, exclusive, onClick, className }: ColorSwatchButtonProps) {
  return (
    <button
      type="button"
      role={exclusive ? "radio" : "checkbox"}
      aria-checked={!!selected}
      className={["lq-swatch", selected && "lq-swatch--selected", className].filter(Boolean).join(" ")}
      onClick={onClick}
    >
      <span className="lq-swatch__box" style={{ backgroundColor: color }} />
      <span className="lq-swatch__label">{label}</span>
    </button>
  );
}
