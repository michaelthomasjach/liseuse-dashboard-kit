import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { DictationButton } from "./Dictation";

const meta: Meta = { title: "Forms/Input/Dictée", tags: ["autodocs"] };
export default meta;
type Story = StoryObj;

export const SurUnChamp: Story = {
  name: "Champ et zone de texte",
  render: () => {
    const [a, setA] = useState("");
    const [b, setB] = useState("");
    return (
      <div style={{ display: "grid", gap: 16, maxWidth: 480 }}>
        <Input label="Question" placeholder="Parlez après avoir appuyé sur le micro" value={a} onChange={(e) => setA(e.target.value)} dictation />
        <Textarea label="Message" placeholder="Dictée en direct" value={b} onChange={(e) => setB(e.target.value)} dictation autoResize minRows={2} />
      </div>
    );
  },
};

export const BoutonSeul: Story = {
  name: "Bouton seul (champ natif)",
  render: () => {
    const ref = useRef<HTMLTextAreaElement>(null);
    const [v, setV] = useState("");
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", maxWidth: 480 }}>
        <textarea ref={ref} value={v} onChange={(e) => setV(e.target.value)} rows={3} style={{ flex: 1 }} />
        <DictationButton field={ref} />
      </div>
    );
  },
};
