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
