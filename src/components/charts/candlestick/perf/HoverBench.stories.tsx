import type { Meta, StoryObj } from "@storybook/react";
import { HoverBenchScene, type HoverBenchSceneProps } from "./HoverBenchScene";

/* La scène du banc de performance du survol (voir HoverBenchScene), pour l'essayer à la main. Les
 * mesures, elles, se font sur la page autonome (perf/app) : voir scripts/benchChartHover.cjs. */

const meta: Meta<HoverBenchSceneProps> = {
  title: "Charts/CandlestickChart/Banc de performance",
  parameters: { layout: "fullscreen" },
  argTypes: { panes: { control: { type: "number", min: 0, max: 8 } }, workspace: { control: "boolean" }, page: { control: "boolean" } },
  args: { panes: 5, workspace: true, candles: 600, page: false },
};
export default meta;

export const Bench: StoryObj<HoverBenchSceneProps> = {
  name: "Survol : bougies, volume et panneaux",
  render: (args) => <HoverBenchScene {...args} />,
};
