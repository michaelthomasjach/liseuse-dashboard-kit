import type { AiTool, AiToolOutcome } from "./aiTools";
import type { AiChartContext } from "./interfaces/AiChartContext.interface";
import type { AiDialogTarget } from "./aiChartControls";
import { DATE_DOC, barIndexOf, fail, num, ok, parseDate, str } from "./toolHelpers";
import { findIndicator, findPane } from "./controlTools";
import {
  chooseOption,
  clickControl,
  closeDialog,
  contextMenuOf,
  describeControls,
  dialogTitle,
  findControl,
  findDialog,
  listControls,
  nextFrame,
  norm,
  openDialogs,
  setChecked,
  typeValue,
  type UiControl,
} from "./uiControl";

/**
 * Outils d'interface : ouvrir une fenêtre de paramètres (graphique, système, volume, indicateur, dessin…), interagir
 * avec les contrôles visibles quand aucun outil dédié ne couvre un réglage, et piloter le menu du clic droit. Tout est
 * lu et actionné dans le DOM du graphique et de ses fenêtres, comme le ferait une personne.
 */

const noUi = (): AiToolOutcome => fail("L'interface du graphique n'est pas disponible ici.");

async function dialogListing(dialog: HTMLElement): Promise<string> {
  const controls = await listControls(dialog, { withOptions: true });
  return `Fenêtre « ${dialogTitle(dialog)} » :\n${describeControls(controls)}`;
}

const DIALOG_TARGETS = ["systeme", "graphique", "volume", "separateurs_de_jours", "indicateur", "panneau", "dessin"] as const;

const OPEN_SETTINGS_TOOL: AiTool = {
  definition: {
    name: "ouvrir_les_parametres",
    description:
      "Ouvre une fenêtre de paramètres et rend la liste de ses contrôles (libellé, type, valeur, options), à régler ensuite avec interagir_avec_l_interface : « systeme » (paramètres système : apparence, échelles, toile), « graphique » (paramètres du graphique / du symbole, en onglets), « volume », « separateurs_de_jours », « indicateur » ou « panneau » (avec id), « dessin » (avec id). action « fermer » ferme la fenêtre ouverte. Préférez les outils dédiés (regler_indicateur, regler_apparence…) quand ils couvrent le réglage.",
    inputSchema: {
      type: "object",
      properties: {
        cible: { type: "string", enum: DIALOG_TARGETS, description: "La fenêtre à ouvrir." },
        id: { type: "string", description: "indicateur, panneau, dessin : son id." },
        action: { type: "string", enum: ["ouvrir", "fermer"], description: "Défaut ouvrir." },
      },
      additionalProperties: false,
    },
  },
  run: async (input, chart) => {
    if (typeof document === "undefined") return noUi();
    if (str(input, "action") === "fermer") {
      const dialog = findDialog();
      if (!dialog) return fail("Aucune fenêtre ouverte.");
      const title = dialogTitle(dialog);
      await closeDialog(dialog);
      return ok(`Fenêtre « ${title} » fermée.`);
    }
    const c = chart.controls;
    if (!c) return noUi();
    const cible = str(input, "cible");
    const id = str(input, "id");
    let target: AiDialogTarget;
    switch (cible) {
      case "systeme":
      case "graphique":
      case "volume":
      case "separateurs_de_jours":
        target = { kind: cible };
        break;
      case "indicateur":
      case "panneau": {
        if (cible === "panneau" && (id === "volume" || id === "prix" || id === "price")) {
          target = { kind: id === "volume" ? "volume" : "graphique" };
          break;
        }
        const indicator = findIndicator(chart, id) ?? (id ? c.indicators().find((i) => i.id === findPane(c, id)?.id) : undefined);
        if (!indicator) return fail(`Indicateur ou panneau « ${id ?? ""} » introuvable. Affichés : ${c.indicators().map((i) => i.id).join(", ") || "aucun"}.`);
        target = { kind: "indicateur", id: indicator.id };
        break;
      }
      case "dessin":
        if (!id) return fail("Indiquez l'« id » du dessin (gerer_les_dessins, action lister).");
        target = { kind: "dessin", id };
        break;
      default:
        return fail(`Cible inconnue. Cibles : ${DIALOG_TARGETS.join(", ")}.`);
    }
    const before = new Set(openDialogs());
    if (!c.openDialog(target)) return fail(`Impossible d'ouvrir cette fenêtre (cible absente du graphique).`);
    let dialog: HTMLElement | null = null;
    for (let i = 0; i < 10 && !dialog; i++) {
      await nextFrame();
      dialog = openDialogs().find((d) => !before.has(d)) ?? null;
    }
    dialog ??= findDialog();
    if (!dialog) return fail("La fenêtre ne s'est pas ouverte.");
    return ok(await dialogListing(dialog));
  },
};

const UI_ACTIONS = ["lister", "cliquer", "choisir", "saisir", "cocher", "decocher", "fermer"] as const;

const UI_TOOL: AiTool = {
  definition: {
    name: "interagir_avec_l_interface",
    description:
      "Interaction générique avec l'interface du graphique, pour ce qu'aucun outil dédié ne couvre. zone « fenetre » (la fenêtre de paramètres ouverte, par défaut), « graphique » (en-tête, barres d'outils, légendes) ou « menu » (menu du clic droit ouvert). « lister » rend les contrôles visibles (type, libellé, valeur, options) ; « cliquer » un bouton, un onglet ou une entrée ; « choisir » une option d'un sélecteur ; « saisir » une valeur (nombre, texte, couleur CSS, ou option) ; « cocher » / « decocher » une case ou un interrupteur ; « fermer » la fenêtre. Le libellé est comparé sans casse ni accents (exact, puis début, puis contenu) ; « section » et « rang » départagent deux contrôles du même nom. Ex. : {action:\"saisir\", libelle:\"Période\", valeur:50} ; {action:\"cliquer\", libelle:\"Style\"} (onglet) ; {action:\"saisir\", libelle:\"Couleur\", valeur:\"#d64545\"}.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: UI_ACTIONS, description: "Ce qu'il faut faire." },
        zone: { type: "string", enum: ["fenetre", "graphique", "menu"], description: "Où chercher. Défaut fenetre (ou graphique si aucune fenêtre n'est ouverte)." },
        fenetre: { type: "string", description: "Titre (ou morceau du titre) de la fenêtre visée, s'il y en a plusieurs." },
        libelle: { type: "string", description: "Libellé du contrôle (tel que listé)." },
        section: { type: "string", description: "Section ou onglet qui contient le contrôle, pour départager." },
        rang: { type: "number", minimum: 1, description: "Le n-ième contrôle de ce nom (défaut 1)." },
        valeur: { type: ["string", "number", "boolean"], description: "saisir : la valeur ; choisir : l'option." },
        option: { type: "string", description: "choisir : l'option (à défaut de valeur)." },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  run: async (input, chart) => {
    if (typeof document === "undefined") return noUi();
    const action = str(input, "action");
    const zoneArg = str(input, "zone");
    const dialog = findDialog(str(input, "fenetre"));
    const zone = zoneArg ?? (dialog ? "fenetre" : "graphique");
    let scope: HTMLElement | null;
    if (zone === "fenetre") {
      scope = dialog;
      if (!scope) return fail(`Aucune fenêtre ouverte${str(input, "fenetre") ? ` nommée « ${str(input, "fenetre")} »` : ""}. Ouvrez-en une avec ouvrir_les_parametres, ou utilisez la zone « graphique ».`);
    } else if (zone === "menu") {
      scope = contextMenuOf(chart.controls?.root() ?? null);
      if (!scope) return fail("Aucun menu du clic droit ouvert : appelez menu_contextuel (action ouvrir).");
    } else {
      scope = chart.controls?.root() ?? null;
      if (!scope) return noUi();
    }
    if (action === "fermer") {
      if (zone !== "fenetre" || !dialog) return fail("Aucune fenêtre à fermer.");
      const title = dialogTitle(dialog);
      await closeDialog(dialog);
      return ok(`Fenêtre « ${title} » fermée.`);
    }
    const controls = await listControls(scope, { withOptions: action === "lister" });
    const header = zone === "fenetre" ? `Fenêtre « ${dialogTitle(scope)} »` : zone === "menu" ? "Menu du clic droit" : "Graphique";
    if (action === "lister") return ok(`${header} :\n${describeControls(controls)}`);
    const label = str(input, "libelle");
    if (!label) return fail("Indiquez « libelle » (voir action lister).");
    const kinds: UiControl["kind"][] | undefined =
      action === "cocher" || action === "decocher" ? ["case_a_cocher", "interrupteur", "radio"] : action === "choisir" ? ["selecteur", "radio", "onglet"] : undefined;
    const control = findControl(controls, label, { section: str(input, "section"), kinds, index: num(input, "rang") });
    if (!control) {
      const names = controls.filter((c) => !kinds || kinds.includes(c.kind)).map((c) => c.label);
      return fail(`Aucun contrôle « ${label} » dans ${header.toLowerCase()}. Disponibles : ${[...new Set(names)].slice(0, 60).join(" | ") || "aucun"}.`);
    }
    let result;
    switch (action) {
      case "cliquer":
        result = await clickControl(control);
        break;
      case "cocher":
      case "decocher":
        result = await setChecked(control, action === "cocher");
        break;
      case "choisir": {
        const option = str(input, "option") ?? (input.valeur !== undefined ? String(input.valeur) : undefined);
        if (!option) return fail("Indiquez « option ».");
        result = await chooseOption(control, option);
        break;
      }
      case "saisir": {
        const value = input.valeur;
        if (value === undefined || (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean")) return fail("Indiquez « valeur ».");
        result = await typeValue(control, value);
        break;
      }
      default:
        return fail(`Action inconnue. Actions : ${UI_ACTIONS.join(", ")}.`);
    }
    return result.ok ? ok(result.message) : fail(result.message);
  },
};

/** Les entrées du menu ouvert, sous-menus compris (chacun ouvert le temps de le lire). */
async function readMenu(menu: HTMLElement): Promise<string> {
  const lines: string[] = [];
  const items = Array.from(menu.querySelectorAll<HTMLElement>(":scope > [role='menuitem'], :scope > .lq-chart__context-menu-subwrap > [role='menuitem'], :scope > [role='separator']"));
  for (const item of items) {
    if (item.getAttribute("role") === "separator") {
      if (lines.length && lines[lines.length - 1] !== "—") lines.push("—");
      continue;
    }
    const label = item.querySelector("span")?.textContent?.trim() ?? item.textContent?.trim() ?? "";
    const hint = item.querySelectorAll("span")[1]?.textContent?.replace("›", "").trim();
    const disabled = (item as HTMLButtonElement).disabled ? " (désactivé)" : "";
    if (item.getAttribute("aria-haspopup") === "menu") {
      if (item.getAttribute("aria-expanded") !== "true") item.click();
      await nextFrame();
      const sub = item.parentElement?.querySelector<HTMLElement>(".lq-chart__context-menu--sub");
      const children = sub ? Array.from(sub.querySelectorAll<HTMLElement>("[role='menuitem']")).map((s) => s.querySelector("span")?.textContent?.trim() ?? "") : [];
      lines.push(`- ${label} › ${children.filter(Boolean).join(" | ")}${disabled}`);
      item.click();
      await nextFrame();
    } else {
      lines.push(`- ${label}${hint ? ` (${hint})` : ""}${disabled}`);
    }
  }
  return lines.join("\n");
}

async function chooseInMenu(root: HTMLElement | null, path: string): Promise<AiToolOutcome> {
  const parts = path.split(/\s*[›>]\s*/).filter(Boolean);
  let menu: HTMLElement | null = contextMenuOf(root);
  if (!menu) return fail("Aucun menu du clic droit ouvert : appelez menu_contextuel avec l'action ouvrir.");
  for (const [i, part] of parts.entries()) {
    const q = norm(part);
    const current: HTMLElement = menu!;
    const items: HTMLElement[] = Array.from(current.querySelectorAll<HTMLElement>("[role='menuitem']")).filter((el) => el.closest(".lq-chart__context-menu") === current);
    const labelOf = (el: HTMLElement) => norm(el.querySelector("span")?.textContent ?? el.textContent ?? "");
    const hit: HTMLElement | undefined = items.find((el) => labelOf(el) === q) ?? items.find((el) => labelOf(el).startsWith(q)) ?? items.find((el) => labelOf(el).includes(q));
    if (!hit) return fail(`Entrée « ${part} » introuvable. Entrées : ${items.map((el) => el.querySelector("span")?.textContent?.trim()).join(" | ")}.`);
    if ((hit as HTMLButtonElement).disabled) return fail(`« ${part} » est désactivée.`);
    const label = hit.querySelector("span")?.textContent?.trim() ?? part;
    if (hit.getAttribute("aria-haspopup") === "menu") {
      if (hit.getAttribute("aria-expanded") !== "true") hit.click();
      await nextFrame();
      const sub: HTMLElement | null = hit.parentElement?.querySelector<HTMLElement>(".lq-chart__context-menu--sub") ?? null;
      if (!sub) return fail(`Le sous-menu « ${label} » ne s'est pas ouvert.`);
      if (i === parts.length - 1) return ok(`Sous-menu « ${label} » ouvert : ${await readMenu(sub)}`);
      menu = sub;
      continue;
    }
    const before = new Set(openDialogs());
    hit.click();
    await nextFrame();
    await nextFrame();
    const dialog = openDialogs().find((d) => !before.has(d));
    return ok(`« ${parts.join(" › ")} » choisi.${dialog ? ` Fenêtre ouverte : « ${dialogTitle(dialog)} » (interagir_avec_l_interface pour la régler).` : ""}`);
  }
  return fail("Chemin d'entrée vide.");
}

const MENU_TOOL: AiTool = {
  definition: {
    name: "menu_contextuel",
    description:
      "Le menu du clic droit, comme une personne : « ouvrir » à une position (date et prix sur les prix, ou un panneau d'indicateur / le volume avec sa valeur) et rendre ses entrées (sous-menus compris), « choisir » une entrée (chemin « Sous-menu › Entrée » pour un sous-menu), « fermer ». Les entrées dépendent de l'endroit : sur les prix, ajouter une ligne horizontale ou une alerte à ce prix, échelle, paramètres du graphique… ; sur un panneau, y poser une moyenne, ses paramètres, sa légende. Ex. : {action:\"ouvrir\", date:\"2024-05-10\", prix:182} puis {action:\"choisir\", entree:\"Ajouter une ligne horizontale\"}.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["ouvrir", "choisir", "fermer"], description: "Ce qu'il faut faire." },
        date: { type: "string", description: `ouvrir : la date visée (défaut : le milieu de la vue). ${DATE_DOC}` },
        prix: { type: "number", description: "ouvrir : la valeur visée sur l'échelle du panneau (prix sur les prix). Défaut : le milieu du panneau." },
        panneau: { type: "string", description: "ouvrir : « prix » (défaut), « volume » ou l'id d'un panneau d'indicateur." },
        entree: { type: "string", description: "choisir : le libellé de l'entrée, ou « Sous-menu › Entrée »." },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  run: async (input, chart) => {
    const c = chart.controls;
    if (!c || typeof document === "undefined") return noUi();
    const action = str(input, "action");
    const root = c.root();
    if (action === "fermer") {
      const menu = contextMenuOf(root);
      if (!menu) return ok("Aucun menu ouvert.");
      menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
      await nextFrame();
      if (contextMenuOf(root)) {
        document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        await nextFrame();
      }
      return contextMenuOf(root) ? fail("Le menu ne s'est pas fermé.") : ok("Menu fermé.");
    }
    if (action === "choisir") {
      const entry = str(input, "entree");
      if (!entry) return fail("Indiquez « entree ».");
      return chooseInMenu(root, entry);
    }
    if (action !== "ouvrir") return fail("Action inconnue : ouvrir, choisir ou fermer.");
    const pane = findPane(c, str(input, "panneau"));
    if (!pane) return fail(`Panneau « ${str(input, "panneau")} » introuvable. Panneaux : ${c.panes().map((p) => p.id).join(", ")}.`);
    if (pane.collapsed) return fail(`Le panneau « ${pane.label} » est replié.`);
    const view = c.view();
    const date = parseDate(input.date);
    if (input.date !== undefined && !date) return fail(`Date illisible. ${DATE_DOC}`);
    const index = date ? barIndexOf(chart.data, date) : Math.floor((view.start + view.end) / 2);
    if (index < view.start - 0.5 || index > view.end) return fail("Cette date est hors de la vue : déplacez d'abord la vue (naviguer_dans_le_temps, aller_a_la_date).");
    const value = num(input, "prix") ?? null;
    if (value !== null && pane.range && (value < pane.range.min || value > pane.range.max))
      return fail(`Valeur hors du panneau (${pane.range.min.toFixed(2)} → ${pane.range.max.toFixed(2)}) : réglez l'axe (regler_l_axe_vertical) ou choisissez une valeur visible.`);
    const point = c.clientPoint(index, value, pane.id);
    const target = c.plotElement();
    if (!point || !target) return fail("Position introuvable à l'écran (graphique masqué ?).");
    target.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y, button: 2 }));
    let menu: HTMLElement | null = null;
    for (let i = 0; i < 6 && !menu; i++) {
      await nextFrame();
      menu = contextMenuOf(root);
    }
    if (!menu) return fail("Le menu ne s'est pas ouvert.");
    return ok(`Menu ouvert sur « ${pane.label} »${date ? ` au ${date.toISOString().slice(0, 10)}` : ""}${value !== null ? ` à ${value}` : ""} :\n${await readMenu(menu)}\nChoisissez avec l'action « choisir ».`);
  },
};

export const UI_TOOLS: AiTool[] = [OPEN_SETTINGS_TOOL, UI_TOOL, MENU_TOOL];

/** Ces outils lisent le DOM : seulement dans un navigateur, sur un graphique affiché. */
export function uiToolAvailable(name: string, chart: AiChartContext): boolean | undefined {
  if (!UI_TOOLS.some((t) => t.definition.name === name)) return undefined;
  return chart.controls !== undefined;
}

