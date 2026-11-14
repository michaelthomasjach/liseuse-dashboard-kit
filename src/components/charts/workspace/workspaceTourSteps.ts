import type { WorkspaceTourStep } from "./WorkspaceTour";

/** What the tour points at, in the order a first-time reader meets it.
 *
 *  The chart first, because that is what they came for; then the two rails, which is where
 *  everything else lives; then the way back to this tour. Each step is one sentence about what the
 *  thing is *for* — not a list of its buttons, which the buttons themselves already answer once
 *  the reader knows they are worth hovering.
 *
 *  A step whose target is absent is skipped, so the same list serves a bare workspace and a fully
 *  equipped one without either being told about something it does not have. */
export const WORKSPACE_TOUR_STEPS: WorkspaceTourStep[] = [
  {
    selector: ".lq-chart__header",
    title: "L'en-tête du graphique",
    body: "Le symbole, l'unité de temps et le type de représentation — bougies, barres, ligne de clôture, Heikin Ashi, Renko. Le rejeu de l'historique bougie par bougie part d'ici aussi.",
  },
  {
    selector: '.lq-chart__header [aria-label="Replay"]',
    title: "Le replay",
    body: "Revenez à n'importe quelle date et rejouez le marché bougie par bougie, sans voir la suite. Avec plusieurs fenêtres ouvertes, toutes suivent la même date.",
  },
  {
    selector: '.lq-chart__header [aria-label="Ajouter un indicateur"]',
    title: "Les indicateurs",
    body: "Moyennes, RSI, MACD, Bollinger et bien d'autres. Dans leurs paramètres, l'onglet Style règle couleurs et zones colorées : un RSI vert au-dessus de 50 et rouge en dessous, par exemple.",
  },
  {
    selector: ".lq-chart__tools-rail",
    title: "Les outils de dessin",
    body: "Lignes de tendance, Fibonacci, vagues, textes, mesures. Restez immobile sur un outil un instant : une note apparaît à côté et dit à quoi il sert.",
  },
  {
    selector: ".lq-chart-workspace__side-rail",
    title: "Tout le reste",
    body: "Liste de surveillance, alertes, éditeur de scripts, assistant, connexion à un courtier, écran divisé. Un panneau à la fois, pour tout l'espace de travail.",
  },
  {
    selector: '.lq-chart-workspace__side-rail [aria-label="Éditeur de script"]',
    title: "Vos propres indicateurs",
    body: "L'éditeur de scripts : écrivez un indicateur, une stratégie avec son backtest ou une analyse, dans un langage documenté. Le résultat s'affiche aussitôt sur le graphique.",
  },
  {
    selector: '.lq-chart-workspace__side-rail [aria-label="Assistant"]',
    title: "L'assistant IA",
    body: "Posez vos questions sur le graphique, ou demandez-lui un indicateur : il ouvre l'éditeur et écrit le code. Demandez-lui aussi où se trouve une fonction, il vous montre le bouton.",
  },
  {
    selector: '.lq-chart-workspace__side-rail [aria-label="Disposition des fenêtres"], [aria-label="Disposition des fenêtres"]',
    title: "Plusieurs graphiques",
    body: "Jusqu'à huit fenêtres côte à côte. Liez-les pour qu'elles suivent le même curseur et la même période ; la dernière fenêtre cliquée est entourée d'un liseré.",
  },
  {
    selector: '.lq-chart-workspace__side-rail [aria-label*="(MCP)"]',
    title: "Votre IA reliée à votre compte",
    body: "Connectez Claude, ChatGPT ou un autre assistant (MCP) : il lit vos données, pilote ce graphique et gère vos alertes de prix, depuis sa propre conversation.",
  },
  {
    selector: ".lq-chart-workspace__help-button",
    title: "Revenir ici",
    body: "Cette visite ne se rouvre pas toute seule une fois fermée. Ce bouton la relance quand vous voulez.",
  },
];
