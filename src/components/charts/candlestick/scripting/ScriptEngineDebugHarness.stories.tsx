import type { Meta, StoryObj } from "@storybook/react";
import { ScriptEngineDebugHarness } from "./ScriptEngineDebugHarness";
import { generateCandles } from "../../../../test-data/financeSampleData";

const meta: Meta<typeof ScriptEngineDebugHarness> = {
  title: "Charts/Scripting (dev)/EngineDebugHarness",
  component: ScriptEngineDebugHarness,
};
export default meta;
type Story = StoryObj<typeof ScriptEngineDebugHarness>;

export const Default: Story = {
  args: {
    data: generateCandles(60, 100, 1),
    indicators: [
      { id: "indicator-0", kind: "rsi", period: 14 },
      { id: "indicator-1", kind: "macd", period: 0, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    ],
  },
};
