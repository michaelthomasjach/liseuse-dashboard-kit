import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { InputPassword } from "./InputPassword";

const meta: Meta<typeof InputPassword> = {
  title: "Forms/Input/InputPassword",
  component: InputPassword,
};
export default meta;
type Story = StoryObj<typeof InputPassword>;

// Pre-filled on purpose: a native `placeholder` is always shown in clear text by the
// browser (it's never masked, even under type="password"), so toggling visibility on an
// *empty* field looks like nothing happened. With real characters typed in, the eye
// button's effect is obvious.
export const Default: Story = {
  render: () => {
    const [value, setValue] = useState("MonMotDePasse123");
    return (
      <div style={{ maxWidth: 280 }}>
        <InputPassword label="Mot de passe" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
    );
  },
};

export const Empty: Story = {
  render: () => {
    const [value, setValue] = useState("");
    return (
      <div style={{ maxWidth: 280 }}>
        <InputPassword label="Mot de passe" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Tapez pour voir le bascule…" />
      </div>
    );
  },
};

export const Sizes: Story = {
  name: "Tailles (small / normal)",
  render: () => {
    const [value, setValue] = useState("MonMotDePasse123");
    return (
      <div style={{ maxWidth: 280, display: "flex", flexDirection: "column", gap: 16 }}>
        <InputPassword size="small" label="Small" value={value} onChange={(e) => setValue(e.target.value)} />
        <InputPassword label="Normal (défaut)" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
    );
  },
};
