import type { Meta, StoryObj } from "@storybook/react";
import { MarketStatePanel } from "./MarketStatePanel";
import { computeIndicatorValues } from "../indicators";
import { generateCandles } from "../../../../test-data/financeSampleData";
import type { Indicator } from "../interfaces/Indicator.interface";

/** The Market State readout on its own, against a fixed dataset and a fixed set of indicators.
 *
 *  It exists because this panel is the rare component in this library that is mostly *arithmetic*:
 *  every figure it shows is a claim about the market that has to be checkable. Rendering it here,
 *  away from a chart, is what makes the claims readable one by one — open a score and the numbers
 *  behind it are right there, against data that does not move between runs. */
const meta: Meta<typeof MarketStatePanel> = {
  title: "Charts/CandlestickChart/État du marché",
  component: MarketStatePanel,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof MarketStatePanel>;

const CANDLES = generateCandles(320, 180, 21);

/** One of each family the panel knows how to read, so every axis has real indicators feeding it
 *  and not just its own price/volume baseline. */
const INDICATORS: Indicator[] = [
  { id: "sma", kind: "sma", period: 50 },
  { id: "ema", kind: "ema", period: 20 },
  { id: "rsi", kind: "rsi", period: 14 },
  { id: "macd", kind: "macd", period: 0, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  { id: "adx", kind: "adx", period: 14 },
  { id: "atr", kind: "atr", period: 14 },
  { id: "bb", kind: "bollinger", period: 20, stdDev: 2 },
  { id: "st", kind: "supertrend", period: 10, supertrendMultiplier: 3 },
  { id: "vwap", kind: "vwap", period: 0 },
  { id: "chop", kind: "chop", period: 14 },
];

const VALUES = INDICATORS.map((indicator) => ({
  indicator,
  values: computeIndicatorValues(CANDLES, indicator, []),
}));

const formatDate = (date: Date) => date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

export const Default: Story = {
  name: "Dix indicateurs",
  render: () => (
    <div style={{ position: "relative", width: 320, height: 620 }}>
      <MarketStatePanel
        candles={CANDLES}
        index={CANDLES.length - 1}
        indicators={VALUES}
        onClose={() => {}}
        formatDate={formatDate}
      />
    </div>
  ),
};

/** With nothing on the chart at all. Every axis still reads, from price and volume alone — the
 *  panel says something true on a bare chart instead of five dashes, and each baseline is labelled
 *  as one so the reader can tell it apart from an indicator's own opinion. */
export const BaselinesOnly: Story = {
  name: "Aucun indicateur",
  render: () => (
    <div style={{ position: "relative", width: 320, height: 620 }}>
      <MarketStatePanel
        candles={CANDLES}
        index={CANDLES.length - 1}
        indicators={[]}
        onClose={() => {}}
        formatDate={formatDate}
      />
    </div>
  ),
};
