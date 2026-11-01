import type { Meta, StoryObj } from "@storybook/react";
import { HeaderLayout } from "./HeaderLayout";
import { UserMenu } from "../finance/UserMenu";
import { DonutChart } from "../charts/DonutChart";
import { SAMPLE_ALLOCATION } from "../../test-data/financeSampleData";
import { LogoutIcon, UserIcon } from "../icons";

const meta: Meta<typeof HeaderLayout> = {
  title: "Layouts/HeaderLayout",
  component: HeaderLayout,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof HeaderLayout>;

export const Dashboard: Story = {
  render: () => (
    <HeaderLayout
      logo={<strong>Finance Kit</strong>}
      navItems={[
        { id: "overview", label: "Vue d'ensemble", active: true },
        { id: "markets", label: "Marchés" },
        { id: "orders", label: "Ordres" },
      ]}
      actions={
        <UserMenu
          name="Michael Jach"
          items={[
            { id: "profile", label: "Profil", icon: <UserIcon size={16} /> },
            { id: "logout", label: "Déconnexion", icon: <LogoutIcon size={16} />, danger: true },
          ]}
        />
      }
    >
      <DonutChart data={SAMPLE_ALLOCATION} formatValue={(v) => `${v} %`} />
    </HeaderLayout>
  ),
};

/** `fullHeight={false}` : la coquille remplit son cadre et replie son menu selon **sa** largeur
 *  (640 px, sous le seuil de 860) — quelle que soit celle de la fenêtre. */
export const InFrame: Story = {
  render: () => (
    <div style={{ padding: 24 }}>
      <div style={{ width: 640, height: 420, border: "1px solid var(--lq-color-border)", overflow: "auto" }}>
        <HeaderLayout
          fullHeight={false}
          logo={<strong>Finance Kit</strong>}
          navItems={[
            { id: "overview", label: "Vue d'ensemble", active: true },
            { id: "markets", label: "Marchés" },
            { id: "orders", label: "Ordres" },
          ]}
        >
          <DonutChart data={SAMPLE_ALLOCATION} formatValue={(v) => `${v} %`} />
        </HeaderLayout>
      </div>
    </div>
  ),
};
