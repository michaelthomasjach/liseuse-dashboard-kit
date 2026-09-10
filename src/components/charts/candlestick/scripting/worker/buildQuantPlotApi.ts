/** Every name the real `plot` API answers to — see `buildPlotApi`. Kept as a list rather than
 *  derived from that module so this file has no reason to import it: what a `@quant` script gets
 *  is deliberately *not* a plot API, and building one just to disable it would be the wrong shape. */
const PLOT_METHODS = [
  "pane",
  "overlay",
  "signal",
  "point",
  "horizontal",
  "vertical",
  "table",
  "xy",
] as const;

/** The `plot` a `@quant` analysis or a `@report` is handed: every method throws, naming what that
 *  kind of script should do instead.
 *
 *  Neither has a pane or an overlay — that is what the decorator declares. The editor
 *  says so before the script runs (see `analyzeQuantPlotCalls`), and this is the same rule where
 *  it cannot be talked past. Throwing rather than silently ignoring: a call that quietly does
 *  nothing leaves the author watching an empty chart and wondering which of the two of them is
 *  broken.
 *
 *  A Proxy rather than the fixed list alone, so a method added to the real API later is refused
 *  here too instead of coming back `undefined` — a `TypeError: plot.newThing is not a function`
 *  says much less than the message below. */
export function buildQuantPlotApi(kind: "quant" | "report" = "quant"): Record<string, unknown> {
  const what = kind === "quant" ? "Une analyse @quant" : "Un rapport @report";
  const instead = kind === "quant" ? "Renvoyez vos résultats avec « return » à la place." : "Écrivez le rapport avec « report.* » à la place.";
  const refuse = (name: string) => () => {
    throw new Error(`${what} n'affiche rien sur le graphique : « plot.${name} » n'y est pas disponible. ${instead}`);
  };
  const base: Record<string, unknown> = {};
  for (const name of PLOT_METHODS) base[name] = refuse(name);
  return new Proxy(base, {
    get(target, prop) {
      if (typeof prop !== "string") return undefined;
      return target[prop] ?? refuse(prop);
    },
  });
}
