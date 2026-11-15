import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ColorPicker } from "./ColorPicker";
import { ColorPreferencesProvider, type ColorPreferences } from "./ColorPreferences";
import { Text } from "../primitives/Text";

const meta: Meta<typeof ColorPicker> = {
  title: "Forms/ColorPicker",
  component: ColorPicker,
};
export default meta;
type Story = StoryObj<typeof ColorPicker>;

const field = { display: "flex", alignItems: "center", gap: 10 } as const;

export const Default: Story = {
  name: "Défaut",
  render: () => {
    const [color, setColor] = useState("#2962ff");
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={field}>
          <span className="lq-field__label">Couleur de la courbe</span>
          <ColorPicker value={color} onChange={setColor} aria-label="Couleur de la courbe" />
        </div>
        <Text size="sm" muted>
          Valeur : <code>{color}</code> (#rrggbbaa dès que l'opacité descend sous 100 %)
        </Text>
        <div style={{ height: 8, borderRadius: 4, background: color }} />
      </div>
    );
  },
};

const SAMPLE: ColorPreferences = {
  recentColors: ["#f23645", "#089981cc", "#ff9800", "#2962ff80"],
  colorSets: [
    { id: "a", name: "Tendance", colors: ["#089981", "#f23645", "#787b86"] },
    { id: "b", name: "Pastels", colors: ["#a8c3e8", "#a8d8b8", "#f0c99a", "#e8b4c8"] },
  ],
  activeColorSetId: null,
};

export const SharedPreferences: Story = {
  name: "Récentes et jeux partagés (fournisseur)",
  render: () => {
    const [prefs, setPrefs] = useState<ColorPreferences>(SAMPLE);
    const [a, setA] = useState("#089981");
    const [b, setB] = useState("#f23645");
    const [c, setC] = useState("#ffeb3b80");
    return (
      <ColorPreferencesProvider value={prefs} onChange={setPrefs}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
          <div style={{ display: "flex", gap: 24 }}>
            <div style={field}>
              <span className="lq-field__label">Hausse</span>
              <ColorPicker value={a} onChange={setA} aria-label="Hausse" />
            </div>
            <div style={field}>
              <span className="lq-field__label">Baisse</span>
              <ColorPicker value={b} onChange={setB} aria-label="Baisse" />
            </div>
            <div style={field}>
              <span className="lq-field__label">Zone</span>
              <ColorPicker value={c} onChange={setC} aria-label="Zone" />
            </div>
          </div>
          <Text size="sm" muted>
            Une couleur choisie dans un sélecteur apparaît dans les récentes des autres ; les jeux se créent, se renomment,
            se complètent et s'appliquent depuis n'importe lequel. Ce que l'application enregistrerait :
          </Text>
          <pre style={{ fontSize: 11, margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(prefs, null, 1)}</pre>
        </div>
      </ColorPreferencesProvider>
    );
  },
};

export const WithThickness: Story = {
  name: "Couleur de ligne avec épaisseur",
  render: () => {
    const [color, setColor] = useState("#2962ff");
    const [width, setWidth] = useState(2);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
        <div style={field}>
          <span className="lq-field__label">Ligne</span>
          <ColorPicker value={color} onChange={setColor} thickness={width} onThicknessChange={setWidth} aria-label="Couleur de la ligne" />
        </div>
        <svg width="320" height="40" aria-hidden="true">
          <path d="M0 30 C 80 0, 160 40, 320 8" fill="none" stroke={color} strokeWidth={width} />
        </svg>
      </div>
    );
  },
};

export const Opaque: Story = {
  name: "Sans opacité",
  render: () => {
    const [color, setColor] = useState("#4caf50");
    return (
      <div style={field}>
        <span className="lq-field__label">Couleur pleine</span>
        <ColorPicker value={color} onChange={setColor} alpha={false} aria-label="Couleur pleine" />
        <code>{color}</code>
      </div>
    );
  },
};
