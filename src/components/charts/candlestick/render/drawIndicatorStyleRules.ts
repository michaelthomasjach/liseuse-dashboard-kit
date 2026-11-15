import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import type { IndicatorStyleRule, StyleRuleOperand } from "../interfaces/IndicatorStyleRule.interface";
import { defaultRuleOpacity, renderedStyleRules, isCrossCondition, isRangeCondition, seriesFieldValue } from "../styleRules";

/** Un indicateur du panneau et ses points visibles. */
export interface StyleRuleMember {
  indicator: Indicator;
  points: { i: number; value: IndicatorValue }[];
}

/** Ce qu'il faut savoir d'un panneau pour y peindre des règles, dans son repère déjà translaté et découpé. */
export interface StyleRulePane {
  /** Les indicateurs du panneau (ceux qui portent des règles et ceux qu'elles citent). */
  members: StyleRuleMember[];
  /** Abscisse du bord gauche de la bougie `i` (le centre est en `i + 0.5`), comme `zoomedXScale`. */
  xAt: (i: number) => number;
  yAt: (value: number) => number;
  /** Cours de clôture de la bougie `i` (panneau principal). */
  closeAt?: (i: number) => number | undefined;
  /** Volume de la bougie `i` (panneau Volume). */
  volumeAt?: (i: number) => number | undefined;
  candleWidth: number;
  /** Hauteur du panneau : un fond coloré le couvre de haut en bas. */
  height: number;
  /** Couleur du fond du graphique : le liseré d'un point de croisement, pour qu'il se détache de la courbe. */
  ringColor?: string;
}

/**
 * Règles de couleur des indicateurs d'un panneau (onglet Style, « Couleurs conditionnelles », voir
 * `IndicatorStyleRule`). En deux couches : « under » (remplissages, fonds) avant les courbes, « over » (segments
 * recolorés, points de croisement) après elles — une ligne recolorée est retracée par-dessus la sienne, un peu plus
 * épaisse, plutôt que d'apprendre à chaque tracé d'indicateur à se découper.
 *
 * Entre deux bougies voisines, toutes les courbes sont des segments : le passage d'une condition de vraie à fausse
 * tombe au point exact où deux d'entre elles se croisent (A et B, A et une borne, les deux bornes). Chaque morceau est
 * donc coupé à ces points, la condition lue en son milieu, et chaque couleur remplie en un seul chemin — les morceaux
 * voisins ne se superposent pas en bandes plus foncées.
 */
export function drawIndicatorStyleRules(ctx: CanvasRenderingContext2D, pane: StyleRulePane, layer: "under" | "over"): void {
  for (const member of pane.members) {
    if (member.indicator.hidden) continue;
    // Zones remplies (paramètres du panneau) d'abord : sous les remplissages des règles, et toutes sous les lignes.
    const rules = renderedStyleRules(member.indicator);
    if (rules.length === 0) continue;
    for (const rule of rules) {
      if (rule.enabled === false) continue;
      const under = rule.effect === "fill" || rule.effect === "background";
      if (under !== (layer === "under")) continue;
      drawRule(ctx, pane, member, rule);
    }
  }
}

type Getter = (i: number) => number | null;

/** Lit une courbe ou une valeur fixe, bougie par bougie. */
function operandGetter(pane: StyleRulePane, owner: StyleRuleMember, operand: StyleRuleOperand | undefined, lookups: Map<string, Map<number, IndicatorValue>>): Getter | null {
  if (!operand) return null;
  if (operand.source === "value") {
    const v = operand.value;
    return Number.isFinite(v) ? () => v : null;
  }
  if (operand.source === "close") {
    const closeAt = pane.closeAt;
    if (!closeAt) return null;
    return (i) => finite(closeAt(i));
  }
  if (operand.source === "volume") {
    const volumeAt = pane.volumeAt;
    if (!volumeAt) return null;
    return (i) => finite(volumeAt(i));
  }
  const id = operand.indicatorId ?? owner.indicator.id;
  let lookup = lookups.get(id);
  if (!lookup) {
    const member = pane.members.find((m) => m.indicator.id === id);
    if (!member) return null;
    lookup = new Map(member.points.map((p) => [p.i, p.value]));
    lookups.set(id, lookup);
  }
  const values = lookup;
  const field = operand.field;
  return (i) => seriesFieldValue(values.get(i), field);
}

function finite(v: number | undefined | null): number | null {
  return v === undefined || v === null || !Number.isFinite(v) ? null : v;
}

/** Les bougies parcourues : celles de la courbe A (ou de l'indicateur qui porte la règle, si A est le cours). */
function driverIndices(pane: StyleRulePane, owner: StyleRuleMember, rule: IndicatorStyleRule): number[] {
  const id = rule.a.source === "indicator" ? (rule.a.indicatorId ?? owner.indicator.id) : owner.indicator.id;
  const member = pane.members.find((m) => m.indicator.id === id) ?? owner;
  return member.points.map((p) => p.i);
}

function drawRule(ctx: CanvasRenderingContext2D, pane: StyleRulePane, owner: StyleRuleMember, rule: IndicatorStyleRule): void {
  const lookups = new Map<string, Map<number, IndicatorValue>>();
  const aAt = operandGetter(pane, owner, rule.a, lookups);
  const bAt = operandGetter(pane, owner, rule.b, lookups);
  const range = isRangeCondition(rule.condition);
  const cAt = range ? operandGetter(pane, owner, rule.c ?? rule.b, lookups) : null;
  if (!aAt || !bAt || (range && !cAt)) return;
  const indices = driverIndices(pane, owner, rule);
  if (indices.length < 2) return;

  ctx.save();
  ctx.globalAlpha = Math.min(100, Math.max(0, rule.opacity ?? defaultRuleOpacity(rule.effect))) / 100;
  if (isCrossCondition(rule.condition)) drawCrossRule(ctx, pane, rule, indices, aAt, bAt);
  else drawStateRule(ctx, pane, rule, indices, aAt, bAt, cAt);
  ctx.restore();
}

/** Les valeurs aux deux bouts d'un morceau, interpolées en `t` (0 : bougie de gauche, 1 : bougie de droite). */
const lerp = (v0: number, v1: number, t: number) => v0 + (v1 - v0) * t;

/** Points où `d` (une différence entre deux courbes) change de signe, en fraction du morceau, dans ]0, 1[. */
function pushCrossing(ts: number[], d0: number, d1: number): void {
  if (d0 * d1 < 0) ts.push(d0 / (d0 - d1));
}

function drawStateRule(
  ctx: CanvasRenderingContext2D,
  pane: StyleRulePane,
  rule: IndicatorStyleRule,
  indices: number[],
  aAt: Getter,
  bAt: Getter,
  cAt: Getter | null,
): void {
  const yes = new Path2D();
  const no = new Path2D();
  const hasElse = !!rule.elseColor;
  const { xAt, yAt, height } = pane;
  const cond = (a: number, b: number, c: number): boolean => {
    switch (rule.condition) {
      case "above":
        return a > b;
      case "below":
        return a < b;
      case "gte":
        return a >= b;
      case "lte":
        return a <= b;
      case "between":
        return a >= Math.min(b, c) && a <= Math.max(b, c);
      case "outside":
        return a < Math.min(b, c) || a > Math.max(b, c);
      default:
        return false;
    }
  };
  // Une ligne recolorée : chaque couleur en un seul tracé, repris sans trou d'un morceau au suivant.
  let lastYes: { x: number; y: number } | null = null;
  let lastNo: { x: number; y: number } | null = null;
  const lineTo = (path: Path2D, last: { x: number; y: number } | null, x0: number, y0: number, x1: number, y1: number) => {
    if (!last || Math.abs(last.x - x0) > 0.01 || Math.abs(last.y - y0) > 0.01) path.moveTo(x0, y0);
    path.lineTo(x1, y1);
    return { x: x1, y: y1 };
  };

  for (let k = 1; k < indices.length; k++) {
    const i0 = indices[k - 1]!;
    const i1 = indices[k]!;
    if (i1 - i0 !== 1) continue;
    const a0 = aAt(i0);
    const a1 = aAt(i1);
    const b0 = bAt(i0);
    const b1 = bAt(i1);
    if (a0 === null || a1 === null || b0 === null || b1 === null) continue;
    const c0 = cAt ? cAt(i0) : b0;
    const c1 = cAt ? cAt(i1) : b1;
    if (c0 === null || c1 === null) continue;

    const ts: number[] = [0, 1];
    pushCrossing(ts, a0 - b0, a1 - b1);
    if (cAt) {
      pushCrossing(ts, a0 - c0, a1 - c1);
      pushCrossing(ts, b0 - c0, b1 - c1);
    }
    ts.sort((p, q) => p - q);
    const xl = xAt(i0 + 0.5);
    const xr = xAt(i1 + 0.5);

    for (let s = 1; s < ts.length; s++) {
      const t0 = ts[s - 1]!;
      const t1 = ts[s]!;
      if (t1 - t0 < 1e-9) continue;
      const tm = (t0 + t1) / 2;
      const am = lerp(a0, a1, tm);
      const bm = lerp(b0, b1, tm);
      const cm = lerp(c0, c1, tm);
      const ok = cond(am, bm, cm);
      if (!ok && !hasElse) continue;
      const path = ok ? yes : no;
      const x0 = lerp(xl, xr, t0);
      const x1 = lerp(xl, xr, t1);
      if (rule.effect === "background") {
        path.rect(x0, 0, x1 - x0, height);
      } else if (rule.effect === "line") {
        const y0 = yAt(lerp(a0, a1, t0));
        const y1 = yAt(lerp(a0, a1, t1));
        if (ok) lastYes = lineTo(yes, lastYes, x0, y0, x1, y1);
        else lastNo = lineTo(no, lastNo, x0, y0, x1, y1);
      } else {
        // Remplissage : entre A et B ; pour « entre » / « hors de », entre A et la borne qu'elle dépasse, ou entre les
        // deux bornes quand elle est dedans. Ces bords restent des segments sur le morceau (les croisements entre
        // bornes et courbe sont des points de coupe).
        let edge0: number;
        let edge1: number;
        let other0: number;
        let other1: number;
        if (cAt) {
          const lo = (t: number) => Math.min(lerp(b0, b1, t), lerp(c0, c1, t));
          const hi = (t: number) => Math.max(lerp(b0, b1, t), lerp(c0, c1, t));
          if (am > Math.max(bm, cm)) {
            [edge0, edge1, other0, other1] = [lerp(a0, a1, t0), lerp(a0, a1, t1), hi(t0), hi(t1)];
          } else if (am < Math.min(bm, cm)) {
            [edge0, edge1, other0, other1] = [lerp(a0, a1, t0), lerp(a0, a1, t1), lo(t0), lo(t1)];
          } else {
            [edge0, edge1, other0, other1] = [hi(t0), hi(t1), lo(t0), lo(t1)];
          }
        } else {
          [edge0, edge1, other0, other1] = [lerp(a0, a1, t0), lerp(a0, a1, t1), lerp(b0, b1, t0), lerp(b0, b1, t1)];
        }
        path.moveTo(x0, yAt(edge0));
        path.lineTo(x1, yAt(edge1));
        path.lineTo(x1, yAt(other1));
        path.lineTo(x0, yAt(other0));
        path.closePath();
      }
    }
  }

  if (rule.effect === "line") {
    ctx.lineWidth = 2.25;
    ctx.lineJoin = "round";
    ctx.lineCap = "butt";
    ctx.setLineDash([]);
    ctx.strokeStyle = rule.color;
    ctx.stroke(yes);
    if (rule.elseColor) {
      ctx.strokeStyle = rule.elseColor;
      ctx.stroke(no);
    }
    return;
  }
  ctx.fillStyle = rule.color;
  ctx.fill(yes);
  if (rule.elseColor) {
    ctx.fillStyle = rule.elseColor;
    ctx.fill(no);
  }
}

/**
 * Croisements : un effet ponctuel. « marker » pose un point plein, cerclé de la couleur du fond, à l'endroit exact où
 * A croise B (entre deux bougies, là où les deux segments se coupent) ; « background » peint une bande fine sur la
 * bougie où le croisement est acquis — un repère vertical qui se lit aussi dans les autres panneaux alignés.
 */
function drawCrossRule(ctx: CanvasRenderingContext2D, pane: StyleRulePane, rule: IndicatorStyleRule, indices: number[], aAt: Getter, bAt: Getter): void {
  const { xAt, yAt, height, candleWidth } = pane;
  const up = rule.condition === "crossUp";
  const marks = new Path2D();
  const radius = 3.5;
  for (let k = 1; k < indices.length; k++) {
    const i0 = indices[k - 1]!;
    const i1 = indices[k]!;
    if (i1 - i0 !== 1) continue;
    const a0 = aAt(i0);
    const a1 = aAt(i1);
    const b0 = bAt(i0);
    const b1 = bAt(i1);
    if (a0 === null || a1 === null || b0 === null || b1 === null) continue;
    const d0 = a0 - b0;
    const d1 = a1 - b1;
    const crossed = up ? d0 <= 0 && d1 > 0 : d0 >= 0 && d1 < 0;
    if (!crossed) continue;
    if (rule.effect === "background") {
      const w = Math.max(2, candleWidth);
      marks.rect(xAt(i1 + 0.5) - w / 2, 0, w, height);
      continue;
    }
    const t = d0 === d1 ? 0 : d0 / (d0 - d1);
    const x = lerp(xAt(i0 + 0.5), xAt(i1 + 0.5), t);
    const y = yAt(lerp(a0, a1, t));
    marks.moveTo(x + radius, y);
    marks.arc(x, y, radius, 0, Math.PI * 2);
  }
  ctx.fillStyle = rule.color;
  if (rule.effect !== "background" && pane.ringColor) {
    ctx.strokeStyle = pane.ringColor;
    ctx.lineWidth = 1.5;
    ctx.stroke(marks);
  }
  ctx.fill(marks);
}
