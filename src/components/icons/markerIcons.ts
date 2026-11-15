/**
 * Icônes de repère : celles qu'une règle de style conditionnel pose sur une courbe ou sur une bougie (« Ajouter une
 * icône »), et qu'un script peut choisir pour `plot.signal` / `plot.point` (option `icon`).
 *
 * Même facture que les autres icônes du kit (viewBox 24×24, trait `currentColor` de 1,75, bouts ronds), mais décrites
 * par de simples chemins SVG (`d`) plutôt que par du JSX : le même dessin sert au composant React (`MarkerIcon`, dans
 * la grille de choix) et au canevas du graphique (`new Path2D(d)`, voir `drawMarkerIcon`), sans deuxième version à
 * tenir à jour. Les cercles sont donc écrits en arcs, et un point est un trait de longueur nulle aux bouts ronds.
 * `filled` : la forme est aussi remplie de la couleur du trait — une forme pleine se lit mieux sur un graphique chargé.
 */

export type MarkerIconCategory = "arrows" | "shapes" | "signals" | "symbols" | "money";

export interface MarkerIconDef {
  /** Identifiant enregistré dans les règles et passé par les scripts (`"rocket"`, `"triangle-up"`…). */
  id: string;
  /** Nom affiché (infobulle, recherche). */
  label: string;
  category: MarkerIconCategory;
  /** Mots de recherche en plus du nom (synonymes, anglais). */
  keywords: string[];
  /** Un ou plusieurs chemins SVG dans le repère 24×24. */
  d: string;
  /** Remplie de la couleur du trait. */
  filled?: boolean;
}

export const MARKER_ICON_CATEGORIES: { value: MarkerIconCategory; label: string }[] = [
  { value: "arrows", label: "Flèches" },
  { value: "shapes", label: "Formes" },
  { value: "signals", label: "Signaux" },
  { value: "symbols", label: "Symboles" },
  { value: "money", label: "Finance" },
];

/** Un cercle en chemin SVG (deux demi-arcs). */
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

export const MARKER_ICONS: MarkerIconDef[] = [
  // Flèches
  { id: "arrow-up", label: "Flèche vers le haut", category: "arrows", keywords: ["haut", "hausse", "up", "achat", "buy"], d: "M12 19.5V4.5M5.5 11 12 4.5l6.5 6.5" },
  { id: "arrow-down", label: "Flèche vers le bas", category: "arrows", keywords: ["bas", "baisse", "down", "vente", "sell"], d: "M12 4.5v15M5.5 13 12 19.5l6.5-6.5" },
  { id: "arrow-up-bold", label: "Grosse flèche vers le haut", category: "arrows", keywords: ["haut", "hausse", "up", "pleine"], d: "M12 3.5 20 12h-4.5v8.5h-7V12H4L12 3.5Z", filled: true },
  { id: "arrow-down-bold", label: "Grosse flèche vers le bas", category: "arrows", keywords: ["bas", "baisse", "down", "pleine"], d: "M12 20.5 4 12h4.5V3.5h7V12H20l-8 8.5Z", filled: true },
  { id: "arrow-up-right", label: "Flèche en hausse", category: "arrows", keywords: ["diagonale", "hausse", "up", "nord-est"], d: "M6.5 17.5 17.5 6.5M8.5 6.5h9v9" },
  { id: "arrow-down-right", label: "Flèche en baisse", category: "arrows", keywords: ["diagonale", "baisse", "down", "sud-est"], d: "M6.5 6.5l11 11M17.5 8.5v9h-9" },
  { id: "chevron-up", label: "Chevron vers le haut", category: "arrows", keywords: ["haut", "up", "chevron"], d: "M5.5 15.5 12 9l6.5 6.5" },
  { id: "chevron-down", label: "Chevron vers le bas", category: "arrows", keywords: ["bas", "down", "chevron"], d: "M5.5 8.5 12 15l6.5-6.5" },
  { id: "chevrons-up", label: "Double chevron vers le haut", category: "arrows", keywords: ["haut", "up", "fort", "double"], d: "M5.5 12.5 12 6l6.5 6.5M5.5 18.5 12 12l6.5 6.5" },
  { id: "chevrons-down", label: "Double chevron vers le bas", category: "arrows", keywords: ["bas", "down", "fort", "double"], d: "M5.5 5.5 12 12l6.5-6.5M5.5 11.5 12 18l6.5-6.5" },
  { id: "trend-up", label: "Tendance haussière", category: "arrows", keywords: ["tendance", "hausse", "trend", "up", "graphique"], d: "M3 17.5l6-6 4 4 8-8M15 7.5h6v6" },
  { id: "trend-down", label: "Tendance baissière", category: "arrows", keywords: ["tendance", "baisse", "trend", "down", "graphique"], d: "M3 6.5l6 6 4-4 8 8M15 16.5h6v-6" },

  // Formes
  { id: "circle-filled", label: "Point", category: "shapes", keywords: ["point", "rond", "cercle", "dot", "plein"], d: circle(12, 12, 6), filled: true },
  { id: "circle", label: "Cercle", category: "shapes", keywords: ["rond", "anneau", "circle", "vide"], d: circle(12, 12, 7.5) },
  { id: "triangle-up", label: "Triangle vers le haut", category: "shapes", keywords: ["triangle", "haut", "hausse", "up", "plein"], d: "M12 4.5 20.5 19h-17L12 4.5Z", filled: true },
  { id: "triangle-down", label: "Triangle vers le bas", category: "shapes", keywords: ["triangle", "bas", "baisse", "down", "plein"], d: "M12 19.5 3.5 5h17L12 19.5Z", filled: true },
  { id: "triangle-up-outline", label: "Triangle creux vers le haut", category: "shapes", keywords: ["triangle", "haut", "up", "vide"], d: "M12 4.5 20.5 19h-17L12 4.5Z" },
  { id: "triangle-down-outline", label: "Triangle creux vers le bas", category: "shapes", keywords: ["triangle", "bas", "down", "vide"], d: "M12 19.5 3.5 5h17L12 19.5Z" },
  { id: "square-filled", label: "Carré", category: "shapes", keywords: ["carré", "square", "plein"], d: "M5.5 5.5h13v13h-13Z", filled: true },
  { id: "square", label: "Carré creux", category: "shapes", keywords: ["carré", "square", "vide"], d: "M5.5 5.5h13v13h-13Z" },
  { id: "diamond-filled", label: "Losange", category: "shapes", keywords: ["losange", "diamant", "diamond", "plein"], d: "M12 3.5 20.5 12 12 20.5 3.5 12 12 3.5Z", filled: true },
  { id: "diamond", label: "Losange creux", category: "shapes", keywords: ["losange", "diamant", "diamond", "vide"], d: "M12 3.5 20.5 12 12 20.5 3.5 12 12 3.5Z" },
  { id: "star-filled", label: "Étoile", category: "shapes", keywords: ["étoile", "star", "favori", "plein"], d: "M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8Z", filled: true },
  { id: "star", label: "Étoile creuse", category: "shapes", keywords: ["étoile", "star", "favori", "vide"], d: "M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8Z" },
  { id: "heart", label: "Cœur", category: "shapes", keywords: ["coeur", "cœur", "heart", "favori", "aime"], d: "M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z", filled: true },
  { id: "hexagon", label: "Hexagone", category: "shapes", keywords: ["hexagone", "hexagon", "plein"], d: "M12 3.5l7.4 4.25v8.5L12 20.5l-7.4-4.25v-8.5L12 3.5Z", filled: true },
  { id: "sparkle", label: "Étincelle", category: "shapes", keywords: ["étincelle", "sparkle", "brillant", "nouveau"], d: "M12 2.5c.75 4.6 2.4 6.75 7.5 9.5-5.1 2.75-6.75 4.9-7.5 9.5-.75-4.6-2.4-6.75-7.5-9.5 5.1-2.75 6.75-4.9 7.5-9.5Z", filled: true },

  // Signaux
  { id: "flag", label: "Drapeau", category: "signals", keywords: ["drapeau", "flag", "repère", "objectif"], d: "M6 21V4M6 4h12l-4 4 4 4H6", filled: true },
  { id: "bell", label: "Cloche", category: "signals", keywords: ["cloche", "bell", "alerte", "alarme", "notification"], d: "M6 10.5a6 6 0 0 1 12 0c0 4 1.5 5.2 1.5 5.7H4.5c0-.5 1.5-1.7 1.5-5.7ZM10 19a2 2 0 0 0 4 0" },
  { id: "bolt", label: "Éclair", category: "signals", keywords: ["éclair", "bolt", "foudre", "rapide", "énergie"], d: "M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8Z", filled: true },
  { id: "target", label: "Cible", category: "signals", keywords: ["cible", "target", "objectif", "viser"], d: `${circle(12, 12, 8.5)}${circle(12, 12, 4.75)}M12 12h.01` },
  { id: "fire", label: "Feu", category: "signals", keywords: ["feu", "flamme", "fire", "chaud", "hot"], d: "M12 21c-3.9 0-6.5-2.7-6.5-6.3 0-3.4 2.4-5.3 3.6-8.2.6 1.6 1.4 2.6 2.4 3.1.3-3.4 1.9-5.8 4-7.1-.3 2.6.6 4.3 1.8 6 1 1.4 1.7 3 1.7 5.1 0 4-2.9 7.4-7 7.4Z", filled: true },
  { id: "rocket", label: "Fusée", category: "signals", keywords: ["fusée", "rocket", "décollage", "envol", "moon"], d: "M14.5 4.5c2.4-1 4.4-1 5-1 0 .6 0 2.6-1 5-1.3 3.1-3.9 5.6-6.9 7.2l-3.3-3.3c1.6-3 4.1-5.6 6.2-7.9ZM8.3 12.4 5 11.9l2.3-3.2h3.5M11.6 15.7l.5 3.3 3.2-2.3v-3.5M15.5 8.5h.01M6.5 15.5c-1.3.4-2 1.8-2 4 2.2 0 3.6-.7 4-2" },
  { id: "thumb-up", label: "Pouce levé", category: "signals", keywords: ["pouce", "haut", "like", "ok", "approuvé"], d: "M7.5 10.5v9.5h-3v-9.5h3ZM7.5 10.5l3.5-7c1.4 0 2.5 1.1 2.5 2.5v3h5a2 2 0 0 1 2 2.3l-1.2 6.5a2 2 0 0 1-2 1.7H7.5" },
  { id: "thumb-down", label: "Pouce baissé", category: "signals", keywords: ["pouce", "bas", "dislike", "refusé"], d: "M7.5 13.5V4h-3v9.5h3ZM7.5 13.5l3.5 7c1.4 0 2.5-1.1 2.5-2.5v-3h5a2 2 0 0 0 2-2.3l-1.2-6.5a2 2 0 0 0-2-1.7H7.5" },
  { id: "lock", label: "Cadenas", category: "signals", keywords: ["cadenas", "verrou", "lock", "fermé", "bloqué"], d: "M6.5 10.5h11a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5V12a1.5 1.5 0 0 1 1.5-1.5ZM7.5 10.5V7.5a4.5 4.5 0 0 1 9 0v3" },
  { id: "unlock", label: "Cadenas ouvert", category: "signals", keywords: ["cadenas", "ouvert", "unlock", "débloqué"], d: "M6.5 10.5h11a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5V12a1.5 1.5 0 0 1 1.5-1.5ZM7.5 10.5V7.5a4.5 4.5 0 0 1 8.6-1.9" },
  { id: "pin", label: "Épingle", category: "signals", keywords: ["épingle", "repère", "pin", "lieu"], d: `M12 21s7-7.5 7-12.5A7 7 0 0 0 5 8.5C5 13.5 12 21 12 21Z${circle(12, 8.5, 2.2)}` },
  { id: "clock", label: "Horloge", category: "signals", keywords: ["horloge", "heure", "clock", "temps", "attente"], d: `${circle(12, 12, 8.5)}M12 7.5V12l3 2` },
  { id: "eye", label: "Œil", category: "signals", keywords: ["oeil", "œil", "eye", "surveiller", "voir"], d: `M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z${circle(12, 12, 3)}` },
  { id: "stop", label: "Stop", category: "signals", keywords: ["stop", "arrêt", "octogone", "sortie"], d: "M8.3 3.5h7.4l4.8 4.8v7.4l-4.8 4.8H8.3l-4.8-4.8V8.3l4.8-4.8Z", filled: true },

  // Symboles
  { id: "check", label: "Coche", category: "symbols", keywords: ["coche", "check", "valide", "ok", "oui"], d: "M5 12.5l4.5 4.5L19 7.5" },
  { id: "check-circle", label: "Coche cerclée", category: "symbols", keywords: ["coche", "check", "valide", "ok"], d: `${circle(12, 12, 9)}M8 12.3l2.8 2.8L16.2 9.7` },
  { id: "cross", label: "Croix", category: "symbols", keywords: ["croix", "x", "non", "annulé", "close"], d: "M6 6l12 12M18 6 6 18" },
  { id: "cross-circle", label: "Croix cerclée", category: "symbols", keywords: ["croix", "x", "non", "erreur"], d: `${circle(12, 12, 9)}M9 9l6 6M15 9l-6 6` },
  { id: "plus", label: "Plus", category: "symbols", keywords: ["plus", "ajout", "positif"], d: "M12 5v14M5 12h14" },
  { id: "minus", label: "Moins", category: "symbols", keywords: ["moins", "retrait", "négatif"], d: "M5 12h14" },
  { id: "exclamation", label: "Point d'exclamation", category: "symbols", keywords: ["exclamation", "attention", "alerte", "important", "!"], d: "M12 4.5v10M12 19.3v.2" },
  { id: "warning", label: "Avertissement", category: "symbols", keywords: ["attention", "avertissement", "warning", "danger", "triangle"], d: "M12 3.5 21.5 20h-19L12 3.5ZM12 9.5v4.4M12 16.8v.1" },
  { id: "question", label: "Point d'interrogation", category: "symbols", keywords: ["question", "interrogation", "doute", "?"], d: "M8.8 8.8a3.3 3.3 0 0 1 6.4 1.1c0 2.2-3.2 2.7-3.2 4.6M12 19v.2" },
  { id: "info", label: "Information", category: "symbols", keywords: ["info", "information", "i", "note"], d: `${circle(12, 12, 9)}M12 11v5.5M12 7.8v.1` },

  // Finance
  { id: "dollar", label: "Dollar", category: "money", keywords: ["dollar", "$", "usd", "argent", "prix"], d: "M12 3v18M16.5 7.6C15.9 6 14.2 5 12 5 9.4 5 7.5 6.3 7.5 8.3c0 4.6 9 2.4 9 7 0 2.1-2 3.4-4.5 3.4-2.3 0-4-1-4.7-2.7" },
  { id: "euro", label: "Euro", category: "money", keywords: ["euro", "€", "eur", "argent", "prix"], d: "M17.5 6.6A6.5 6.5 0 0 0 7 12a6.5 6.5 0 0 0 10.5 5.4M4.5 10h9M4.5 14h8" },
  { id: "percent", label: "Pourcentage", category: "money", keywords: ["pourcentage", "pourcent", "%", "variation", "taux"], d: `M18.5 5.5 5.5 18.5${circle(7, 7, 2.5)}${circle(17, 17, 2.5)}` },
  { id: "coin", label: "Pièce", category: "money", keywords: ["pièce", "monnaie", "coin", "argent", "dividende"], d: `${circle(12, 12, 8.5)}${circle(12, 12, 5)}` },
  { id: "bank", label: "Banque", category: "money", keywords: ["banque", "bank", "banque centrale", "taux"], d: "M3.5 9.5 12 4l8.5 5.5ZM5.5 10v7M10 10v7M14 10v7M18.5 10v7M3.5 20h17" },
  { id: "news", label: "Actualité", category: "money", keywords: ["actualité", "news", "journal", "publication", "résultats"], d: "M4.5 5.5h12v13a1.5 1.5 0 0 0 1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5v-13ZM16.5 9.5h3v9a1.5 1.5 0 0 1-3 0M7.5 9h6M7.5 12.5h6M7.5 16h4" },
];

const BY_ID = new Map(MARKER_ICONS.map((icon) => [icon.id, icon]));

/** L'icône repère dans le catalogue ; un identifiant inconnu (ancien, mal tapé dans un script) donne le point. */
export function markerIconById(id: string | undefined | null): MarkerIconDef {
  return (id && BY_ID.get(id)) || BY_ID.get("circle-filled")!;
}

/** Vrai si `id` nomme une icône du catalogue. */
export function isMarkerIconId(id: unknown): id is string {
  return typeof id === "string" && BY_ID.has(id);
}

/** Recherche dans le catalogue, sans tenir compte des accents ni de la casse : le nom, l'identifiant et les mots-clés. */
export function searchMarkerIcons(query: string, category?: MarkerIconCategory | null): MarkerIconDef[] {
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = fold(query.trim());
  return MARKER_ICONS.filter((icon) => {
    if (category && icon.category !== category) return false;
    if (!q) return true;
    return [icon.label, icon.id, ...icon.keywords].some((s) => fold(s).includes(q));
  });
}
