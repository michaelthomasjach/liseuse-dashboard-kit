/* Captures one illustration per indicator and per drawing tool, for the info modals behind the
 * "?" icons in the "Ajouter un indicateur" picker and the drawing-tool menus.
 *
 * The pictures are the real component, screenshotted — not drawings of it. That distinction is
 * the whole point: a hand-drawn diagram can only be as right as whoever drew it, it rots quietly
 * as the renderer evolves, and it leaves the reader looking at a picture *of* a Fibonacci
 * retracement rather than at one. A capture cannot drift, because it is the thing.
 *
 * It navigates a headless Chrome to `diagramShots/DiagramShot.stories.tsx` once per variant,
 * screenshots the `[data-diagram-shot]` box and writes a JPEG under `diagrams/images/`, then
 * regenerates `diagrams/diagramShotImages.ts` — the module both diagram registries read.
 *
 * Deliberately dependency-free, same as `captureChartPropShots.cjs`: it drives Chrome over the
 * DevTools Protocol using Node's own global WebSocket rather than adding Puppeteer or Playwright
 * to a library that would otherwise never need a browser at build time.
 *
 *   node scripts/captureDiagramShots.cjs                                 # starts its own Storybook
 *   node scripts/captureDiagramShots.cjs --url http://localhost:6006     # reuses a running one
 *   node scripts/captureDiagramShots.cjs --only drawing-pin,indicator-rsi
 *
 * On Windows, or anywhere `which` cannot find Chrome, pass --chrome <path> or set CHROME_PATH.
 */
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DIAGRAMS_DIR = path.join(ROOT, "src/components/charts/candlestick/diagrams");
const IMAGES_DIR = path.join(DIAGRAMS_DIR, "images");
const STORY_TITLE = "Charts/CandlestickChart/Captures de diagrammes";
const STORY_ID_FALLBACK = "charts-candlestickchart-captures-de-diagrammes--shot";

/** JPEG quality and the widest output we keep.
 *
 *  These sit full-bleed across a "wide" modal — about 620 CSS px — so 1000 still covers a 2x
 *  display with a little room. The numbers matter more here than for most assets: every one is
 *  inlined as base64 (see diagramShot.tsx), and sixty-nine of them at 1200/82 came to 9.5 MB of
 *  chunk. At 1000/72 they come to roughly half that, with no difference visible at the size they
 *  are actually shown. */
const TARGET_WIDTH = 1000;
const JPEG_QUALITY = 72;

const CHROME_FLAGS = [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-extensions",
  "--force-device-scale-factor=1",
];

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The variant table lives in TypeScript next to the story that renders it, and this script is
 *  plain Node. Rather than parsing it — brittle, and it has computed entries — the story publishes
 *  its own id list on `window`, and we read it from the page. A variant added to the table
 *  therefore cannot be captured-and-forgotten. Crops come the same way. */
async function readVariants(page, baseUrl, storyId) {
  await page("Page.navigate", { url: shotUrl(baseUrl, storyId, "indicator-sma") });
  const deadline = Date.now() + 60_000;
  for (;;) {
    const ids = await evaluate(page, "window.__DIAGRAM_SHOT_IDS__ ?? null");
    if (Array.isArray(ids) && ids.length) return ids;
    if (Date.now() > deadline) throw new Error("The story never published __DIAGRAM_SHOT_IDS__");
    await sleep(400);
  }
}

function shotUrl(baseUrl, storyId, id) {
  return (
    `${baseUrl}/iframe.html?id=${storyId}&viewMode=story` +
    `&args=variant:${encodeURIComponent(id)}` +
    `&globals=lqPalette:color;lqSurface:light`
  );
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      /* not listening yet */
    }
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${url}`);
    await sleep(400);
  }
}

/** A minimal CDP client: one socket, one session, a promise per command. */
async function connect(port) {
  const version = await (await waitForHttp(`http://127.0.0.1:${port}/json/version`, 20_000)).json();
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
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
  await page("Network.enable");
  // Storybook's dev server caches its own module graph hard; a run right after an edit would
  // otherwise screenshot the previous build.
  await page("Network.setCacheDisabled", { cacheDisabled: true });
  await page("Emulation.setDeviceMetricsOverride", {
    width: 1320,
    height: 900,
    deviceScaleFactor: 2,
    mobile: false,
  });
  return { page, close: () => ws.close() };
}

async function evaluate(page, expression) {
  const { result, exceptionDetails } = await page("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text ?? "evaluate failed");
  return result.value;
}

/** Waits for the chart to have actually painted: the frame is in the DOM, its canvas carries more
 *  than a flat background, and web fonts have settled (a shot taken before that shows the fallback
 *  typeface). Returns the frame's own rect, and the crop the variant asked for. */
async function waitForChart(page, id, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const state = await evaluate(
      page,
      `(() => {
      const box = document.querySelector('[data-diagram-shot=${JSON.stringify(id)}]');
      if (!box) return { ready: false, why: 'no frame' };
      const canvas = box.querySelector('canvas');
      if (!canvas || !canvas.width) return { ready: false, why: 'no canvas' };
      const ctx = canvas.getContext('2d');
      const { data } = ctx.getImageData(0, 0, canvas.width, Math.min(canvas.height, 240));
      const seen = new Set();
      for (let i = 0; i < data.length; i += 4 * 97) {
        seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
        if (seen.size > 3) break;
      }
      const r = box.getBoundingClientRect();
      return { ready: seen.size > 3, why: 'blank canvas', rect: { x: r.x, y: r.y, width: r.width, height: r.height } };
    })()`,
    );
    if (state?.ready) {
      await evaluate(page, "document.fonts.ready.then(() => true)");
      // One more frame after fonts settle, so any relayout they cause is included.
      await sleep(450);
      return state.rect;
    }
    if (Date.now() > deadline) throw new Error(`Chart never painted for "${id}" (${state?.why})`);
    await sleep(250);
  }
}

/** The region to capture, resolved *in the page* rather than guessed here.
 *
 *  "plot" means "everything below the chart's own header", and the header's height is measured
 *  from the live DOM instead of being approximated as a fraction of the frame. It was a fraction
 *  first, and it cost a whole afternoon: 12% overshot the real header by a dozen pixels and
 *  quietly sliced the top off any indicator that plotted near the high of the range. */
async function readClip(page, id) {
  return evaluate(
    page,
    `(() => {
      const box = document.querySelector('[data-diagram-shot=${JSON.stringify(id)}]');
      if (!box) return null;
      const r = box.getBoundingClientRect();
      const crop = window.__DIAGRAM_SHOT_CROPS__?.[${JSON.stringify(id)}];
      if (crop === 'plot') {
        const header = box.querySelector('.lq-chart__header');
        const top = header ? header.getBoundingClientRect().bottom : r.top;
        return { x: r.x, y: top, width: r.width, height: r.bottom - top };
      }
      if (!crop) return { x: r.x, y: r.y, width: r.width, height: r.height };
      return {
        x: r.x + crop.x * r.width,
        y: r.y + crop.y * r.height,
        width: r.width * crop.width,
        height: r.height * crop.height,
      };
    })()`,
  );
}

/** "measure" is deliberately never stored among the drawings, so it cannot be seeded as data the
 *  way every other tool is. The only way to photograph it is to use it: pick the tool up off the
 *  rail, then click the two points a person would.
 *
 *  Every step is checked, and a failed step throws. The first version of this clicked hopefully
 *  and captured whatever was on screen, which turned out to be an empty chart — and an empty
 *  capture is worse than a missing one, because nothing about it looks wrong. */
async function driveMeasure(page, id) {
  const armed = await evaluate(
    page,
    `(() => {
      const btn = [...document.querySelectorAll('button[aria-label]')]
        .find((b) => b.getAttribute('aria-label') === 'Mesure');
      if (!btn) return 'no button';
      btn.click();
      return null;
    })()`,
  );
  if (armed) throw new Error(`Measure tool: ${armed}`);
  await sleep(300);
  await page("Emulation.setFocusEmulationEnabled", { enabled: true });
  await page("Page.bringToFront");

  const pressed = await evaluate(
    page,
    `document.querySelector('button[aria-label="Mesure"]')?.getAttribute('aria-pressed') ?? null`,
  );
  if (pressed !== "true") throw new Error(`Measure tool did not arm (aria-pressed=${pressed})`);

  // Points come from `.lq-chart__overlay` — the rect that actually carries the click handler —
  // not from the frame or even the canvas. The canvas sits behind the axis gutters, so a fraction
  // of *it* lands somewhere the overlay does not cover, and the click goes nowhere.
  const plot = await evaluate(
    page,
    `(() => {
      const box = document.querySelector('[data-diagram-shot=${JSON.stringify(id)}]');
      const overlay = box?.querySelector('.lq-chart__overlay');
      if (!overlay) return null;
      const r = overlay.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()`,
  );
  if (!plot) throw new Error("Measure tool: no .lq-chart__overlay to click in");

  // Two real clicks, through CDP, at the overlay's own measured coordinates.
  //
  // Three details, each of which cost a run to find. The page needs focus emulation and to be
  // brought to front, or CDP's input events are delivered to a page that considers itself
  // unfocused and nothing reaches the handler at all. The coordinates have to come from
  // `.lq-chart__overlay` rather than from the frame, because the frame includes the header and the
  // tool rail and the same fraction lands somewhere different with them than without. And the two
  // clicks have to be a round trip apart: the tool keeps its first point in React state and reads
  // it back on the second click, so fired inside one evaluate both run against the same render,
  // the second sees no pending point, files itself as the first all over again, and no measurement
  // is ever placed.
  const clickAt = async (fx, fy) => {
    const x = plot.x + plot.width * fx;
    const y = plot.y + plot.height * fy;
    await page("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
    await sleep(80);
    await page("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
    await sleep(60);
    await page("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
    await sleep(400);
  };

  await clickAt(0.3, 0.68);
  await clickAt(0.68, 0.3);

  // The tool disarms itself once the second point lands (unlike every other tool, which stays
  // active) — so this is the post-condition that says the measurement actually exists.
  const stillArmed = await evaluate(
    page,
    `document.querySelector('button[aria-label="Mesure"]')?.getAttribute('aria-pressed') ?? null`,
  );
  if (stillArmed !== "false") throw new Error("Measure tool never completed — no measurement was placed");

  // Park the cursor away from the measurement so no hover highlight sits on top of it.
  await page("Input.dispatchMouseEvent", { type: "mouseMoved", x: plot.x + 4, y: plot.y + 4, buttons: 0 });
  await sleep(400);
}

async function main() {
  const only = arg("only")?.split(",").map((s) => s.trim()).filter(Boolean);

  let storybook = null;
  let baseUrl = arg("url");
  if (!baseUrl) {
    const port = Number(arg("port") ?? 6071);
    baseUrl = `http://127.0.0.1:${port}`;
    console.log(`Starting Storybook on ${port}…`);
    storybook = spawn("npx", ["storybook", "dev", "-p", String(port), "--ci", "--no-open", "--quiet"], {
      cwd: ROOT,
      stdio: "ignore",
      shell: process.platform === "win32",
    });
    await waitForHttp(`${baseUrl}/index.json`, 240_000);
  }

  // Ask the running Storybook for the story's real id rather than trusting a hand-derived slug.
  let storyId = STORY_ID_FALLBACK;
  try {
    const index = await (await fetch(`${baseUrl}/index.json`)).json();
    const entry = Object.values(index.entries ?? {}).find((e) => e.title === STORY_TITLE);
    if (entry) storyId = entry.id;
  } catch {
    console.warn(`Could not read index.json; falling back to "${STORY_ID_FALLBACK}"`);
  }

  const cdpPort = Number(arg("cdp-port") ?? 9331);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "diagram-shots-"));
  const chrome = spawn(
    chromeBinary(),
    [...CHROME_FLAGS, `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${userDataDir}`, "about:blank"],
    { stdio: "ignore" },
  );

  const cleanup = () => {
    try { chrome.kill(); } catch { /* already gone */ }
    try { storybook?.kill(); } catch { /* already gone */ }
    // Chrome may still be flushing its profile; it is a temp directory either way, so a failed
    // delete is not worth failing the run over.
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* the OS will */ }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(130); });

  const { page, close } = await connect(cdpPort);
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const allIds = await readVariants(page, baseUrl, storyId);
  if (only) {
    const missing = only.filter((id) => !allIds.includes(id));
    if (missing.length) throw new Error(`Unknown variant(s): ${missing.join(", ")}`);
  }
  const ids = only ? allIds.filter((id) => only.includes(id)) : allIds;
  console.log(`${ids.length} variant(s) to capture.\n`);

  const failures = [];
  for (const id of ids) {
    try {
      await page("Page.navigate", { url: shotUrl(baseUrl, storyId, id) });
      const rect = await waitForChart(page, id);
      if (id === "drawing-measure") await driveMeasure(page, id);

      const region = (await readClip(page, id)) ?? rect;
      const clip = { ...region, scale: Math.min(1, TARGET_WIDTH / region.width) };
      const { data } = await page("Page.captureScreenshot", {
        format: "jpeg",
        quality: JPEG_QUALITY,
        clip,
        captureBeyondViewport: true,
      });
      const file = path.join(IMAGES_DIR, `${id}.jpg`);
      fs.writeFileSync(file, Buffer.from(data, "base64"));
      const kb = (fs.statSync(file).size / 1024).toFixed(1);
      console.log(`  ${id.padEnd(34)} ${Math.round(clip.width * clip.scale)}x${Math.round(clip.height * clip.scale)}  ${kb} KB`);
    } catch (err) {
      failures.push({ id, message: err.message });
      console.log(`  ${id.padEnd(34)} FAILED — ${err.message}`);
    }
  }

  close();
  cleanup();
  console.log(`\n${ids.length - failures.length}/${ids.length} capture(s) written to ${path.relative(ROOT, IMAGES_DIR)}`);
  if (failures.length) {
    // Loud, and non-zero: a missing picture is a modal with a hole in it, and silently carrying on
    // would leave the registry pointing at a file that is not there.
    console.error(`\n${failures.length} failure(s):`);
    for (const f of failures) console.error(`  ${f.id}: ${f.message}`);
    process.exitCode = 1;
    return;
  }

  // Only a full run can regenerate the registry: a --only run knows just its own subset, and
  // writing that would drop every other illustration from both modals.
  if (only) {
    console.log("Registry left untouched (--only run) — re-run without --only to regenerate it.");
    return;
  }
  writeRegistry(allIds);
}

/** The module both diagram registries read: one static import per JPEG, keyed by variant id.
 *  Generated rather than hand-maintained so a captured variant cannot be forgotten. */
function writeRegistry(ids) {
  const identifier = (id) => id.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase()).replace(/-/g, "_");
  const file = path.join(DIAGRAMS_DIR, "diagramShotImages.ts");
  const lines = [
    "/* GENERATED FILE — do not edit by hand.",
    " * Run `node scripts/captureDiagramShots.cjs` to regenerate it and the images it points at.",
    " *",
    " * One real screenshot per indicator and per drawing tool, shown at the top of that thing's own",
    " * info modal. Every entry is a capture of the component actually rendering it — see",
    " * `diagramShots/diagramShotVariants.ts` for the configuration behind each one, and that file's",
    " * own doc for why these are captures rather than drawings. */",
    "",
    ...ids.map((id) => `import ${identifier(id)} from "./images/${id}.jpg";`),
    "",
    "/** Keyed by `indicator-<kind>` / `drawing-<tool>`, matching the capture script's own ids. */",
    "export const DIAGRAM_SHOT_IMAGES: Record<string, string> = {",
    ...ids.map((id) => `  ${JSON.stringify(id)}: ${identifier(id)},`),
    "};",
    "",
  ];
  fs.writeFileSync(file, lines.join("\n"));
  console.log(`Registry written to ${path.relative(ROOT, file)} (${ids.length} entries)`);
}

function chromeBinary() {
  const explicit = arg("chrome") ?? process.env.CHROME_PATH;
  if (explicit) return explicit;
  for (const candidate of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    try {
      return execFileSync("which", [candidate], { encoding: "utf8" }).trim();
    } catch { /* try the next one */ }
  }
  // Windows has no `which` and installs Chrome somewhere predictable.
  for (const candidate of [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error("No Chrome found — pass --chrome <path> or set CHROME_PATH.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
