import { useEffect, useRef, type RefObject } from "react";

/** Ce qu'un clavier peut atteindre par Tab : contrôles natifs actifs et tout ce qui porte un
 *  `tabindex` positif ou nul. Les éléments masqués (`display: none`, `visibility: hidden`) sont
 *  écartés plus bas, la sélection CSS seule ne le sait pas. */
const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Les éléments focalisables de `root`, dans l'ordre du document. */
export function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.tabIndex < 0) return false;
    if (el.closest("[inert]")) return false;
    // getClientRects est vide pour un élément non rendu (display: none sur lui ou un ancêtre).
    return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  });
}

/** Pile des pièges actifs : seul le dernier ouvert (une modale par-dessus une autre) tient Tab. */
const stack: HTMLElement[] = [];

/**
 * Gestion du focus d'un dialogue modal, en trois temps :
 *
 * 1. **à l'ouverture**, le focus entre dans `ref` — sur un élément marqué `autofocus` ou
 *    `data-autofocus` s'il y en a un, sinon sur le premier élément focalisable qui ne porte pas
 *    `data-lq-initial-focus="skip"` (la croix d'en-tête, par exemple), sinon sur le conteneur
 *    lui-même (qui doit alors avoir `tabIndex={-1}`). Si un champ `autoFocus` a déjà pris le focus
 *    à l'intérieur, on ne le déplace pas ;
 * 2. **tant qu'il est ouvert**, Tab et Maj+Tab bouclent sur ses éléments focalisables au lieu de
 *    fuir vers la page dessous ;
 * 3. **à la fermeture**, le focus revient à l'élément qui l'avait avant l'ouverture (le bouton qui
 *    a ouvert le dialogue, typiquement), s'il est encore dans le document.
 *
 * L'élément d'origine est relevé pendant le rendu où `active` passe à vrai : un effet arriverait
 * trop tard, après qu'un enfant `autoFocus` a déjà déplacé le focus.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  const returnToRef = useRef<HTMLElement | null>(null);
  const wasActiveRef = useRef(false);
  if (active && !wasActiveRef.current && typeof document !== "undefined") {
    returnToRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  wasActiveRef.current = active;

  useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;
    stack.push(root);

    if (!root.contains(document.activeElement)) {
      const preferred = root.querySelector<HTMLElement>("[autofocus], [data-autofocus]");
      const first = focusableIn(root).find((el) => el.dataset.lqInitialFocus !== "skip");
      (preferred ?? first ?? root).focus({ preventScroll: true });
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || stack[stack.length - 1] !== root || !root) return;
      const items = focusableIn(root);
      if (items.length === 0) {
        e.preventDefault();
        root.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || current === root || !root.contains(current))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !root.contains(current))) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);

    const returnTo = returnToRef.current;
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const i = stack.lastIndexOf(root);
      if (i >= 0) stack.splice(i, 1);
      // Rendre le focus seulement s'il était encore dans le dialogue (ou perdu sur <body>) : si
      // l'utilisateur a cliqué ailleurs entre-temps, on ne le lui reprend pas.
      const current = document.activeElement;
      const lost = !current || current === document.body || root.contains(current) || !current.isConnected;
      if (returnTo && returnTo.isConnected && lost) returnTo.focus({ preventScroll: true });
    };
  }, [active, ref]);
}
