import type { Meta, StoryObj } from "@storybook/react";
import { PriceChangeTag } from "./PriceChangeTag";

const meta: Meta<typeof PriceChangeTag> = {
  title: "Finance/PriceChangeTag",
  component: PriceChangeTag,
};
export default meta;
type Story = StoryObj<typeof PriceChangeTag>;

export const UpAndDown: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 16 }}>
      <PriceChangeTag value={2.4} />
      <PriceChangeTag value={-1.1} />
      <PriceChangeTag value={128.5} format={(v) => `${v.toFixed(2)} €`} />
    </div>
  ),
};

export const Locale: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 16 }}>
      <PriceChangeTag value={2.4} />
      <PriceChangeTag value={-1.1} />
      <PriceChangeTag value={2.4} locale="en-US" />
      <PriceChangeTag value={-1.1} locale="en-US" />
    </div>
  ),
};
