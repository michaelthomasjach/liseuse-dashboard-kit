/* Banc de performance du survol de CandlestickChart.
 *
 * Ouvre la story « Charts/CandlestickChart/Banc de performance » (perf/HoverBench.stories.tsx) dans
 * un Chrome sans interface piloté par le protocole DevTools (comme captureChartPropShots.cjs, sans
 * dépendance), balaie le graphique à la souris — zigzag sur les bougies et sur chaque panneau — et
 * mesure ce que coûte chaque mouvement : temps du fil principal, images par seconde, délai entre le
 * mouvement et l'image suivante. Le processeur est ralenti (×1, ×4, ×6) pour simuler un portable.
 *
 * Mesurer sur la page autonome construite en production (React de production, comme une
 * application, sans Storybook : son module de surlignage parcourt tout le DOM à chaque mutation) :
 *   npx vite build --config scripts/vite.bench.config.mjs --outDir <dossier>
 *   node scripts/benchChartHover.cjs --static <dossier> --label avant --out bench-avant.json
 * Options : --throttles 1,4,6  --steps 400  --heavy (page lourde seule)  --trace (temps par type
 * d'événement Chrome)  --profile (points chauds JS ; lisible sur la Storybook de dev : --url
 * http://localhost:6006)  --css "<règle>" (essai d'une règle CSS injectée avant la mesure).
 *
 * --pan : glisser au doigt au lieu du survol, sur un téléphone émulé (412 × 915, densité 3, tactile) —
 * des allers-retours horizontaux sur les bougies, comme on parcourt l'historique. --dpr 2 pour un
 * téléphone moins dense ; --width/--height pour un autre écran.
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const STORY_TITLE = "Charts/CandlestickChart/Banc de performance";
const CHROME =
  process.env.CHROME_PATH ??
  ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => fs.existsSync(p));

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : (process.argv[i + 1] ?? true);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serveStatic(dir) {
  const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
  const server = http.createServer((req, res) => {
    const file = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname));
    fs.readFile(fs.existsSync(file) && fs.statSync(file).isDirectory() ? path.join(file, "index.html") : file, (err, body) => {
      if (err) return res.writeHead(404).end();
      res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" }).end(body);
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      /* pas encore prêt */
    }
    if (Date.now() > deadline) throw new Error(`Pas de réponse de ${url}`);
    await sleep(300);
  }
}

async function connect(port, width, height, mobile = null) {
  const version = await (await waitForHttp(`http://127.0.0.1:${port}/json/version`, 20_000)).json();
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method) for (const l of listeners) l(msg);
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.error) entry.reject(new Error(`${entry.method}: ${msg.error.message}`));
    else entry.resolve(msg.result);
  });
  const send = (method, params, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject, method });
      ws.send(JSON.stringify({ id, method, params: params ?? {}, sessionId }));
    });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  await page("Page.enable");
  await page("Runtime.enable");
  // Visite guidée de l'espace de travail déjà vue : sa bulle couvrirait le graphique et capterait le doigt.
  await page("Page.addScriptToEvaluateOnNewDocument", { source: "try { localStorage.setItem('lq-workspace-tour-seen', '1'); } catch {}" });
  await page("Performance.enable", { timeDomain: "timeTicks" });
  await page("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile?.dpr ?? 1, mobile: Boolean(mobile) });
  if (mobile) await page("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  const on = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  return { page, on, close: () => ws.close() };
}

/** Trace Chrome du balayage : durée totale par type d'événement (peinture, composition, script…). */
async function traced(conn, fn) {
  const events = [];
  const off = conn.on((m) => {
    if (m.method === "Tracing.dataCollected") events.push(...m.params.value);
  });
  const done = new Promise((resolve) => {
    const offDone = conn.on((m) => {
      if (m.method === "Tracing.tracingComplete") {
        offDone();
        resolve();
      }
    });
  });
  await conn.page("Tracing.start", { traceConfig: { includedCategories: ["devtools.timeline", "disabled-by-default-devtools.timeline"] }, transferMode: "ReportEvents" });
  await fn();
  await conn.page("Tracing.end");
  await done;
  off();
  const byName = new Map();
  for (const e of events) {
    if (e.ph !== "X" || !e.dur) continue;
    byName.set(e.name, (byName.get(e.name) ?? 0) + e.dur / 1000);
  }
  return [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
}

async function evaluate(page, expression) {
  const { result, exceptionDetails } = await page("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text ?? "evaluate");
  return result.value;
}

/** Le graphique est peint : la plus grande toile du banc porte autre chose qu'un fond uni. */
async function waitForChart(page, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const rect = await evaluate(
      page,
      `(() => {
        const root = document.querySelector('[data-bench-root]') ?? document.querySelector('.lq-chart');
        if (!root) return null;
        const canvases = [...root.querySelectorAll('canvas')].filter((c) => c.width > 0);
        if (!canvases.length) return null;
        const c = canvases.sort((a, b) => b.width * b.height - a.width * a.height)[0];
        const d = c.getContext('2d').getImageData(0, 0, c.width, Math.min(c.height, 300)).data;
        const seen = new Set();
        for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
        if (seen.size < 4) return null;
        const r = c.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      })()`,
    );
    if (rect) return rect;
    if (Date.now() > deadline) throw new Error("Le graphique ne s'est jamais peint");
    await sleep(250);
  }
}

const collector = (move) => `(() => {
  const s = (window.__bench = { frames: [], moves: 0, lat: [], pending: [], long: [], running: true });
  addEventListener('${move}', (e) => { s.moves++; s.pending.push(e.timeStamp); }, { capture: true, passive: true });
  // Fin du traitement de chaque mouvement (après les gestionnaires du graphique) : coût propre de l'événement.
  addEventListener('${move}', (e) => { s.handled = (s.handled ?? []); s.handled.push(performance.now() - e.timeStamp); }, { passive: true });
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) s.long.push(e.duration); }).observe({ type: 'longtask' }); } catch {}
  const tick = (t) => {
    s.frames.push(t);
    const now = performance.now();
    for (const ts of s.pending) s.lat.push(now - ts);
    s.pending = [];
    if (s.running) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return true;
})()`;

const metricsOf = async (page) => Object.fromEntries((await page("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
const pct = (xs, p) => {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
};

/** Zigzag : de gauche à droite et retour, en traversant à chaque passage les bougies et tous les panneaux. */
function sweepPath(rect, steps) {
  const pts = [];
  const left = rect.x + 30;
  const right = rect.x + rect.width - 90;
  const top = rect.y + 40;
  const bottom = rect.y + rect.height - 40;
  for (let i = 0; i < steps; i++) {
    const u = (i % 200) / 199;
    const x = Math.floor(i / 200) % 2 === 0 ? left + u * (right - left) : right - u * (right - left);
    const v = (Math.sin(i / 9) + 1) / 2;
    pts.push({ x: Math.round(x), y: Math.round(top + v * (bottom - top)) });
  }
  return pts;
}

/** Glisser au doigt : allers-retours horizontaux au milieu des bougies, doigt posé tout du long. */
function panPath(rect, steps) {
  const pts = [];
  const left = rect.x + rect.width * 0.15;
  const right = rect.x + rect.width * 0.75;
  const y = Math.round(rect.y + Math.min(rect.height * 0.3, 160));
  for (let i = 0; i < steps; i++) {
    const u = (i % 100) / 99;
    const x = Math.floor(i / 100) % 2 === 0 ? left + u * (right - left) : right - u * (right - left);
    pts.push({ x: Math.round(x), y });
  }
  return pts;
}

async function runScenario(conn, baseUrl, storyId, sc, opts) {
  const { page } = conn;
  const url = opts.site
    ? opts.site
    : storyId
    ? `${baseUrl}/iframe.html?id=${storyId}&viewMode=story&args=panes:${sc.panes};workspace:!${sc.workspace};page:!${Boolean(sc.page)}`
    : `${baseUrl}/index.html?panes=${sc.panes}&workspace=${sc.workspace ? 1 : 0}&page=${sc.page ? 1 : 0}${arg("candles") ? `&candles=${arg("candles")}` : ""}`;
  await page("Emulation.setCPUThrottlingRate", { rate: 1 });
  await page("Page.navigate", { url });
  await sleep(500);
  const rect = await waitForChart(page);
  await sleep(800);
  const pts = opts.pan ? panPath(rect, opts.steps) : sweepPath(rect, opts.steps);
  const touch = (type, p) => page("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: p.x, y: p.y, id: 1 }] });
  const move = (p) => (opts.pan ? touch("touchMove", p) : page("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x, y: p.y }));
  await page("Emulation.setCPUThrottlingRate", { rate: sc.throttle });
  // Échauffement (JIT, caches) hors mesure.
  if (opts.pan) await touch("touchStart", pts[0]);
  for (const p of pts.slice(0, 40)) {
    await move(p);
    await sleep(opts.gap);
  }
  if (opts.pan) await touch("touchEnd", pts[39]);
  if (opts.css) await evaluate(page, `(() => { const st = document.createElement('style'); st.textContent = ${JSON.stringify(String(opts.css))}; document.head.appendChild(st); return true; })()`);
  if (opts.js) await evaluate(page, String(opts.js));
  await evaluate(page, collector(opts.pan ? "touchmove" : "mousemove"));
  if (opts.profile) {
    await page("Profiler.enable");
    await page("Profiler.setSamplingInterval", { interval: 200 });
    await page("Profiler.start");
  }
  const before = await metricsOf(page);
  const t0 = Date.now();
  const sweep = async () => {
    if (opts.pan) await touch("touchStart", pts[0]);
    for (const p of pts) {
      await move(p);
      await sleep(opts.gap);
    }
    if (opts.pan) await touch("touchEnd", pts[pts.length - 1]);
    await sleep(300);
  };
  const trace = opts.trace ? await traced(conn, sweep) : (await sweep(), null);
  const wall = Date.now() - t0;
  const after = await metricsOf(page);
  let profile = null;
  if (opts.profile) profile = (await page("Profiler.stop")).profile;
  const s = await evaluate(page, `(() => { const s = window.__bench; s.running = false; return { frames: s.frames, moves: s.moves, lat: s.lat, long: s.long, handled: s.handled ?? [] }; })()`);
  const intervals = s.frames.slice(1).map((t, i) => t - s.frames[i]);
  const d = (k) => (after[k] - before[k]) * 1000;
  const r = {
    ...sc,
    moves: s.moves,
    wallMs: wall,
    busyMsPerMove: d("TaskDuration") / Math.max(1, s.moves),
    scriptMsPerMove: d("ScriptDuration") / Math.max(1, s.moves),
    layoutStyleMsPerMove: (d("LayoutDuration") + d("RecalcStyleDuration")) / Math.max(1, s.moves),
    busyShare: d("TaskDuration") / wall,
    busyMsPerFrame: d("TaskDuration") / Math.max(1, s.frames.length),
    handlerP50: pct(s.handled, 50),
    handlerP95: pct(s.handled, 95),
    fps: (s.frames.length / (s.frames[s.frames.length - 1] - s.frames[0])) * 1000,
    frameP50: pct(intervals, 50),
    frameP95: pct(intervals, 95),
    latP50: pct(s.lat, 50),
    latP95: pct(s.lat, 95),
    longTasks: s.long.length,
    longTaskMs: s.long.reduce((a, b) => a + b, 0),
  };
  return { r, profile, trace };
}

function hotspots(profile, top = 30) {
  const self = new Map();
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const dt = profile.timeDeltas;
  profile.samples.forEach((id, i) => {
    const n = byId.get(id);
    const f = n.callFrame;
    const key = `${f.functionName || "(anonyme)"}  ${path.basename(f.url || "")}:${f.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0) / 1000);
  });
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  return [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, ms]) => `${ms.toFixed(1).padStart(8)} ms ${((ms / total) * 100).toFixed(1).padStart(5)} %  ${k}`);
}

/** Temps inclusif (fonction et tout ce qu'elle appelle), par fonction de nos propres sources. */
function inclusive(profile, top = Number(arg("top") ?? 40)) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const tot = new Map();
  profile.samples.forEach((id, i) => {
    const seen = new Set();
    for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
      const f = byId.get(cur).callFrame;
      // --all : toutes les fonctions du paquet (page autonome construite avec --minify false).
      if (!(arg("all") ? /\/assets\//.test(f.url) && f.functionName : /\/src\/|getScreenCTM|getBoundingClientRect|getComputedStyle|commitRoot|renderRootSync|performSyncWorkOnRoot/.test(f.url + f.functionName))) continue;
      const key = `${f.functionName || "(anonyme)"}  ${path.basename((f.url || "").split("?")[0])}:${f.lineNumber + 1}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tot.set(key, (tot.get(key) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000);
    }
  });
  return [...tot.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, ms]) => `${ms.toFixed(1).padStart(8)} ms  ${k}`);
}

/** Qui appelle une fonction native coûteuse (getScreenCTM…) : temps par chaîne d'appelants. */
function callers(profile, fn, depth = 4) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const tot = new Map();
  profile.samples.forEach((id, i) => {
    if (byId.get(id).callFrame.functionName !== fn) return;
    const chain = [];
    for (let cur = parent.get(id); cur !== undefined && chain.length < depth; cur = parent.get(cur)) {
      const f = byId.get(cur).callFrame;
      chain.push(`${f.functionName || "(anonyme)"}:${f.lineNumber + 1}`);
    }
    const key = chain.join(" < ");
    tot.set(key, (tot.get(key) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000);
  });
  return [...tot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, ms]) => `${ms.toFixed(1).padStart(8)} ms  ${k}`);
}

async function main() {
  let server = null;
  let baseUrl = arg("url") ?? (arg("site") ? new URL(arg("site")).origin : undefined);
  if (!baseUrl) {
    const dir = arg("static");
    if (!dir) throw new Error("--static <build storybook> ou --url <storybook>");
    server = await serveStatic(path.resolve(dir));
    baseUrl = server.url;
  }
  // Page autonome (perf/app, construite par scripts/vite.bench.config.mjs) par défaut ; une
  // Storybook seulement si le dossier ou l'URL en est une (index.json présent).
  let entry = { id: null };
  const indexRes = arg("site") ? null : await fetch(`${baseUrl}/index.json`).catch(() => null);
  if (indexRes?.ok) {
    const index = await indexRes.json();
    entry = Object.values(index.entries ?? {}).find((e) => e.title === STORY_TITLE && e.type === "story");
    if (!entry) throw new Error(`Story introuvable : ${STORY_TITLE}`);
  } else await waitForHttp(`${baseUrl}/index.html`, 120_000);

  const cdpPort = 9400 + Math.floor(Math.random() * 400);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "hover-bench-"));
  // --headful : un vrai Chrome avec la carte graphique (fenêtre ouverte hors de l'écran), au lieu du
  // mode sans interface — dont le rendu logiciel n'est pas celui d'un navigateur d'utilisateur.
  const display = arg("headful") ? ["--window-position=-2400,0", "--window-size=1600,1500"] : ["--headless=new"];
  const chrome = spawn(CHROME, [...display, "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--disable-extensions", `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${userDataDir}`, "about:blank"], { stdio: "ignore" });
  const cleanup = () => {
    try { chrome.kill(); } catch { /* déjà fermé */ }
    server?.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* tant pis */ }
  };
  process.on("exit", cleanup);

  const pan = Boolean(arg("pan"));
  const conn = pan
    ? await connect(cdpPort, Number(arg("width") ?? 412), Number(arg("height") ?? 915), { dpr: Number(arg("dpr") ?? 3) })
    : await connect(cdpPort, 1600, Number(arg("height") ?? 1500));
  const { page, close } = conn;
  const opts = { steps: Number(arg("steps") ?? 400), gap: Number(arg("gap") ?? 8), profile: Boolean(arg("profile")), trace: Boolean(arg("trace")), css: arg("css"), js: arg("js"), site: arg("site"), before: arg("before"), pan };
  const throttles = String(arg("throttles") ?? "1,4,6").split(",").map(Number);
  const scenarios = [];
  for (const throttle of throttles) {
    scenarios.push({ name: "5 panneaux, espace de travail", panes: 5, workspace: true, throttle });
    if (!opts.profile && !opts.trace) scenarios.push({ name: "sans panneau, espace de travail", panes: 0, workspace: true, throttle });
    // La page lourde (trois colonnes) n'a pas de sens sur un téléphone.
    if (!opts.profile && !opts.pan) scenarios.push({ name: "5 panneaux, page lourde", panes: 5, workspace: true, page: true, throttle });
  }
  if (arg("heavy")) scenarios.splice(0, scenarios.length, ...throttles.map((throttle) => ({ name: "5 panneaux, page lourde", panes: 5, workspace: true, page: true, throttle })));
  const results = [];
  for (const sc of scenarios) {
    const { r, profile, trace } = await runScenario(conn, baseUrl, entry.id, sc, opts);
    results.push(r);
    console.log(
      `${sc.name.padEnd(32)} ×${sc.throttle}  mvts ${String(r.moves).padStart(3)}  occupé ${(r.busyShare * 100).toFixed(0).padStart(3)} %  ${r.busyMsPerMove.toFixed(1).padStart(5)} ms/mvt  traitement p50/p95 ${r.handlerP50.toFixed(1)}/${r.handlerP95.toFixed(1)} ms  ${r.fps.toFixed(0).padStart(3)} i/s  image p95 ${r.frameP95.toFixed(0)} ms  mvt→image p95 ${r.latP95.toFixed(0)} ms  longues ${r.longTasks}`,
    );
    if (trace) console.log(trace.map(([k, ms]) => `${(ms / r.moves).toFixed(2).padStart(8)} ms/mvt  ${k}`).join("\n"));
    if (profile) console.log(hotspots(profile).join("\n") + "\n--- inclusif ---\n" + inclusive(profile).join("\n"));
    if (profile && arg("callers")) console.log(`--- appelants de ${arg("callers")} ---\n` + callers(profile, String(arg("callers"))).join("\n"));
  }
  close();
  cleanup();
  const out = arg("out");
  if (out) fs.writeFileSync(out, JSON.stringify({ label: arg("label") ?? null, date: new Date().toISOString(), opts, results }, null, 2));
}

main().catch((err) => {
  console.error(err.stack ?? err.message);
  process.exit(1);
});
