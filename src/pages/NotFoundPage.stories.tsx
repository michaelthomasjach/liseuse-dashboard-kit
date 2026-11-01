import type { Meta, StoryObj } from "@storybook/react";
import { NotFoundPage } from "./NotFoundPage";

const meta: Meta<typeof NotFoundPage> = {
  title: "Pages/NotFoundPage",
  component: NotFoundPage,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof NotFoundPage>;

export const Default: Story = {
  render: () => <NotFoundPage />,
};

export const CustomMessage: Story = {
  render: () => (
    <NotFoundPage
      title="Marché introuvable"
      message="Ce symbole n'existe pas ou n'est plus coté."
      actionLabel="Retour au portefeuille"
      actionHref="/portfolio"
    />
  ),
};

/** `fullHeight={false}` : la page prend la hauteur de son cadre et s'y centre, au lieu d'imposer
 *  celle de la fenêtre ; la taille du code suit la largeur du cadre. */
export const InFrame: Story = {
  render: () => (
    <div style={{ padding: 24 }}>
      <div style={{ width: 420, height: 360, border: "1px solid var(--lq-color-border)" }}>
        <NotFoundPage fullHeight={false} />
      </div>
    </div>
  ),
};
