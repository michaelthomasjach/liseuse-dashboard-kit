import type { Meta, StoryObj } from "@storybook/react";
import { Avatar } from "./Avatar";

const meta: Meta<typeof Avatar> = {
  title: "Primitives/Avatar",
  component: Avatar,
};
export default meta;
type Story = StoryObj<typeof Avatar>;

export const Initials: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Avatar name="Michael Jach" size={28} />
      <Avatar name="Michael Jach" size={36} />
      <Avatar name="Michael Jach" size={48} />
    </div>
  ),
};
