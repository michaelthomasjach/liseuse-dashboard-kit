import type { Meta, StoryObj } from "@storybook/react";
import { ChartTooltip } from "./ChartTooltip";
import { CODE_LISIBLE } from "../../test-data/storyChartFormat";
import { NuageDelais } from "../../test-data/NuageDelais";
import codeNuage from "../../test-data/NuageDelais.tsx?raw";

/** Le tracé de démonstration : la bulle se place en pixels par rapport à lui. */
const LARGEUR = 520;
const HAUTEUR = 220;

/**
 * La bulle de survol des graphiques, exposée pour composer les siens.
 */
const meta = {
  title: "Charts/ChartTooltip",
  component: ChartTooltip,
  parameters: {
    ...CODE_LISIBLE,
    docs: {
      description: {
        component: [
          "La bulle flottante qu'affichent tous les graphiques du kit au survol, exposée pour un graphique composé à la main (avec `ChartAxis`). Elle se positionne en **pixels** : `x` et `y` sont mesurés depuis le coin haut-gauche de son parent, qui doit être en `position: relative`.",
          "",
          "**Quand l'utiliser** — pour un graphique fait main ; les graphiques du kit ont déjà la leur. Pour une aide attachée à un bouton ou un libellé, prenez `Tooltip`.",
          "",
          "**Placement** — la bulle se pose à droite du point (`align=\"right\"`, défaut) ou à sa gauche (`align=\"left\"`), mais c'est une **préférence** : elle mesure sa propre taille et celle du tracé, et se recale à l'intérieur si elle devait en sortir — horizontalement comme verticalement. Le calcul se fait avant que le navigateur ne peigne : elle n'apparaît jamais d'abord au mauvais endroit. `visible={false}` la retire.",
          "",
          "**Contenu** — `children`, libre : un titre, des lignes valeur par série. Elle ne capte pas le pointeur (`pointer-events: none`) : le survol reste au tracé en dessous.",
          "",
          "**Thème** — fond `--lq-color-panel`, filet `--lq-color-border`, angles `--lq-radius-md`, ombre `--lq-shadow-modal`, texte `--lq-color-text` ; marges intérieures `--lq-space-2` et `--lq-space-3`.",
        ].join("\n"),
      },
    },
  },
  render: (args) => (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: LARGEUR,
        height: HAUTEUR,
        border: "1px dashed var(--lq-color-border)",
        background: "var(--lq-color-panel)",
      }}
    >
      {/* Le point décrit par la bulle. */}
      <span
        style={{
          position: "absolute",
          left: args.x - 4,
          top: args.y - 4,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "var(--lq-color-accent)",
        }}
      />
      <span style={{ position: "absolute", left: 8, bottom: 6, fontSize: 12, color: "var(--lq-color-text-muted)" }}>
        point : x = {args.x}, y = {args.y}
      </span>
      <ChartTooltip {...args} />
    </div>
  ),
  args: {
    x: 180,
    y: 70,
    visible: true,
    children: (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <strong>Groupe Delmas</strong>
        <span>142 k€ facturés</span>
        <span>payé en 31 jours en moyenne</span>
      </div>
    ),
  },
  argTypes: {
    children: { control: false },
    x: { control: { type: "range", min: 0, max: LARGEUR, step: 1 } },
    y: { control: { type: "range", min: 0, max: HAUTEUR, step: 1 } },
  },
} satisfies Meta<typeof ChartTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Défaut",
  parameters: {
    docs: {
      description: {
        story: "La bulle à droite du point. Déplacez `x` et `y` dans les contrôles : près d'un bord, elle se recale à l'intérieur du cadre.",
      },
    },
  },
};

export const AlignLeft: Story = {
  name: "À gauche du point",
  args: { x: 340, align: "left" },
  parameters: { docs: { description: { story: "`align=\"left\"` : la bulle préfère la gauche — l'usage quand le point est dans la moitié droite du tracé." } } },
};

export const ClampedAtEdge: Story = {
  name: "Recalée au bord",
  args: { x: 470, y: 190 },
  parameters: {
    docs: {
      description: {
        story: "Le point est près du coin bas-droit et la bulle préfère la droite : elle se recale à l'intérieur du cadre plutôt que d'en sortir et de perdre son texte.",
      },
    },
  },
};

export const SeriesRows: Story = {
  name: "Une ligne par série",
  args: {
    children: (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <strong>oct. 26</strong>
        {[
          ["Chiffre d'affaires", "98 k€", "var(--lq-color-accent)"],
          ["Charges", "77 k€", "var(--lq-color-green)"],
        ].map(([libelle, valeur, couleur]) => (
          <span key={libelle} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: couleur }} />
            {libelle} : {valeur}
          </span>
        ))}
      </div>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: "Le contenu type d'un graphique à plusieurs séries : la date en titre, puis une ligne par série avec sa pastille de couleur.",
      },
    },
  },
};

export const Hidden: Story = {
  name: "Masquée",
  args: { visible: false },
  parameters: { docs: { description: { story: "`visible={false}` : rien n'est rendu — l'état d'un tracé que le pointeur a quitté." } } },
};

export const Composed: Story = {
  name: "Dans un graphique composé",
  render: () => <NuageDelais />,
  parameters: {
    docs: {
      source: { code: codeNuage },
      description: {
        story: "La bulle d'un nuage de points fait main : survolez un point, elle le suit et reste dans le tracé, même pour les points du bord droit. Le code ci-dessous est le composant complet.",
      },
    },
  },
};
