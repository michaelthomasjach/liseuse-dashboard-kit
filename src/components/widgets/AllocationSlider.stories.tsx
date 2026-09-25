import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { AllocationSlider } from "./AllocationSlider";
import { BoxesIcon, ForkliftIcon, TruckIcon } from "../icons";

/**
 * Partager le temps d'un chariot entre ses tâches : une barre d'ensemble, une ligne par tâche, et ce
 * qui reste libre. `mode="cap"` (défaut) s'arrête à ce qui est libre ; `mode="steal"` prend aux autres.
 */
const meta: Meta<typeof AllocationSlider> = {
  title: "Widgets/AllocationSlider",
  component: AllocationSlider,
};
export default meta;
type Story = StoryObj<typeof AllocationSlider>;

const TASKS = [
  { id: "unload", label: "Décharger les camions", icon: <TruckIcon size={10} /> },
  { id: "putaway", label: "Ranger en rack", icon: <BoxesIcon size={10} /> },
  { id: "feed", label: "Rack → tapis", icon: <ForkliftIcon size={10} /> },
];

export const Partage: Story = {
  name: "Le temps d'un chariot",
  render: function Render() {
    const [values, setValues] = useState<Record<string, number>>({ unload: 40, putaway: 35, feed: 15 });
    return (
      <div style={{ maxWidth: 460 }}>
        <AllocationSlider items={TASKS} values={values} onChange={setValues} ariaLabel="Temps du chariot" />
      </div>
    );
  },
};

export const PrendreAuxAutres: Story = {
  name: "Prendre aux autres (steal)",
  render: function Render() {
    const [values, setValues] = useState<Record<string, number>>({ unload: 50, putaway: 30, feed: 20 });
    return (
      <div style={{ maxWidth: 460 }}>
        <AllocationSlider items={TASKS} values={values} onChange={setValues} mode="steal" ariaLabel="Temps du chariot" />
      </div>
    );
  },
};

/** Sur un téléphone : le nom passe au-dessus de son curseur, la zone de prise fait 44 px. */
export const Telephone: Story = {
  name: "Sur un téléphone",
  globals: { viewport: { value: "mobile2", isRotated: false } },
  render: function Render() {
    const [values, setValues] = useState<Record<string, number>>({ unload: 40, putaway: 35, feed: 15 });
    return (
      <div style={{ width: "100%", maxWidth: 390 }}>
        <AllocationSlider items={TASKS} values={values} onChange={setValues} ariaLabel="Temps du chariot" />
      </div>
    );
  },
};
