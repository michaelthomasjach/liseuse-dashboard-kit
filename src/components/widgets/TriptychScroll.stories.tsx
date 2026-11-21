import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { TriptychScroll } from "./TriptychScroll";
import { Button } from "../primitives/Button";
import { StatCard } from "../finance/StatCard";
import { Sparkline } from "../charts/Sparkline";
import { ARCHITECTURE_PHOTOS, INTERIOR_PHOTOS, LANDSCAPE_PHOTOS, photoUrl } from "../../test-data/showcasePhotos";

/**
 * Trois sections côte à côte qui se relaient au défilement : faites défiler la page. À chaque cran,
 * la gauche descend, puis la droite, puis le centre monte, chacune amenant sa vue suivante.
 */
const meta: Meta<typeof TriptychScroll> = {
  title: "Widgets/TriptychScroll",
  component: TriptychScroll,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof TriptychScroll>;

const img = (id: string, alt: string) => <img src={photoUrl(id, 900, 1400)} alt={alt} draggable={false} />;

const left = LANDSCAPE_PHOTOS.slice(0, 4).map((p) => img(p.id, p.title));
const center = LANDSCAPE_PHOTOS.slice(4, 8).map((p) => img(p.id, p.title));
const right = [...ARCHITECTURE_PHOTOS, INTERIOR_PHOTOS[0]].map((p) => img(p.id, p.title));

const WORDS = ["Organisé.", "Rangé.", "Relié.", "Serein."];

function Intro({ children }: { children: ReactNode }) {
  return <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--lq-color-text-muted)" }}>{children}</div>;
}

/** En ouverture de page : un mot par étape en bas à droite, une pastille au centre. */
export const Ouverture: Story = {
  args: {
    sections: [left, center, right],
    height: "calc(100vh - 24px)",
    stickyTop: "12px",
    gap: 8,
    ariaLabel: "Présentation",
    overlay: ({ step }) => (
      <div style={{ position: "absolute", inset: 0, color: "#fff" }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 64,
            height: 112,
            transform: "translate(-50%, -50%)",
            borderRadius: 999,
            background: "rgba(10, 12, 14, 0.82)",
            boxShadow: "0 10px 40px rgba(0,0,0,.35)",
          }}
        />
        <div style={{ position: "absolute", left: 24, bottom: 24, maxWidth: 240, display: "grid", gap: 14 }}>
          <span style={{ fontSize: 13, lineHeight: 1.45, textShadow: "0 1px 8px rgba(0,0,0,.5)" }}>
            Un seul outil pour le courrier, les clients et les projets, qui se range tout seul.
          </span>
          <span>
            <Button tone="primary">Rejoindre la liste</Button>
          </span>
        </div>
        <div style={{ position: "absolute", right: 28, bottom: 20, textAlign: "right" }}>
          <div style={{ fontSize: "clamp(2.6rem, 8vw, 6.5rem)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, textShadow: "0 4px 30px rgba(0,0,0,.35)" }}>
            {WORDS[Math.min(step, WORDS.length - 1)]}
          </div>
          <div style={{ marginTop: 6, fontSize: 13, fontStyle: "italic", opacity: 0.85 }}>Pour que vous n'ayez pas à l'être.</div>
        </div>
      </div>
    ),
  },
  render: (args) => (
    <div style={{ padding: "0 12px" }}>
      <Intro>Faites défiler ↓</Intro>
      <TriptychScroll {...args} />
      <Intro>Fin de la séquence.</Intro>
    </div>
  ),
};

const metric = (label: string, value: string, delta: number, data: number[]) => (
  <div style={{ height: "100%", display: "grid", alignContent: "center", padding: 16, boxSizing: "border-box" }}>
    <StatCard label={label} value={value} delta={delta} sparklineData={data} />
  </div>
);

const note = (title: string, text: string, data: number[]) => (
  <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 22, boxSizing: "border-box" }}>
    <div>
      <div style={{ fontSize: 12, color: "var(--lq-color-text-muted)" }}>{title}</div>
      <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.5 }}>{text}</p>
    </div>
    <Sparkline data={data} height={64} width={260} area colorByTrend />
  </div>
);

/** Dans un tableau de bord : chiffres, commentaires et photos qui arrivent par vagues. */
export const TableauDeBord: Story = {
  args: {
    sections: [
      [
        metric("Ventes du trimestre", "1,24 M€", 8.2, [4, 6, 5, 7, 8, 9, 11]),
        metric("Nouveaux clients", "1 284", 12.5, [3, 4, 4, 6, 7, 8, 9]),
        metric("Panier moyen", "67,40 €", -1.4, [8, 7, 7, 6, 7, 6, 6]),
      ],
      [
        img(INTERIOR_PHOTOS[1].id, INTERIOR_PHOTOS[1].title),
        img(INTERIOR_PHOTOS[2].id, INTERIOR_PHOTOS[2].title),
        img(INTERIOR_PHOTOS[4].id, INTERIOR_PHOTOS[4].title),
      ],
      [
        note("Ce qu'il faut retenir", "Le trimestre est porté par les ventes en ligne, en hausse pour le cinquième mois de suite.", [3, 4, 5, 5, 6, 7, 8]),
        note("À surveiller", "Le panier moyen recule légèrement : les petites commandes progressent plus vite que les grandes.", [8, 7, 7, 6, 6, 6, 5]),
        note("Prochaine étape", "Relancer les clients inactifs depuis trois mois avec l'offre de printemps.", [2, 3, 3, 4, 4, 5, 6]),
      ],
    ],
    directions: ["up", "down", "up"],
    order: [1, 0, 2],
    height: "560px",
    stickyTop: "24px",
    gap: 12,
    ariaLabel: "Bilan du trimestre",
  },
  render: (args) => (
    <div style={{ padding: "0 24px" }}>
      <Intro>Bilan du trimestre — faites défiler ↓</Intro>
      <TriptychScroll {...args} />
      <Intro>Fin du bilan.</Intro>
    </div>
  ),
};

/** Un fond commun : une vidéo sur toute la largeur, chaque section en montre sa part ; au défilement, les sections
 *  glissent l'une après l'autre et découvrent l'information. */
export const FondVideo: Story = {
  args: {
    background: { video: "https://assets.mixkit.co/videos/5004/5004-720.mp4", image: photoUrl(LANDSCAPE_PHOTOS[2].id, 1600) },
    sections: [
      [metric("Ventes du trimestre", "1,24 M€", 8.2, [4, 6, 5, 7, 8, 9, 11]), metric("Panier moyen", "67,40 €", -1.4, [8, 7, 7, 6, 7, 6, 6])],
      [note("Ce qu'il faut retenir", "Le trimestre est porté par les ventes en ligne.", [3, 4, 5, 5, 6, 7, 8]), note("À surveiller", "Le panier moyen recule légèrement.", [8, 7, 7, 6, 6, 6, 5])],
      [metric("Nouveaux clients", "1 284", 12.5, [3, 4, 4, 6, 7, 8, 9]), note("Prochaine étape", "Relancer les clients inactifs.", [2, 3, 3, 4, 4, 5, 6])],
    ],
    height: "75vh",
    stickyTop: "12px",
    gap: 8,
    ariaLabel: "Bilan",
    overlay: ({ step }) =>
      step === 0 ? (
        <div style={{ position: "absolute", right: 28, bottom: 20, color: "#fff", fontSize: "clamp(2.4rem, 7vw, 6rem)", fontWeight: 700, letterSpacing: "-0.04em", textShadow: "0 4px 30px rgba(0,0,0,.35)" }}>Organisé.</div>
      ) : null,
  },
  render: (args) => (
    <div style={{ padding: "0 12px" }}>
      <Intro>Faites défiler ↓</Intro>
      <TriptychScroll {...args} />
      <Intro>Fin.</Intro>
    </div>
  ),
};
