import type { Meta, StoryObj } from "@storybook/react";
import type { CSSProperties } from "react";
import { Carousel } from "./Carousel";
import { Jumbotron } from "./Jumbotron";
import { Button } from "./Button";

const meta: Meta<typeof Carousel> = {
  title: "Primitives/Carousel",
  component: Carousel,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof Carousel>;

// Real Unsplash photos (not generated placeholders) — a different one per slide so the three are
// easy to tell apart, each thematically matched to its own slide's copy.
const MARKET_IMAGE = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80";
const ALERTS_IMAGE = "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?auto=format&fit=crop&w=1600&q=80";
const EARNINGS_IMAGE = "https://images.unsplash.com/photo-1522083165195-3424ed129620?auto=format&fit=crop&w=1600&q=80";

export const HeroBanners: Story = {
  name: "Bannières promotionnelles",
  render: () => (
    <div style={{ padding: 24 }}>
      <Carousel height={360} autoplayInterval={4000}>
        <Jumbotron
          eyebrow="Marché"
          title="Les marchés ouvrent dans 2 heures"
          description="Préparez vos ordres avant l'ouverture de Wall Street."
          backgroundImage={MARKET_IMAGE}
          imageFilter="grayscale"
          actions={<Button selected>Voir le calendrier</Button>}
        />
        <Jumbotron
          eyebrow="Nouveau"
          title="Alertes de prix personnalisées"
          description="Soyez notifié dès qu'un titre atteint votre seuil."
          backgroundImage={ALERTS_IMAGE}
          imageFilter="grayscale"
          actions={<Button selected>Configurer une alerte</Button>}
        />
        <Jumbotron
          eyebrow="Résultats"
          title="Saison des résultats T3"
          description="Consultez le calendrier des publications de vos titres suivis."
          backgroundImage={EARNINGS_IMAGE}
          imageFilter="grayscale"
          actions={<Button selected>Voir les résultats</Button>}
        />
      </Carousel>
    </div>
  ),
};

const SLIDE_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  border: "1px solid var(--lq-color-border-subtle)",
  borderRadius: "var(--lq-radius-lg)",
  backgroundColor: "var(--lq-color-panel)",
  fontSize: "1.1rem",
  fontWeight: 600,
};

export const SimpleContent: Story = {
  name: "Contenu simple",
  render: () => (
    <div style={{ padding: 24, maxWidth: 480 }}>
      <Carousel height={180} dots arrows>
        <div style={SLIDE_STYLE}>Diapositive 1</div>
        <div style={SLIDE_STYLE}>Diapositive 2</div>
        <div style={SLIDE_STYLE}>Diapositive 3</div>
      </Carousel>
    </div>
  ),
};

/** Des Jumbotron sans image : leur texte commence au bord gauche, là où se pose la flèche
 *  « précédent » — le carrousel leur réserve la place des flèches de chaque côté. */
export const TextSlides: Story = {
  name: "Diapositives de texte",
  render: () => (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <Carousel height={220} ariaLabel="Annonces">
        <Jumbotron eyebrow="Nouveau" title="Alertes de prix personnalisées" description="Soyez notifié dès qu'un titre atteint votre seuil." />
        <Jumbotron eyebrow="Rappel" title="Clôture trimestrielle le 31" description="Vérifiez vos ordres en attente avant la fin du trimestre." />
        <Jumbotron eyebrow="Résultats" title="Saison des résultats T3" description="Consultez le calendrier des publications de vos titres suivis." />
      </Carousel>
    </div>
  ),
};
