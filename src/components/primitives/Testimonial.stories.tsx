import type { Meta, StoryObj } from "@storybook/react";
import { Testimonial, QuoteMark } from "./Testimonial";

const meta: Meta<typeof Testimonial> = {
  title: "Primitives/Testimonial",
  component: Testimonial,
};
export default meta;
type Story = StoryObj<typeof Testimonial>;

export const Default: Story = {
  render: () => (
    <Testimonial
      quote="Le tableau de bord m'a fait gagner un temps fou pour suivre mes positions — les graphiques sont enfin lisibles sur ma liseuse."
      name="Camille Berthier"
      role="Investisseuse particulière"
      rating={5}
    />
  ),
};

export const WithoutRating: Story = {
  render: () => (
    <Testimonial
      quote="Simple à intégrer, et le mode e-ink est vraiment pensé pour l'écran, pas juste du noir et blanc appliqué après coup."
      name="Julien Roche"
      role="CTO, Fintech Studio"
    />
  ),
};

export const Italique: Story = {
  name: "Italique (sans cadre)",
  render: () => (
    <Testimonial variant="italic" quote="Le texte de ma citation en italique" />
  ),
};

export const Callout: Story = {
  name: "Fond teinté et trait vertical à gauche",
  render: () => (
    <Testimonial variant="callout" quote="Le texte de ma citation avec une couleur de fond et un trait vertical à gauche" />
  ),
};

export const MotsEnAvant: Story = {
  name: "Mots mis en avant",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 480 }}>
      <Testimonial variant="italic" quote="Le texte de ma citation avec des mots mis en avant" highlight={["mots mis en avant"]} />
      <Testimonial
        variant="callout"
        quote="Le rendement net est de 6,2 % sur douze mois, contre 4,1 % pour l'indice de référence."
        highlight={["6,2 %", "4,1 %"]}
      />
    </div>
  ),
};

/** `highlight` ne peut pas réécrire du texte à l'intérieur de nœuds arbitraires : quand la citation
 *  n'est pas une simple chaîne, c'est à l'appelant de poser ses `<QuoteMark>` lui-même. */
export const MotsEnAvantManuels: Story = {
  name: "Mots mis en avant (citation composée)",
  render: () => (
    <Testimonial
      variant="callout"
      quote={
        <>
          Trois mois après la bascule, le temps de chargement est passé de 4 s à <QuoteMark>moins de 400 ms</QuoteMark>.
        </>
      }
      name="Sofia Nguyen"
      role="Lead front-end"
    />
  ),
};

export const LesTroisStyles: Story = {
  name: "Les trois styles",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 520 }}>
      <Testimonial
        quote="Le tableau de bord m'a fait gagner un temps fou pour suivre mes positions."
        name="Camille Berthier"
        role="Investisseuse particulière"
        rating={5}
      />
      <Testimonial variant="italic" quote="Le texte de ma citation en italique" name="Julien Roche" role="CTO, Fintech Studio" />
      <Testimonial variant="callout" quote="Le texte de ma citation avec une couleur de fond et un trait vertical à gauche" />
    </div>
  ),
};
