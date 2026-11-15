/* Vérification du format compact des valeurs d'indicateur, de volume et de panneau
 * (src/components/charts/candlestick/formatting.ts) :
 *
 *   node scripts/checkCompactNumber.mjs
 *
 * Le dépôt n'a pas de lanceur de tests : le TypeScript est empaqueté à la volée par esbuild (celui de vite), comme
 * scripts/checkSankeyLayout.mjs.
 */
import { build } from "esbuild";
import * as d3 from "d3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const outfile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "compact-check-")), "bundle.mjs");
await build({
  entryPoints: [path.join(ROOT, "src/components/charts/candlestick/formatting.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile,
  logLevel: "warning",
});
const { formatCompactNumber, formatVolumeValue, formatPlainNumber, compactAxisTickFormat, formatWithValueFormat } = await import(pathToFileURL(outfile).href);

const problems = [];
const expect = (label, actual, expected) => {
  if (actual !== expected) problems.push(`${label} : obtenu « ${actual} », attendu « ${expected} »`);
};
const M = "−";

// Les exemples de la demande, au format des volumes (entiers sans décimales).
const volumeCases = [
  [100, "100"],
  [1000, "1000"],
  [9999, "9999"],
  [10_000, "10k"],
  [12_345, "12.3k"],
  [100_000, "100k"],
  [999_999, "1M"],
  [1_000_000, "1M"],
  [10_000_000, "10M"],
  [100_000_000, "100M"],
  [160_000_000, "160M"],
  [1_000_000_000, "1B"],
  [10_000_000_000, "10B"],
  [10_100_000_000, "10.1B"],
  [3_562_067_169, "3.56B"],
  [27_129_799_659.15, "27.1B"],
  [999_500_000_000, "1T"],
  [1_250_000_000_000, "1.25T"],
  [0, "0"],
  [-0, "0"],
  [-200_000_000, `${M}200M`],
  [-200_000_000_000, `${M}200B`],
  [-12_345, `${M}12.3k`],
  [-500, `${M}500`],
  [1234.5, "1234.5"],
];
for (const [v, want] of volumeCases) expect(`formatVolumeValue(${v})`, formatVolumeValue(v), want);

// Valeur d'indicateur : deux décimales sous 10 000 (RSI, MACD gardent leur précision), compact au-delà.
expect("formatCompactNumber(54.3)", formatCompactNumber(54.3), "54.30");
expect("formatCompactNumber(0.0012, 4 déc.)", formatCompactNumber(0.0012, (v) => v.toFixed(4)), "0.0012");
expect("formatCompactNumber(-0.001)", formatCompactNumber(-0.001), "0.00");
expect("formatCompactNumber(-3.2)", formatCompactNumber(-3.2), `${M}3.20`);
expect("formatCompactNumber(1946482002.12)", formatCompactNumber(1946482002.12), "1.95B");
expect("formatCompactNumber(100000)", formatCompactNumber(100000), "100k");
expect("formatCompactNumber(NaN)", formatCompactNumber(NaN), "NaN");
expect("formatPlainNumber(0.0035)", formatPlainNumber(0.0035), "0.0035");

// Graduations d'axe : précision du pas en dessous de 10 000, compact au-delà, jamais de G.
const axis = compactAxisTickFormat(d3.scaleLinear().domain([0, 200e9]), 3);
expect("axe 0..200B (0)", axis(0), "0");
expect("axe 0..200B (100B)", axis(100e9), "100B");
expect("axe 0..200B (200B)", axis(200e9), "200B");
const small = compactAxisTickFormat(d3.scaleLinear().domain([0, 8000]), 3);
expect("axe 0..8000 (5000)", small(5000), "5000");
const macd = compactAxisTickFormat(d3.scaleLinear().domain([-0.002, 0.002]), 3);
expect("axe MACD (0.001)", macd(0.001), "0.001");
expect("axe MACD (-0.001)", macd(-0.001), `${M}0.001`);

// Formats réglables (réglage de l'indicateur, option format d'un script).
expect("auto 12345678", formatWithValueFormat(12_345_678, "auto"), "12.3M");
expect("integer 1234.56", formatWithValueFormat(1234.56, "integer"), "1235");
expect("integer 160e6", formatWithValueFormat(160e6, "integer"), "160M");
expect("percent 21.456", formatWithValueFormat(21.456, "percent"), "21.46%");
expect("raw 3562067169.5", formatWithValueFormat(3562067169.5, "raw"), "3562067169.5");
expect("decimals 4", formatWithValueFormat(0.00123, { decimals: 4 }), "0.0012");
expect("prefix $", formatWithValueFormat(-1.2e9, { prefix: "$" }), `${M}$1.2B`);
expect("compact false", formatWithValueFormat(160e6, { compact: false, decimals: 0 }), "160000000");
expect("inconnu → auto", formatWithValueFormat(100000, "nimporte"), "100k");

for (const [v, want] of volumeCases) console.log(`${String(v).padStart(18)} → ${formatVolumeValue(v)}${formatVolumeValue(v) === want ? "" : `   (attendu ${want})`}`);
if (problems.length > 0) {
  console.error(`\n${problems.length} problème(s) :`);
  for (const p of problems) console.error("  -", p);
  process.exit(1);
}
console.log("\nFormat compact : tous les cas passent.");
