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
} as const;

/** Counted from the source, not estimated: each category's own barrel file under
 *  `src/components` (public exports only, icons split out), `DrawingToolType`, and the story
 *  exports across every `.stories.tsx`.
 *  Re-check them before quoting a bigger number — a landing page that inflates its own figures is
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
    title: "Graphiques faits pour la finance",
    body:
      "Chandeliers, Heikin Ashi, Renko, Line Break, ligne de clôture. Volume, événements, résultats, seasonality, replay, comparaison de symboles — et un rendu canvas qui encaisse dix ans d'historique sans broncher.",
  },
  {
    icon: BrushIcon,
    title: "37 outils de dessin",
    body:
      "Tendances, canaux, pitchforks, Fibonacci, vagues d'Elliott, ETE, tasse avec anse, projections, positions longues et courtes, textes, notes et alertes posées directement sur le prix.",
  },
  {
    icon: CodeIcon,
    title: "Scripting embarqué",
    body:
      "Un éditeur CodeMirror, un moteur isolé en Web Worker, et quatre décorateurs : @indicator, @strategy, @quant, @report. Indicateurs maison, backtests, analyses multi-symboles, rapports d'entreprise.",
  },
  {
    icon: SparkleIcon,
    title: "Un assistant IA sur le graphique",
    body:
      "Sous-commandes / à la Claude, accès aux outils du graphique, génération de scripts et de rapports exportables en PDF. Votre clef API, votre fournisseur : rien n'est appelé sans vous.",
  },
  {
    icon: MoonIcon,
    title: "Pensé pour l'e-ink",
    body:
      "Hairlines, aplats francs, aucune ombre ni dégradé quand la palette est eink — parce qu'un écran qui ne rétroéclaire pas ne pardonne pas les demi-teintes. La palette color reprend exactement la même géométrie.",
  },
  {
    icon: LayersIcon,
    title: "Un vrai espace de travail",
    body:
      "Panneaux multiples synchronisés au crosshair, watchlists, recherche de symboles, fenêtres détachées dans un second écran, plein écran, dispositions sauvegardables.",
  },
];

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
