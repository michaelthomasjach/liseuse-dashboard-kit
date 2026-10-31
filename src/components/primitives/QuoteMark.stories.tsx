import type { Meta, StoryObj } from "@storybook/react";
import { QuoteMark, Testimonial } from "./Testimonial";
import { Text } from "./Text";

/**
 * Le mot mis en avant dans une citation : un `<mark>` sur un fond teinté de l'accent.
 */
const meta = {
  title: "Primitives/QuoteMark",
  component: QuoteMark,
  parameters: {
    docs: {
      description: {
        component: [
          "Fait ressortir un mot ou une expression dans une citation : un élément `<mark>` en graisse appuyée, sur un fond teinté de l'accent, aux angles légèrement arrondis.",
          "",
          "**Pourquoi un composant à part** — `Testimonial` met lui-même des mots en avant avec sa prop `highlight`, mais seulement quand la citation est une chaîne : il ne peut pas réécrire le texte enfoui dans des nœuds React. Dès que la citation contient un `<em>`, un lien, une valeur calculée, on la compose en JSX et on entoure à la main les mots voulus de `QuoteMark`.",
          "",
          "**Hors d'une citation** — rien ne l'y attache : il marque aussi un mot dans un `Text`. Gardez-le pour ce qu'il dit — « voici le mot qui compte » — et non pour surligner un résultat de recherche ou signaler une erreur.",
          "",
          "**Accessibilité** — `<mark>` est annoncé comme texte surligné par la plupart des lecteurs d'écran.",
          "",
          "**Thème** — fond `--lq-color-accent` à 18 %, `--lq-font-weight-bold`, `--lq-radius-sm` ; le texte garde la couleur de son parent.",
        ].join("\n"),
      },
    },
  },
  args: { children: "18 jours" },
  argTypes: { children: { control: "text" } },
  render: (args) => (
    <Text size="lg">
      Le délai de paiement moyen est passé de 31 à <QuoteMark {...args} />.
    </Text>
  ),
} satisfies Meta<typeof QuoteMark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Défaut" };

export const InTestimonial: Story = {
  name: "Dans un témoignage",
  render: () => (
    <div style={{ maxWidth: 520 }}>
      <Testimonial
        quote={
          <>
            Nos commerciaux ouvrent le tableau des <QuoteMark>encours clients</QuoteMark> avant chaque rendez-vous — <em>tous</em>, sans exception.
          </>
        }
        name="Inès Roux"
        role="Directrice commerciale, Cabinet Roux"
      />
    </div>
  ),
  parameters: { docs: { description: { story: "La citation contient un `<em>` : `highlight` ne peut plus chercher dedans, `QuoteMark` prend le relais." } } },
};

export const InCallout: Story = {
  name: "Dans un encadré latéral",
  render: () => (
    <div style={{ maxWidth: 520 }}>
      <Testimonial
        variant="callout"
        quote={
          <>
            Trois mois après la bascule, le délai de paiement moyen est passé de 31 à <QuoteMark>18 jours</QuoteMark>.
          </>
        }
      />
    </div>
  ),
};

export const Several: Story = {
  name: "Plusieurs mots",
  render: () => (
    <div style={{ maxWidth: 520 }}>
      <Testimonial
        variant="italic"
        quote={
          <>
            <QuoteMark>Moins de saisie</QuoteMark>, <QuoteMark>moins de relances</QuoteMark>, et une clôture qui tient en une matinée.
          </>
        }
        name="Claire Lemoine"
        role="Lemoine SAS"
      />
    </div>
  ),
};
