import type { Meta, StoryObj } from "@storybook/react";
import { scaleBand, scaleLinear, scaleUtc, type AxisDomain, type AxisScale } from "d3";
import { ChartAxis } from "./ChartAxis";
import { VENTES_CANAL } from "../../test-data/storyDemoData";
import { CODE_LISIBLE, euros, moisAnnee } from "../../test-data/storyChartFormat";
import { NuageDelais } from "../../test-data/NuageDelais";
import codeNuage from "../../test-data/NuageDelais.tsx?raw";

/** Le tracé de démonstration : 560 × 200 px, et la place des libellés autour. */
const L = 560;
const H = 200;
const MARGE = { top: 12, right: 64, bottom: 30, left: 56 };

/** `ChartAxis` est générique sur le domaine de son échelle ; ses variantes, ici, en changent d'une story à l'autre. */
const echelle = <D extends AxisDomain>(s: AxisScale<D>) => s as unknown as AxisScale<AxisDomain>;

const yJours = scaleLinear().domain([0, 75]).range([H, 0]).nice();
const yPrix = scaleLinear().domain([38, 62]).range([H, 0]).nice();
const xMois = scaleUtc()
  .domain([new Date(Date.UTC(2025, 10, 1)), new Date(Date.UTC(2026, 9, 1))])
  .range([0, L]);
const xCanaux = scaleBand<string>()
  .domain(VENTES_CANAL.map((c) => c.label))
  .range([0, L])
  .padding(0.2);

const jours = (v: AxisDomain) => `${v} j`;
const moisDeLAxe = (v: AxisDomain) => moisAnnee(v as Date);
const prixDeLAxe = (v: AxisDomain) => euros(Number(v));

/**
 * L'axe d3 du kit, exposé pour composer ses propres graphiques.
 */
const meta = {
  title: "Charts/ChartAxis",
  component: ChartAxis,
  parameters: {
    ...CODE_LISIBLE,
    docs: {
      description: {
        component: [
          "L'axe qu'utilisent tous les graphiques du kit, exposé pour en **composer** un qui n'existe pas (un nuage de points, un graphique à deux échelles…). C'est un mince enrobage de `d3-axis` : d3 dessine les graduations dans un seul `<g>`, React garde la main sur tout le reste — la manière idiomatique de mêler les deux sans qu'ils se disputent les mêmes nœuds.",
          "",
          "**Quand l'utiliser** — seulement pour un graphique fait main. Si le kit a déjà le graphique (`LineAreaChart`, `BarChart`…), prenez-le : il apporte zoom, bulle, légende et plein écran.",
          "",
          "**Ce qu'il attend** — une échelle **d3** dans `scale` (`scaleLinear`, `scaleUtc` ou `scaleTime`, `scaleBand`…, du paquet `d3`, dont le kit dépend déjà), et `orientation` : `\"left\"`, `\"right\"` ou `\"bottom\"`. Il rend un `<g>` : posez-le dans un `<svg>` et placez-le avec `transform` (un axe du bas se translate de la hauteur du tracé, un axe de droite de sa largeur).",
          "",
          "**Graduations** — `ticks` (5 par défaut) est un souhait que d3 arrondit au pas « rond » le plus proche ; `tickValues` impose des positions exactes ; `tickFormat` met en forme chaque libellé ; `tickSizeOuter` (0) règle les tirets aux extrémités. Un libellé qui déborderait de l'étendue de l'échelle est masqué. `grid` prolonge chaque graduation en ligne de grille sur `gridLength` pixels (la largeur ou la hauteur du tracé, à fournir). `domainExtent` allonge ou raccourcit le trait d'axe sans toucher à l'échelle. `className=\"lq-chart__axis--hidden\"` ne garde que la grille.",
          "",
          "**Interactions** — aucune : c'est un tracé statique, que React redessine quand l'échelle change (un zoom, un redimensionnement).",
          "",
          "**Thème** — trait d'axe, tirets et grille (en pointillés) en `--lq-color-border-subtle` ; libellés en `--lq-color-text-muted`, police `--lq-font-family`, corps 0,7 rem.",
        ].join("\n"),
      },
    },
  },
  render: (args) => (
    <svg width={L + MARGE.left + MARGE.right} height={H + MARGE.top + MARGE.bottom} style={{ maxWidth: "100%", overflow: "visible" }}>
      <g transform={`translate(${MARGE.left},${MARGE.top})`}>
        <ChartAxis {...args} />
      </g>
    </svg>
  ),
  args: {
    scale: echelle(yJours),
    orientation: "left",
    ticks: 5,
    grid: true,
    gridLength: L,
    tickFormat: jours,
  },
  argTypes: {
    scale: { control: false },
    tickFormat: { control: false },
    tickValues: { control: false },
    domainExtent: { control: false },
    transform: { control: "text" },
    ticks: { control: { type: "range", min: 2, max: 12, step: 1 } },
  },
} satisfies Meta<typeof ChartAxis>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Défaut",
  parameters: {
    docs: {
      description: {
        story: "Un axe de valeurs à gauche (`scaleLinear`, 0 à 75 jours) dont les graduations se prolongent en grille sur toute la largeur du tracé.",
      },
    },
  },
};

export const TimeAxis: Story = {
  name: "Axe du temps en bas",
  args: {
    scale: echelle(xMois),
    orientation: "bottom",
    transform: `translate(0,${H})`,
    ticks: 6,
    grid: false,
    tickFormat: moisDeLAxe,
  },
  parameters: {
    docs: {
      description: {
        story: "Un axe du bas sur une `scaleUtc`, translaté de la hauteur du tracé (`transform`). d3 choisit des dates rondes ; `tickFormat` les écrit en mois courts. Des données datées en UTC appellent `scaleUtc` : une `scaleTime` graduerait en heure locale, et ses graduations, lues en UTC, glisseraient d'un jour — d'un mois pour un 1er du mois.",
      },
    },
  },
};

export const RightAxis: Story = {
  name: "Axe à droite",
  args: { scale: echelle(yPrix), orientation: "right", transform: `translate(${L},0)`, tickFormat: prixDeLAxe },
  parameters: {
    docs: {
      description: {
        story: "La convention des graphiques de cours : l'échelle des prix à droite, translatée de la largeur du tracé. La grille part alors vers la gauche.",
      },
    },
  },
};

export const BandAxis: Story = {
  name: "Axe de catégories",
  args: { scale: echelle(xCanaux), orientation: "bottom", transform: `translate(0,${H})`, grid: false, tickFormat: undefined },
  parameters: {
    docs: {
      description: {
        story: "Une `scaleBand` : une graduation par catégorie, centrée sur sa bande. C'est l'échelle d'un histogramme fait main.",
      },
    },
  },
};

export const TickValues: Story = {
  name: "Graduations imposées",
  args: { tickValues: [0, 30, 45, 60] },
  parameters: {
    docs: {
      description: {
        story: "`tickValues` remplace le calcul automatique : ici les seules échéances de paiement qui comptent — comptant, 30, 45 et 60 jours.",
      },
    },
  },
};

export const GridOnly: Story = {
  name: "Grille seule",
  args: { className: "lq-chart__axis--hidden" },
  parameters: {
    docs: {
      description: {
        story: "`className=\"lq-chart__axis--hidden\"` masque libellés, trait et tirets : il ne reste que la grille, pour un graphique dont les valeurs se lisent ailleurs.",
      },
    },
  },
};

export const Composed: Story = {
  name: "Composer un graphique",
  render: () => <NuageDelais />,
  parameters: {
    docs: {
      source: { code: codeNuage },
      description: {
        story: "Un nuage de points écrit avec deux `ChartAxis` et un `ChartTooltip` : délai de paiement selon le montant facturé, les retards au-delà de 45 jours en `--lq-color-down`. Survolez un point. Le code ci-dessous est le composant complet.",
      },
    },
  },
};
