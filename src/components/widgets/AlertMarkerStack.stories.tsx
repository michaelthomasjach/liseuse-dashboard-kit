import { useState, type CSSProperties, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { AlertMarkerStack, type AlertMarkerProps } from "./AlertMarker";

/**
 * Le décor de la story : un conteneur positionné, comme une application poserait la pile sur sa
 * carte ou son plan. Il ne lit que des variables du thème, pour suivre palette et surface.
 */
function Stage({ height = 380, children }: { height?: number; children: ReactNode }) {
  const line = "color-mix(in srgb, var(--lq-color-text) 6%, transparent)";
  return (
    <div
      style={{
        position: "relative",
        height,
        overflow: "hidden",
        border: "1px solid var(--lq-color-border-subtle)",
        borderRadius: "var(--lq-radius-md)",
        background: `repeating-linear-gradient(0deg, ${line} 0 1px, transparent 1px 28px), repeating-linear-gradient(90deg, ${line} 0 1px, transparent 1px 28px), color-mix(in srgb, var(--lq-color-text) 3%, var(--lq-color-bg))`,
      }}
    >
      <Block left="10%" top="34%" width="34%" height="30%" />
      <Block left="54%" top="52%" width="26%" height="26%" />
      {children}
    </div>
  );
}

function Block(style: Pick<CSSProperties, "left" | "top" | "width" | "height">) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        borderRadius: "var(--lq-radius-sm)",
        background: "color-mix(in srgb, var(--lq-color-text) 12%, var(--lq-color-bg))",
        ...style,
      }}
    />
  );
}

/** Une ligne de légende en bas à gauche de la scène : ce que le dernier geste a produit. */
function Caption({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        position: "absolute",
        left: "var(--lq-space-3)",
        bottom: "var(--lq-space-2)",
        margin: 0,
        fontSize: "var(--lq-text-sm)",
        color: "var(--lq-color-text-muted)",
      }}
    >
      {children}
    </p>
  );
}

type StackedAlert = AlertMarkerProps & { id: string };

/** Du plus grave au plus léger : c'est à l'application de les ranger, la pile garde l'ordre reçu. */
const ALERTS: Omit<StackedAlert, "onClick">[] = [
  { id: "paiement", severity: "critical", label: "Échec de prélèvement : 2 clients", count: 2 },
  { id: "stock", severity: "warning", label: "Stock bas : cartons 40 × 30" },
  { id: "contrat", severity: "warning", label: "Contrat à renouveler" },
  { id: "export", severity: "info", label: "Export comptable prêt" },
  { id: "message", severity: "info", label: "Nouveau message" },
  { id: "maj", severity: "info", label: "Mise à jour disponible" },
];

/**
 * La pile d'alertes sans lieu, rangée dans un coin de la scène. Au-delà de `max`, les suivantes se
 * replient en « +N ».
 */
const meta = {
  title: "Widgets/AlertMarkerStack",
  component: AlertMarkerStack,
  parameters: {
    docs: {
      description: {
        component: [
          "La **pile d'alertes** : une rangée d'épingles `AlertMarker` rangée dans un coin de son conteneur, pour ce qui ne se rattache à **aucun endroit** de la scène — un prélèvement échoué, un contrat à renouveler, un message.",
          "",
          "**Quand l'utiliser** — en surimpression d'une carte ou d'un plan, à côté des épingles posées sur place : la pile tient ce qui n'a pas de lieu. Pour des alertes qui restent dans le flux de la page, avec leur texte en entier, `AlertList`.",
          "",
          "**Données** — `alerts` est une liste de props d'`AlertMarker` (`severity`, `label`, `onClick`, et au besoin `count`, `size`, `bounce`), chacune avec un `id`. **L'ordre est celui du tableau** : à l'application de mettre le plus grave en premier.",
          "",
          "**Repli** — au-delà de `max` (5 par défaut), les alertes suivantes se replient en une pastille « +N » dont l'infobulle liste les noms.",
          "",
          "**Placement** — `corner` : `top-right` (défaut), `top-left`, `bottom-right` ou `bottom-left`. **Le conteneur doit être positionné** (`position: relative`). `aria-label` nomme le groupe (« Alertes » par défaut).",
          "",
          "**Thème** — celles d'`AlertMarker` : `--lq-color-danger`, `--lq-color-amber`, `--lq-color-accent`, `--lq-color-panel`, `--lq-color-border`, `--lq-color-text`, `--lq-text-xs`.",
        ].join("\n"),
      },
    },
  },
  args: {
    alerts: ALERTS.map((a) => ({ ...a, onClick: () => {} })),
    corner: "top-right",
    max: 4,
    "aria-label": "Alertes du compte",
  },
  argTypes: {
    alerts: { control: false },
    corner: { control: "select", options: ["top-right", "top-left", "bottom-right", "bottom-left"] },
    max: { control: { type: "range", min: 1, max: 6, step: 1 } },
  },
  // La story branche chaque épingle sur la légende du bas.
  render: function Render(args) {
    const [last, setLast] = useState("—");
    return (
      <Stage height={300}>
        <AlertMarkerStack {...args} alerts={args.alerts.map((a) => ({ ...a, onClick: () => setLast(a.label) }))} />
        <Caption>Dernier clic : {last}</Caption>
      </Stage>
    );
  },
} satisfies Meta<typeof AlertMarkerStack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Défaut",
  parameters: { docs: { description: { story: "Six alertes, quatre montrées : les deux dernières se replient en « +2 »." } } },
};

export const BottomRight: Story = {
  name: "En bas à droite, petites",
  args: { corner: "bottom-right", max: 5, alerts: ALERTS.slice(0, 3).map((a) => ({ ...a, size: "sm" as const, onClick: () => {} })) },
  parameters: { docs: { description: { story: "Trois alertes en taille `sm`, dans le coin bas droit." } } },
};

export const Urgent: Story = {
  name: "Urgences seules",
  args: {
    "aria-label": "Alertes urgentes",
    alerts: [
      { id: "tresorerie", severity: "critical", label: "Trésorerie négative", onClick: () => {} },
      { id: "retards", severity: "critical", label: "Commandes en retard", count: 12, onClick: () => {} },
    ],
  },
};
