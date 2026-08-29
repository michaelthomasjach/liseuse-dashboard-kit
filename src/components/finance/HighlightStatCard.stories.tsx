import type { Meta, StoryObj } from "@storybook/react";
import { HighlightStatCard } from "./HighlightStatCard";

const meta: Meta<typeof HighlightStatCard> = {
  title: "Finance/HighlightStatCard",
  component: HighlightStatCard,
};
export default meta;
type Story = StoryObj<typeof HighlightStatCard>;

const FIFTY_TWO_WEEK_TREND = [142, 148, 145, 151, 157, 154, 162, 168, 165, 172, 178, 175, 183, 188, 191];

export const FiftyTwoWeekHigh: Story = {
  name: "52-week high",
  render: () => (
    <div style={{ maxWidth: 220 }}>
      <HighlightStatCard label="52-week high" value="191,22 $" subtext="3,6 % en dessous" sparklineData={FIFTY_TWO_WEEK_TREND} />
    </div>
  ),
};

export const NoSparkline: Story = {
  name: "Sans sparkline",
  render: () => (
    <div style={{ maxWidth: 220 }}>
      <HighlightStatCard label="Rendement du dividende" value="1,8 %" />
    </div>
  ),
};
