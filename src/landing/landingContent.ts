import type { ComponentType } from "react";
import {
  ActivityIcon,
  BrushIcon,
  CodeIcon,
  LayersIcon,
  MoonIcon,
  SparkleIcon,
  type IconProps,
} from "../components/icons";

/** A Storybook path, as it appears after `?path=`. Kept together here rather than inline in the
 *  page so a renamed story shows up as one broken constant instead of a link that quietly stops
 *  resolving somewhere in the middle of the markup. */
export const LINKS = {
  candlestick: "/story/charts-candlestickchart--all-features",
  workspace: "/story/charts-chartworkspace--docs",
  homeDashboard: "/story/dashboard-maison-tableau-de-bord--maison",
  primitives: "/docs/primitives-button--docs",
  charts: "/docs/charts-lineareachart--docs",
  icons: "/docs/foundations-icons--docs",
  forms: "/docs/forms-textfield--docs",
  pages: "/docs/pages-loginpage--docs",
  typography: "/docs/foundations-typography--docs",
} as const;

/** Counted from the source, not estimated: each category's own barrel file under
 *  `src/components` (public exports only, icons split out), `DrawingToolType`, and the story
 *  exports across every `.stories.tsx`.
 *  Re-check them before quoting a bigger number. A landing page that inflates its own figures is
 *  the fastest way to lose a reader who then opens the sidebar and counts. */
export interface LandingFigure {
  value: string;
  label: string;
}

export const FIGURES: LandingFigure[] = [
  { value: "96", label: "composants exportés" },
  { value: "11", label: "graphiques D3" },
  { value: "120", label: "icônes" },
  { value: "37", label: "outils de dessin" },
  { value: "200", label: "stories" },
  { value: "4", label: "thèmes livrés" },
];

export interface LandingFeature {
  icon: ComponentType<IconProps>;
  title: string;
  body: string;
}

export const FEATURES: LandingFeature[] = [
  {
    icon: ActivityIcon,
    title: "Graphiques pour la finance",
    body:
      "Bougies, Heikin Ashi, Renko, Line Break, ligne de clôture. Volume, événements, résultats, saisonnalité, rejeu, comparaison de symboles. Le tracé passe par un canvas, ce qui laisse dix ans d'historique à l'écran sans ralentir le défilement.",
  },
  {
    icon: BrushIcon,
    title: "37 outils de dessin",
    body:
      "Tendances, canaux, pitchforks, Fibonacci, vagues d'Elliott, ETE, tasse avec anse, projections, positions longues et courtes, textes, notes, alertes posées directement sur le prix.",
  },
  {
    icon: CodeIcon,
    title: "Scripting embarqué",
    body:
      "Un éditeur CodeMirror avec autocomplétion et diagnostics, et un moteur qui s'exécute dans un Web Worker. Quatre décorateurs délimitent ce qu'un script a le droit de faire : @indicator, @strategy, @quant, @report.",
  },
  {
    icon: SparkleIcon,
    title: "Assistant IA sur le graphique",
    body:
      "Des sous-commandes / dans un panneau latéral, l'accès aux outils de la chart, la génération de scripts et de rapports d'entreprise exportables en PDF. La clef API vient de votre application, et rien n'est appelé tant qu'elle n'est pas fournie.",
  },
  {
    icon: MoonIcon,
    title: "Écrit pour l'e-ink",
    body:
      "Quand la palette vaut eink, il n'y a ni ombre ni dégradé, et les filets restent à un pixel. La palette color garde la même géométrie et se contente d'y ajouter des teintes désaturées.",
  },
  {
    icon: LayersIcon,
    title: "Espace de travail",
    body:
      "Plusieurs panneaux synchronisés au crosshair, des listes de surveillance, une recherche de symboles, des fenêtres détachables vers un second écran, des dispositions que l'application peut sauvegarder.",
  },
];

/** What each decorator on a script's first line changes about the API it gets. Taken from
 *  `scriptKind.ts` and the four `build*Api.ts` files, which are what actually enforce this. */
export interface DecoratorRow {
  name: string;
  what: string;
  gets: string;
}

export const DECORATORS: DecoratorRow[] = [
  {
    name: "@indicator",
    what: "Dessine sur le graphique.",
    gets: "plot.overlay, plot.pane, plot.signal, alert, state",
  },
  {
    name: "@strategy",
    what: "Prend des positions et se fait tester sur l'historique.",
    gets: "un compte, des ordres, une courbe d'équité, un panneau de réglages",
  },
  {
    name: "@quant",
    what: "Ne dessine rien. S'exécute une fois par symbole déclaré.",
    gets: "ce que le script renvoie devient son résultat, sauvegardable",
  },
  {
    name: "@report",
    what: "Écrit un document plutôt qu'une courbe.",
    gets: "report.title, .heading, .text, .metrics, .table, .series, export PDF",
  },
];

export const SCRIPT_SNIPPET = `@indicator
// Deux moyennes, et une alerte au croisement.
const prix = market.close(0);
const courte = math.sma(market.series("close", 50), 50);
const longue = math.sma(market.series("close", 200), 200);

plot.overlay("SMA 50").line("SMA 50", courte ?? prix);
plot.overlay("SMA 200").line("SMA 200", longue ?? prix);

// state.* garde la valeur de la bougie précédente d'un
// appel à l'autre : c'est ce qui distingue un croisement
// d'un simple écart.
const avantCourte = state.get("avantCourte", null);
const avantLongue = state.get("avantLongue", null);

if (bar.isNew() && avantCourte !== null && courte !== null) {
  if (avantCourte <= avantLongue && courte > longue) {
    plot.signal("BUY");
    alert("Golden Cross : SMA 50 au-dessus de SMA 200");
  }
}

state.set("avantCourte", courte);
state.set("avantLongue", longue);`;

export const INSTALL_SNIPPET = `# .npmrc du projet consommateur
@michaelthomasjach:registry=https://npm.pkg.github.com

npm install @michaelthomasjach/liseuse-dashboard-kit d3`;

export const USAGE_SNIPPET = `import {
  LqThemeProvider,
  CandlestickChart,
} from "@michaelthomasjach/liseuse-dashboard-kit";
import "@michaelthomasjach/liseuse-dashboard-kit/style.css";

export function App() {
  return (
    <LqThemeProvider palette="color" surface="dark">
      <CandlestickChart
        data={candles}
        symbol="MSFT"
        showVolume
        showIndicators
        drawingTools
        zoomable
      />
    </LqThemeProvider>
  );
}`;

export interface FaqEntry {
  question: string;
  answer: string;
}

/** Questions with a verifiable answer. Anything that would need a claim about performance,
 *  accessibility or a roadmap is left out rather than guessed at. */
export const FAQ: FaqEntry[] = [
  {
    question: "Faut-il installer d3 ?",
    answer:
      "d3 est une peerDependency et ne sert qu'aux composants de components/charts. Le reste de la bibliothèque fonctionne sans. react et react-dom sont également des peerDependencies.",
  },
  {
    question: "Où se trouve le paquet ?",
    answer:
      "Sur GitHub Packages, et non sur npmjs.org. Le projet consommateur a besoin d'un .npmrc qui route le scope @michaelthomasjach vers https://npm.pkg.github.com, avec un token GitHub portant le scope read:packages.",
  },
  {
    question: "Peut-on changer les couleurs ?",
    answer:
      "Oui. Aucun composant n'écrit de valeur hexadécimale : tout passe par les variables CSS --lq-*. Les redéfinir sur .lq-root change toute l'application, les redéfinir sur un conteneur ne change que ce sous-arbre.",
  },
  {
    question: "L'assistant IA appelle-t-il un service tout seul ?",
    answer:
      "Non. Le graphique n'envoie une requête que si vous lui passez une prop ai contenant votre clef ou votre propre fonction d'envoi. Sans cette prop, le bouton n'apparaît même pas.",
  },
  {
    question: "Un script long fige-t-il l'interface ?",
    answer:
      "Non, le moteur s'exécute dans un Web Worker. Le graphique reste utilisable pendant qu'un script tourne, et un script qui dépasse son budget de temps est interrompu.",
  },
  {
    question: "Qu'est-ce qui est en français ?",
    answer:
      "Toute l'interface visible : libellés, menus, messages d'erreur, documentation du scripting. Les noms de composants, de props et d'événements sont en anglais.",
  },
];
