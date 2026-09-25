import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { AnalogClock } from "./AnalogClock";

/**
 * L'horloge d'une partie : un temps en secondes — l'heure du jour ou le temps absolu de la
 * simulation — et ses aiguilles. En option, l'heure en chiffres, le soleil ou la lune, le jour et une
 * légende.
 */
const meta: Meta<typeof AnalogClock> = {
  title: "Widgets/AnalogClock",
  component: AnalogClock,
  args: { seconds: 14 * 3600 + 5 * 60, showDigital: true, day: 3, caption: "trafic fluide", night: false, size: 30 },
};
export default meta;
type Story = StoryObj<typeof AnalogClock>;

export const Horloge: Story = { name: "L'horloge" };

/** Le temps d'une simulation qui file : une minute de jeu par pas, jour et nuit selon l'heure. */
export const Simulation: Story = {
  name: "Une journée qui défile",
  render: function Render() {
    const [t, setT] = useState(5 * 3600);
    useEffect(() => {
      const id = window.setInterval(() => setT((v) => v + 60 * 7), 60);
      return () => window.clearInterval(id);
    }, []);
    const hour = (t % 86400) / 3600;
    return <AnalogClock seconds={t} day={Math.floor(t / 86400) + 1} night={hour < 7 || hour >= 20} caption={hour >= 7 && hour < 9 ? "heure de pointe" : "trafic fluide"} size={40} />;
  },
};

export const Tailles: Story = {
  name: "Tailles et variantes",
  render: () => (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <AnalogClock seconds={3 * 3600 + 40 * 60} showDigital={false} size={24} />
      <AnalogClock seconds={9 * 3600} size={30} />
      <AnalogClock seconds={22 * 3600 + 15 * 60} night day={12} size={48} />
      <AnalogClock seconds={86400 * 4 + 18 * 3600 + 30 * 60} day={5} caption="prix de l'électricité : pointe" size={56} />
    </div>
  ),
};
