import { useState } from "react";
import { SAMPLE_BROKERS } from "../../test-data/sampleBrokers";
import { AAPL_FINANCIALS } from "../../test-data/symbolFinancialsSample";
import type { Meta, StoryObj } from "@storybook/react";
import { ChartWorkspace, type ChartWorkspaceGridLayoutId } from "./ChartWorkspace";
import { CandlestickChart } from "./CandlestickChart";
import { generateCandles, generateCandlesByTimeframe } from "../../test-data/financeSampleData";
import type { ChartWorkspaceWatchlist } from "./workspace/ChartWorkspaceWatchlist.interface";
import type { SymbolProfile } from "./workspace/SymbolProfile.interface";

const meta: Meta<typeof ChartWorkspace> = {
  title: "Charts/ChartWorkspace",
  component: ChartWorkspace,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof ChartWorkspace>;

// Different lengths/base prices/seeds per symbol on purpose — proves the crosshair sync lines up
// by *date*, not by raw candle index, across panels whose own data doesn't otherwise match up.
const DATASETS: Record<string, ReturnType<typeof generateCandles>> = {
  AAPL: generateCandles(400, 190, 11),
  MSFT: generateCandles(320, 410, 27),
  NVDA: generateCandles(400, 120, 42),
  GOOGL: generateCandles(260, 165, 58),
  TSLA: generateCandles(340, 240, 73),
  AMZN: generateCandles(300, 175, 19),
  META: generateCandles(280, 480, 35),
  AMD: generateCandles(360, 140, 88),
};

export const EightPanels: Story = {
  name: "8 panneaux (2 liés, changer la disposition)",
  render: () => {
    const [groups, setGroups] = useState<number[][]>([[0, 1]]);
    return (
      <div style={{ padding: 24 }}>
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
          `defaultPanels={8}` — huit graphiques pré-configurés en enfants ; AAPL et MSFT (panneaux 1 et 2) sont
          liés par défaut (`defaultLinkGroups`) : survoler l'une des deux affiche le crosshair sur l'autre, à la
          date la plus proche dans <em>ses propres</em> données (longueurs et plages différentes entre les huit
          séries, exprès). L'icône chaîne de chaque en-tête gère les groupes ; le bouton « Disposition des
          fenêtres » du rail de droite (il montre la disposition courante) change la grille de tout l'espace
          de travail : de 1 à 8 fenêtres, côte à côte, empilées ou une grande à côté de plusieurs petites.
        </p>
        <ChartWorkspace brokers={SAMPLE_BROKERS} defaultPanels={8} defaultLinkGroups={groups} onLinkGroupsChange={setGroups}>
          <CandlestickChart data={DATASETS.AAPL} symbol="AAPL" zoomable />
          <CandlestickChart data={DATASETS.MSFT} symbol="MSFT" zoomable />
          <CandlestickChart data={DATASETS.NVDA} symbol="NVDA" zoomable />
          <CandlestickChart data={DATASETS.GOOGL} symbol="GOOGL" zoomable />
          <CandlestickChart data={DATASETS.TSLA} symbol="TSLA" zoomable />
          <CandlestickChart data={DATASETS.AMZN} symbol="AMZN" zoomable />
          <CandlestickChart data={DATASETS.META} symbol="META" zoomable />
          <CandlestickChart data={DATASETS.AMD} symbol="AMD" zoomable />
        </ChartWorkspace>
      </div>
    );
  },
};

// Une série hebdomadaire sur une dizaine d'années, à lier avec des séries journalières d'un an et
// demi : la synchronisation doit se faire par date, pas par numéro de bougie, et un graphique doit
// savoir quoi faire d'une plage qui déborde de son historique.
const NVDA_WEEKLY = generateCandlesByTimeframe(120, 42)["1w"];

/** Trois graphiques liés de symboles, d'unités de temps et d'historiques différents : déplacer ou
 *  zoomer l'un (glisser, molette, axe des dates, Espace…) montre aussitôt la même période sur les
 *  deux autres, image par image pendant le geste, chacun calé sur ses propres bougies, et l'échelle
 *  des prix de chacun s'ajuste aux bougies affichées — y compris sur MSFT, dont l'ajustement
 *  automatique est coupé (`YAutoScaling={false}`), et sur le RSI d'AAPL. Le graphique qu'on manipule
 *  garde son comportement habituel. Dézoomer NVDA (hebdo, dix ans) au-delà de l'historique des deux
 *  autres les montre en entier, sans les vider. */
export const LinkedVisibleRange: Story = {
  name: "Graphiques liés : même période affichée (3 symboles)",
  render: () => (
    <div>
      <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
        AAPL (journalier, 400 bougies, RSI), MSFT (journalier, 320 bougies, ajustement vertical coupé) et NVDA
        (hebdomadaire, une dizaine d'années) sont liés : glisser ou zoomer l'un déplace les deux autres sur les mêmes
        dates. Délier un graphique (icône chaîne) le rend indépendant.
      </p>
      <ChartWorkspace brokers={SAMPLE_BROKERS} defaultPanels={3} panelHeight={520} defaultLinkGroups={[[0, 1, 2]]}>
        <CandlestickChart
          data={DATASETS.AAPL}
          symbol="AAPL"
          zoomable
          showIndicators
          defaultIndicators={[{ id: "i-0", kind: "rsi", period: 14 }]}
          initialVisibleCandles={120}
        />
        <CandlestickChart data={DATASETS.MSFT} symbol="MSFT" zoomable YAutoScaling={false} initialVisibleCandles={120} />
        <CandlestickChart data={NVDA_WEEKLY} symbol="NVDA · hebdo" zoomable initialVisibleCandles={60} />
      </ChartWorkspace>
    </div>
  ),
};

export const TwoPanels: Story = {
  name: "2 panneaux",
  render: () => (
    // No wrapper padding — ChartWorkspace fills 100% of the viewport height by default (see its
    // own `panelHeight` doc), and the negative margin cancels the global Storybook decorator's
    // own 32px padding (see .storybook/preview.tsx) so that fit is exact, same fix as
    // CandlestickChart.stories.tsx's own "Toutes les options" story.
    <div style={{ margin: -32 }}>
      <ChartWorkspace brokers={SAMPLE_BROKERS} defaultPanels={2}>
        <CandlestickChart data={DATASETS.AAPL} symbol="AAPL" zoomable />
        <CandlestickChart data={DATASETS.MSFT} symbol="MSFT" zoomable />
      </ChartWorkspace>
    </div>
  ),
};

/** Le menu « Disposition des fenêtres » du rail de droite, ouvert sur une disposition qui n'est pas
 *  une simple grille : 1 grande fenêtre à gauche, 2 empilées à droite. Le menu montre une ligne par
 *  nombre de fenêtres (1 à 8) et une icône par disposition, dessinée depuis la même définition que la
 *  grille. Huit graphiques en enfants : la disposition choisie prend les N premiers. */
export const GridLayouts: Story = {
  name: "Dispositions des fenêtres (menu à icônes)",
  render: () => (
    <div style={{ margin: -32 }}>
      <ChartWorkspace brokers={SAMPLE_BROKERS} defaultGridLayout="3-big-left">
        {Object.entries(DATASETS).map(([symbol, data]) => (
          <CandlestickChart key={symbol} data={data} symbol={symbol} zoomable />
        ))}
      </ChartWorkspace>
    </div>
  ),
};

const GRID_LAYOUT_STORAGE_KEY = "lq-story-workspace-grid-layout";

/** La disposition tenue par l'hôte (`gridLayout` + `onGridLayoutChange`) et retrouvée au
 *  rechargement : l'espace de travail ne mémorise rien lui-même, c'est l'hôte qui garde le choix —
 *  ici dans localStorage — et le lui rend. Recharger la page après avoir choisi une disposition la
 *  rouvre telle quelle. */
export const RememberedGridLayout: Story = {
  name: "Disposition contrôlée et mémorisée",
  render: function RememberedGridLayoutStory() {
    const [layout, setLayout] = useState<ChartWorkspaceGridLayoutId>(() => {
      try {
        return (window.localStorage.getItem(GRID_LAYOUT_STORAGE_KEY) as ChartWorkspaceGridLayoutId | null) ?? "5-big-left";
      } catch {
        return "5-big-left";
      }
    });
    return (
      <div style={{ margin: -32 }}>
        <ChartWorkspace
          brokers={SAMPLE_BROKERS}
          gridLayout={layout}
          onGridLayoutChange={(id) => {
            setLayout(id);
            try {
              window.localStorage.setItem(GRID_LAYOUT_STORAGE_KEY, id);
            } catch {
              // Rien à mémoriser si le navigateur refuse : la disposition reste celle de la session.
            }
          }}
        >
          {Object.entries(DATASETS).map(([symbol, data]) => (
            <CandlestickChart key={symbol} data={data} symbol={symbol} zoomable />
          ))}
        </ChartWorkspace>
      </div>
    );
  },
};

const SYMBOL_PROFILE_WATCHLISTS: ChartWorkspaceWatchlist[] = [
  {
    id: "wl-1",
    name: "Liste de surveillance",
    columns: [{ id: "price", label: "Prix" }],
    rows: [
      { id: "r-msft", ticker: "MSFT", values: { price: "412,88" } },
      { id: "r-nvda", ticker: "NVDA", values: { price: "128,47" } },
      { id: "r-aapl", ticker: "AAPL", values: { price: "231,05" } },
    ],
  },
];

// A gently rising/falling seasonal path (cumulative % through a reference year) — just enough
// points for Sparkline to read as a real trend, not meant to represent any real seasonality math.
const SEASONALITY_PATH = generateCandles(52, 100, 5).map((c) => ({ date: c.date, value: c.close - 100 }));

/** A worked example of everything the details modal's own tabs can render, in the shape an
 *  application would supply it (see `SymbolFinancials`). Figures are illustrative, not real. */

const SYMBOL_PROFILES: SymbolProfile[] = [
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    instrumentType: "Action",
    marketStatus: "Marché fermé",
    financials: AAPL_FINANCIALS,
    description:
      "Apple Inc. conçoit, fabrique et commercialise des smartphones, ordinateurs personnels, tablettes, montres connectées et accessoires, et propose une large gamme de services associés (App Store, iCloud, Apple Music, Apple Pay). L'entreprise vend ses produits dans le monde entier via ses propres magasins, son site en ligne et des revendeurs tiers.",
    sectors: ["Technologie", "Matériel informatique", "Électronique grand public"],
    performance: [
      { label: "1S", changePercent: 0.8 },
      { label: "1M", changePercent: -2.3 },
      { label: "3M", changePercent: 5.1 },
      { label: "6M", changePercent: 12.4 },
      { label: "YTD", changePercent: 18.6 },
      { label: "1A", changePercent: 24.7 },
    ],
    seasonality: SEASONALITY_PATH,
    news: [
      {
        id: "n-1",
        time: "Il y a 2 jours",
        headline: "Wall Street mise sur le succès de GTA 6 — le titre Take-Two en profite.",
        provider: "Barrons.com",
      },
      { id: "n-2", time: "Il y a 4 jours", headline: "Apple prépare un nouveau cycle de produits pour la rentrée." },
    ],
    keyStats: {
      nextEarningsInDays: 67,
      volume: "3,71 M",
      averageVolume: "2,22 M",
      marketCap: "44,01 Md",
    },
    earnings: [
      { date: "T4 24", estimateEps: 1.4, actualEps: 1.55 },
      { date: "T1 25", estimateEps: 1.1, actualEps: 1.2 },
      { date: "T2 25", estimateEps: 0.75, actualEps: 0.68 },
      { date: "T3 25", estimateEps: 0.95, actualEps: 1.35 },
      { date: "T4 25", estimateEps: 1.2 },
    ],
  },
];

export const SymbolProfileWorkspace: Story = {
  name: "Panneau latéral — infos sur l'entreprise (sous la liste de surveillance)",
  render: () => (
    <div style={{ margin: -32 }}>
      <ChartWorkspace brokers={SAMPLE_BROKERS} defaultPanels={1} watchlists={SYMBOL_PROFILE_WATCHLISTS} symbolProfiles={SYMBOL_PROFILES}>
        <CandlestickChart data={DATASETS.AAPL} symbol="AAPL" zoomable />
      </ChartWorkspace>
    </div>
  ),
};

const PICK_WATCHLISTS: ChartWorkspaceWatchlist[] = [
  {
    id: "wl-pick",
    name: "Liste de surveillance",
    columns: [{ id: "last", label: "Dernier" }],
    rows: Object.entries(DATASETS).map(([ticker, data]) => ({
      id: `r-${ticker}`,
      ticker,
      values: { last: data[data.length - 1].close.toFixed(2).replace(".", ",") },
    })),
  },
];

/** Cliquer le nom du symbole d'une fenêtre (en haut à gauche du tracé) ouvre la liste de
 *  surveillance pour cette fenêtre-là : les autres s'estompent, et le symbole cliqué ensuite dans la
 *  liste va dans la fenêtre visée, sans passer par la question « quelle fenêtre ». Échap, la
 *  fermeture du panneau ou un clic dans une autre fenêtre abandonnent. L'hôte tient un symbole par
 *  fenêtre grâce à `onPanelSymbolChange`, et donne à chacune les données de son symbole. */
export const PickPanelSymbol: Story = {
  name: "Choisir le symbole d'une fenêtre (clic sur son nom)",
  render: function PickPanelSymbolStory() {
    const [symbols, setSymbols] = useState<string[]>(["AAPL", "MSFT", "NVDA"]);
    return (
      <div style={{ margin: -32 }}>
        <ChartWorkspace
          brokers={SAMPLE_BROKERS}
          defaultGridLayout="3-big-left"
          watchlists={PICK_WATCHLISTS}
          symbolProfiles={SYMBOL_PROFILES}
          onPanelSymbolChange={(panelIndex, symbol) =>
            setSymbols((prev) => prev.map((s, i) => (i === panelIndex && symbol in DATASETS ? symbol : s)))
          }
        >
          {symbols.map((symbol, i) => (
            <CandlestickChart key={i} data={DATASETS[symbol]} symbol={symbol} zoomable drawingTools />
          ))}
        </ChartWorkspace>
      </div>
    );
  },
};

export const ScriptingWorkspace: Story = {
  name: "Scripts partagés (2 panneaux)",
  render: () => (
    <div style={{ margin: -32 }}>
      <ChartWorkspace brokers={SAMPLE_BROKERS} defaultPanels={2} scripting>
        <CandlestickChart data={DATASETS.AAPL} symbol="AAPL" zoomable showIndicators defaultIndicators={[{ id: "i-0", kind: "rsi", period: 14 }]} />
        <CandlestickChart data={DATASETS.MSFT} symbol="MSFT" zoomable showIndicators defaultIndicators={[{ id: "i-0", kind: "rsi", period: 14 }]} />
      </ChartWorkspace>
    </div>
  ),
};

/** Watchlists that only exist a moment after the workspace has mounted — a host that fetches them
 *  rather than writing them out inline, which is the ordinary case outside a storybook.
 *
 *  Worth a story of its own because the workspace's own tab and list state are *uncontrolled*:
 *  their initialisers run once, against whatever was there at mount, which here is nothing. Both
 *  therefore have to keep resolving against what the workspace actually has rather than trusting
 *  what it had — without that, this story showed an empty "Alertes" heading over a list it was
 *  holding but not showing, and, on the phone layout, a topbar highlighting no list while the
 *  panel below it displayed one. */
export const LateWatchlists: Story = {
  name: "Listes chargées après coup",
  render: function LateWatchlistsStory() {
    const [watchlists, setWatchlists] = useState<ChartWorkspaceWatchlist[] | undefined>(undefined);
    return (
      <div style={{ margin: -32 }}>
        {watchlists === undefined && (
          <button type="button" style={{ position: "absolute", zIndex: 10, top: 8, left: 8 }} onClick={() => setWatchlists(SYMBOL_PROFILE_WATCHLISTS)}>
            Charger les listes
          </button>
        )}
        <ChartWorkspace brokers={SAMPLE_BROKERS} defaultPanels={1} watchlists={watchlists} symbolProfiles={SYMBOL_PROFILES}>
          <CandlestickChart data={DATASETS.AAPL} symbol="AAPL" zoomable />
        </ChartWorkspace>
      </div>
    );
  },
};

/** Un espace de travail posé dans une page, à hauteur fixe (`panelHeight={620}`), comme sur la page
 *  d'un symbole de macro-rates : liste de surveillance, alertes et outils de dessin. Une disposition
 *  sur plusieurs lignes passe la zone en pleine hauteur d'écran ; revenir à une seule ligne doit lui
 *  rendre ses 620 px, graphique et colonne d'outils compris, sans bande vide sous l'axe des dates. */
export const FixedPanelHeight: Story = {
  name: "Hauteur fixe (panelHeight) et retour à une seule ligne",
  render: () => (
    <div>
      <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
        `panelHeight={620}` : passer à 2 fenêtres empilées, à la grille 2 × 2 ou à « 1 à gauche, 2 empilées », puis
        revenir à 1 fenêtre. La fenêtre unique et sa colonne d'outils reprennent toute la hauteur du cadre.
      </p>
      <ChartWorkspace
        brokers={SAMPLE_BROKERS}
        defaultPanels={1}
        panelHeight={620}
        watchlists={SYMBOL_PROFILE_WATCHLISTS}
        symbolProfiles={SYMBOL_PROFILES}
        alerts={<p style={{ padding: 12, fontSize: 13 }}>Aucune alerte.</p>}
      >
        <CandlestickChart data={DATASETS.AAPL} symbol="AAPL" zoomable drawingTools showIndicators />
      </ChartWorkspace>
      <p style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>Suite de la page, sous l'espace de travail.</p>
    </div>
  ),
};
