import type { ComponentType } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import * as Icons from "./icons";

const meta: Meta = {
  title: "Foundations/Icons",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

type AnyIconComponent = ComponentType<{ size?: number }>;

// Built from the module's own exports rather than a hand-maintained list, so a newly added icon
// shows up here automatically instead of silently missing from the catalog.
const ICON_ENTRIES: { name: string; Icon: AnyIconComponent }[] = Object.entries(Icons)
  .filter((entry): entry is [string, AnyIconComponent] => entry[0].endsWith("Icon") && typeof entry[1] === "function")
  .map(([name, Icon]) => ({ name, Icon }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const Gallery: Story = {
  name: "Tous les icônes",
  render: () => (
    <div>
      <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>
        Tous les icônes exportés par <code>@michaelthomasjach/liseuse-dashboard-kit</code>, du plus générique (navigation,
        formulaires, statuts…) aux plus spécifiques (météo, finance, graphiques). Même style partout : viewBox 24×24,
        trait <code>currentColor</code> — ils héritent donc la couleur de texte ambiante et se redimensionnent via la prop{" "}
        <code>size</code>. Chacun accepte aussi une prop <code>animated</code> qui lui donne son animation de repos, choisie
        pour ce qu&apos;il représente — voir "Foundations/Animated Icons".
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
          gap: 10,
        }}
      >
        {ICON_ENTRIES.map(({ name, Icon }) => (
          <div
            key={name}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "16px 8px",
              color: "var(--lq-color-text)",
              backgroundColor: "var(--lq-color-panel)",
              border: "1px solid var(--lq-color-border-subtle)",
              borderRadius: "var(--lq-radius-md, 8px)",
            }}
          >
            <Icon size={22} />
            <span style={{ fontSize: 11, textAlign: "center", opacity: 0.75, wordBreak: "break-word", lineHeight: 1.3 }}>
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  ),
};
