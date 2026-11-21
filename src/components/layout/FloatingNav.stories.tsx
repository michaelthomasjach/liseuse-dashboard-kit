import { useState, type CSSProperties } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { FloatingNav } from "./FloatingNav";
import { LANDSCAPE_PHOTOS, photoUrl } from "../../test-data/showcasePhotos";

/**
 * Menu flottant au bord de l'écran : une liste courte, sans fond, l'entrée active marquée d'un point.
 * Sur téléphone (placement fixe), il devient une rangée de pastilles en bas de l'écran.
 */
const meta: Meta<typeof FloatingNav> = {
  title: "Layouts/FloatingNav",
  component: FloatingNav,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof FloatingNav>;

const PLANETS = ["Mercure", "Vénus", "Terre", "Mars", "Jupiter", "Saturne", "Uranus", "Neptune"];

/** Sur une image plein cadre, à gauche, comme une table des matières. */
export const SurUneImage: Story = {
  render: function Render() {
    const [active, setActive] = useState("Mars");
    return (
      <div
        style={{
          position: "relative",
          height: "100vh",
          minHeight: 520,
          color: "#fff",
          background: `center / cover url(${photoUrl(LANDSCAPE_PHOTOS[7].id, 1800)})`,
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.25)" }} />
        <div style={{ "--lq-color-text": "#fff", "--lq-color-text-muted": "rgba(255,255,255,.72)" } as CSSProperties}>
          <FloatingNav
            placement="absolute"
            ariaLabel="Planètes"
            items={PLANETS.map((p) => ({ id: p, label: p, active: p === active, onClick: () => setActive(p) }))}
          />
        </div>
      </div>
    );
  },
};

/** Avec un titre, des icônes de compte, sur le bord droit. */
export const ADroite: Story = {
  render: function Render() {
    const [active, setActive] = useState("apercu");
    const items = [
      { id: "apercu", label: "Aperçu" },
      { id: "ventes", label: "Ventes", badge: 12 },
      { id: "clients", label: "Clients" },
      { id: "stocks", label: "Stocks", badge: "!" },
      { id: "rapports", label: "Rapports" },
    ];
    return (
      <div style={{ position: "relative", height: 420, background: "var(--lq-color-bg)" }}>
        <FloatingNav
          placement="absolute"
          side="right"
          title="Sur cette page"
          items={items.map((i) => ({ ...i, active: i.id === active, onClick: () => setActive(i.id) }))}
        />
      </div>
    );
  },
};

/** À sa place dans la page, sans flotter. */
export const EnLigne: Story = {
  args: {
    placement: "static",
    title: "Sections",
    items: [
      { id: "a", label: "Introduction" },
      { id: "b", label: "Méthode", active: true },
      { id: "c", label: "Résultats" },
      { id: "d", label: "Annexes" },
    ],
  },
  render: (args) => (
    <div style={{ padding: 32 }}>
      <FloatingNav {...args} />
    </div>
  ),
};
