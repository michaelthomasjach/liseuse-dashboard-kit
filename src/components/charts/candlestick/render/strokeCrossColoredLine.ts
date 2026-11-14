/** Un point d'une ligne à deux couleurs : sa position, et s'il est au-dessus (true), en dessous (false) de la ligne
 *  de référence, ou sans référence à cet endroit (null : la couleur de base). */
export interface CrossPoint {
  x: number;
  y: number;
  above: boolean | null;
}

/**
 * Trace une ligne dont la couleur change quand elle croise une autre ligne (la MACD et son signal, deux moyennes…) :
 * chaque segment prend la couleur de son point d'arrivée, et les segments consécutifs de même couleur forment un seul
 * tracé (peu d'appels au canevas même sur des milliers de bougies). Le style du trait (épaisseur, pointillés) est celui
 * déjà posé sur le contexte.
 */
export function strokeCrossColoredLine(ctx: CanvasRenderingContext2D, points: CrossPoint[], colors: { above: string; below: string; base: string }) {
  if (points.length < 2) return;
  const colorOf = (p: CrossPoint) => (p.above === null ? colors.base : p.above ? colors.above : colors.below);
  let current = colorOf(points[1]!);
  ctx.strokeStyle = current;
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let k = 1; k < points.length; k++) {
    const p = points[k]!;
    const color = colorOf(p);
    if (color !== current) {
      // Le tracé en cours s'arrête au point précédent ; le suivant repart de lui, sans trou.
      ctx.stroke();
      const prev = points[k - 1]!;
      current = color;
      ctx.strokeStyle = current;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
    }
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}
