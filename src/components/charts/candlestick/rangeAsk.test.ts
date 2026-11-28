import { describe, expect, it } from "vitest";
import type { Candle } from "./interfaces/Candle.interface";
import { buildRangeAskRequest, clampRangeToCandles, lastClosedCandleIndex, MAX_RANGE_PROMPT_CHARS } from "./rangeAsk";

const HALF_HOUR = 30 * 60_000;
const start = Date.UTC(2026, 10, 20, 8);
const data: Candle[] = Array.from({ length: 300 }, (_, i) => {
  const o = 7950 + Math.sin(i / 5) * 30;
  return { date: new Date(start + i * HALF_HOUR), open: o, high: o + 12.345, low: o - 11.2, close: o + 3.21, volume: 12_345 + i };
});
const lastDate = data[299]!.date.getTime();
/** Bien après la clôture de la dernière bougie : toutes closes. */
const later = lastDate + 10 * HALF_HOUR;

describe("zone de l'IA bornée aux bougies existantes", () => {
  it("la dernière bougie compte comme close une fois son heure de clôture passée, en formation avant", () => {
    expect(lastClosedCandleIndex(data, false, later)).toBe(299);
    expect(lastClosedCandleIndex(data, false, lastDate + HALF_HOUR / 2)).toBe(298);
    expect(lastClosedCandleIndex(data, true, later)).toBe(298);
    expect(lastClosedCandleIndex([], false, later)).toBe(-1);
  });

  it("ne dépasse ni la dernière bougie close (futur, bougie en formation) ni la première bougie", () => {
    const future = new Date(lastDate + 40 * HALF_HOUR);
    const before = new Date(start - 40 * HALF_HOUR);
    expect(clampRangeToCandles({ from: data[250]!.date, to: future }, data, false, later)).toEqual({ from: data[250]!.date, to: data[299]!.date });
    expect(clampRangeToCandles({ from: data[250]!.date, to: future }, data, true, later)).toEqual({ from: data[250]!.date, to: data[298]!.date });
    expect(clampRangeToCandles({ from: future, to: before }, data, false, later)).toEqual({ from: data[0]!.date, to: data[299]!.date });
    // Zone entière dans le futur : ramenée sur la dernière bougie close.
    expect(clampRangeToCandles({ from: future, to: new Date(future.getTime() + HALF_HOUR) }, data, false, later)).toEqual({ from: data[299]!.date, to: data[299]!.date });
  });

  it("la demande envoyée porte les dates et le nombre de bougies bornés", () => {
    const req = buildRangeAskRequest({ kind: "events", range: { from: data[240]!.date, to: new Date(lastDate + 20 * HALF_HOUR) }, data, formatDate: (d) => d.toISOString(), lastCandleOpen: true, now: later });
    expect(req.to).toEqual(data[298]!.date);
    expect(req.candles).toHaveLength(59);
    expect(req.summary).toContain("59 bougies");
  });
});

describe("taille de la demande d'une zone", () => {
  it("reste sous la limite avec beaucoup d'indicateurs affichés (refusée avant : « Invalid request parameters »)", () => {
    for (const n of [0, 3, 6, 12, 30]) {
      const indicators = Array.from({ length: n }, (_, k) => ({ label: `Indicateur ${k} (20, 2)`, values: data.map((c) => (k % 2 ? { upper: c.high * 1.0012, middle: c.close * 1.00034, lower: c.low * 0.99877 } : c.close * 1.000123)) }));
      const req = buildRangeAskRequest({ kind: "events", range: { from: data[150]!.date, to: data[210]!.date }, data, symbol: "CAC 40", timeframe: "30m", formatDate: (d) => d.toISOString(), indicators, now: later });
      expect(req.candles).toHaveLength(61);
      expect(req.prompt.length).toBeLessThanOrEqual(MAX_RANGE_PROMPT_CHARS);
      if (n > 0) expect(req.prompt).toContain("Indicateur 0 (20, 2) :");
    }
  });
});
