import type { Meta, StoryObj } from "@storybook/react";
import { ServerErrorPage } from "./ServerErrorPage";
import { AlertTriangleIcon, PlugIcon } from "../components/icons";

const meta: Meta<typeof ServerErrorPage> = {
  title: "Pages/ServerErrorPage",
  component: ServerErrorPage,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof ServerErrorPage>;

/** La page remplit son conteneur : on lui en donne un à la hauteur de la zone d'affichage (moins
 *  la marge du décorateur). */
const FRAME = { height: "calc(100vh - 64px)", minHeight: 520 } as const;

/** Une nouvelle tentative qui prend une seconde, pour voir l'état occupé. */
const slowRetry = () => new Promise<void>((resolve) => setTimeout(resolve, 1000));

export const Default: Story = {
  render: () => (
    <div style={FRAME}>
      <ServerErrorPage onRetry={slowRetry} />
    </div>
  ),
};

export const WithIncident: Story = {
  render: () => (
    <div style={FRAME}>
      <ServerErrorPage
        illustration={<AlertTriangleIcon size={48} />}
        onRetry={slowRetry}
        incidentId="INC-7F3A-20261101-0942"
        footer={
          <>
            Le problème persiste ? Écrivez à <a href="mailto:support@exemple.fr">support@exemple.fr</a> en citant l'identifiant.
          </>
        }
      />
    </div>
  ),
};

export const ServiceUnavailable: Story = {
  render: () => (
    <div style={FRAME}>
      <ServerErrorPage
        code="503"
        title="Service en maintenance"
        message="Nous mettons à jour la plateforme. Elle sera de retour vers 6 h ; vos données ne sont pas affectées."
        illustration={<PlugIcon size={48} />}
        onHome={() => {}}
        homeLabel="Voir la page d'état"
      />
    </div>
  ),
};

export const InFrame: Story = {
  render: () => (
    <div style={{ width: 380, height: 480, border: "1px solid var(--lq-color-border)" }}>
      <ServerErrorPage onRetry={slowRetry} incidentId="INC-7F3A" />
    </div>
  ),
};
