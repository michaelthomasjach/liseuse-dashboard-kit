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
  args: { data: generateCandles(60, 100, 1) },
};
