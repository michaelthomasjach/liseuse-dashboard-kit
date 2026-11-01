import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Slider } from "./Slider";
import { Button } from "../primitives/Button";
import { Text } from "../primitives/Text";

const meta: Meta<typeof Slider> = {
  title: "Forms/Slider",
  component: Slider,
};
export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  name: "Défaut (valeur libre)",
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <Slider label="Volume" defaultValue={40} formatValue={(v) => `${v} %`} />
    </div>
  ),
};

export const Controlled: Story = {
  name: "Contrôlé",
  render: () => {
    const [value, setValue] = useState(21);
    return (
      <div style={{ maxWidth: 320, display: "flex", flexDirection: "column", gap: 12 }}>
        <Slider
          label="Consigne de température"
          min={16}
          max={28}
          step={0.5}
          value={value}
          onChange={setValue}
          formatValue={(v) => `${v.toLocaleString("fr-FR")} °C`}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Text size="sm" muted>
            Valeur : {value.toLocaleString("fr-FR")} °C
          </Text>
          <Button onClick={() => setValue(19)}>Mode éco (19 °C)</Button>
        </div>
      </div>
    );
  },
};

export const WithMarks: Story = {
  name: "Graduations avec libellés",
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <Slider
        label="Exposition au risque"
        defaultValue={50}
        step={5}
        marks={[
          { value: 0, label: "Prudent" },
          { value: 50, label: "Équilibré" },
          { value: 100, label: "Dynamique" },
        ]}
        formatValue={(v) => `${v} %`}
      />
    </div>
  ),
};

export const StepMarks: Story = {
  name: "Un cran par pas (marks={true})",
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <Slider label="Luminosité" defaultValue={60} step={10} marks formatValue={(v) => `${v} %`} />
    </div>
  ),
};

export const AlwaysShowValue: Story = {
  name: "Valeur toujours affichée",
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <Slider
        label="Budget mensuel"
        min={0}
        max={5000}
        step={50}
        defaultValue={1850}
        showValue="always"
        formatValue={(v) => `${v.toLocaleString("fr-FR")} €`}
        marks={[
          { value: 0, label: "0 €" },
          { value: 2500, label: "2 500 €" },
          { value: 5000, label: "5 000 €" },
        ]}
      />
    </div>
  ),
};

export const Tones: Story = {
  name: "Tons",
  render: () => (
    <div style={{ maxWidth: 360, display: "flex", flexDirection: "column", gap: 16 }}>
      <Slider label="Accent" defaultValue={70} tone="accent" />
      <Slider label="Succès" defaultValue={55} tone="success" />
      <Slider label="Info" defaultValue={40} tone="info" />
      <Slider label="Danger" defaultValue={85} tone="danger" />
      <Slider label="Avertissement" defaultValue={25} tone="warning" />
    </div>
  ),
};

const BANDS = [
  { hz: "60 Hz", value: 4 },
  { hz: "230 Hz", value: 2 },
  { hz: "910 Hz", value: -1 },
  { hz: "3,6 kHz", value: 3 },
  { hz: "14 kHz", value: 5 },
];

export const Vertical: Story = {
  name: "Vertical (égaliseur)",
  render: () => (
    <div style={{ display: "flex", gap: 28, alignItems: "flex-end" }}>
      {BANDS.map((b) => (
        <div key={b.hz} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <Slider
            orientation="vertical"
            height={180}
            min={-12}
            max={12}
            defaultValue={b.value}
            aria-label={`Gain ${b.hz}`}
            formatValue={(v) => `${v > 0 ? "+" : ""}${v} dB`}
          />
          <Text size="xs" muted>
            {b.hz}
          </Text>
        </div>
      ))}
      <Slider
        orientation="vertical"
        height={120}
        label="Volume"
        defaultValue={60}
        step={20}
        marks={[0, 20, 40, 60, 80, 100].map((v) => ({ value: v, label: `${v}` }))}
        tone="success"
      />
    </div>
  ),
};

export const Disabled: Story = {
  name: "Désactivé",
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <Slider label="Volume" defaultValue={40} marks={[{ value: 0 }, { value: 50 }, { value: 100 }]} disabled />
    </div>
  ),
};
