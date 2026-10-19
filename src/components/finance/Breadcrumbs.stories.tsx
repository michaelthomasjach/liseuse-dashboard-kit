import type { Meta, StoryObj } from "@storybook/react";
import { Breadcrumbs } from "./Breadcrumbs";

const meta: Meta<typeof Breadcrumbs> = {
  title: "Layouts/Breadcrumbs",
  component: Breadcrumbs,
};
export default meta;
type Story = StoryObj<typeof Breadcrumbs>;

export const Default: Story = {
  render: () => (
    <Breadcrumbs
      items={[
        { id: "home", label: "Accueil" },
        { id: "portfolios", label: "Portefeuilles" },
        { id: "current", label: "Portefeuille Croissance" },
      ]}
    />
  ),
};
