import type { Meta, StoryObj } from "@storybook/react";
import { SidebarLayout } from "./SidebarLayout";
import { UserMenu } from "../finance/UserMenu";
import { StatCard } from "../finance/StatCard";
import { LineAreaChart } from "../charts/LineAreaChart";
import { Breadcrumbs } from "../finance/Breadcrumbs";
import { generateSeries } from "../../test-data/financeSampleData";
import { HomeIcon, SettingsIcon, LogoutIcon, UserIcon, BarChartIcon, TableIcon } from "../icons";

const meta: Meta<typeof SidebarLayout> = {
  title: "Layouts/SidebarLayout",
  component: SidebarLayout,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof SidebarLayout>;

export const Dashboard: Story = {
  render: () => (
    <SidebarLayout
      logo={<strong>Finance Kit</strong>}
      navItems={[
        { id: "overview", label: "Vue d'ensemble", icon: <HomeIcon size={18} />, active: true },
        { id: "settings", label: "Paramètres", icon: <SettingsIcon size={18} /> },
      ]}
      footer={
        <UserMenu
          name="Michael Jach"
          items={[
            { id: "profile", label: "Profil", icon: <UserIcon size={16} /> },
            { id: "logout", label: "Déconnexion", icon: <LogoutIcon size={16} />, danger: true },
          ]}
        />
      }
      header={<Breadcrumbs items={[{ id: "home", label: "Accueil" }, { id: "overview", label: "Vue d'ensemble" }]} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ width: 220 }}>
            <StatCard label="Valeur totale" value="42 380 €" delta={3.4} sparklineData={[10, 10.4, 10.1, 10.8, 11.2, 11.6, 12.1]} />
          </div>
          <div style={{ width: 220 }}>
            <StatCard label="P&L du jour" value="− 214 €" delta={-1.2} />
          </div>
        </div>
        <LineAreaChart series={[{ id: "p", label: "Portefeuille", data: generateSeries(90, 40000, 5) }]} area />
      </div>
    </SidebarLayout>
  ),
};

/** En-tête fixe : il reste affiché en haut de l'écran pendant le défilement (et la barre du menu sur mobile). */
export const StickyHeader: Story = {
  render: () => (
    <SidebarLayout
      stickyHeader
      logo={<strong>Finance Kit</strong>}
      navItems={[{ id: "overview", label: "Vue d'ensemble", icon: <HomeIcon size={18} />, active: true }]}
      header={<div style={{ padding: "12px 0", borderBottom: "1px solid var(--lq-color-border-subtle)" }}>En-tête fixe : faites défiler la page</div>}
    >
      {Array.from({ length: 60 }, (_, i) => (
        <p key={i}>Ligne {i + 1}</p>
      ))}
    </SidebarLayout>
  ),
};

/** Sous-menu : un groupe repliable (ouvert quand l'une de ses pages est active). */
export const WithSubmenu: Story = {
  render: () => (
    <SidebarLayout
      logo={<strong>Finance Kit</strong>}
      navItems={[
        { id: "overview", label: "Vue d'ensemble", icon: <HomeIcon size={18} /> },
        {
          id: "trading",
          label: "Trading",
          icon: <HomeIcon size={18} />,
          children: [
            { id: "journal", label: "Journal de trading", active: true },
            { id: "lab", label: "Laboratoire de prévision" },
          ],
        },
      ]}
    >
      <p>Contenu</p>
    </SidebarLayout>
  ),
};


/** Le rail : barre fixée à la fenêtre, réduite à sa colonne d'icônes, qui s'ouvre au survol et
 *  s'épingle par l'anneau de son en-tête. Les sous-entrées s'y affichent par leur initiale. */
export const Rail: Story = {
  render: () => (
    <SidebarLayout
      variant="rail"
      stickyHeader
      logo={<strong>Finance Kit</strong>}
      navItems={[
        { id: "overview", label: "Vue d'ensemble", details: "3 alertes", icon: <HomeIcon size={18} />, active: true },
        {
          id: "markets",
          label: "Marchés",
          icon: <BarChartIcon size={18} />,
          children: [
            { id: "equities", label: "Actions" },
            { id: "bonds", label: "Obligations" },
            { id: "fx", label: "Devises", abbr: "fx" },
          ],
        },
        { id: "reports", label: "Rapports", icon: <TableIcon size={18} /> },
        { id: "settings", label: "Paramètres", icon: <SettingsIcon size={18} /> },
      ]}
      header={<Breadcrumbs items={[{ id: "home", label: "Accueil" }, { id: "overview", label: "Vue d'ensemble" }]} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {Array.from({ length: 12 }, (_, i) => (
          <StatCard key={i} label={`Indicateur ${i + 1}`} value={`${(i + 1) * 1200} €`} delta={i % 3 === 0 ? -1.2 : 2.4} />
        ))}
      </div>
    </SidebarLayout>
  ),
};
