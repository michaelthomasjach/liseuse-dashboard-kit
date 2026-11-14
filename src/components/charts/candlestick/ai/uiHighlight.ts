/** Où se trouve une fonctionnalité : les boutons visibles de l'interface, et la mise en surbrillance de l'un d'eux.
 *
 *  Lu dans le DOM vivant plutôt que dans une liste écrite à la main : ce qui est à l'écran dépend des options que
 *  l'application a activées, de la largeur (barres repliées sur mobile) et des fenêtres ouvertes. Une liste figée
 *  promettrait des boutons absents. */

export interface UiButton {
  /** Nom du bouton (aria-label, sinon son texte). */
  label: string;
  /** Infobulle, quand elle dit plus que le nom. */
  title: string | null;
  /** Où il se trouve, en mots (« barre d'outils de gauche », « en-tête du graphique »…). */
  zone: string;
  element: HTMLElement;
}

const ZONES: [string, string][] = [
  [".lq-ai, .lq-ai-sheet", "panneau de l'assistant"],
  [".lq-chart__floating-toolbar", "barre flottante du dessin sélectionné"],
  [".lq-chart__tools-rail", "barre d'outils de gauche du graphique"],
  [".lq-chart__header", "en-tête du graphique (en haut)"],
  [".lq-chart__symbol-info, .lq-chart__plot-topleft", "légende en haut à gauche du graphique"],
  [".lq-chart-workspace__side-rail", "barre de droite de l'espace de travail"],
  [".lq-chart__side-panel", "panneau latéral de droite (listes, alertes)"],
  [".lq-chart-workspace__mobile-bottomnav, .lq-chart-workspace__mobile-topbar", "barre de navigation mobile"],
];

function zoneOf(el: Element): string | null {
  for (const [selector, name] of ZONES) if (el.closest(selector)) return name;
  return null;
}

function visible(el: HTMLElement): boolean {
  if (el.closest("[hidden], [aria-hidden='true']")) return false;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none";
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Les boutons visibles, une seule fois par nom. Avec plusieurs fenêtres, ceux de la fenêtre active d'abord. */
export function listUiButtons(): UiButton[] {
  if (typeof document === "undefined") return [];
  const active = document.querySelector(".lq-chart-workspace__panel--active");
  const all = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button'], [role='tab'], [role='menuitem']"));
  // La fenêtre active passe devant, pour qu'un nom présent dans chaque fenêtre désigne celle-là.
  all.sort((a, b) => Number(!!(active && active.contains(b))) - Number(!!(active && active.contains(a))));
  const seen = new Set<string>();
  const out: UiButton[] = [];
  for (const el of all) {
    const zone = zoneOf(el);
    if (!zone || !visible(el)) continue;
    const label = (el.getAttribute("aria-label") ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!label || label.length > 80) continue;
    const key = `${zone}|${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const title = el.getAttribute("title");
    out.push({ label, title: title && title !== label ? title : null, zone, element: el });
  }
  return out;
}

/** Le bouton dont le nom (ou l'infobulle) correspond le mieux à `query` : nom exact d'abord, puis contenu. */
export function findUiButton(query: string): UiButton | null {
  const q = norm(query);
  if (!q) return null;
  const buttons = listUiButtons();
  return (
    buttons.find((b) => norm(b.label) === q) ??
    buttons.find((b) => norm(b.label).includes(q)) ??
    buttons.find((b) => b.title !== null && norm(b.title).includes(q)) ??
    buttons.find((b) => q.split(" ").every((word) => norm(`${b.label} ${b.title ?? ""}`).includes(word))) ??
    null
  );
}

const HIGHLIGHT_CLASS = "lq-ui-highlight";

/** Surligne `el` jusqu'à ce qu'on le survole, le touche ou le sélectionne au clavier ; un seul bouton à la fois. */
export function highlightUiElement(el: HTMLElement): void {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((other) => other.classList.remove(HIGHLIGHT_CLASS));
  el.classList.add(HIGHLIGHT_CLASS);
  el.scrollIntoView({ block: "nearest", inline: "nearest" });
  const clear = () => {
    el.classList.remove(HIGHLIGHT_CLASS);
    el.removeEventListener("pointerenter", clear);
    el.removeEventListener("pointerdown", clear);
    el.removeEventListener("focus", clear);
  };
  el.addEventListener("pointerenter", clear);
  el.addEventListener("pointerdown", clear);
  el.addEventListener("focus", clear);
}
