import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ProgressCircle } from "./ProgressCircle";
import { Card } from "../primitives/Card";
import { Button } from "../primitives/Button";
import type { SurfaceTone } from "../primitives/tone";

const meta: Meta<typeof ProgressCircle> = {
  title: "Feedback/ProgressCircle",
  component: ProgressCircle,
};
export default meta;
type Story = StoryObj<typeof ProgressCircle>;

const row = { display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" as const };
const caption = { fontSize: 12, color: "var(--lq-color-text-muted)", marginTop: 8, textAlign: "center" as const };

export const Default: Story = {
  name: "Déterminé (défaut)",
  render: () => <ProgressCircle value={64} label="Import des transactions" />,
};

export const Indeterminate: Story = {
  name: "Indéterminé",
  render: () => (
    <div style={row}>
      <ProgressCircle size="sm" />
      <ProgressCircle />
      <ProgressCircle size="lg" label="Synchronisation…" />
    </div>
  ),
};

export const WithValue: Story = {
  name: "Valeur au centre",
  render: () => (
    <div style={row}>
      <ProgressCircle value={0} size="lg" showValue />
      <ProgressCircle value={38} size="lg" showValue />
      <ProgressCircle value={100} size="lg" showValue tone="success" />
      <ProgressCircle value={72} size={64} showValue formatValue={(v) => `${Math.round((v / 100) * 50)}/50`} label="Fichiers envoyés" />
      <ProgressCircle value={64} size={120} thickness={10} showValue formatValue={() => "218 / 340"} label="Lignes rapprochées" />
    </div>
  ),
};

export const Sizes: Story = {
  name: "Tailles et épaisseurs",
  render: () => (
    <div style={row}>
      {(
        [
          ["sm", undefined],
          ["md", undefined],
          ["lg", undefined],
          [48, 2],
          [48, 8],
          [120, 14],
        ] as const
      ).map(([size, thickness]) => (
        <div key={`${size}-${thickness}`} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <ProgressCircle value={62} size={size} thickness={thickness} showValue={typeof size === "number" ? size >= 48 : size !== "sm"} />
          <div style={caption}>
            {String(size)}
            {thickness ? ` · ${thickness} px` : ""}
          </div>
        </div>
      ))}
    </div>
  ),
};

const TONES: SurfaceTone[] = ["default", "accent", "success", "info", "danger", "warning", "dark"];

export const Tones: Story = {
  name: "Tons",
  render: () => (
    <div style={row}>
      {TONES.map((tone, i) => (
        <div key={tone} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <ProgressCircle value={30 + i * 10} tone={tone} showValue />
          <div style={caption}>{tone}</div>
        </div>
      ))}
    </div>
  ),
};

/** Un envoi simulé : la valeur avance par pas réguliers, l'arc glisse d'un chiffre à l'autre. */
export const Live: Story = {
  name: "En direct",
  render: function Render() {
    const [value, setValue] = useState(0);
    const [running, setRunning] = useState(true);
    useEffect(() => {
      if (!running) return;
      const id = setInterval(() => setValue((v) => (v >= 100 ? 0 : v + 4)), 300);
      return () => clearInterval(id);
    }, [running]);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <ProgressCircle value={value} size="lg" showValue tone={value === 100 ? "success" : "default"} label="Envoi du fichier" />
        <Button onClick={() => setRunning((r) => !r)}>{running ? "Pause" : "Reprendre"}</Button>
      </div>
    );
  },
};

/** Dans une carte pleine, le cercle passe en contraste avec le reste du contenu. */
export const InCard: Story = {
  name: "Dans une carte",
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 280px))", gap: 16 }}>
      <Card title="Stockage">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <ProgressCircle value={81} size={72} showValue tone="warning" label="Stockage utilisé" />
          <div style={{ fontSize: "0.85rem", color: "var(--lq-color-text-muted)" }}>40,5 Go sur 50 Go</div>
        </div>
      </Card>
      <Card title="Objectif du mois" tone="success">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <ProgressCircle value={58} size={72} showValue label="Objectif atteint" />
          <div style={{ fontSize: "0.85rem" }}>29 000 € sur 50 000 €</div>
        </div>
      </Card>
    </div>
  ),
};
