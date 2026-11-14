import { runScript } from "../src/components/charts/candlestick/scripting/worker/runScript";
import { stripScriptKind } from "../src/components/charts/candlestick/scripting/scriptKind";
import { stripScriptBlocks } from "../src/components/charts/candlestick/scripting/scriptBlocks";
import { stripScriptDescription } from "../src/components/charts/candlestick/scripting/scriptDescription";
const ohlcv = Array.from({ length: 60 }, (_, i) => ({ t: Date.UTC(2026, 0, 1) + i * 86400000, o: 100 + i, h: 102 + i, l: 99 + i, c: 101 + i, v: 1000 }));
async function run(name: string, code: string) {
  const r = await runScript({ ohlcv, indicatorSeries: {}, fundamentalSeries: {}, runUpToIndex: ohlcv.length - 1, scriptCode: stripScriptKind(stripScriptBlocks(stripScriptDescription(code))), limits: { timeoutMs: 5000, maxSeriesLength: 5000 } } as never);
  console.log(name, "→", r.error ? `ERREUR ${r.error.message}` : `ok, logs: ${r.logs.slice(-2).join(" | ")}`);
}
await run("map simple", `@indicator\nconst a = [1,2,3].map((x) => x * 2);\nconsole.log(a.join(","));`);
await run("map série", `@indicator\nconst s = market.series("close", 5).map((c) => c * 2);\nconsole.log(s.join(","));`);
await run("map fonction", `@indicator\nconst s = market.series("close", 3).map(function (c, i) { return c + i; });\nconsole.log(s.join(","));`);
await run("map objet", `@indicator\nconst rows = [{p:1},{p:2}].map(r => ({ v: r.p }));\nconsole.log(JSON.stringify(rows));`);
await run("map multiligne", `@indicator\nconst s = market.series("close", 3)\n  .map((c) => c / 2);\nconsole.log(s.join(","));`);
