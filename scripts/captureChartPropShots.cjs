/* Captures one illustration per visually-demonstrable CandlestickChart prop, for the props
 * reference modal (`ChartPropsModal`).
 *
 * The pictures are real renders, not drawings: it navigates a headless Chrome to the
 * "Captures de props" Storybook story once per prop (see `propShots/PropShot.stories.tsx`),
 * screenshots the chart, and writes a JPEG under `propShots/images/`. Same reasoning as the
 * indicator diagrams under `diagrams/images/` — a screenshot of the real component stays true as
 * the component evolves, where a hand-drawn mock quietly rots.
 *
 * Deliberately dependency-free: it drives Chrome over the DevTools Protocol using Node's own
 * global WebSocket rather than adding Puppeteer/Playwright to a library that would otherwise
 * never need a browser at build time.
 *
 *   node scripts/captureChartPropShots.cjs                  # starts its own Storybook
 *   node scripts/captureChartPropShots.cjs --url http://localhost:6006   # reuses a running one
 *   node scripts/captureChartPropShots.cjs --only showVolume,replay      # a subset
 */
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SHOTS_DIR = path.join(ROOT, "src/components/charts/candlestick/propShots");
const IMAGES_DIR = path.join(SHOTS_DIR, "images");
const STORY_TITLE = "Charts/CandlestickChart/Captures de props";
const STORY_ID_FALLBACK = "charts-candlestickchart-captures-de-props--shot";

/** JPEG quality and the widest output we keep. A card in the modal is ~520 CSS px wide, so
 *  ~900px covers a 2x display with room to spare; beyond that we would only be shipping bytes
 *  nobody can see. Anything narrower than this is captured 1:1 rather than upscaled. */
const TARGET_WIDTH = 900;
const JPEG_QUALITY = 80;

/** The story's own frame, mirrored from PropShot.stories.tsx. Only used to turn a variant's
 *  fractional `crop` into pixels — the real element is measured in the page. */
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

/** The variant table lives in TypeScript, next to the story that renders it, because that is
 *  where it belongs — but this script is plain Node. Rather than adding a TS loader, we read the
 *  ids and crops back out of the source. It is a narrow, well-defined extraction (top-level keys
 *  and their optional `crop:` literal) and it fails loudly if the file's shape ever changes. */
function readVariants() {
  const src = fs.readFileSync(path.join(SHOTS_DIR, "propShotVariants.ts"), "utf8");
  const toJson = (literal) => JSON.parse(literal.replace(/(\w+):/g, '"$1":').replace(/,\s*\}/, "}"));

  // Crops are written as named constants (HEADER_LEFT, LEFT_RAIL…) so the table stays readable;
  // collect them first so a `crop:` can be resolved against either a name or an inline literal.
  const named = {};
  for (const m of src.matchAll(/^const (\w+) = (\{ *x:[^}]*\});$/gm)) named[m[1]] = toJson(m[2]);

  const body = src.slice(src.indexOf("export const PROP_SHOT_VARIANTS"));
  const variants = [];
  // Top-level entries are the only ones opening at exactly two spaces of indentation.
  for (const m of body.matchAll(/\n {2}(\w+): \{\n([\s\S]*?)\n {2}\},/g)) {
    const [, id, entry] = m;
    const crop = entry.match(/crop: (\w+|\{[^}]*\})/);
    const caption = entry.match(/caption: "((?:[^"\\]|\\.)*)"/);
    if (!caption) throw new Error(`No caption on variant "${id}"`);
    variants.push({ id, caption: caption[1], crop: crop ? (named[crop[1]] ?? toJson(crop[1])) : null });
  }
  if (!variants.length) throw new Error("No variants parsed out of propShotVariants.ts");
  const unresolved = variants.filter((v) => v.crop && typeof v.crop.width !== "number");
  if (unresolved.length) throw new Error(`Unresolved crop for: ${unresolved.map((v) => v.id).join(", ")}`);
  return variants;
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

/** A minimal CDP client: one socket, one session, promise per command. */
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
  // Storybook's dev server is aggressive about caching its own module graph; a capture run right
  // after an edit would otherwise screenshot the previous build.
  await page("Network.setCacheDisabled", { cacheDisabled: true });
  await page("Emulation.setDeviceMetricsOverride", {
    width: 1280, height: 940, deviceScaleFactor: 2, mobile: false,
  });
  return { page, close: () => ws.close() };
}

async function evaluate(page, expression) {
  const { result, exceptionDetails } = await page("Runtime.evaluate", {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.text ?? "evaluate failed");
  return result.value;
}

/** Waits for the chart to have actually painted: the frame is in the DOM, its canvas carries
 *  something other than a flat background, and web fonts have settled (a screenshot taken before
 *  that shows the fallback typeface). */
async function waitForChart(page, id, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const state = await evaluate(page, `(() => {
      const box = document.querySelector('[data-prop-shot=${JSON.stringify(id)}]');
      if (!box) return { ready: false, why: 'no frame' };
      const canvas = box.querySelector('canvas');
      if (!canvas || !canvas.width) return { ready: false, why: 'no canvas' };
      const ctx = canvas.getContext('2d');
      const { data } = ctx.getImageData(0, 0, canvas.width, Math.min(canvas.height, 200));
      let distinct = 0;
      const seen = new Set();
      for (let i = 0; i < data.length; i += 4 * 97) {
        seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
        if (seen.size > 3) { distinct = seen.size; break; }
      }
      const r = box.getBoundingClientRect();
      return { ready: distinct > 3, why: 'blank canvas', rect: { x: r.x, y: r.y, width: r.width, height: r.height } };
    })()`);
    if (state?.ready) {
      await evaluate(page, "document.fonts.ready.then(() => true)");
      // One more frame after fonts settle, so any relayout they cause is included.
      await sleep(400);
      return state.rect;
    }
    if (Date.now() > deadline) throw new Error(`Chart never painted for "${id}" (${state?.why})`);
    await sleep(250);
  }
}

async function main() {
  const only = arg("only")?.split(",").map((s) => s.trim()).filter(Boolean);
  const variants = readVariants().filter((v) => !only || only.includes(v.id));
  if (only) {
    const missing = only.filter((id) => !variants.some((v) => v.id === id));
    if (missing.length) throw new Error(`Unknown variant(s): ${missing.join(", ")}`);
  }

  let storybook = null;
  let baseUrl = arg("url");
  if (!baseUrl) {
    const port = Number(arg("port") ?? 6070);
    baseUrl = `http://127.0.0.1:${port}`;
    console.log(`Starting Storybook on ${port}…`);
    storybook = spawn("npx", ["storybook", "dev", "-p", String(port), "--ci", "--no-open", "--quiet"], {
      cwd: ROOT, stdio: "ignore",
    });
    await waitForHttp(`${baseUrl}/index.json`, 180_000);
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

  const cdpPort = Number(arg("cdp-port") ?? 9330);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "prop-shots-"));
  const chrome = spawn(chromeBinary(), [
    ...CHROME_FLAGS,
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: "ignore" });

  const cleanup = () => {
    try { chrome.kill(); } catch { /* already gone */ }
    try { storybook?.kill(); } catch { /* already gone */ }
    // Chrome can still be flushing its profile as we tear down; the directory is a temp one
    // either way, so a failed delete is not worth failing the run over.
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* the OS will */ }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(130); });

  const { page, close } = await connect(cdpPort);
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  for (const variant of variants) {
    const url = `${baseUrl}/iframe.html?id=${storyId}&viewMode=story`
      + `&args=variant:${encodeURIComponent(variant.id)}`
      + `&globals=lqPalette:color;lqSurface:light`;
    await page("Page.navigate", { url });
    const rect = await waitForChart(page, variant.id);

    const c = variant.crop ?? { x: 0, y: 0, width: 1, height: 1 };
    const clip = {
      x: rect.x + c.x * rect.width,
      y: rect.y + c.y * rect.height,
      width: rect.width * c.width,
      height: rect.height * c.height,
      scale: Math.min(1, TARGET_WIDTH / (rect.width * c.width)),
    };
    const { data } = await page("Page.captureScreenshot", {
      format: "jpeg", quality: JPEG_QUALITY, clip, captureBeyondViewport: true,
    });
    const file = path.join(IMAGES_DIR, `${variant.id}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    const kb = (fs.statSync(file).size / 1024).toFixed(1);
    console.log(`  ${variant.id.padEnd(26)} ${Math.round(clip.width * clip.scale)}x${Math.round(clip.height * clip.scale)}  ${kb} KB`);
  }

  close();
  cleanup();
  console.log(`\n${variants.length} capture(s) written to ${path.relative(ROOT, IMAGES_DIR)}`);

  // Only a full run can regenerate the registry: a `--only` run has just the subset it captured,
  // and writing that would silently drop every other prop's illustration from the reference.
  if (only) {
    console.log("Registry left untouched (--only run) — re-run without --only to regenerate it.");
    return;
  }
  writeRegistry(readVariants());
}

/** The module `ChartPropsModal` loads: one static import per JPEG, plus the caption that goes
 *  under it. Generated rather than hand-maintained so an added variant cannot be captured and
 *  then forgotten — and kept separate from `propShotVariants.ts`, which drags a Storybook story,
 *  a 160-candle dataset and a pile of JSX behind it that the modal has no use for. */
function writeRegistry(variants) {
  const file = path.join(SHOTS_DIR, "propShotImages.ts");
  const lines = [
    "/* GENERATED FILE — do not edit by hand.",
    " * Run `node scripts/captureChartPropShots.cjs` to regenerate it and the images it points at.",
    " *",
    " * One illustration per visually-demonstrable prop of `CandlestickChart`, shown on that prop's",
    " * own card in `ChartPropsModal`. A prop absent from here has no picture, on purpose: its effect",
    " * is a callback or a format, and a screenshot of it would be a chart that looks like any other.",
    " *",
    " * Loaded through a dynamic `import()`, never a static one — Vite inlines every asset as a base64",
    " * data URI in library mode (see vite.config.lib.ts's own note on why), so a static import would",
    " * put all of this in the main bundle for a modal most consumers never open. */",
    "",
    ...variants.map((v) => `import ${v.id} from "./images/${v.id}.jpg";`),
    "",
    "export interface PropShotImage {",
    "  /** Already a data URI by the time it reaches a consumer — see the note above. */",
    "  src: string;",
    "  /** What the picture is showing, in a sentence. Rendered under the image. */",
    "  caption: string;",
    "}",
    "",
    "/** Keyed by prop name, matching `CHART_PROPS_REFERENCE`'s own `name`. */",
    "export const PROP_SHOT_IMAGES: Record<string, PropShotImage> = {",
    ...variants.map((v) => `  ${v.id}: { src: ${v.id}, caption: ${JSON.stringify(v.caption)} },`),
    "};",
    "",
  ];
  fs.writeFileSync(file, lines.join("\n"));
  console.log(`Registry written to ${path.relative(ROOT, file)} (${variants.length} entries)`);
}

function chromeBinary() {
  const explicit = arg("chrome") ?? process.env.CHROME_PATH;
  if (explicit) return explicit;
  for (const candidate of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    try {
      return execFileSync("which", [candidate], { encoding: "utf8" }).trim();
    } catch { /* try the next one */ }
  }
  throw new Error("No Chrome found — pass --chrome <path> or set CHROME_PATH.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
