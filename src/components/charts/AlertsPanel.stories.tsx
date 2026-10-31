import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { AlertsPanel } from "./AlertsPanel";
import { Button } from "../primitives/Button";
import type { ChartAlert } from "./candlestick/interfaces/ChartAlertDraft.interface";
import { ALERTES_NOVA } from "../../test-data/storyDemoData";
import { CODE_LISIBLE, SOURCE_ABREGEE } from "../../test-data/storyChartFormat";

/**
 * La liste des alertes posées sur un graphique de cours.
 */
const meta = {
  title: "Charts/AlertsPanel",
  component: AlertsPanel,
  parameters: {
    ...CODE_LISIBLE,
    docs: {
      source: SOURCE_ABREGEE,
      description: {
        component: [
          "La liste, en lecture, de toutes les alertes posées sur un graphique — sur ses tracés ou directement sur un indicateur, le prix compris. Une ligne par alerte : son `message` — c'est donc lui qui doit dire la condition, le seuil et le titre — et une corbeille pour la supprimer.",
          "",
          "**Quand l'utiliser** — à côté d'un `CandlestickChart`, pour voir d'un coup toutes les alertes d'un titre. Sa place naturelle est l'onglet « Alertes » d'un `ChartWorkspace` (prop `alerts`), ou le panneau latéral d'un graphique seul (`sidePanel`). Ce n'est pas un second endroit d'édition : une alerte se **modifie** depuis le tracé ou l'indicateur qui l'a créée, dans le graphique.",
          "",
          "**Les données** — `alerts` est la même liste que celle passée au graphique (`CandlestickChart.alerts`) : l'application la détient, le kit n'en stocke ni n'en évalue aucune. Chaque `ChartAlert` porte `id`, `message`, `conditionIndicatorId`, `crossing` (franchissement, à la hausse, à la baisse, au-dessus, en dessous…), `trigger` (une seule fois, une fois par bougie, à la clôture…), `drawingId`, `sound` et `expiresAt`.",
          "",
          "**Interactions** — la corbeille d'une ligne appelle `onDeleteAlert(id)` ; à l'application de retirer l'alerte de sa liste. Sans `onDeleteAlert`, le panneau reste en lecture seule. Une liste vide affiche `emptyMessage` (« Aucune alerte configurée pour le moment. » par défaut).",
          "",
          "**Thème** — chaque ligne est une carte `--lq-color-panel` au texte `--lq-color-text`, espacée de `--lq-space-2` ; la corbeille prend `--lq-color-hover` au survol ; le message de liste vide est en `--lq-color-text-muted`.",
        ].join("\n"),
      },
    },
  },
  args: { alerts: ALERTES_NOVA, onDeleteAlert: fn(), emptyMessage: "Aucune alerte sur ce titre." },
  argTypes: { alerts: { control: false }, onDeleteAlert: { control: false } },
  render: (args) => (
    <div style={{ maxWidth: 420 }}>
      <AlertsPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof AlertsPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Défaut",
  parameters: {
    docs: {
      description: {
        story: "Trois alertes posées sur NOVA. La corbeille appelle `onDeleteAlert` (voyez l'onglet Actions) ; la liste, elle, ne bouge pas : c'est à l'application de retirer l'alerte.",
      },
    },
  },
};

export const Empty: Story = {
  name: "Vide",
  args: { alerts: [] },
  parameters: { docs: { description: { story: "Sans alerte, le panneau affiche `emptyMessage`." } } },
};

export const ReadOnly: Story = {
  name: "Lecture seule",
  args: { onDeleteAlert: undefined },
  parameters: { docs: { description: { story: "Sans `onDeleteAlert`, rien ne se supprime d'ici." } } },
};

export const Controlled: Story = {
  name: "Liste tenue par l'application",
  render: function Render() {
    const [alertes, setAlertes] = useState<ChartAlert[]>(ALERTES_NOVA);
    const supprimer = (id: string) => setAlertes((a) => a.filter((x) => x.id !== id));
    const retablir = () => setAlertes(ALERTES_NOVA);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 420 }}>
        <AlertsPanel alerts={alertes} onDeleteAlert={supprimer} emptyMessage="Plus aucune alerte sur NOVA." />
        {alertes.length < ALERTES_NOVA.length ? (
          <div>
            <Button onClick={retablir}>Rétablir les alertes</Button>
          </div>
        ) : null}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "L'usage réel : l'application tient la liste dans son état et retire l'alerte que `onDeleteAlert` lui désigne. Supprimez-en une, puis rétablissez-les.",
      },
    },
  },
};
