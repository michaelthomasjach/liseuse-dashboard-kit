import { Input } from "../forms/Input";
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { SegmentedControl } from "./SegmentedControl";

const meta: Meta<typeof SegmentedControl> = {
  title: "Primitives/SegmentedControl",
  component: SegmentedControl,
};
export default meta;
type Story = StoryObj<typeof SegmentedControl>;

export const Palette: Story = {
  render: () => {
    const [value, setValue] = useState("eink");
    return (
      <SegmentedControl
        label="Palette"
        value={value}
        onChange={setValue}
        options={[
          { value: "eink", label: "E-ink (N&B)" },
          { value: "color", label: "Tablette couleur" },
        ]}
      />
    );
  },
};

export const Typo: Story = {
  render: () => {
    const [value, setValue] = useState("manrope");
    return (
      <SegmentedControl
        label="Typo"
        value={value}
        onChange={setValue}
        options={[
          { value: "space-grotesk", label: "Space Grotesk" },
          { value: "manrope", label: "Manrope" },
          { value: "sora", label: "Sora" },
          { value: "inter", label: "Inter" },
          { value: "ibm-plex-sans", label: "IBM Plex Sans" },
        ]}
      />
    );
  },
};

/** Dans une barre de filtres : libellé au-dessus et hauteur d'un `Input`, alignés avec les champs voisins. */
export const LabelOnTop: Story = {
  render: () => {
    const [v, setV] = useState("14");
    return (
      <div style={{ display: "flex", gap: 20, alignItems: "flex-end" }}>
        <Input label="Société" placeholder="Symbole ou nom…" />
        <SegmentedControl
          labelPosition="top"
          label="Horizon"
          options={[
            { value: "7", label: "7 j" },
            { value: "14", label: "14 j" },
            { value: "28", label: "4 sem." },
          ]}
          value={v}
          onChange={setV}
        />
      </div>
    );
  },
};
