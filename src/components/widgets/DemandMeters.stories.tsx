import { useEffect, useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { DemandMeters, type DemandMeter } from "./DemandMeters";
import { BoltIcon, BoxesIcon, ClipboardListIcon, ForkliftIcon, SnowflakeIcon, TruckIcon } from "../icons";

/**
 * Les jauges de demande d'un jeu de gestion, en bas de la scène. Survolez une jauge — ou tabulez
 * jusqu'à elle — pour lire son détail. Au-delà de 100 %, des chevrons battent au bout de la barre.
 */
const meta: Meta<typeof DemandMeters> = {
  title: "Widgets/DemandMeters",
  component: DemandMeters,
};
export default meta;
type Story = StoryObj<typeof DemandMeters>;

/** Le ton qu'un jeu donnerait à une demande : ça va, ça tire, ça déborde. */
const toneOf = (v: number): DemandMeter["tone"] => (v > 1 ? "critical" : v > 0.8 ? "warning" : v < 0.35 ? "good" : "neutral");

const BASE: { id: string; label: string; icon: ReactNode; value: number; detail: string }[] = [
  { id: "orders", label: "Commandes", icon: <ClipboardListIcon />, value: 0.62, detail: "Commandes en attente de préparation" },
  { id: "stock", label: "Stockage", icon: <BoxesIcon />, value: 0.88, detail: "Emplacements de stockage demandés" },
  { id: "docks", label: "Quais", icon: <TruckIcon />, value: 1.12, detail: "Camions en attente d'un quai libre" },
  { id: "staff", label: "Caristes", icon: <ForkliftIcon />, value: 0.3, detail: "Besoin en caristes" },
  { id: "power", label: "Énergie", icon: <BoltIcon />, value: 0.55, detail: "Puissance appelée / puissance disponible" },
  { id: "cold", label: "Froid", icon: <SnowflakeIcon />, value: 0.18, detail: "Demande en stockage frigorifique" },
];

const toMeters = (values: number[]): DemandMeter[] =>
  BASE.map((b, i) => ({ ...b, value: values[i], tone: toneOf(values[i]), detail: `${b.detail} — ${Math.round(values[i] * 100)} %` }));

/** Des valeurs qui dérivent toutes les 1,2 s, comme une partie qui tourne. */
function useDrift(initial: number[], running: boolean) {
  const [values, setValues] = useState(initial);
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setValues((vs) => vs.map((v) => Math.min(1.35, Math.max(0, v + (Math.random() - 0.48) * 0.22))));
    }, 1200);
    return () => window.clearInterval(t);
  }, [running]);
  return [values, setValues] as const;
}

const Stage = ({ children, height = 300 }: { children: ReactNode; height?: number }) => (
  <div
    style={{
      position: "relative",
      height,
      background:
        "linear-gradient(135deg, color-mix(in srgb, var(--lq-color-accent) 18%, var(--lq-color-bg)), color-mix(in srgb, var(--lq-color-text) 8%, var(--lq-color-bg)))",
    }}
  >
    {children}
  </div>
);

export const Animated: Story = {
  name: "En partie",
  render: function Render() {
    const [running, setRunning] = useState(true);
    const [values, setValues] = useDrift(BASE.map((b) => b.value), running);
    return (
      <Stage height={340}>
        <div style={{ padding: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
          <label>
            <input type="checkbox" checked={running} onChange={(e) => setRunning(e.target.checked)} /> Animation
          </label>
          <label>
            Quais{" "}
            <input
              type="range"
              min={0}
              max={150}
              value={Math.round(values[2] * 100)}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                setValues((vs) => vs.map((x, i) => (i === 2 ? v : x)));
              }}
            />{" "}
            {Math.round(values[2] * 100)} %
          </label>
        </div>
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 16, display: "flex", justifyContent: "center" }}>
          <DemandMeters meters={toMeters(values)} />
        </div>
      </Stage>
    );
  },
};

export const Tones: Story = {
  name: "Tons et débordement",
  args: {
    meters: [
      { id: "n", label: "Neutre", icon: <ClipboardListIcon />, value: 0.5, tone: "neutral", detail: "Ton neutre — l'accent" },
      { id: "g", label: "Bon", icon: <BoxesIcon />, value: 0.25, tone: "good", detail: "Ton « good »" },
      { id: "w", label: "Tendu", icon: <ForkliftIcon />, value: 0.86, tone: "warning", detail: "Ton « warning »" },
      { id: "c", label: "Critique", icon: <BoltIcon />, value: 0.97, tone: "critical", detail: "Ton « critical »" },
      { id: "o", label: "Débordé", icon: <TruckIcon />, value: 1.4, tone: "critical", detail: "140 % : la demande dépasse la capacité" },
      { id: "t", label: "Sans icône", value: 0.4 },
    ],
  },
};

export const Vertical: Story = {
  name: "Vertical",
  render: function Render() {
    const [values] = useDrift(BASE.map((b) => b.value), true);
    return (
      <Stage>
        <div style={{ position: "absolute", left: 16, bottom: 16 }}>
          <DemandMeters meters={toMeters(values)} orientation="vertical" />
        </div>
      </Stage>
    );
  },
};

export const Compact: Story = {
  name: "Compact",
  render: function Render() {
    const [values] = useDrift(BASE.map((b) => b.value), true);
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16 }}>
        <DemandMeters meters={toMeters(values)} compact />
        <DemandMeters meters={toMeters(values)} compact orientation="vertical" />
      </div>
    );
  },
};

/** Largeur d'un téléphone : les jauges passent à la ligne ; en compact, elles tiennent sur deux rangs serrés. */
export const Narrow: Story = {
  name: "Téléphone (390 px)",
  render: function Render() {
    const [values] = useDrift(BASE.map((b) => b.value), true);
    return (
      <div style={{ width: 390, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 12, border: "1px dashed var(--lq-color-border)", padding: 8 }}>
        <DemandMeters meters={toMeters(values)} />
        <DemandMeters meters={toMeters(values)} compact />
      </div>
    );
  },
};
