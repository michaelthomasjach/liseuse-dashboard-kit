import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { IconDock, type IconDockItem } from "./IconDock";
import {
  ArrowPathIcon,
  BarChartIcon,
  BoltIcon,
  BookOpenIcon,
  BoxesIcon,
  BriefcaseIcon,
  BuildingWarehouseIcon,
  ClipboardListIcon,
  GaugeIcon,
  HelpIcon,
  HouseRoofIcon,
  RefreshIcon,
  SettingsIcon,
  SquareDashedIcon,
} from "../icons";

/**
 * Le dock d'icônes d'un jeu de gestion, en haut à gauche de la scène : une section active à la fois,
 * les noms dans des infobulles. Au clavier : Tab pour entrer dans le dock, les flèches pour s'y
 * déplacer, Entrée ou Espace pour ouvrir.
 */
const meta: Meta<typeof IconDock> = {
  title: "Widgets/IconDock",
  component: IconDock,
};
export default meta;
type Story = StoryObj<typeof IconDock>;

const SECTIONS: { id: string; label: string; icon: ReactNode; badge?: ReactNode }[] = [
  { id: "warehouse", label: "Entrepôt", icon: <BuildingWarehouseIcon /> },
  { id: "ops", label: "Opérations", icon: <GaugeIcon /> },
  { id: "orders", label: "Commandes", icon: <ClipboardListIcon />, badge: 3 },
  { id: "stock", label: "Stocks", icon: <BoxesIcon /> },
  { id: "energy", label: "Énergie", icon: <BoltIcon />, badge: true },
  { id: "company", label: "Entreprise", icon: <BriefcaseIcon /> },
  { id: "stats", label: "Stats", icon: <BarChartIcon /> },
  { id: "guide", label: "Guide", icon: <BookOpenIcon /> },
];

const TOOLS: { id: string; label: string; icon: ReactNode; toggle?: boolean; disabled?: boolean }[] = [
  { id: "flow", label: "Tracer un flux", icon: <ArrowPathIcon />, toggle: true },
  { id: "zone", label: "Tracer une zone", icon: <SquareDashedIcon />, toggle: true },
  { id: "roof", label: "Toiture", icon: <HouseRoofIcon />, toggle: true },
  { id: "tour", label: "Visite guidée", icon: <HelpIcon /> },
  { id: "new", label: "Nouvelle partie", icon: <RefreshIcon />, disabled: true },
  { id: "settings", label: "Réglages", icon: <SettingsIcon /> },
];

/** Les huit sections, une seule active ; un second clic referme la section. */
function useSections(initial: string | null = "warehouse") {
  const [active, setActive] = useState<string | null>(initial);
  const items: IconDockItem[] = SECTIONS.map((s) => ({
    ...s,
    active: s.id === active,
    onClick: () => setActive((a) => (a === s.id ? null : s.id)),
  }));
  return { active, items };
}

function useTools() {
  const [tool, setTool] = useState<string | null>(null);
  const [log, setLog] = useState("");
  const items: IconDockItem[] = TOOLS.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    disabled: t.disabled,
    active: t.toggle ? tool === t.id : false,
    onClick: () => (t.toggle ? setTool((x) => (x === t.id ? null : t.id)) : setLog(`« ${t.label} »`)),
  }));
  return { tool, log, items };
}

const Stage = ({ children, height = 360 }: { children: ReactNode; height?: number }) => (
  <div
    style={{
      position: "relative",
      height,
      overflow: "hidden",
      background:
        "linear-gradient(135deg, color-mix(in srgb, var(--lq-color-accent) 18%, var(--lq-color-bg)), color-mix(in srgb, var(--lq-color-text) 8%, var(--lq-color-bg)))",
    }}
  >
    {children}
  </div>
);

export const Default: Story = {
  name: "IconDock",
  render: function Render() {
    const sections = useSections();
    const tools = useTools();
    const name = SECTIONS.find((s) => s.id === sections.active)?.label ?? "aucune";
    return (
      <Stage>
        <div style={{ position: "absolute", left: 16, top: 16, right: 16, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
          <IconDock items={sections.items} aria-label="Sections du jeu" />
          <IconDock items={tools.items} size="sm" aria-label="Outils" />
        </div>
        <p style={{ position: "absolute", left: 16, bottom: 8, fontSize: 13, color: "var(--lq-color-text-muted)" }}>
          Section : {name} · Outil : {TOOLS.find((t) => t.id === tools.tool)?.label ?? "aucun"} {tools.log && `· Dernier clic : ${tools.log}`}
        </p>
      </Stage>
    );
  },
};

export const Vertical: Story = {
  name: "Vertical",
  render: function Render() {
    const sections = useSections("stock");
    return (
      <Stage height={520}>
        <div style={{ position: "absolute", left: 16, top: 16 }}>
          <IconDock items={sections.items} orientation="vertical" aria-label="Sections du jeu" />
        </div>
      </Stage>
    );
  },
};

export const Sizes: Story = {
  name: "Tailles",
  render: function Render() {
    const sections = useSections("orders");
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16 }}>
        <IconDock items={sections.items} size="sm" aria-label="Petit" />
        <IconDock items={sections.items} size="md" aria-label="Moyen" />
        <IconDock items={sections.items} size="lg" aria-label="Grand" />
      </div>
    );
  },
};

export const Badges: Story = {
  name: "Pastilles",
  render: function Render() {
    const [active, setActive] = useState("orders");
    const items: IconDockItem[] = [
      { id: "orders", label: "Commandes", icon: <ClipboardListIcon />, badge: 12 },
      { id: "stock", label: "Stocks", icon: <BoxesIcon />, badge: "99+" },
      { id: "energy", label: "Énergie", icon: <BoltIcon />, badge: true },
      { id: "stats", label: "Stats", icon: <BarChartIcon />, badge: 0 },
    ].map((it) => ({ ...it, active: it.id === active, onClick: () => setActive(it.id) }));
    return <IconDock items={items} aria-label="Pastilles" />;
  },
};

/** Largeur d'un téléphone : le dock devient un ruban qui défile, sans barre visible. */
export const Narrow: Story = {
  name: "Téléphone (390 px)",
  render: function Render() {
    const sections = useSections();
    const tools = useTools();
    return (
      <div style={{ width: 390, maxWidth: "100%", border: "1px dashed var(--lq-color-border)" }}>
        <Stage height={300}>
          <div style={{ position: "absolute", left: 8, right: 8, top: 8, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
            <IconDock items={sections.items} compact aria-label="Sections du jeu" />
            <IconDock items={tools.items} compact size="sm" aria-label="Outils" />
          </div>
        </Stage>
      </div>
    );
  },
};
