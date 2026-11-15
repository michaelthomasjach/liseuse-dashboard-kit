import { markerIconById } from "../../../icons/markerIcons";

/** Les chemins des icônes repères, construits une fois chacun : `Path2D` lit directement le `d` du catalogue. */
const PATHS = new Map<string, Path2D>();

function iconPath(id: string): { path: Path2D; filled: boolean } {
  const def = markerIconById(id);
  let path = PATHS.get(def.id);
  if (!path) {
    path = new Path2D(def.d);
    PATHS.set(def.id, path);
  }
  return { path, filled: !!def.filled };
}

/**
 * Dessine une icône repère du kit (`MARKER_ICONS`) sur le canevas, centrée en (`cx`, `cy`), de `size` pixels CSS de
 * côté — le même dessin que `MarkerIcon` en SVG. Le trait garde au moins 1,3 px pour rester lisible en petit.
 * `halo` : la couleur du fond du graphique, tracée d'abord un peu plus large, pour que l'icône se détache d'une courbe
 * ou d'une bougie qu'elle chevauche (comme le liseré de l'ancien point de croisement).
 */
export function drawMarkerIcon(ctx: CanvasRenderingContext2D, id: string, cx: number, cy: number, size: number, color: string, halo?: string): void {
  const { path, filled } = iconPath(id);
  const s = size / 24;
  if (!(s > 0) || !Number.isFinite(cx) || !Number.isFinite(cy)) return;
  const lineWidth = Math.max(1.9, 1.3 / s);
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(s, s);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([]);
  if (halo) {
    ctx.strokeStyle = halo;
    ctx.lineWidth = lineWidth + 3 / s;
    ctx.stroke(path);
    if (filled) {
      ctx.fillStyle = halo;
      ctx.fill(path);
    }
  }
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill(path);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke(path);
  ctx.restore();
}

/** Écart en pixels entre une icône posée « au-dessus » / « en dessous » et le point (ou la bougie) qu'elle marque. */
export const MARKER_ICON_GAP = 4;

/** Le centre vertical d'une icône posée par rapport à un point : au-dessus de `yTop`, en dessous de `yBottom`, ou
 *  centrée sur `yTop` (« on »). Pour une bougie, `yTop` est son plus haut et `yBottom` son plus bas ; pour une courbe,
 *  les deux valent le point. */
export function markerIconCenterY(position: "above" | "below" | "on", yTop: number, yBottom: number, size: number): number {
  if (position === "on") return yTop;
  return position === "above" ? yTop - MARKER_ICON_GAP - size / 2 : yBottom + MARKER_ICON_GAP + size / 2;
}
