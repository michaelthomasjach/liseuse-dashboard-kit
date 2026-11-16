/* Vérification des bandes de Bollinger posées sur un panneau (src/components/charts/candlestick/attachedIndicators.ts) :
 *
 *   node scripts/checkAttachedBollinger.mjs
 *
 * Bollinger(20, 2) calculé sur la série d'un RSI(14), comparé au Bollinger de référence (`BollingerBands` de
 * technicalindicators, celui des prix) appliqué à la même série RSI ; puis sur le volume, et la valeur d'alerte
 * (`alertSeriesValues` → la médiane). Le TypeScript est empaqueté à la volée par esbuild, comme
 * scripts/checkCompactNumber.mjs.
 */
import { build } from "esbuild";
import { BollingerBands, RSI } from "technicalindicators";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attached-bb-check-"));
const entry = path.join(dir, "entry.ts");
fs.writeFileSync(
  entry,
  `export { withAttachedValues, bollingerOn } from ${JSON.stringify(path.join(ROOT, "src/components/charts/candlestick/attachedIndicators.ts"))};
export { computeIndicatorValues } from ${JSON.stringify(path.join(ROOT, "src/components/charts/candlestick/indicators.ts"))};
export { alertSeriesValues } from ${JSON.stringify(path.join(ROOT, "src/components/charts/candlestick/alertSeries.ts"))};`,
);
const outfile = path.join(dir, "bundle.mjs");
await build({ entryPoints: [entry], bundle: true, platform: "node", format: "esm", outfile, logLevel: "warning" });
const { withAttachedValues, computeIndicatorValues, alertSeriesValues } = await import(pathToFileURL(outfile).href);

// Une série de cours déterministe (marche pseudo-aléatoire), avec volume.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const data = [];
let close = 100;
for (let i = 0; i < 300; i++) {
  const open = close;
  close = Math.max(1, close + (rand() - 0.5) * 4);
  data.push({ date: new Date(2024, 0, 1 + i), open, high: Math.max(open, close) + rand(), low: Math.min(open, close) - rand(), close, volume: Math.round(1e6 + rand() * 5e6) });
}

const problems = [];
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
const compare = (label, values, ref) => {
  const firstIdx = values.findIndex((v) => v !== null);
  const got = values.slice(firstIdx);
  if (got.length !== ref.length) problems.push(`${label} : ${got.length} valeurs, attendu ${ref.length}`);
  got.forEach((v, k) => {
    const r = ref[k];
    if (!v || !r || !near(v.upper, r.upper) || !near(v.middle, r.middle) || !near(v.lower, r.lower))
      problems.push(`${label} [${firstIdx + k}] : ${JSON.stringify(v)} ≠ ${JSON.stringify(r)}`);
  });
};

const rsi = { id: "rsi1", kind: "rsi", period: 14 };
const bbRsi = { id: "bb1", kind: "bollinger", period: 20, stdDev: 2, sourceId: "rsi1" };
const bbVol = { id: "bb2", kind: "bollinger", period: 20, stdDev: 2.5, sourceId: "volume" };
const indicators = [rsi, bbRsi, bbVol];
const all = withAttachedValues(indicators, (ind) => computeIndicatorValues(data, ind, undefined), data.map((d) => d.volume));

const rsiRef = RSI.calculate({ period: 14, values: data.map((d) => d.close) });
compare("Bollinger(20, 2) sur RSI(14)", all[1].values, BollingerBands.calculate({ period: 20, stdDev: 2, values: rsiRef }));
compare("Bollinger(20, 2.5) sur le volume", all[2].values, BollingerBands.calculate({ period: 20, stdDev: 2.5, values: data.map((d) => d.volume) }));

const alert = alertSeriesValues(data, indicators, "bb1");
all[1].values.forEach((v, i) => {
  if ((v === null) !== (alert[i] === null) || (v && !near(alert[i], v.middle))) problems.push(`alerte [${i}] : ${alert[i]} au lieu de la médiane ${v?.middle}`);
});

if (problems.length) {
  console.error(problems.slice(0, 20).join("\n"));
  console.error(`${problems.length} écart(s).`);
  process.exit(1);
}
console.log("Bollinger posé sur un panneau : RSI, volume et valeur d'alerte conformes à la référence.");
