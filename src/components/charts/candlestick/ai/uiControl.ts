/**
 * Interaction générique avec l'interface du graphique, pour ce qu'aucun outil dédié ne couvre : lister les contrôles
 * visibles d'une fenêtre ouverte (libellé, type, valeur, options), cliquer un bouton, choisir une option, saisir une
 * valeur, cocher une case, et lire / déclencher le menu du clic droit.
 *
 * Lu dans le DOM vivant (ce qu'une personne voit), et limité au conteneur du graphique et à ses fenêtres (les boîtes
 * de dialogue de la bibliothèque, rendues à la racine du document) : rien du reste de la page de l'application n'est
 * atteignable. Chaque geste passe par les mêmes évènements qu'un clic ou une saisie, donc par le même code que la
 * personne déclencherait.
 */

export type UiControlKind =
  | "bouton"
  | "onglet"
  | "case_a_cocher"
  | "interrupteur"
  | "radio"
  | "selecteur"
  | "nombre"
  | "texte"
  | "couleur"
  | "curseur"
  | "entree_de_menu";

export interface UiControl {
  kind: UiControlKind;
  label: string;
  /** Titre de la section (ou de l'onglet) qui contient le contrôle, quand il y en a un. */
  section?: string;
  value?: string | number | boolean;
  options?: string[];
  disabled?: boolean;
  /** Entrée de menu qui ouvre un sous-menu. */
  submenu?: boolean;
  element: HTMLElement;
}

export type UiZone = "fenetre" | "graphique" | "menu";

const MAX_CONTROLS = 160;

export const norm = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[«»"“”’']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const text = (el: Element | null | undefined): string => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

/** Une image, puis la suivante : de quoi laisser React rendre ce qu'un geste vient de changer. */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "undefined") return void setTimeout(resolve, 16);
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
export const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.closest("[hidden], [aria-hidden='true'], [inert]")) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}

/** Les fenêtres de la bibliothèque ouvertes (boîtes de dialogue, panneaux flottants), la plus récente en dernier.
 *  Le panneau de l'assistant et la visite guidée n'en sont pas. */
export function openDialogs(): HTMLElement[] {
  if (typeof document === "undefined") return [];
  return Array.from(document.querySelectorAll<HTMLElement>(".lq-modal, [role='dialog']")).filter(
    (el) =>
      isVisible(el) &&
      !el.closest(".lq-ai, .lq-ai-sheet") &&
      !el.classList.contains("lq-color-picker__panel") &&
      !el.closest(".lq-guided-tour, .lq-workspace-tour") &&
      // Une boîte imbriquée dans une autre est comptée avec elle.
      !el.parentElement?.closest(".lq-modal"),
  );
}

/** Titre lisible d'une fenêtre. */
export function dialogTitle(dialog: HTMLElement): string {
  const labelled = dialog.getAttribute("aria-labelledby");
  const byId = labelled ? document.getElementById(labelled) : null;
  return text(byId) || dialog.getAttribute("aria-label") || text(dialog.querySelector(".lq-modal__title, h2, h3")) || "Fenêtre";
}

/** La fenêtre visée : celle dont le titre contient `title`, sinon la plus récente. */
export function findDialog(title?: string): HTMLElement | null {
  const dialogs = openDialogs();
  if (title) {
    const q = norm(title);
    return [...dialogs].reverse().find((d) => norm(dialogTitle(d)).includes(q)) ?? null;
  }
  return dialogs[dialogs.length - 1] ?? null;
}

/** Le menu du clic droit ouvert dans ce graphique, null sinon. */
export function contextMenuOf(root: HTMLElement | null): HTMLElement | null {
  const scope = root ?? document;
  const menus = Array.from(scope.querySelectorAll<HTMLElement>(".lq-chart__context-menu:not(.lq-chart__context-menu--sub)"));
  return menus.find(isVisible) ?? null;
}

const GENERIC_LABELS = new Set(["choisir une couleur", "augmenter", "diminuer"]);

/** Le nom d'un contrôle, tel qu'une personne le lirait à côté de lui. */
export function controlLabel(el: HTMLElement): string {
  const aria = el.getAttribute("aria-label");
  if (aria && !GENERIC_LABELS.has(norm(aria))) return aria.replace(/^Couleur : /, "Couleur : ").trim();
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const t = labelledBy
      .split(/\s+/)
      .map((id) => text(document.getElementById(id)))
      .filter(Boolean)
      .join(" ");
    if (t) return t;
  }
  if (el.id) {
    const forLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (forLabel && text(forLabel)) return text(forLabel);
  }
  const wrapping = el.closest("label");
  if (wrapping) {
    const t = text(wrapping.querySelector(".lq-checkbox__label, .lq-field__label")) || text(wrapping);
    if (t) return t;
  }
  const field = el.closest(".lq-field, .lq-select, .lq-input-number");
  const fieldLabel = text(field?.querySelector(".lq-field__label"));
  if (fieldLabel) return fieldLabel;
  // Ligne de réglage : le libellé posé avant le contrôle dans la même ligne.
  const row = el.closest("[class*='__row'], [class*='-row'], .lq-ind-settings__row, tr");
  if (row) {
    const lab = row.querySelector("label, [class*='__label'], th");
    if (lab && !lab.contains(el) && text(lab)) return text(lab);
  }
  const prev = el.previousElementSibling;
  if (prev && (prev.tagName === "LABEL" || prev.tagName === "SPAN") && text(prev) && text(prev).length < 60) return text(prev);
  const own = text(el);
  if (own) return own;
  return el.getAttribute("title") || el.getAttribute("placeholder") || (aria ?? "");
}

function sectionOf(el: HTMLElement, scope: HTMLElement): string | undefined {
  const section = el.closest("section, fieldset, [role='tabpanel'], [class*='__section']");
  if (!section || !scope.contains(section) || section === scope) return undefined;
  const title = section.querySelector("h3, h4, legend, [class*='section-title'], [class*='__section-head']");
  const t = text(title);
  return t && t.length < 60 ? t : undefined;
}

function kindOf(el: HTMLElement): UiControlKind | null {
  const role = el.getAttribute("role");
  if (role === "menuitem") return "entree_de_menu";
  if (role === "tab") return "onglet";
  if (role === "switch") return "interrupteur";
  if (role === "radio") return "radio";
  if (role === "option") return null;
  if (el.tagName === "SELECT") return "selecteur";
  if (el.getAttribute("aria-haspopup") === "listbox") return "selecteur";
  if (el.classList.contains("lq-color-picker") || el.hasAttribute("data-color")) return "couleur";
  if (el.tagName === "TEXTAREA") return "texte";
  if (el.tagName === "INPUT") {
    const type = (el as HTMLInputElement).type;
    if (type === "checkbox") return "case_a_cocher";
    if (type === "radio") return "radio";
    if (type === "range") return "curseur";
    if (type === "color") return "couleur";
    if (type === "number" || el.getAttribute("inputmode") === "decimal" || el.getAttribute("inputmode") === "numeric" || el.closest(".lq-input-number"))
      return "nombre";
    if (type === "hidden" || type === "file") return null;
    return "texte";
  }
  if (el.tagName === "BUTTON" || role === "button") return "bouton";
  return null;
}

function valueOf(el: HTMLElement, kind: UiControlKind): UiControl["value"] {
  switch (kind) {
    case "case_a_cocher":
    case "radio":
      return el instanceof HTMLInputElement ? el.checked : el.getAttribute("aria-checked") === "true";
    case "interrupteur":
      return el.getAttribute("aria-checked") === "true";
    case "onglet":
      return el.getAttribute("aria-selected") === "true";
    case "couleur":
      return el.getAttribute("data-color") ?? (el instanceof HTMLInputElement ? el.value : undefined);
    case "selecteur":
      if (el instanceof HTMLSelectElement) return el.selectedOptions[0]?.text ?? el.value;
      return text(el.querySelector(".lq-select__value, [class*='value']")) || text(el);
    case "nombre": {
      const v = (el as HTMLInputElement).value;
      const n = Number(v.replace(",", ".").replace(/\s/g, ""));
      return v === "" ? "" : Number.isFinite(n) ? n : v;
    }
    case "texte":
    case "curseur":
      return (el as HTMLInputElement).value;
    default:
      return undefined;
  }
}

const CONTROL_SELECTOR = "button, [role='button'], [role='tab'], [role='switch'], [role='radio'], [role='menuitem'], input, select, textarea";

/** Les contrôles visibles d'une zone, dans l'ordre de lecture. Les options d'un sélecteur natif sont lues ; celles
 *  d'un sélecteur de la bibliothèque le sont avec `withOptions` (le menu est ouvert puis refermé). */
export async function listControls(scope: HTMLElement, { withOptions = false }: { withOptions?: boolean } = {}): Promise<UiControl[]> {
  const out: UiControl[] = [];
  for (const el of Array.from(scope.querySelectorAll<HTMLElement>(CONTROL_SELECTOR))) {
    if (out.length >= MAX_CONTROLS) break;
    if (!isVisible(el) && !(el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio") && el.closest("label") && isVisible(el.closest("label")!))) continue;
    // Les boutons internes d'un champ (flèches d'un nombre) et la croix de fermeture n'apportent rien de plus.
    if (el.closest(".lq-input-number") && el.tagName === "BUTTON") continue;
    const kind = kindOf(el);
    if (!kind) continue;
    const label = controlLabel(el).slice(0, 80);
    if (!label) continue;
    const control: UiControl = { kind, label, element: el, value: valueOf(el, kind) };
    const section = sectionOf(el, scope);
    if (section) control.section = section;
    if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") control.disabled = true;
    if (kind === "entree_de_menu" && el.getAttribute("aria-haspopup") === "menu") control.submenu = true;
    if (kind === "entree_de_menu") control.label = text(el.querySelector("span")) || label;
    if (el instanceof HTMLSelectElement) control.options = Array.from(el.options).map((o) => o.text);
    out.push(control);
  }
  if (withOptions) {
    for (const c of out) {
      if (c.kind === "selecteur" && !(c.element instanceof HTMLSelectElement) && !c.disabled) c.options = await readListboxOptions(c.element);
    }
  }
  return out;
}

/** Ouvre un sélecteur de la bibliothèque, lit ses options et le referme. */
async function readListboxOptions(trigger: HTMLElement): Promise<string[]> {
  const wasOpen = trigger.getAttribute("aria-expanded") === "true";
  if (!wasOpen) trigger.click();
  await nextFrame();
  const options = listboxOptions(trigger).map((o) => text(o));
  if (!wasOpen) {
    trigger.click();
    await nextFrame();
  }
  return options;
}

function listboxOptions(trigger: HTMLElement): HTMLElement[] {
  const id = trigger.getAttribute("aria-controls");
  const list = (id ? document.getElementById(id) : null) ?? Array.from(document.querySelectorAll<HTMLElement>("[role='listbox']")).filter(isVisible).pop() ?? null;
  return list ? Array.from(list.querySelectorAll<HTMLElement>("[role='option']")) : [];
}

/** Le contrôle dont le libellé correspond : exact, puis début, puis contenu ; `section` et `index` départagent. */
export function findControl(controls: UiControl[], label: string, opts: { section?: string; kinds?: UiControlKind[]; index?: number } = {}): UiControl | null {
  const q = norm(label);
  if (!q) return null;
  let pool = opts.kinds ? controls.filter((c) => opts.kinds!.includes(c.kind)) : controls;
  if (opts.section) {
    const s = norm(opts.section);
    const inSection = pool.filter((c) => c.section && norm(c.section).includes(s));
    if (inSection.length > 0) pool = inSection;
  }
  const tiers = [
    pool.filter((c) => norm(c.label) === q),
    pool.filter((c) => norm(c.label).startsWith(q)),
    pool.filter((c) => norm(c.label).includes(q)),
    pool.filter((c) => q.split(" ").every((w) => norm(`${c.section ?? ""} ${c.label}`).includes(w))),
  ];
  const hits = tiers.find((t) => t.length > 0) ?? [];
  return hits[Math.max(0, (opts.index ?? 1) - 1)] ?? null;
}

/** Une ligne lisible par contrôle, groupées par section. */
export function describeControls(controls: UiControl[]): string {
  if (controls.length === 0) return "Aucun contrôle visible.";
  const lines: string[] = [];
  let section: string | undefined;
  for (const c of controls) {
    if (c.section !== section) {
      section = c.section;
      if (section) lines.push(`[${section}]`);
    }
    const value =
      c.value === undefined || c.value === ""
        ? ""
        : typeof c.value === "boolean"
          ? c.kind === "onglet"
            ? c.value
              ? " (actif)"
              : ""
            : c.value
              ? " = oui"
              : " = non"
          : ` = ${c.value}`;
    const options = c.options && c.options.length > 0 ? ` — options : ${c.options.slice(0, 30).join(" | ")}` : "";
    lines.push(`- ${c.kind} « ${c.label} »${value}${options}${c.submenu ? " ›" : ""}${c.disabled ? " (désactivé)" : ""}`);
  }
  if (controls.length >= MAX_CONTROLS) lines.push(`(liste coupée à ${MAX_CONTROLS} contrôles)`);
  return lines.join("\n");
}

/** Valeur d'un champ comme si on la tapait : le setter natif (React ne voit pas une simple affectation), puis les
 *  évènements de saisie et de sortie du champ. */
export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  el.focus();
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function pressEnterAndBlur(el: HTMLElement): void {
  el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
  el.blur();
}

export type UiActionResult = { ok: true; message: string } | { ok: false; message: string };

export async function clickControl(c: UiControl): Promise<UiActionResult> {
  if (c.disabled) return { ok: false, message: `« ${c.label} » est désactivé.` };
  c.element.click();
  await nextFrame();
  return { ok: true, message: `« ${c.label} » cliqué.` };
}

export async function setChecked(c: UiControl, checked: boolean): Promise<UiActionResult> {
  if (!["case_a_cocher", "interrupteur", "radio", "onglet"].includes(c.kind)) return { ok: false, message: `« ${c.label} » n'est pas une case à cocher (${c.kind}).` };
  if (c.disabled) return { ok: false, message: `« ${c.label} » est désactivé.` };
  const current = valueOf(c.element, c.kind) === true;
  if (current !== checked) {
    // Une case cachée sous sa pastille : le clic sur l'étiquette fait le même geste.
    c.element.click();
    await nextFrame();
  }
  const now = valueOf(c.element, c.kind) === true;
  return now === checked ? { ok: true, message: `« ${c.label} » ${checked ? "coché" : "décoché"}.` } : { ok: false, message: `« ${c.label} » n'a pas changé d'état.` };
}

export async function chooseOption(c: UiControl, option: string): Promise<UiActionResult> {
  const q = norm(option);
  if (c.kind === "radio" || c.kind === "onglet") return clickControl(c);
  if (c.kind !== "selecteur") return { ok: false, message: `« ${c.label} » n'est pas un sélecteur (${c.kind}).` };
  if (c.element instanceof HTMLSelectElement) {
    const opts = Array.from(c.element.options);
    const hit = opts.find((o) => norm(o.text) === q || norm(o.value) === q) ?? opts.find((o) => norm(o.text).includes(q));
    if (!hit) return { ok: false, message: `Option « ${option} » introuvable. Options : ${opts.map((o) => o.text).join(" | ")}.` };
    setNativeValue(c.element, hit.value);
    await nextFrame();
    return { ok: true, message: `« ${c.label} » : ${hit.text}.` };
  }
  if (c.element.getAttribute("aria-expanded") !== "true") c.element.click();
  await nextFrame();
  const opts = listboxOptions(c.element);
  const hit = opts.find((o) => norm(text(o)) === q) ?? opts.find((o) => norm(text(o)).startsWith(q)) ?? opts.find((o) => norm(text(o)).includes(q));
  if (!hit) {
    const names = opts.map((o) => text(o));
    c.element.click();
    await nextFrame();
    return { ok: false, message: `Option « ${option} » introuvable. Options : ${names.join(" | ") || "aucune"}.` };
  }
  hit.click();
  await nextFrame();
  return { ok: true, message: `« ${c.label} » : ${text(hit)}.` };
}

/** Une couleur CSS en « RRVVBB » pour le champ hexadécimal du sélecteur de couleur, null si illisible. */
export function hexOf(color: string): string | null {
  const c = color.trim();
  const short = /^#?([0-9a-f]{3})$/i.exec(c);
  if (short) return short[1].split("").map((d) => d + d).join("").toUpperCase();
  const long = /^#?([0-9a-f]{6}([0-9a-f]{2})?)$/i.exec(c);
  if (long) return long[1].toUpperCase();
  if (typeof document === "undefined") return null;
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return null;
  probe.fillStyle = "#010203";
  probe.fillStyle = c;
  const out = String(probe.fillStyle);
  if (out === "#010203" && norm(c) !== "#010203") return null;
  const m = /^#([0-9a-f]{6})$/i.exec(out);
  if (m) return m[1].toUpperCase();
  const rgba = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(out);
  if (!rgba) return null;
  const hex = [rgba[1], rgba[2], rgba[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
  const alpha = rgba[4] !== undefined ? Math.round(Number(rgba[4]) * 255).toString(16).padStart(2, "0") : "";
  return (hex + alpha).toUpperCase();
}

async function setColor(c: UiControl, color: string): Promise<UiActionResult> {
  const hex = hexOf(color);
  if (!hex) return { ok: false, message: `Couleur illisible : « ${color} ».` };
  if (c.element instanceof HTMLInputElement) {
    setNativeValue(c.element, `#${hex.slice(0, 6).toLowerCase()}`);
    return { ok: true, message: `« ${c.label} » : #${hex}.` };
  }
  const trigger = c.element;
  if (trigger.getAttribute("aria-expanded") !== "true") trigger.click();
  await nextFrame();
  const panels = Array.from(document.querySelectorAll<HTMLElement>(".lq-color-picker__panel")).filter(isVisible);
  const panel = panels[panels.length - 1];
  if (!panel) return { ok: false, message: "Le sélecteur de couleur ne s'est pas ouvert." };
  let input = panel.querySelector<HTMLInputElement>(".lq-color-picker__hex input");
  if (!input) {
    const fine = Array.from(panel.querySelectorAll<HTMLElement>("button")).find((b) => norm(b.getAttribute("aria-label") ?? "").includes("couleur personnalisee"));
    fine?.click();
    await nextFrame();
    input = panel.querySelector<HTMLInputElement>(".lq-color-picker__hex input");
  }
  if (!input) {
    trigger.click();
    return { ok: false, message: "Champ hexadécimal du sélecteur de couleur introuvable." };
  }
  const withAlpha = (input.maxLength ?? 7) > 7 ? hex : hex.slice(0, 6);
  setNativeValue(input, withAlpha);
  pressEnterAndBlur(input);
  await nextFrame();
  // Refermé comme on l'a ouvert : un second clic sur la pastille.
  if (trigger.getAttribute("aria-expanded") === "true") trigger.click();
  await nextFrame();
  return { ok: true, message: `« ${c.label} » : #${withAlpha}.` };
}

export async function typeValue(c: UiControl, value: string | number | boolean): Promise<UiActionResult> {
  if (c.disabled) return { ok: false, message: `« ${c.label} » est désactivé.` };
  if (typeof value === "boolean") return setChecked(c, value);
  if (c.kind === "couleur") return setColor(c, String(value));
  if (c.kind === "selecteur" || c.kind === "radio") return chooseOption(c, String(value));
  if (c.kind === "case_a_cocher" || c.kind === "interrupteur") return setChecked(c, value === "oui" || value === "true" || value === 1);
  if (!["nombre", "texte", "curseur"].includes(c.kind)) return { ok: false, message: `« ${c.label} » n'est pas un champ de saisie (${c.kind}).` };
  const el = c.element as HTMLInputElement | HTMLTextAreaElement;
  setNativeValue(el, String(value));
  pressEnterAndBlur(el);
  await nextFrame();
  return { ok: true, message: `« ${c.label} » : ${(el as HTMLInputElement).value}.` };
}

/** Ferme la fenêtre : sa croix, sinon Échap. */
export async function closeDialog(dialog: HTMLElement): Promise<void> {
  const close = dialog.querySelector<HTMLElement>(".lq-modal__close-icon, .lq-modal__close-button, [aria-label='Fermer']");
  if (close) close.click();
  else dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
  await nextFrame();
}
