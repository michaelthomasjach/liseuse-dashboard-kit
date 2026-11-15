import type { AiTool } from "./aiTools";
import type { AiChartContext } from "./interfaces/AiChartContext.interface";
import type { AiWorkspaceControls } from "./interfaces/AiWorkspaceControls.interface";
import { fail, num, ok, str } from "./toolHelpers";
import { wait } from "./uiControl";

/**
 * Outils de l'espace de travail (`ChartWorkspace`) : disposition de la grille, symbole et unité de temps de chaque
 * fenêtre, fenêtre active (celle sur laquelle agissent les autres outils), fenêtre agrandie, et synchronisation des
 * fenêtres entre elles (groupes liés : réticule et plage de dates ; alignement du symbole ou de l'unité de temps).
 * Les fenêtres sont numérotées à partir de 1, comme à l'écran.
 */

function describeWorkspace(ws: AiWorkspaceControls): string {
  const panels = ws.panels();
  const target = ws.target?.() ?? 0;
  const focused = ws.focused?.() ?? null;
  const groups = ws.linkGroups?.() ?? [];
  const layout = ws.layouts?.().find((l) => l.id === ws.layoutId?.());
  return [
    `Disposition : ${layout ? `${layout.id} (${layout.panels} fenêtre(s)${layout.label ? `, ${layout.label}` : ""})` : `${panels.length} fenêtre(s)`}.`,
    ...panels.map((p) => `- Fenêtre ${p.index + 1} : ${p.symbol ?? "sans symbole"}${p.timeframe ? ` (${p.timeframe})` : ""}${p.index === target ? " — active (les outils agissent sur elle)" : ""}${p.index === focused ? " — agrandie" : ""}`),
    `Groupes liés (réticule et plage de dates) : ${groups.filter((g) => g.length >= 2).map((g) => g.map((i) => i + 1).join("+")).join(" ; ") || "aucun"}.`,
  ].join("\n");
}

const indexOf = (ws: AiWorkspaceControls, raw: number | undefined): number | null => {
  if (raw === undefined) return null;
  const i = Math.round(raw) - 1;
  return i >= 0 && i < ws.panels().length ? i : null;
};

const WINDOW_ACTIONS = ["lister", "disposition", "symbole", "unite_de_temps", "activer", "agrandir", "reduire", "ajouter"] as const;

const WINDOWS_TOOL: AiTool = {
  definition: {
    name: "gerer_les_fenetres",
    description:
      "L'espace de travail à plusieurs fenêtres : « lister » (disposition, symbole et unité de temps de chaque fenêtre, fenêtre active, groupes liés) ; « disposition » applique une disposition de la grille par son id (avec « symboles » facultatifs, un par fenêtre) ; « symbole » / « unite_de_temps » changent ceux d'une fenêtre ; « activer » met une fenêtre au premier plan : les autres outils (indicateurs, dessins, axes, navigation, paramètres…) agissent ensuite sur elle ; « agrandir » lui donne toute la grille, « reduire » revient à la grille ; « ajouter » ouvre une fenêtre de plus avec un symbole. Ex. : {action:\"disposition\", disposition:\"2-columns\", symboles:[\"AAPL\",\"MSFT\"]} ; {action:\"activer\", fenetre:2}.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: WINDOW_ACTIONS, description: "Ce qu'il faut faire." },
        disposition: { type: "string", description: "disposition : id de la disposition (ex. 1, 2-columns, 2-rows, 3-big-left, 4-grid, 6-grid-3x2, 8-grid-4x2 ; « lister » les donne toutes)." },
        symboles: { type: "array", items: { type: "string" }, maxItems: 8, description: "disposition : symbole de chaque fenêtre, dans l'ordre (facultatif)." },
        fenetre: { type: "number", minimum: 1, maximum: 8, description: "Numéro de la fenêtre (1 = la première)." },
        symbole: { type: "string", description: "symbole, ajouter : le ticker (ex. « ^FCHI »)." },
        unite_de_temps: { type: "string", description: "unite_de_temps : la valeur (une de celles de decrire_le_graphique)." },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  run: async (input, chart) => {
    const ws = chart.workspace;
    if (!ws) return fail("Ce graphique n'est pas dans un espace de travail à plusieurs fenêtres.");
    const action = str(input, "action");
    switch (action) {
      case "lister": {
        const layouts = ws.layouts?.() ?? [];
        return ok(`${describeWorkspace(ws)}\nDispositions possibles : ${layouts.map((l) => l.id).join(", ")}.`);
      }
      case "disposition": {
        const id = str(input, "disposition") ?? "";
        if (!ws.setLayout) return fail("Changer de disposition n'est pas possible ici.");
        const layout = ws.layouts?.().find((l) => l.id === id);
        if (!layout) return fail(`Disposition « ${id} » inconnue. Dispositions : ${(ws.layouts?.() ?? []).map((l) => l.id).join(", ")}.`);
        ws.setLayout(id);
        const symbols = (Array.isArray(input.symboles) ? input.symboles : []).filter((s): s is string => typeof s === "string" && s.trim() !== "");
        symbols.slice(0, layout.panels).forEach((s, i) => ws.setPanelSymbol?.(i, s.trim().toUpperCase()));
        await wait(120);
        return ok(describeWorkspace(ws));
      }
      case "symbole":
      case "unite_de_temps": {
        const i = indexOf(ws, num(input, "fenetre"));
        if (i === null) return fail(`Fenêtre inconnue : de 1 à ${ws.panels().length}.`);
        if (action === "symbole") {
          const symbol = str(input, "symbole")?.trim();
          if (!symbol || !ws.setPanelSymbol) return fail("Indiquez « symbole ».");
          ws.setPanelSymbol(i, symbol.toUpperCase());
        } else {
          const tf = str(input, "unite_de_temps");
          const ctx = ws.contextOf?.(i);
          if (!tf || !ws.setPanelTimeframe) return fail("Indiquez « unite_de_temps ».");
          if (ctx && ctx.availableTimeframes.length > 0 && !ctx.availableTimeframes.includes(tf)) return fail(`Unité de temps inconnue. Disponibles : ${ctx.availableTimeframes.join(", ")}.`);
          ws.setPanelTimeframe(i, tf);
        }
        await wait(120);
        return ok(`${describeWorkspace(ws)}\n(L'application charge les bougies de la fenêtre.)`);
      }
      case "activer": {
        const i = indexOf(ws, num(input, "fenetre"));
        if (i === null || !ws.setTarget) return fail(`Fenêtre inconnue : de 1 à ${ws.panels().length}.`);
        ws.setTarget(i);
        await wait(80);
        return ok(`Fenêtre ${i + 1} active : les outils agissent maintenant sur elle.\n${describeWorkspace(ws)}`);
      }
      case "agrandir":
      case "reduire": {
        if (!ws.setFocused) return fail("Agrandir une fenêtre n'est pas possible ici.");
        if (action === "reduire") ws.setFocused(null);
        else {
          const i = indexOf(ws, num(input, "fenetre")) ?? ws.target?.() ?? 0;
          ws.setFocused(i);
          ws.setTarget?.(i);
        }
        await wait(80);
        return ok(describeWorkspace(ws));
      }
      case "ajouter": {
        const symbol = str(input, "symbole")?.trim();
        if (!symbol) return fail("Indiquez « symbole ».");
        const i = ws.addPanel(symbol.toUpperCase());
        if (i === null) return fail(`L'espace a déjà ${ws.maxPanels} fenêtres.`);
        await wait(120);
        return ok(`Fenêtre ${i + 1} ajoutée avec ${symbol.toUpperCase()}.\n${describeWorkspace(ws)}`);
      }
      default:
        return fail(`Action inconnue. Actions : ${WINDOW_ACTIONS.join(", ")}.`);
    }
  },
};

const SYNC_TOOL: AiTool = {
  definition: {
    name: "synchroniser_les_fenetres",
    description:
      "Synchronise les fenêtres de l'espace de travail : « lier » des fenêtres (bouton chaîne : elles partagent le réticule et la plage de dates — déplacer ou zoomer l'une déplace les autres) ; « delier » (les groupes de ces fenêtres, ou tous) ; « aligner » le symbole ou l'unité de temps de fenêtres sur ceux d'une fenêtre source ; « lister » les groupes. Le replay est toujours commun à toutes les fenêtres. Ex. : {action:\"lier\", fenetres:[1,2]} ; {action:\"aligner\", quoi:\"unite_de_temps\", source:1}.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["lier", "delier", "aligner", "lister"], description: "Ce qu'il faut faire." },
        fenetres: { type: "array", items: { type: "number", minimum: 1, maximum: 8 }, description: "Numéros des fenêtres (défaut : toutes)." },
        quoi: { type: "string", enum: ["symbole", "unite_de_temps"], description: "aligner : ce qui est recopié." },
        source: { type: "number", minimum: 1, maximum: 8, description: "aligner : la fenêtre modèle (défaut 1)." },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  run: async (input, chart) => {
    const ws = chart.workspace;
    if (!ws) return fail("Ce graphique n'est pas dans un espace de travail à plusieurs fenêtres.");
    const count = ws.panels().length;
    const all = Array.from({ length: count }, (_, i) => i);
    const given = (Array.isArray(input.fenetres) ? input.fenetres : []).filter((n): n is number => typeof n === "number").map((n) => Math.round(n) - 1);
    const bad = given.filter((i) => i < 0 || i >= count);
    if (bad.length > 0) return fail(`Fenêtre(s) inconnue(s) : ${bad.map((i) => i + 1).join(", ")} (il y en a ${count}).`);
    const targets = given.length > 0 ? [...new Set(given)] : all;
    const action = str(input, "action");
    if (action === "lister") return ok(describeWorkspace(ws));
    if (action === "lier") {
      if (!ws.link) return fail("Lier des fenêtres n'est pas possible ici.");
      if (targets.length < 2) return fail("Il faut au moins deux fenêtres.");
      ws.link(targets);
      await wait(60);
      return ok(`Fenêtres ${targets.map((i) => i + 1).join(", ")} liées (réticule et plage de dates).\n${describeWorkspace(ws)}`);
    }
    if (action === "delier") {
      if (!ws.unlink) return fail("Délier n'est pas possible ici.");
      ws.unlink(given.length > 0 ? targets : undefined);
      await wait(60);
      return ok(describeWorkspace(ws));
    }
    if (action === "aligner") {
      const what = str(input, "quoi");
      const source = Math.round(num(input, "source") ?? 1) - 1;
      if (source < 0 || source >= count) return fail(`Fenêtre source inconnue : de 1 à ${count}.`);
      const from = ws.panels()[source];
      const others = targets.filter((i) => i !== source);
      if (what === "symbole") {
        if (!from.symbol || !ws.setPanelSymbol) return fail("La fenêtre source n'a pas de symbole.");
        others.forEach((i) => ws.setPanelSymbol!(i, from.symbol!));
      } else if (what === "unite_de_temps") {
        if (!from.timeframe || !ws.setPanelTimeframe) return fail("La fenêtre source n'a pas d'unité de temps.");
        others.forEach((i) => ws.setPanelTimeframe!(i, from.timeframe!));
      } else return fail("Indiquez « quoi » : symbole ou unite_de_temps.");
      await wait(120);
      return ok(`${what === "symbole" ? "Symbole" : "Unité de temps"} de la fenêtre ${source + 1} recopié(e) sur ${others.map((i) => i + 1).join(", ") || "aucune autre"}.\n${describeWorkspace(ws)}`);
    }
    return fail("Action inconnue : lier, delier, aligner ou lister.");
  },
};

export const WORKSPACE_TOOLS: AiTool[] = [WINDOWS_TOOL, SYNC_TOOL];

export function workspaceToolAvailable(name: string, chart: AiChartContext): boolean | undefined {
  if (!WORKSPACE_TOOLS.some((t) => t.definition.name === name)) return undefined;
  return chart.workspace?.setLayout !== undefined;
}

/** Les leviers ajoutés de l'espace de travail, relus à chaque appel (le graphique les recopie dans son contexte). */
export function forwardWorkspaceExtras(get: () => AiWorkspaceControls | undefined): Partial<AiWorkspaceControls> {
  return {
    layouts: () => get()?.layouts?.() ?? [],
    layoutId: () => get()?.layoutId?.() ?? "",
    setLayout: (id) => get()?.setLayout?.(id) ?? false,
    setPanelSymbol: (i, s) => get()?.setPanelSymbol?.(i, s),
    setPanelTimeframe: (i, t) => get()?.setPanelTimeframe?.(i, t),
    target: () => get()?.target?.() ?? 0,
    setTarget: (i) => get()?.setTarget?.(i) ?? false,
    contextOf: (i) => get()?.contextOf?.(i) ?? null,
    focused: () => get()?.focused?.() ?? null,
    setFocused: (i) => get()?.setFocused?.(i),
    linkGroups: () => get()?.linkGroups?.() ?? [],
    link: (indices) => get()?.link?.(indices),
    unlink: (indices) => get()?.unlink?.(indices),
  };
}
