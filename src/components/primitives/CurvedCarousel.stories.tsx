import type { Meta, StoryObj } from "@storybook/react";
import { CurvedCarousel, type CurvedCarouselItem } from "./CurvedCarousel";
import { Button } from "./Button";
import { StatCard } from "../finance/StatCard";
import { ARCHITECTURE_PHOTOS, INTERIOR_PHOTOS, LANDSCAPE_PHOTOS, photoUrl } from "../../test-data/showcasePhotos";

/**
 * Une rangée de cartes posée sur une courbe creuse, qui défile toute seule. Prenez-la à la souris
 * pour la faire glisser (elle garde l'élan), survolez-la pour la ralentir jusqu'à l'arrêt, ou
 * utilisez les flèches du clavier une fois le carrousel sélectionné.
 */
const meta: Meta<typeof CurvedCarousel> = {
  title: "Primitives/CurvedCarousel",
  component: CurvedCarousel,
  parameters: { layout: "fullscreen" },
  argTypes: {
    curvature: { control: { type: "range", min: 0, max: 1, step: 0.05 } },
    speed: { control: { type: "range", min: 0, max: 120, step: 4 } },
    direction: { control: "inline-radio", options: ["left", "right"] },
  },
};
export default meta;
type Story = StoryObj<typeof CurvedCarousel>;

const interiors: CurvedCarouselItem[] = [...INTERIOR_PHOTOS, ...ARCHITECTURE_PHOTOS].map((p) => ({
  id: p.id,
  src: photoUrl(p.id, 640, 760),
  alt: p.title,
}));

const landscapes: CurvedCarouselItem[] = LANDSCAPE_PHOTOS.map((p) => ({
  id: p.id,
  src: photoUrl(p.id, 640, 800),
  title: p.title,
  caption: p.caption,
  onClick: () => undefined,
}));

/** En ouverture de page, entre le titre et l'appel à l'action. */
export const Vitrine: Story = {
  args: { items: interiors, cardWidth: 230, cardHeight: 290, curvature: 0.55, speed: 32, ariaLabel: "Réalisations" },
  render: (args) => (
    <div style={{ padding: "56px 0 48px", textAlign: "center" }}>
      <h1 style={{ margin: "0 auto 12px", maxWidth: 560, fontSize: "clamp(2.2rem, 6vw, 4rem)", lineHeight: 1.02, letterSpacing: "-0.03em" }}>
        Ateliers d'architecture sur mesure
      </h1>
      <p style={{ margin: "0 auto 36px", color: "var(--lq-color-text-muted)" }}>Le lieu que vous méritez n'a encore jamais été construit.</p>
      <CurvedCarousel {...args} />
      <p style={{ margin: "32px auto 20px", maxWidth: 460, color: "var(--lq-color-text-muted)" }}>
        Résidences privées et espaces commerciaux dessinés à partir d'une page blanche.
      </p>
      <div style={{ display: "inline-flex", gap: 12 }}>
        <Button variant="solid">Prendre rendez-vous</Button>
        <Button variant="outline">Voir les projets</Button>
      </div>
    </div>
  ),
};

/** Cartes titrées et cliquables ; défilement vers la droite, courbure plus marquée. */
export const Titres: Story = {
  args: { items: landscapes, cardWidth: 260, cardHeight: 340, curvature: 0.8, speed: 24, direction: "right", ariaLabel: "Destinations" },
  render: (args) => (
    <div style={{ padding: "40px 0" }}>
      <CurvedCarousel {...args} />
    </div>
  ),
};

const kpis = [
  { label: "Chiffre d'affaires", value: "1,24 M€", delta: 8.2, data: [4, 6, 5, 7, 8, 9, 11] },
  { label: "Clients actifs", value: "18 420", delta: 3.1, data: [9, 9, 10, 10, 11, 12, 12] },
  { label: "Panier moyen", value: "67,40 €", delta: -1.4, data: [8, 7, 7, 6, 7, 6, 6] },
  { label: "Taux de retour", value: "2,1 %", delta: -0.6, data: [5, 4, 4, 3, 3, 3, 2] },
  { label: "Délai de livraison", value: "1,8 j", delta: -4.0, data: [6, 6, 5, 4, 4, 3, 3] },
  { label: "Satisfaction", value: "4,7 / 5", delta: 0.9, data: [7, 7, 8, 8, 8, 9, 9] },
];

/** N'importe quel contenu dans les cartes : ici des indicateurs, pour un tableau de bord. */
export const Indicateurs: Story = {
  args: {
    items: kpis.map((k) => ({
      id: k.label,
      content: (
        <div style={{ height: "100%" }}>
          <StatCard label={k.label} value={k.value} delta={k.delta} sparklineData={k.data} />
        </div>
      ),
    })),
    cardWidth: 250,
    cardHeight: 170,
    curvature: 0.4,
    speed: 20,
    ariaLabel: "Indicateurs",
  },
  render: (args) => (
    <div style={{ padding: "32px 0" }}>
      <CurvedCarousel {...args} />
    </div>
  ),
};

/** Sans défilement automatique ni courbure : une rangée qu'on fait glisser à la main. */
export const Immobile: Story = {
  args: { items: interiors, speed: 0, curvature: 0, cardWidth: 200, cardHeight: 240, controls: true, ariaLabel: "Intérieurs" },
  render: (args) => (
    <div style={{ padding: "32px 0" }}>
      <CurvedCarousel {...args} />
    </div>
  ),
};
