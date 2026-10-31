import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { Button } from "../primitives/Button";
import { ChartEventTooltip } from "./EventTooltip";
import type { ChartEvent } from "./candlestick/interfaces/ChartEvent.interface";
import { EVENEMENTS_EMPILES, EVENEMENTS_NOVA } from "../../test-data/storyDemoData";
import { CODE_LISIBLE, SOURCE_ABREGEE, dateCourte } from "../../test-data/storyChartFormat";

/** Les évènements de NOVA, chacun bordé de la couleur de son type. */
const COULEUR_PAR_TYPE: Record<string, string> = {
  Résultats: "var(--lq-color-violet)",
  Dividende: "var(--lq-color-green)",
  Assemblée: "var(--lq-color-sky)",
};
const EVENEMENTS_COLORES: ChartEvent[] = EVENEMENTS_NOVA.slice(0, 3).map((e) => ({ ...e, color: COULEUR_PAR_TYPE[e.kind] }));

/** Le cadre positionné qui tient lieu de graphique : la carte s'y ancre, la fenêtre le remplit. */
const cadre = {
  position: "relative",
  height: 400,
  maxWidth: 720,
  border: "1px dashed var(--lq-color-border)",
  background: "var(--lq-color-panel)",
} as const;

/**
 * La carte de détail d'un repère d'évènement, montrée hors de son graphique.
 */
const meta = {
  title: "Charts/ChartEventTooltip",
  component: ChartEventTooltip,
  parameters: {
    ...CODE_LISIBLE,
    docs: {
      source: SOURCE_ABREGEE,
      description: {
        component: [
          "La carte qui s'ouvre quand on clique un repère d'évènement (résultats, dividende, assemblée…) au pied d'un `CandlestickChart`. Une carte par évènement : son `label` en titre, ses lignes `details`, sa date ; plusieurs évènements tombés sur le même repère s'empilent dans la même carte, avec un défilement au-delà de la hauteur disponible.",
          "",
          "**Quand l'utiliser** — le graphique de cours l'ouvre lui-même : il suffit de lui passer `events`. On ne la monte à la main que pour un graphique composé qui a ses propres repères.",
          "",
          "**Deux modes** — `mode=\"popover\"` : une petite carte ancrée au repère, placée par `left` et `bottom` (en px, depuis l'ancêtre positionné : elle grandit **vers le haut** à mesure que le contenu s'allonge), large de `width` (320 px), plafonnée à 350 px de haut. `mode=\"modal\"` : elle remplit tout son ancêtre positionné — dans un graphique, tout le graphique — avec un en-tête (le titre, ou « N évènements ») et un bouton de fermeture. Le positionnement et le passage d'un mode à l'autre reviennent à l'appelant.",
          "",
          "**Interactions** — un clic hors de la carte ou la touche Échap appellent `onClose`. Avec `onExpand`, chaque carte devient cliquable (voile au survol) et demande l'agrandissement ; sans lui, elles restent inertes. `formatDate` met en forme les dates. Une `color` sur un évènement borde sa carte.",
          "",
          "**Thème** — cartes sur `--lq-color-panel` au filet `--lq-color-border-subtle`, ombre `--lq-shadow-modal`, angles `--lq-radius-md` et `--lq-radius-sm` ; titre en `--lq-color-text`, détails et date en `--lq-color-text-muted` ; survol `--lq-color-hover` ; liseré d'accent `--lq-color-accent` par défaut.",
        ].join("\n"),
      },
    },
  },
  render: (args) => (
    <div style={cadre}>
      <ChartEventTooltip {...args} />
    </div>
  ),
  args: {
    events: [EVENEMENTS_NOVA[0]],
    mode: "popover",
    left: 16,
    bottom: 16,
    formatDate: dateCourte,
    onClose: fn(),
    onExpand: fn(),
  },
  argTypes: {
    events: { control: false },
    formatDate: { control: false },
    onClose: { control: false },
    onExpand: { control: false },
    left: { control: { type: "range", min: 0, max: 400, step: 4 } },
    bottom: { control: { type: "range", min: 0, max: 200, step: 4 } },
  },
} satisfies Meta<typeof ChartEventTooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Défaut",
  parameters: {
    docs: {
      description: {
        story: "Un évènement — les résultats annuels — dans la petite carte ancrée en bas à gauche. Cliquer la carte appelle `onExpand`, cliquer ailleurs ou Échap `onClose` (onglet Actions).",
      },
    },
  },
};

export const Stacked: Story = {
  name: "Évènements empilés",
  args: { events: EVENEMENTS_EMPILES },
  parameters: { docs: { description: { story: "Deux évènements sur le même repère : le détachement du dividende et l'assemblée générale, listés dans la même carte." } } },
};

export const Modal: Story = {
  name: "Fenêtre",
  args: { events: EVENEMENTS_EMPILES, mode: "modal" },
  parameters: {
    docs: {
      description: {
        story: "`mode=\"modal\"` remplit tout l'ancêtre positionné — ici le cadre pointillé, dans un graphique le graphique entier — avec un en-tête et un bouton de fermeture.",
      },
    },
  },
};

export const Colored: Story = {
  name: "Couleur par type",
  args: { events: EVENEMENTS_COLORES, left: 40, width: 360 },
  parameters: {
    docs: {
      description: {
        story: "`ChartEvent.color` borde chaque carte : un repère visuel par type d'évènement, toujours par variable du thème.",
      },
    },
  },
};

export const Inert: Story = {
  name: "Cartes inertes",
  args: { onExpand: undefined },
  parameters: { docs: { description: { story: "Sans `onExpand`, la carte ne réagit ni au survol ni au clic : elle se lit, c'est tout." } } },
};

export const Controlled: Story = {
  name: "Ouverture tenue par l'appelant",
  render: function Render() {
    const [mode, setMode] = useState<"popover" | "modal" | null>("popover");
    const agrandir = () => setMode("modal");
    const fermer = () => setMode(null);
    const rouvrir = () => setMode("popover");
    return (
      <div style={cadre}>
        {mode ? (
          <ChartEventTooltip
            events={EVENEMENTS_EMPILES}
            mode={mode}
            left={16}
            bottom={16}
            formatDate={dateCourte}
            onExpand={agrandir}
            onClose={fermer}
          />
        ) : (
          <div style={{ padding: 16 }}>
            <Button onClick={rouvrir}>Rouvrir la carte</Button>
          </div>
        )}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Le cycle complet, tenu par l'appelant : la carte s'ouvre en petit, un clic l'agrandit (`onExpand` → `mode=\"modal\"`), la croix, Échap ou un clic dehors la ferment (`onClose`).",
      },
    },
  },
};
