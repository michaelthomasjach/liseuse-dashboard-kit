import WebSocket from "ws";
import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9224/json/list")).json();
const ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl, { maxPayload: 128e6 });
await new Promise((r) => ws.once("open", r));
let id = 0; const p = new Map();
ws.on("message", (raw) => { const m = JSON.parse(raw); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } });
const send = (method, params = {}) => new Promise((res) => { const n = ++id; p.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 800, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: `http://localhost:6051/iframe.html?id=${process.argv[2]}&viewMode=story` });
await sleep(6000);
console.log(await ev(`(() => {
  const svg = document.querySelector('.lq-earnings-dot-chart');
  if (!svg) return "pas de graphique";
  const tick = svg.querySelector('.lq-earnings-dot-chart__tick-label');
  const date = svg.querySelector('.lq-earnings-dot-chart__date-label');
  const dot = svg.querySelector('.lq-earnings-dot-chart__point');
  const box = svg.getBoundingClientRect();
  const cs = (el) => el ? getComputedStyle(el).fontSize : null;
  // What the label measures on screen, after any SVG scaling.
  const rendered = (el) => el ? Math.round(el.getBoundingClientRect().height * 10) / 10 : null;
  return JSON.stringify({
    svgAttr: svg.getAttribute('width') + 'x' + svg.getAttribute('height'),
    viewBox: svg.getAttribute('viewBox'),
    svgRendu: Math.round(box.width) + 'x' + Math.round(box.height),
    facteurEchelle: +(box.width / parseFloat(svg.getAttribute('width'))).toFixed(2),
    policeCSS: { tick: cs(tick), date: cs(date) },
    hauteurRendue: { tick: rendered(tick), date: rendered(date) },
    rayonPoint: dot?.getAttribute('r') ?? null,
  }, null, 1);
})()`));
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(process.argv[3], Buffer.from(shot.result.data, "base64"));
ws.close();
