import type { Meta, StoryObj } from "@storybook/react";
import { ScriptingStateDebugHarness } from "./ScriptingStateDebugHarness";
import { generateCandles } from "../../../../test-data/financeSampleData";

const meta: Meta<typeof ScriptingStateDebugHarness> = {
  title: "Charts/Scripting (dev)/ScriptingStateDebugHarness",
  component: ScriptingStateDebugHarness,
};
export default meta;
type Story = StoryObj<typeof ScriptingStateDebugHarness>;

export const Default: Story = {
  args: {
    data: generateCandles(60, 100, 1),
    indicators: [{ id: "indicator-0", kind: "rsi", period: 14 }],
  },
};
