import type { MouseEvent as ReactMouseEvent } from "react";
import { flushSync } from "react-dom";

/* Clic droit sur un graphique ou un espace de travail : jamais le menu du navigateur (Retour, Actualiser,
 * Inspecter…), sauf dans un champ de saisie, où il sert à copier-coller.
 *
 * Le conteneur racine (`.lq-chart`, `.lq-chart-workspace`) pose `claimChartContextMenu` en phase de capture. React
 * fait suivre aux événements l'arbre des composants, portails compris : une modale, un menu ou une liste déroulante
 * ouverts par le graphique et rendus dans `document.body` passent donc eux aussi par là, alors qu'une modale du site
 * qui n'appartient à aucun graphique n'y passe jamais. La capture passe avant tout `stopPropagation` d'un enfant
 * (barre de navigation, sélecteur de couleur), qui laissait sinon le menu du navigateur s'afficher.
 *
 * Le fond d'une modale du graphique (`Modal`) laisse voir le graphique : un clic droit dessus ferme la modale puis
 * rejoue le clic droit sur ce qui est dessous (`replayContextMenuBehindBackdrop`), comme si la modale n'avait pas
 * été là. */

// Événements passés par la capture d'un graphique : seuls ceux-là sont repris par le fond d'une modale.
const claimed = new WeakSet<Event>();

// Champs où le menu natif reste utile (copier, coller, correcteur orthographique). Un texte simplement sélectionné
// n'en fait pas partie : une sélection oubliée (un glisser sur une légende, un double-clic sur un titre) ferait
// revenir le menu du navigateur sur le graphique, et Ctrl+C la copie de toute façon.
const NATIVE_MENU_FIELDS = 'textarea, [contenteditable]:not([contenteditable="false"]), .cm-editor, .monaco-editor';
// Une case, un curseur ou un bouton n'ont rien à copier ni à coller.
const NON_TEXT_INPUTS = new Set(["checkbox", "radio", "range", "button", "submit", "reset", "color", "file", "image"]);

/** Le menu du navigateur reste-t-il sur cette cible ? Oui dans un champ de texte ou un éditeur de code. */
export function keepsNativeContextMenu(target: EventTarget | null): boolean {
  // Pas d'`instanceof Element` : une fenêtre détachée (éditeur de scripts) a ses propres constructeurs.
  const el = target as Element | null;
  if (!el || typeof el.closest !== "function") return false;
  const input = el.closest("input");
  if (input) return !NON_TEXT_INPUTS.has((input as HTMLInputElement).type);
  return el.closest(NATIVE_MENU_FIELDS) !== null;
}

/** `onContextMenuCapture` du conteneur d'un graphique ou d'un espace de travail. */
export function claimChartContextMenu(e: ReactMouseEvent): void {
  claimed.add(e.nativeEvent);
  if (!keepsNativeContextMenu(e.target)) e.preventDefault();
}

/** Clic droit sur le fond d'une modale. Si elle appartient à un graphique, l'événement ne va pas plus loin et le clic
 *  droit est rejoué sous la modale une fois celle-ci fermée (à l'appelant de la fermer) ; renvoie alors `true`. */
export function replayContextMenuBehindBackdrop(e: ReactMouseEvent): boolean {
  if (!claimed.has(e.nativeEvent)) return false;
  e.preventDefault();
  // Sinon un parent React (la zone de tracé, la liste de suivi) prendrait le fond de la modale pour lui.
  e.stopPropagation();
  const { clientX, clientY } = e;
  // Après la fermeture : la modale rend le focus au bouton qui l'avait ouverte, le menu s'ouvre ensuite.
  setTimeout(() => replayContextMenuAt(clientX, clientY), 0);
  return true;
}

function replayContextMenuAt(clientX: number, clientY: number) {
  // Toute la pile sous le point, sans les modales encore ouvertes (une autre au-dessous, ou celle-ci si l'hôte ne
  // l'a pas encore retirée).
  const under = document.elementsFromPoint(clientX, clientY).find((el) => !el.closest(".lq-modal__overlay"));
  if (!under) return;
  const init = { bubbles: true, cancelable: true, composed: true, clientX, clientY, view: window };
  // Un survol d'abord, appliqué tout de suite : le graphique sait alors quelle courbe est sous le pointeur, et le
  // menu propose les paramètres de cet indicateur comme pour un vrai clic droit.
  flushSync(() => {
    under.dispatchEvent(new PointerEvent("pointermove", { ...init, pointerType: "mouse", isPrimary: true }));
  });
  under.dispatchEvent(new MouseEvent("contextmenu", { ...init, button: 2 }));
}
