import type { Meta, StoryObj } from "@storybook/react";
import { Heading } from "./Heading";
import { Text } from "./Text";

const meta: Meta = {
  title: "Foundations/Typography",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

export const TypeScale: Story = {
  name: "Échelle typographique",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, maxWidth: 640 }}>
      <section>
        <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Titres — Heading
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
          {[1, 2, 3, 4, 5, 6].map((level) => (
            <div key={level} style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              <span style={{ width: 28, fontSize: 12, opacity: 0.5, fontFamily: "monospace" }}>h{level}</span>
              <Heading level={level as 1 | 2 | 3 | 4 | 5 | 6}>Structure du capital</Heading>
            </div>
          ))}
        </div>
      </section>

      <section>
        <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          En-tête de section — Heading (meta + divider)
        </span>
        <div style={{ marginTop: 12 }}>
          <Heading level={3} meta="Settled · 29.08.2026" divider>
            Positions
          </Heading>
        </div>
      </section>

      <section>
        <Text size="xs" muted weight="bold">
          Texte — Text (tailles)
        </Text>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          <Text size="xl">Texte extra-large (xl) — pour un chiffre clé ou une accroche.</Text>
          <Text size="lg">Texte large (lg) — sous-titre ou paragraphe d'intro.</Text>
          <Text size="md">Texte standard (md) — le corps de texte par défaut de l'application.</Text>
          <Text size="sm">Texte petit (sm) — légendes, aide contextuelle.</Text>
          <Text size="xs">Texte extra-petit (xs) — mentions légales, métadonnées.</Text>
        </div>
      </section>

      <section>
        <Text size="xs" muted weight="bold">
          Texte — graisses et variante atténuée
        </Text>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          <Text weight="regular">Graisse normale — paragraphe courant.</Text>
          <Text weight="medium">Graisse medium — légèrement mise en avant.</Text>
          <Text weight="bold">Graisse grasse — forte emphase.</Text>
          <Text muted>Variante atténuée (muted) — texte secondaire, moins prioritaire.</Text>
        </div>
      </section>

      <section>
        <Text size="xs" muted weight="bold">
          Paragraphe long
        </Text>
        <div style={{ marginTop: 12 }}>
          <Text>
            Les marchés actions ont clôturé en légère hausse ce vendredi, portés par des résultats trimestriels
            supérieurs aux attentes dans le secteur technologique. La volatilité reste toutefois élevée à l'approche
            de la prochaine décision de politique monétaire, et plusieurs analystes recommandent la prudence sur les
            valeurs les plus exposées aux taux d'intérêt.
          </Text>
        </div>
      </section>
    </div>
  ),
};
