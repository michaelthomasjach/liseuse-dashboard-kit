/* Generates `src/components/charts/candlestick/chartPropsReference.ts` from
 * `CandlestickChartProps.interface.ts`.
 *
 * Generated rather than hand-written because the interface's own doc comments are already the
 * truth: a second, hand-maintained copy would drift the first time a prop changed, and a props
 * reference that lies is worse than none. Run `node scripts/generateChartPropsReference.cjs` after
 * adding, removing or re-documenting a prop; the check below fails loudly if a new prop has no
 * group, so one can never quietly land in a junk drawer.
 */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "src/components/charts/candlestick/interfaces/CandlestickChartProps.interface.ts");
const TARGET = path.join(ROOT, "src/components/charts/candlestick/chartPropsReference.ts");

/** Which section each prop belongs to, in the order the sections should read. */
const GROUPS = [
  ["Données", ["data", "symbol", "events", "fundamentals", "lastCandleOpen", "livePrice"]],
  [
    "Taille et apparence",
    ["width", "height", "fillHeight", "margin", "className", "showVolume", "initialVisibleCandles", "YAutoScaling", "onYAutoScalingChange"],
  ],
  ["Mode d'affichage", ["defaultChartDisplayMode", "onChartDisplayModeChange", "renkoAtrPeriod"]],
  ["Formatage", ["formatDate", "formatPrice", "formatVolume"]],
  [
    "Navigation",
    ["zoomable", "fullscreenToggle", "isFullscreen", "onFullscreenChange", "timeframes", "timeframe", "onTimeframeChange", "seasonality", "replay"],
  ],
  ["Dessins", ["drawingTools", "defaultDrawings", "onDrawingsChange"]],
  ["Indicateurs", ["showIndicators", "defaultIndicators", "onIndicatorsChange", "customIndicators"]],
  ["Modèles", ["showTemplates", "defaultTemplates", "onTemplatesChange"]],
  ["Alertes", ["alerts", "onCreateAlert", "onUpdateAlert", "onDeleteAlert", "alertSoundOptions", "onPlaySound"]],
  [
    "Recherche de symbole",
    ["symbolSearch", "symbolSearchResults", "onSymbolSearchChange", "onSymbolSelect", "onAddSymbolOverlay", "defaultFavoriteSymbolIds", "onFavoriteSymbolIdsChange"],
  ],
  ["Synchronisation entre graphiques", ["syncedHoverDate", "onHoverDateChange", "syncedHoverPrice", "onHoverPriceChange", "linkable", "isLinked", "onLinkClick"]],
  ["Panneau latéral", ["sidePanel", "defaultSidePanelOpen", "onSidePanelOpenChange"]],
  [
    "Scripts",
    ["scripts", "onScriptsChange", "onScriptRunOutput", "onScriptAlert", "onEditScript", "onCreateScript", "onDeleteScript", "onCreateStrategyFromIndicator"],
  ],
];

const source = ts.createSourceFile(SOURCE, fs.readFileSync(SOURCE, "utf8"), ts.ScriptTarget.Latest, true);
const props = new Map();
source.forEachChild((node) => {
  if (!ts.isInterfaceDeclaration(node) || node.name.text !== "CandlestickChartProps") return;
  for (const member of node.members) {
    if (!ts.isPropertySignature(member) || !member.name) continue;
    const doc = (member.jsDoc || [])
      .map((d) => (typeof d.comment === "string" ? d.comment : (d.comment || []).map((c) => c.text).join("")))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    props.set(member.name.getText(source), {
      type: member.type ? member.type.getText(source).replace(/\s+/g, " ") : "unknown",
      required: !member.questionToken,
      doc,
    });
  }
});

const grouped = new Set(GROUPS.flatMap(([, names]) => names));
const ungrouped = [...props.keys()].filter((n) => !grouped.has(n));
const missing = [...grouped].filter((n) => !props.has(n));
if (ungrouped.length > 0) throw new Error(`Props sans groupe (ajoutez-les à GROUPS) : ${ungrouped.join(", ")}`);
if (missing.length > 0) throw new Error(`Props listées dans GROUPS mais absentes de l'interface : ${missing.join(", ")}`);
const undocumented = [...props].filter(([, p]) => !p.doc).map(([n]) => n);
if (undocumented.length > 0) throw new Error(`Props sans commentaire de doc : ${undocumented.join(", ")}`);

const q = (s) => JSON.stringify(s);
const body = GROUPS.map(
  ([title, names]) =>
    `  {\n    title: ${q(title)},\n    props: [\n` +
    names
      .map((n) => {
        const p = props.get(n);
        return `      { name: ${q(n)}, type: ${q(p.type)}, required: ${p.required}, doc: ${q(p.doc)} },`;
      })
      .join("\n") +
    `\n    ],\n  },`
).join("\n");

fs.writeFileSync(
  TARGET,
  `/* GÉNÉRÉ — ne pas éditer à la main.
 * Source : interfaces/CandlestickChartProps.interface.ts
 * Régénérer : node scripts/generateChartPropsReference.cjs
 */

/** One prop of \`CandlestickChartProps\`, as the in-app reference shows it. */
export interface ChartPropDoc {
  name: string;
  /** The declared TypeScript type, verbatim. */
  type: string;
  /** False for an optional prop — most of them; \`data\` is the only thing the chart cannot do without. */
  required: boolean;
  doc: string;
}

export interface ChartPropSection {
  title: string;
  props: ChartPropDoc[];
}

/** Every prop \`CandlestickChart\` accepts, grouped by what it is for. */
export const CHART_PROPS_REFERENCE: ChartPropSection[] = [
${body}
];
`,
  "utf8"
);
console.log(`${props.size} props écrites dans ${path.relative(ROOT, TARGET)}`);
