import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ContextMenu } from "./ContextMenu";

const meta: Meta<typeof ContextMenu> = {
  title: "Primitives/ContextMenu",
  component: ContextMenu,
};
export default meta;

function Demo() {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [chosen, setChosen] = useState(false);
  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      style={{ padding: 24, border: "1px dashed var(--lq-color-border)" }}
    >
      Clic droit ici {chosen ? "(ajouté)" : ""}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: "Lire", onSelect: () => undefined, hint: "nouvel onglet" },
            { separator: true },
            { label: "Ajouter", onSelect: () => setChosen(true), disabled: chosen },
            { label: "Retirer", onSelect: () => setChosen(false), disabled: !chosen },
          ]}
        />
      )}
    </div>
  );
}

export const Default: StoryObj<typeof ContextMenu> = { render: () => <Demo /> };
