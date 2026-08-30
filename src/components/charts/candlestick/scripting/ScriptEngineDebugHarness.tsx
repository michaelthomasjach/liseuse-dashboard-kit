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
  "security: every blocked global (M6)": `
const targets = [
  ["fetch", () => fetch("https://example.com")],
  ["XMLHttpRequest", () => new XMLHttpRequest()],
  ["WebSocket", () => new WebSocket("wss://example.com")],
  ["importScripts", () => importScripts("https://example.com/x.js")],
  ["Worker", () => new Worker("https://example.com/x.js")],
  ["indexedDB", () => indexedDB.open("x")],
  ["caches", () => caches.open("x")],
  ["Notification", () => new Notification("x")],
  ["navigator.sendBeacon", () => navigator.sendBeacon("https://example.com", "x")],
];
for (const [name, attempt] of targets) {
  try {
    attempt();
    console.log(name + ": NOT BLOCKED — SECURITY FAILURE");
  } catch (e) {
    console.log(name + ": blocked (" + e.message + ")");
  }
}
console.log("--- legitimate globals still usable ---");
console.log("Math.max(1,2)=" + Math.max(1, 2));
console.log("Date.now() type=" + typeof Date.now());
console.log("JSON.stringify({a:1})=" + JSON.stringify({ a: 1 }));
console.log("Array.isArray([1,2])=" + Array.isArray([1, 2]));
console.log("new Map().size=" + new Map().size);
console.log("new Set().size=" + new Set().size);
`,
  "chart.indicator + math + ta": `
console.log("listIndicators=" + JSON.stringify(chart.listIndicators()));

const rsi = chart.indicator("rsi");
console.log("rsi.value(0)=" + rsi.value(0));
console.log("rsi.line(0) [wrong accessor, expect null]=" + rsi.line(0));

const macd = chart.indicator("macd");
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
const rsi = chart.indicator("rsi").value(0);
const macd = chart.indicator("macd").histogram(0);
const price = market.close(0);
const ema = math.sma(market.series("close", 20), 20);

let score = 0;
if (rsi !== null && rsi > 50) score += 1;
if (macd !== null && macd > 0) score += 1;
if (ema !== null && price > ema) score += 1;

plot.pane("Quant Score").line("Quant Score", score);
plot.overlay("Fast SMA20").line("Fast SMA20", ema ?? price);

if (score === 3) plot.signal({ type: "BUY", price });
if (rsi !== null && rsi > 70) plot.signal("SELL");
`,
  "state + alert + bar": `
const seenBars = state.get("seenBars", 0) + 1;
state.set("seenBars", seenBars);

const prevClose = state.get("prevClose", null);
const close = market.close(0);
state.set("prevClose", close);

if (bar.isNew()) {
  console.log("bar #" + seenBars + " isNew=" + bar.isNew() + " isClosed=" + bar.isClosed() + " isRealtime=" + bar.isRealtime());
}

if (prevClose !== null && close > prevClose * 1.01) {
  alert("Bond de plus de 1% : " + prevClose.toFixed(2) + " -> " + close.toFixed(2));
}

if (bar.isNew() && !bar.isClosed()) {
  alert("Dernière bougie encore en formation");
}
`,
};

export function ScriptEngineDebugHarness({ data: initialData, indicators }: ScriptEngineDebugHarnessProps) {
  // Local copy so "Simulate new candle" below can append to it — exercising useScriptEngine's own
  // real-time re-trigger effect (M4), which fires on `data` identity change, requires an actual
  // prop-level data change here, not just re-running the same script by hand.
  const [data, setData] = useState(initialData);
  const [lastCandleOpen, setLastCandleOpen] = useState(false);
  const engine = useScriptEngine("debug-script", data, indicators, undefined, lastCandleOpen);
  const [lastScript, setLastScript] = useState<string | null>(null);

  return (
    <div style={{ fontFamily: "monospace", fontSize: 12, padding: 16 }}>
      <h3>Script Engine Debug Harness (M1-M4)</h3>
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
      <label>
        <input type="checkbox" checked={lastCandleOpen} onChange={(e) => setLastCandleOpen(e.target.checked)} />
        lastCandleOpen
      </label>
      <button
        type="button"
        data-testid="simulate-new-candle"
        onClick={() => {
          setData((prev) => {
            const last = prev[prev.length - 1];
            const nextClose = last.close * (1 + (Math.random() - 0.3) * 0.03);
            return [
              ...prev,
              { date: new Date(last.date.getTime() + 24 * 60 * 60 * 1000), open: last.close, high: Math.max(last.close, nextClose), low: Math.min(last.close, nextClose), close: nextClose, volume: last.volume },
            ];
          });
        }}
      >
        Simulate new candle
      </button>
      <div data-testid="engine-data-length">data.length={data.length}</div>
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
