import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ColorSwatchButton } from "./ColorSwatchButton";

const meta: Meta<typeof ColorSwatchButton> = {
  title: "Primitives/ColorSwatchButton",
  component: ColorSwatchButton,
};
export default meta;
type Story = StoryObj<typeof ColorSwatchButton>;

const OPTIONS = [
  { id: "red", label: "Rouge", color: "#ef4444" },
  { id: "amber", label: "Ambre", color: "#f59e0b" },
  { id: "green", label: "Vert", color: "#22c55e" },
  { id: "blue", label: "Bleu", color: "#3b82f6" },
  { id: "rose", label: "Rose", color: "#ec4899" },
  { id: "violet", label: "Violet", color: "#8b5cf6" },
];

export const Grid: Story = {
  render: () => {
    const [selected, setSelected] = useState("amber");
    return (
      <div role="radiogroup" aria-label="Couleur" style={{ display: "flex", gap: 8, flexWrap: "wrap", maxWidth: 340 }}>
        {OPTIONS.map((opt) => (
          <ColorSwatchButton
            key={opt.id}
            label={opt.label}
            color={opt.color}
            selected={opt.id === selected}
            exclusive
            onClick={() => setSelected(opt.id)}
          />
        ))}
      </div>
    );
  },
};
