import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ChartWorkspace } from "./ChartWorkspace";
import { CandlestickChart } from "./CandlestickChart";
import { generateCandles } from "../../test-data/financeSampleData";

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
          séries, exprès). Chaque panneau a sa propre icône grille (écran divisé, 2/4/6/8) et icône chaîne
          (gestion des groupes) dans son en-tête — cliquer la grille change la disposition pour l'espace de
          travail entier, quel que soit le panneau depuis lequel on clique.
        </p>
        <ChartWorkspace defaultPanels={8} defaultLinkGroups={groups} onLinkGroupsChange={setGroups}>
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

export const TwoPanels: Story = {
  name: "2 panneaux",
  render: () => (
    // No wrapper padding — ChartWorkspace fills 100% of the viewport height by default (see its
    // own `panelHeight` doc), and the negative margin cancels the global Storybook decorator's
    // own 32px padding (see .storybook/preview.tsx) so that fit is exact, same fix as
    // CandlestickChart.stories.tsx's own "Toutes les options" story.
    <div style={{ margin: -32 }}>
      <ChartWorkspace defaultPanels={2}>
        <CandlestickChart data={DATASETS.AAPL} symbol="AAPL" zoomable />
        <CandlestickChart data={DATASETS.MSFT} symbol="MSFT" zoomable />
      </ChartWorkspace>
    </div>
  ),
};

export const ScriptingWorkspace: Story = {
  name: "Scripts partagés (2 panneaux)",
  render: () => (
    <div style={{ margin: -32 }}>
      <ChartWorkspace defaultPanels={2} scripting>
        <CandlestickChart data={DATASETS.AAPL} symbol="AAPL" zoomable showIndicators defaultIndicators={[{ id: "i-0", kind: "rsi", period: 14 }]} />
        <CandlestickChart data={DATASETS.MSFT} symbol="MSFT" zoomable showIndicators defaultIndicators={[{ id: "i-0", kind: "rsi", period: 14 }]} />
      </ChartWorkspace>
    </div>
  ),
};
