import type { TrendLineDrawing } from "./interfaces/TrendLineDrawing.interface";

/** Figures chartistes qui savent projeter leur objectif théorique (option « Projection de l'objectif théorique »). */
export const PATTERN_TARGET_TYPES = new Set(["headShoulders", "cupHandle", "elliottImpulse", "elliottCorrection", "doubleBottom", "tripleBottom"]);

export interface PatternTarget {
  /** Point d'où part la projection (cassure, dernier point de la figure). */
  from: { x: Date; y: number };
  /** Niveau de départ de la mesure (ligne de cou, bord de la tasse, point 4…), où commence la flèche. */
  base: number;
  /** Objectifs, du principal au secondaire. */
  levels: { price: number; label: string }[];
  /** Hauteur mesurée de la figure (valeur absolue). */
  height: number;
}

type P = { x: Date; y: number };

/** Les points d'une figure dans l'ordre du tracé (x1/y1, x2/y2 puis les points suivants). */
const pointsOf = (dr: TrendLineDrawing): P[] => [{ x: dr.x1, y: dr.y1 }, { x: dr.x2, y: dr.y2 }, ...(dr.extraPoints ?? [])];

/** Creux (rangs impairs) et sommets intermédiaires (rangs pairs, sans le départ ni la sortie) d'un double ou triple bottom. */
export function bottomPatternLevels(pts: P[], n: number): { bottom: boolean; neck: number; extreme: number } {
  const lows = pts.slice(0, n).filter((_, i) => i % 2 === 1);
  const highs = pts.slice(0, n).filter((_, i) => i % 2 === 0 && i > 0 && i < n - 1);
  const mean = (a: P[]): number => a.reduce((s, p) => s + p.y, 0) / a.length;
  // Tracée à l'envers (creux au-dessus des sommets), la figure se lit en double ou triple top.
  const bottom = mean(lows) < mean(highs);
  const neck = bottom ? Math.max(...highs.map((p) => p.y)) : Math.min(...highs.map((p) => p.y));
  const extreme = bottom ? Math.min(...lows.map((p) => p.y)) : Math.max(...lows.map((p) => p.y));
  return { bottom, neck, extreme };
}

/**
 * Objectif théorique d'une figure chartiste, d'après sa hauteur :
 * - ETE (et ETE inversé) : la hauteur tête → ligne de cou, reportée depuis la ligne de cou au point de cassure (point 7) ;
 * - tasse avec anse : la profondeur de la tasse (bord → fond), reportée au-dessus du bord ;
 * - double / triple bottom (ou top) : la hauteur creux → ligne de cou, reportée au-delà de la ligne de cou ;
 * - vague d'Elliott impulsive : vague 5 égale à la vague 1, puis 0,618 × (0 → 3), mesurées depuis le point 4 ;
 * - vague d'Elliott correctrice : C = A, puis C = 1,618 × A, mesurées depuis B.
 * `indexOf` rend la position d'une date sur l'axe (barres), pour interpoler une ligne de cou oblique.
 */
export function patternTarget(dr: TrendLineDrawing, indexOf: (d: Date) => number): PatternTarget | null {
  const pts = pointsOf(dr);
  const last = pts[pts.length - 1]!;
  switch (dr.lineType) {
    case "headShoulders": {
      if (pts.length < 7) return null;
      const [p1, , , head, p5, , p7] = pts as [P, P, P, P, P, P, P];
      const i1 = indexOf(p1.x);
      const i5 = indexOf(p5.x);
      const neckAt = (d: Date): number => (i5 === i1 ? p1.y : p1.y + (p5.y - p1.y) * ((indexOf(d) - i1) / (i5 - i1)));
      const height = head.y - neckAt(head.x);
      const base = neckAt(p7.x);
      return { from: p7, base, height: Math.abs(height), levels: [{ price: base - height, label: "Objectif théorique" }] };
    }
    case "cupHandle": {
      if (pts.length < 5) return null;
      const [a, b, c] = pts as [P, P, P];
      const rim = Math.max(a.y, c.y);
      const depth = rim - b.y;
      return { from: last, base: rim, height: Math.abs(depth), levels: [{ price: rim + depth, label: "Objectif théorique" }] };
    }
    case "doubleBottom":
    case "tripleBottom": {
      const n = dr.lineType === "doubleBottom" ? 5 : 7;
      if (pts.length < n) return null;
      const { neck, extreme } = bottomPatternLevels(pts, n);
      const height = neck - extreme;
      return { from: pts[n - 1]!, base: neck, height: Math.abs(height), levels: [{ price: neck + height, label: "Objectif théorique" }] };
    }
    case "elliottImpulse": {
      if (pts.length < 6) return null;
      const [p0, p1, , p3, p4] = pts as [P, P, P, P, P];
      const wave1 = p1.y - p0.y;
      return {
        from: p4,
        base: p4.y,
        height: Math.abs(wave1),
        levels: [
          { price: p4.y + wave1, label: "Vague 5 = vague 1" },
          { price: p4.y + 0.618 * (p3.y - p0.y), label: "Vague 5 = 0,618 × (0 → 3)" },
        ],
      };
    }
    case "elliottCorrection": {
      if (pts.length < 4) return null;
      const [p0, pa, pb] = pts as [P, P, P];
      const waveA = pa.y - p0.y;
      return {
        from: pb,
        base: pb.y,
        height: Math.abs(waveA),
        levels: [
          { price: pb.y + waveA, label: "C = A" },
          { price: pb.y + 1.618 * waveA, label: "C = 1,618 × A" },
        ],
      };
    }
    default:
      return null;
  }
}
