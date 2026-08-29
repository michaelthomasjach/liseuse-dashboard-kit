import { useState } from "react";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import { useScriptEngine } from "./hooks/useScriptEngine";

/** Development-only harness for exercising `useScriptEngine` before the real editor UI (M5)
 *  exists — a fixed set of test scripts, a Run button per script, and the raw
 *  `ScriptRunResult` printed as text. Not part of the public API (not exported from
 *  `src/index.ts`), not meant to ship — remove once M5's real `ScriptEditorPanel` supersedes it
 *  as the way to exercise this engine end to end. */
export interface ScriptEngineDebugHarnessProps {
  data: Candle[];
  indicators: Indicator[];
}

const TEST_SCRIPTS: Record<string, string> = {
  "close/offset": `
console.log("close(0)=" + market.close(0));
console.log("close(1)=" + market.close(1));
console.log("open(0)=" + market.open(0));
console.log("high(0)=" + market.high(0));
console.log("low(0)=" + market.low(0));
console.log("volume(0)=" + market.volume(0));
console.log("time(0)=" + market.time(0));
`,
  "out-of-range returns null, never leaks the future": `
console.log("close(9999)=" + market.close(9999));
console.log("close(-1)=" + market.close(-1));
console.log("close(-100)=" + market.close(-100));
`,
  "series": `
const closes = market.series("close", 5);
console.log("series length=" + closes.length);
console.log("series=" + JSON.stringify(closes));
`,
  "runtime error with line number": `
const a = 1;
const b = 2;
const c = market.close();
undefinedFunctionCall();
`,
  "syntax error": `
const a = 1
if (true) {
`,
  "infinite loop (timeout test)": `
while (true) {}
`,
  "chart.indicator + math + ta": `
console.log("listIndicators=" + JSON.stringify(chart.listIndicators()));

const rsi = chart.indicator("rsi_14");
console.log("rsi.value(0)=" + rsi.value(0));
console.log("rsi.line(0) [wrong accessor, expect null]=" + rsi.line(0));

const macd = chart.indicator("macd_12_26_9");
console.log("macd.line(0)=" + macd.line(0));
console.log("macd.signal(0)=" + macd.signal(0));
console.log("macd.histogram(0)=" + macd.histogram(0));

const missing = chart.indicator("nonexistent_id");
console.log("missing.value(0) [expect null]=" + missing.value(0));

const closes = market.series("close", 20);
console.log("math.mean=" + math.mean(closes));
console.log("math.std=" + math.std(closes));
console.log("math.sma(closes,5)=" + math.sma(closes, 5));

console.log("ta.rsi(closes,14)=" + ta.rsi(closes, 14));
const wideCloses = market.series("close", 60);
const taMacd = ta.macd(wideCloses);
console.log("wideCloses.length=" + wideCloses.length + " ta.macd=" + JSON.stringify(taMacd));
`,
  "plot.* (score, signals, overlay)": `
const rsi = chart.indicator("rsi_14").value(0);
const macd = chart.indicator("macd_12_26_9").histogram(0);
const price = market.close(0);
const ema = math.sma(market.series("close", 20), 20);

let score = 0;
if (rsi !== null && rsi > 50) score += 1;
if (macd !== null && macd > 0) score += 1;
if (ema !== null && price > ema) score += 1;

plot.line("Quant Score", score);
plot.overlay("Fast SMA20", ema ?? price);

if (score === 3) plot.signal({ type: "BUY", price });
if (rsi !== null && rsi > 70) plot.signal("SELL");
`,
};

export function ScriptEngineDebugHarness({ data, indicators }: ScriptEngineDebugHarnessProps) {
  const engine = useScriptEngine("debug-script", data, indicators, undefined);
  const [lastScript, setLastScript] = useState<string | null>(null);

  return (
    <div style={{ fontFamily: "monospace", fontSize: 12, padding: 16 }}>
      <h3>Script Engine Debug Harness (M1)</h3>
      <p>{engine.running ? "RUNNING..." : "idle"}</p>
      {Object.entries(TEST_SCRIPTS).map(([name, code]) => (
        <div key={name} style={{ marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => {
              setLastScript(name);
              engine.run(code);
            }}
          >
            Run: {name}
          </button>
        </div>
      ))}
      <button type="button" onClick={() => engine.stop()}>
        Stop
      </button>
      <hr />
      <div>Last script: {lastScript}</div>
      <pre data-testid="engine-result">{JSON.stringify(engine.result, null, 2)}</pre>
      <h4>scriptIndicators (→ CustomIndicatorDef)</h4>
      <pre data-testid="engine-script-indicators">{JSON.stringify(engine.scriptIndicators, null, 2)}</pre>
      <h4>scriptDrawings (→ TrendLineDrawing)</h4>
      <pre data-testid="engine-script-drawings">{JSON.stringify(engine.scriptDrawings, null, 2)}</pre>
    </div>
  );
}
