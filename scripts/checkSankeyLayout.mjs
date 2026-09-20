/* Invariant check for the Sankey placement engine (src/components/charts/internal/sankeyLayout.ts).
 *
 *   node scripts/checkSankeyLayout.mjs
 *
 * Why this exists when the repo has no test runner: the layout is the one piece of this library
 * that is pure arithmetic with no visible failure mode. A ribbon that starts three pixels outside
 * the node it comes from looks like a slightly untidy diagram, not like a bug — and the two bugs
 * this caught on its first run (a column of twenty leaves whose gaps overflowed the plot at both
 * ends, and minimum-size clamps that made a node's ribbons add up to more than the node) had both
 * already been eyeballed and passed.
 *
 * It asserts what a Sankey has to be true of, not what it happened to compute: every node inside
 * the plot, every node's height exactly its value on the shared scale, no two nodes of a column
 * overlapping, and every ribbon landing inside the boxes at both of its ends. Plus the degenerate
 * inputs — a cycle, an unknown node id, a zero-size plot — which must degrade rather than throw.
 *
 * TypeScript is bundled on the fly with esbuild (already present, vite's own) rather than adding a
 * runner: one file in, one file out, no configuration to keep in step with tsconfig.
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

async function load() {
  const outfile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sankey-check-")), "bundle.mjs");
  await build({
    entryPoints: [path.join(ROOT, "src/components/charts/internal/sankeyLayout.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "warning",
  });
  return import(pathToFileURL(outfile).href);
}

const { sankeyLayout, sankeyRibbonPath, downstreamOf, upstreamOf } = await load();
const { SANKEY_BUDGET_NODES, SANKEY_BUDGET_LINKS, SANKEY_REVENUE_NODES, SANKEY_REVENUE_LINKS } = await (async () => {
  const outfile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sankey-data-")), "data.mjs");
  await build({
    entryPoints: [path.join(ROOT, "src/test-data/sankeySampleData.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "warning",
  });
  return import(pathToFileURL(outfile).href);
})();

/** Slack, in px, for the float arithmetic the relaxation passes accumulate. */
const EPS = 0.6;

/** Pairs of ribbons that visibly cross, measured on the drawn endpoints.
 *
 *  Only links spanning the same pair of columns are comparable, and after waypoint routing every
 *  link spans exactly one — so grouping by the source's column is the whole comparison. Two
 *  monotone ribbons over the same horizontal span cross precisely when their ends are inverted. */
function countDrawnCrossings(links) {
  const byColumn = new Map();
  for (const link of links) {
    const key = link.source.depth;
    if (!byColumn.has(key)) byColumn.set(key, []);
    byColumn.get(key).push(link);
  }
  let total = 0;
  for (const group of byColumn.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i];
        const b = group[j];
        if ((a.y0 - b.y0) * (a.y1 - b.y1) < 0) total += 1;
      }
    }
  }
  return total;
}

function run(name, nodes, links, width, height) {
  const layout = sankeyLayout(nodes, links, { width, height, nodeWidth: 12, nodePadding: 14 });
  console.log(
    `${name.padEnd(16)} ${String(width).padStart(4)}x${String(height).padStart(4)}  nodes=${layout.nodes.length} links=${layout.links.length} columns=${layout.columns.length} ky=${layout.ky.toFixed(4)} crossings=${layout.crossings}`
  );

  for (const n of layout.nodes) {
    check(Number.isFinite(n.x0) && Number.isFinite(n.y0) && Number.isFinite(n.y1), `${name}: NaN on node ${n.id}`);
    check(n.y0 >= -EPS && n.y1 <= height + EPS, `${name}: node ${n.id} outside [0,${height}] -> ${n.y0.toFixed(1)}..${n.y1.toFixed(1)}`);
    check(n.x0 >= -EPS && n.x1 <= width + EPS, `${name}: node ${n.id} outside x -> ${n.x0.toFixed(1)}..${n.x1.toFixed(1)}`);
    check(Math.abs(n.y1 - n.y0 - n.value * layout.ky) < 0.01, `${name}: node ${n.id} is not value*ky tall`);
  }

  for (const l of layout.links) {
    check(Number.isFinite(l.y0) && Number.isFinite(l.y1) && Number.isFinite(l.width), `${name}: NaN on link ${l.index}`);
    check(
      l.y0 - l.width / 2 >= l.source.y0 - EPS && l.y0 + l.width / 2 <= l.source.y1 + EPS,
      `${name}: ${l.source.id} -> ${l.target.id} leaves its source box`
    );
    check(
      l.y1 - l.width / 2 >= l.target.y0 - EPS && l.y1 + l.width / 2 <= l.target.y1 + EPS,
      `${name}: ${l.source.id} -> ${l.target.id} leaves its target box`
    );
    check(!sankeyRibbonPath(l).includes("NaN"), `${name}: NaN in the ribbon path of link ${l.index}`);
  }

  for (const column of layout.columns) {
    const sorted = [...column].sort((a, b) => a.y0 - b.y0);
    for (let i = 1; i < sorted.length; i += 1) {
      check(sorted[i].y0 >= sorted[i - 1].y1 - EPS, `${name}: ${sorted[i - 1].id} overlaps ${sorted[i].id}`);
    }
    // The stacking order must be the order that was computed to be crossing-free. If the two ever
    // disagree the diagram is drawn against an ordering nobody checked.
    for (let i = 1; i < column.length; i += 1) {
      check(column[i].y0 >= column[i - 1].y0 - EPS, `${name}: column ${column[i].depth} is drawn out of its own order`);
    }
  }

  // Crossings, counted on the geometry that actually gets drawn rather than on the layout's own
  // bookkeeping — two ribbons between the same columns cross exactly when one starts above the
  // other and ends below it. Cross-checked against `layout.crossings` so a bug in either shows up.
  const drawn = countDrawnCrossings(layout.links);
  check(
    drawn === layout.crossings,
    `${name}: reports ${layout.crossings} crossings but ${drawn} are drawn`
  );

  return { layout, drawn };
}

// A wide desktop chart, a phone-sized one, and a shallow three-column diagram.
// Both fixtures are trees, so zero crossings is not a hope, it is the contract — see the header
// of sankeyLayout.ts for why a tree always admits a crossing-free order and a general graph does
// not. Several plot sizes, because the ordering must not depend on how much room it is given.
const treeCases = [
  ["budget", SANKEY_BUDGET_NODES, SANKEY_BUDGET_LINKS, 900, 480],
  ["budget-narrow", SANKEY_BUDGET_NODES, SANKEY_BUDGET_LINKS, 320, 240],
  ["budget-tall", SANKEY_BUDGET_NODES, SANKEY_BUDGET_LINKS, 1400, 900],
  ["revenue", SANKEY_REVENUE_NODES, SANKEY_REVENUE_LINKS, 700, 320],
];
let budget = null;
for (const [name, nodes, links, w, h] of treeCases) {
  const { layout, drawn } = run(name, nodes, links, w, h);
  check(drawn === 0, `${name}: ${drawn} ribbon crossing(s) on tree-shaped data — that must be zero`);
  if (name === "budget") budget = layout;
}

// A node with two parents. Not a tree, so zero is not promised — but the ordering still has to do
// its job rather than leave the seed untouched.
const diamond = sankeyLayout(
  [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
    { id: "x", label: "X" },
    { id: "y", label: "Y" },
  ],
  [
    { source: "a", target: "x", value: 10 },
    { source: "a", target: "y", value: 6 },
    { source: "b", target: "x", value: 4 },
  ],
  { width: 400, height: 300 }
);
console.log(`diamond          crossings=${diamond.crossings}`);
check(diamond.crossings === 0, `the two-parent case should still reach zero here, got ${diamond.crossings}`);

const logement = budget.nodes.find((n) => n.id === "logement");
check(downstreamOf(logement).size === 10, `downstream(logement) should be itself + 9 leaves, got ${downstreamOf(logement).size}`);
check(upstreamOf(logement).size === 7, `upstream(logement) should be itself + budget + 5 sources, got ${upstreamOf(logement).size}`);

// A cycle must degrade, not hang or throw.
const cyclic = sankeyLayout(
  [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
    { id: "c", label: "C" },
  ],
  [
    { source: "a", target: "b", value: 10 },
    { source: "b", target: "c", value: 10 },
    { source: "c", target: "b", value: 4 },
  ],
  { width: 300, height: 200 }
);
check(cyclic.nodes.length === 3, "a cycle should keep every node");
console.log(`cyclic          columns -> ${cyclic.nodes.map((n) => `${n.id}@${n.depth}`).join(" ")}`);

check(sankeyLayout([], [], { width: 100, height: 100 }).links.length === 0, "empty input should lay out as empty");
check(
  sankeyLayout([{ id: "a", label: "A" }], [{ source: "a", target: "ghost", value: 5 }], { width: 100, height: 100 }).links.length === 0,
  "a link to an undeclared node should be dropped"
);
check(sankeyLayout(SANKEY_REVENUE_NODES, SANKEY_REVENUE_LINKS, { width: 0, height: 0 }).nodes.length === 0, "a zero-size plot should lay out as empty");

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 30)) console.error("  -", p);
  process.exit(1);
}
console.log("\nSankey layout: toutes les invariantes tiennent.");
