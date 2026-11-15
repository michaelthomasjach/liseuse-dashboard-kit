import { IconBase, type IconProps } from "./IconBase";
import { markerIconById } from "./markerIcons";

export interface MarkerIconProps extends IconProps {
  /** Identifiant d'une icône de `MARKER_ICONS`. */
  icon: string;
}

/** Une icône repère en SVG, comme les autres icônes du kit (couleur du texte ambiant, prop `size`). */
export function MarkerIcon({ icon, ...props }: MarkerIconProps) {
  const def = markerIconById(icon);
  return (
    <IconBase {...props}>
      <path d={def.d} fill={def.filled ? "currentColor" : "none"} />
    </IconBase>
  );
}
