/* Invariant check for the isometric paint order (src/components/warehouse/warehousePaint.ts) and
 * the camera it serves (src/components/warehouse/warehouseIso.ts).
 *
 *   node scripts/checkPaintOrder.mjs
 *
 * Why this exists: the isometric view draws its depth by DOM order, and a wrong order does not
 * throw — a machine is simply drawn over the rack it is parked behind, or a rack's wall over the
 * one in front of it. That reads as "the 3D looks a bit off", not as a bug, which is how the CSS 3D
 * version this replaced shipped with walls missing their inner ends.
 *
 * What it asserts is what the order has to be true of, not what it happened to compute:
 *
 *   - every box is painted exactly once, whatever the input;
 *   - for boxes that do not overlap on the floor, A is painted before B whenever A is behind B —
 *     they share some x and A ends before B starts in y, or share some y and A ends before B starts
 *     in x — on rack rows, a pinwheel, machines in aisles, and on random layouts;
 *   - the rule's blind spot is safe: two boxes separated on *both* axes (diagonal neighbours) never
 *     overlap on screen, measured with the real camera, so leaving them unordered loses nothing;
 *   - the camera's own arithmetic round-trips: unproject(project(p)) = p, and the CSS strings are
 *     built from the same constants — a wall's local up maps to straight up on screen.
 *
 * TypeScript is bundled on the fly with esbuild, like checkSankeyLayout.mjs.
 */
import { build } from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");

const problems = [];
const check = (condition, message) => {
  if (!condition) problems.push(message);
};

async function load(entry, tag) {
  const outfile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), `${tag}-`)), "bundle.mjs");
  await build({ entryPoints: [path.join(ROOT, entry)], bundle: true, platform: "node", format: "esm", outfile, logLevel: "warning" });
  return import(pathToFileURL(outfile).href);
}

const { paintOrder } = await load("src/components/warehouse/warehousePaint.ts", "paint-check");
const { projectIso, unprojectIso, ISO_TRANSFORM, ISO_FRONT_WALL, ISO_SIDE_WALL, liftIso } = await load(
  "src/components/warehouse/warehouseIso.ts",
  "iso-check"
);

/** The relation the sort must respect, restated independently of the implementation. */
const behind = (a, b) => {
  const shareX = a.x < b.x + b.width && b.x < a.x + a.width;
  const shareY = a.y < b.y + b.height && b.y < a.y + a.height;
  return (shareX && a.y + a.height <= b.y) || (shareY && a.x + a.width <= b.x);
};

/** Every "behind" pair comes out in that order, and every box comes out once. */
function assertOrder(name, boxes) {
  const out = paintOrder(boxes);
  check(out.length === boxes.length && new Set(out).size === boxes.length, `${name}: ${boxes.length} in, ${out.length} out (${new Set(out).size} distinct)`);
  const at = new Map(out.map((box, i) => [box, i]));
  let violations = 0;
  for (const a of boxes) {
    for (const b of boxes) {
      if (a !== b && behind(a, b) && at.get(a) > at.get(b)) {
        violations += 1;
        if (violations <= 3) problems.push(`${name}: ${a.id} is behind ${b.id} but painted after it`);
      }
    }
  }
  return out;
}

const box = (id, x, y, width, height) => ({ id, x, y, width, height });

// ---- 1. Two rows of racks, as in the sample floor, plus machines in the aisles ----
const rows = [
  box("A1", 4, 4, 10, 2),
  box("A2", 4, 8, 10, 2),
  box("A3", 4, 12, 10, 2),
  box("B1", 18, 4, 10, 2),
  box("B2", 18, 8, 10, 2),
  box("B3", 18, 12, 10, 2),
  box("agv-in-aisle-A2-A3", 8, 10.4, 1.6, 1.2), // between A2's front and A3's back
  box("agv-behind-A1", 8, 2.4, 1.6, 1.2), // north of the A row: behind everything
  box("agv-east-of-B", 29, 9, 1.6, 1.2), // beyond the B row: in front of everything in its y
];
const rowOrder = assertOrder("rows", rows).map((b) => b.id);
const pos = (id) => rowOrder.indexOf(id);
check(pos("A1") < pos("A2") && pos("A2") < pos("A3"), `rows: A1 < A2 < A3 expected, got ${rowOrder.join(" ")}`);
check(pos("A2") < pos("agv-in-aisle-A2-A3") && pos("agv-in-aisle-A2-A3") < pos("A3"), `rows: the machine in the A2/A3 aisle must sit between them, got ${rowOrder.join(" ")}`);
check(pos("agv-behind-A1") < pos("A1"), `rows: a machine north of A1 is behind it, got ${rowOrder.join(" ")}`);
check(pos("agv-east-of-B") > pos("B2"), `rows: a machine east of B2 is in front of it, got ${rowOrder.join(" ")}`);
console.log(`rows        -> ${rowOrder.join(" ")}`);

// ---- 2. A pinwheel around a hole: the classic layout that defeats sorting by a single key ----
const pinwheel = [box("N", 0, 0, 3, 1), box("E", 3, 0, 1, 3), box("S", 1, 3, 3, 1), box("W", 0, 1, 1, 3)];
console.log(`pinwheel    -> ${assertOrder("pinwheel", pinwheel).map((b) => b.id).join(" ")}`);

// ---- 3. Overlapping footprints: no right answer, but every box once and no throw ----
const stacked = [box("under", 2, 2, 4, 4), box("over", 3, 3, 4, 4), box("same", 2, 2, 4, 4), box("bystander", 9, 2, 1, 1)];
const stackedOrder = assertOrder("overlapping", stacked).map((b) => b.id);
check(stackedOrder.indexOf("under") < stackedOrder.indexOf("over"), `overlapping: nearer (x + y) last expected, got ${stackedOrder.join(" ")}`);
console.log(`overlapping -> ${stackedOrder.join(" ")}`);

// ---- 4. Random non-overlapping layouts ----
let seed = 7;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
for (let round = 0; round < 40; round += 1) {
  const boxes = [];
  for (let tries = 0; tries < 400 && boxes.length < 60; tries += 1) {
    const candidate = box(`r${round}-${boxes.length}`, Math.floor(rand() * 40), Math.floor(rand() * 40), 1 + Math.floor(rand() * 8), 1 + Math.floor(rand() * 8));
    const overlaps = boxes.some((b) => candidate.x < b.x + b.width && b.x < candidate.x + candidate.width && candidate.y < b.y + b.height && b.y < candidate.y + candidate.height);
    if (!overlaps) boxes.push(candidate);
  }
  assertOrder(`random round ${round} (${boxes.length} boxes)`, boxes);
}
console.log("random      -> 40 layouts of up to 60 boxes");

// ---- 5. The blind spot is safe: diagonal neighbours never overlap on screen ----
// A box's picture spans, in screen x, from its far-left corner (x, y + height) to its far-right
// corner (x + width, y); height does not move screen x. B entirely −x and +y of A must end where
// A begins.
let diagonalOverlaps = 0;
for (let i = 0; i < 2000; i += 1) {
  const a = box("a", rand() * 30, rand() * 30, 0.5 + rand() * 10, 0.5 + rand() * 10);
  const bWidth = 0.5 + rand() * 10;
  const b = box("b", a.x - bWidth - rand() * 5, a.y + a.height + rand() * 5, bWidth, 0.5 + rand() * 10);
  const right = (p) => projectIso(p.x + p.width, p.y).x;
  const left = (p) => projectIso(p.x, p.y + p.height).x;
  if (right(b) > left(a) + 1e-9) diagonalOverlaps += 1;
}
check(diagonalOverlaps === 0, `diagonal neighbours overlapped on screen ${diagonalOverlaps} times`);
console.log(`diagonal    -> 2000 pairs, ${diagonalOverlaps} screen overlaps`);

// ---- 6. The camera round-trips, and the CSS agrees with it ----
for (let i = 0; i < 200; i += 1) {
  const p = { x: rand() * 2000 - 1000, y: rand() * 2000 - 1000 };
  const s = projectIso(p.x, p.y);
  const q = unprojectIso(s.x, s.y);
  check(Math.abs(q.x - p.x) < 1e-6 && Math.abs(q.y - p.y) < 1e-6, `round trip drifted at ${JSON.stringify(p)} -> ${JSON.stringify(q)}`);
}
const num = (s) => s.match(/-?\d+(\.\d+)?/g).map(Number);
const camera = num(ISO_TRANSFORM);
const sample = projectIso(3, 5);
check(Math.abs(camera[0] * 3 + camera[2] * 5 - sample.x) < 1e-5 && Math.abs(camera[1] * 3 + camera[3] * 5 - sample.y) < 1e-5, `ISO_TRANSFORM ${ISO_TRANSFORM} disagrees with projectIso`);
// A wall's local "up" (front: CSS y; side: CSS x) is a floor step that the camera must send straight
// up the screen, by the same amount projectIso lifts a height.
const front = num(ISO_FRONT_WALL);
const side = num(ISO_SIDE_WALL);
const lift = num(liftIso(1));
const up = (dx, dy) => projectIso(dx, dy);
for (const [name, dx, dy] of [
  ["front wall", front[2], front[3]],
  ["side wall", side[0], side[1]],
  ["liftIso", lift[0], lift[1]],
]) {
  const s = up(dx, dy);
  const expected = projectIso(0, 0, 1).y;
  check(Math.abs(s.x) < 1e-5 && Math.abs(s.y - expected) < 1e-5, `${name}: one unit of height goes to (${s.x.toFixed(4)}, ${s.y.toFixed(4)}), expected (0, ${expected.toFixed(4)})`);
}
console.log(`camera      -> ${ISO_TRANSFORM}; walls ${ISO_FRONT_WALL} / ${ISO_SIDE_WALL}`);

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 30)) console.error("  -", p);
  process.exit(1);
}
console.log("\nOrdre de peinture isométrique : toutes les invariantes tiennent.");
