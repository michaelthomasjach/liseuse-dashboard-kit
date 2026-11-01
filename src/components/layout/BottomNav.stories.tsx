import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { BottomNav, type BottomNavItem } from "./BottomNav";
import { BellIcon, CalendarIcon, HomeIcon, PieChartIcon, SearchIcon, SettingsIcon, UserIcon } from "../icons";

const meta: Meta<typeof BottomNav> = {
  title: "Layouts/BottomNav",
  component: BottomNav,
  parameters: { layout: "centered" },
};
export default meta;
type Story = StoryObj<typeof BottomNav>;

const ITEMS: BottomNavItem[] = [
  { id: "accueil", label: "Accueil", icon: <HomeIcon /> },
  { id: "agenda", label: "Agenda", icon: <CalendarIcon /> },
  { id: "rapports", label: "Rapports", icon: <PieChartIcon /> },
  { id: "alertes", label: "Alertes", icon: <BellIcon />, badge: 3 },
  { id: "profil", label: "Profil", icon: <UserIcon /> },
];

/** Un écran de téléphone : la page défile, la barre reste au pied. */
function Phone({ children, nav }: { children: ReactNode; nav: ReactNode }) {
  return (
    <div
      style={{
        width: 390,
        height: 620,
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--lq-color-border-subtle)",
        background: "var(--lq-color-bg)",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
      {nav}
    </div>
  );
}

function Page({ title }: { title: string }) {
  return (
    <>
      <strong style={{ fontSize: 18 }}>{title}</strong>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} style={{ height: 64, background: "var(--lq-color-panel)", border: "1px solid var(--lq-color-border-subtle)" }} />
      ))}
    </>
  );
}

function Interactive({ items = ITEMS, labels }: { items?: BottomNavItem[]; labels?: "always" | "active" }) {
  const [active, setActive] = useState(items[0].id);
  return (
    <Phone nav={<BottomNav items={items} activeId={active} onChange={setActive} position="static" labels={labels} />}>
      <Page title={items.find((i) => i.id === active)?.label ?? ""} />
    </Phone>
  );
}

/** Cinq destinations, l'active en couleur sous une pilule. */
export const Default: Story = {
  render: () => <Interactive />,
};

/** `badge` : un compteur (au-delà de `badgeMax`, « 99+ ») ou `true` pour un simple point. */
export const Badges: Story = {
  render: () => (
    <Interactive
      items={[
        { id: "accueil", label: "Accueil", icon: <HomeIcon /> },
        { id: "recherche", label: "Recherche", icon: <SearchIcon />, badge: true },
        { id: "agenda", label: "Agenda", icon: <CalendarIcon />, badge: 12 },
        { id: "alertes", label: "Alertes", icon: <BellIcon />, badge: 240 },
      ]}
    />
  ),
};

/** `labels="active"` : seul le libellé de l'entrée active reste affiché. */
export const ActiveLabelOnly: Story = {
  render: () => <Interactive labels="active" />,
};

/** Trois destinations — le minimum ; une entrée désactivée. */
export const ThreeItems: Story = {
  render: () => (
    <Interactive
      items={[
        { id: "accueil", label: "Accueil", icon: <HomeIcon /> },
        { id: "rapports", label: "Rapports", icon: <PieChartIcon /> },
        { id: "reglages", label: "Réglages", icon: <SettingsIcon />, disabled: true },
      ]}
    />
  ),
};

/** `position="fixed"` (défaut) : collée au bas de la fenêtre, marge de zone sûre comprise. Faites défiler. */
export const Fixed: Story = {
  parameters: { layout: "fullscreen" },
  render: function Render() {
    const [active, setActive] = useState("accueil");
    return (
      <div style={{ padding: 16, paddingBottom: 96, display: "flex", flexDirection: "column", gap: 12 }}>
        <Page title="Page longue" />
        <Page title="Suite" />
        <BottomNav items={ITEMS} activeId={active} onChange={setActive} />
      </div>
    );
  },
};
