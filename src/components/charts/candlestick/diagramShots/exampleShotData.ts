import type { Candle } from "../interfaces/Candle.interface";
import { PROP_SHOT_DATA } from "../propShots/propShotData";

/** Les séries des captures d'exemple des pages d'aide (« Ce qu'il faut rechercher ») : une tendance haussière avec ses
 *  replis, une tendance baissière avec ses rebonds, un range, et un retournement (hausse puis baisse).
 *
 *  Mêmes dates que `PROP_SHOT_DATA` et un tirage à graine fixe, pour la même raison que les autres captures : des
 *  images versionnées qui ne bougent pas d'un passage à l'autre. Chaque série suit un tracé voulu (`path`) plus un
 *  bruit borné : un exemple doit montrer la situation qu'il illustre, pas une marche au hasard qui la contiendrait
 *  peut-être. */

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Des bougies qui suivent `path(t)` (t de 0 à 1 sur la série), avec un bruit de `noise` (en fraction du prix). */
function candlesAlong(seed: number, path: (t: number) => number, noise: number): Candle[] {
  const rand = mulberry32(seed);
  const n = PROP_SHOT_DATA.length;
  const out: Candle[] = [];
  let close = path(0);
  for (let i = 0; i < n; i++) {
    const open = close;
    const target = path(i / (n - 1));
    close = target * (1 + (rand() - 0.5) * 2 * noise);
    const span = Math.max(open, close) * noise * 0.8;
    out.push({
      date: PROP_SHOT_DATA[i].date,
      open: r2(open),
      high: r2(Math.max(open, close) + rand() * span),
      low: r2(Math.min(open, close) - rand() * span),
      close: r2(close),
      volume: Math.round(60_000 + rand() * 180_000),
    });
  }
  return out;
}

/** Hausse franche (de 60 à 120 environ), ponctuée de replis réguliers. */
export const SHOT_TREND_UP_DATA = candlesAlong(31, (t) => 60 * (1 + t * 1.05) * (1 + 0.035 * Math.sin(t * 22)), 0.012);

/** Baisse franche (de 120 à 60 environ), ponctuée de rebonds. */
export const SHOT_TREND_DOWN_DATA = candlesAlong(47, (t) => 120 * (1 - t * 0.5) * (1 + 0.035 * Math.sin(t * 20 + 1)), 0.012);

/** Un range : le prix oscille entre environ 92 et 108, sans direction. */
export const SHOT_RANGE_DATA = candlesAlong(53, (t) => 100 * (1 + 0.07 * Math.sin(t * 26)), 0.01);

/** Un retournement : hausse jusqu'aux deux tiers de la série, puis baisse. */
export const SHOT_REVERSAL_DATA = candlesAlong(71, (t) => (t < 0.62 ? 70 + 55 * (t / 0.62) : 125 - 60 * ((t - 0.62) / 0.38)) * (1 + 0.025 * Math.sin(t * 30)), 0.011);

export const EXAMPLE_DATASETS = {
  up: SHOT_TREND_UP_DATA,
  down: SHOT_TREND_DOWN_DATA,
  range: SHOT_RANGE_DATA,
  reversal: SHOT_REVERSAL_DATA,
} as const;

export type ExampleDataset = keyof typeof EXAMPLE_DATASETS;
