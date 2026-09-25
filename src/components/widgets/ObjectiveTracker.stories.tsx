import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ObjectiveTracker, type Objective } from "./ObjectiveTracker";

/**
 * Les objectifs d'une prise en main, en petite carte flottante. « Valider l'étape » fait passer l'étape
 * en cours à « faite » — elle s'illumine un instant — et la suivante devient l'étape en cours.
 */
const meta: Meta<typeof ObjectiveTracker> = {
  title: "Widgets/ObjectiveTracker",
  component: ObjectiveTracker,
};
export default meta;
type Story = StoryObj<typeof ObjectiveTracker>;

const STEPS: Omit<Objective, "state">[] = [
  { id: "walls", title: "Fermer le bâtiment", description: "Tracez quatre murs autour de la zone de travail.", hint: "Astuce : l'outil « Murs en chaîne » ferme un rectangle en quatre clics." },
  { id: "dock", title: "Poser un quai", description: "Remplacez un mur par un mur de quai et ajoutez un parking poids lourds devant.", hint: "Le parking se tourne avec R avant la pose." },
  { id: "racks", title: "Installer trois racks", description: "Des racks à palettes pour stocker ce qui arrive." },
  { id: "pack", title: "Poser un poste d'emballage", description: "Les commandes partent emballées." },
  { id: "first", title: "Expédier une première commande", description: "Lancez la simulation et regardez partir le premier camion." },
];

export const Tutoriel: Story = {
  name: "Prise en main",
  render: function Render() {
    const [done, setDone] = useState(1);
    const [collapsed, setCollapsed] = useState(false);
    const [open, setOpen] = useState(true);
    const objectives: Objective[] = STEPS.map((s, i) => ({
      ...s,
      state: i < done ? "done" : i === done ? "current" : "todo",
      action: i === done ? { label: "Valider l'étape", onClick: () => setDone((d) => d + 1) } : undefined,
    }));
    return (
      <div style={{ position: "relative", height: 460, background: "color-mix(in srgb, var(--lq-color-text) 5%, var(--lq-color-bg))" }}>
        {open ? (
          <div style={{ position: "absolute", left: 16, bottom: 16 }}>
            <ObjectiveTracker title="Premiers pas" subtitle="Monter son premier entrepôt" objectives={objectives} collapsed={collapsed} onCollapsedChange={setCollapsed} onDismiss={() => setOpen(false)} />
          </div>
        ) : (
          <button type="button" style={{ margin: 16 }} onClick={() => setOpen(true)}>
            Rouvrir les objectifs
          </button>
        )}
        <button type="button" style={{ position: "absolute", right: 16, top: 16 }} onClick={() => setDone(1)}>
          Recommencer
        </button>
      </div>
    );
  },
};

export const Termine: Story = {
  name: "Tout est fait",
  args: { title: "Premiers pas", objectives: STEPS.map((s) => ({ ...s, state: "done" as const })) },
};
