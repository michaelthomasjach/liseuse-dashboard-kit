import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Conveyor } from "./Conveyor";
import { NumberField } from "../forms";

const meta: Meta<typeof Conveyor> = {
  title: "Warehouse/Tapis roulant",
  component: Conveyor,
};
export default meta;
type Story = StoryObj<typeof Conveyor>;

export const Droit: Story = {
  name: "Tapis droit",
  args: {
    kind: "straight",
    length: 7,
    width: 1.6,
    legHeight: 1,
    bedThickness: 0.22,
    guardHeight: 0.14,
    load: "carton",
    loadCount: 2,
    speed: 1.1,
    reversed: false,
    running: true,
    cellSize: 34,
  },
  render: (args) => (
    <div style={{ padding: 40 }}>
      <Conveyor {...args} />
    </div>
  ),
};

/** L'angle est le module de transfert carré qu'un vrai sol utilise pour tourner une ligne : la
 *  bande décrit un quart de cercle centré sur le coin, tangente à l'entrée comme à la sortie, donc
 *  elle se raccorde d'équerre à un tapis droit des deux côtés. */
export const Angle: Story = {
  name: "Tapis d'angle",
  args: {
    kind: "corner",
    width: 2.4,
    legHeight: 1,
    bedThickness: 0.22,
    guardHeight: 0.14,
    load: "carton",
    speed: 1.1,
    reversed: false,
    running: true,
    cellSize: 44,
  },
  render: (args) => (
    <div style={{ padding: 40 }}>
      <Conveyor {...args} />
    </div>
  ),
};

/** Une seule flèche dit le sens, et elle ne bouge pas : une marque qu'il faut voir s'animer pour
 *  la lire est une marque que la moitié des lecteurs ne lit jamais — `prefers-reduced-motion`, un
 *  onglet en pause, une capture d'écran. Ce qui bouge, c'est la charge, qui est la chose honnête à
 *  animer : un convoyeur n'est intéressant que parce que quelque chose y va quelque part. */
export const Sens: Story = {
  name: "Avant, arrière, arrêté",
  render: () => (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-end", padding: 40, flexWrap: "wrap" }}>
      {[
        { label: "Avant", reversed: false, running: true },
        { label: "Arrière", reversed: true, running: true },
        { label: "Arrêté", reversed: false, running: false },
      ].map((it) => (
        <div key={it.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Conveyor kind="straight" length={5} width={1.6} legHeight={1} cellSize={30} load="carton" reversed={it.reversed} running={it.running} />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{it.label}</span>
        </div>
      ))}
    </div>
  ),
};

/** La vitesse est en **cases par seconde**, pas en durée : à la même vitesse, un tapis long et un
 *  angle vont à la même allure, alors qu'une durée les ferait aller à des allures différentes. */
export const Atelier: Story = {
  name: "Régler le tapis",
  render: function Render() {
    const [kind, setKind] = useState<"straight" | "corner">("straight");
    const [size, setSize] = useState({ length: 7, width: 1.6, legs: 1 });
    const [speed, setSpeed] = useState(1.1);
    const [reversed, setReversed] = useState(false);
    const [running, setRunning] = useState(true);

    const field = (
      label: string,
      value: number,
      onChange: (next: number) => void,
      { min, max, step }: { min: number; max: number; step: number }
    ) => (
      <NumberField
        label={label}
        size="small"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(next) => onChange(next === "" ? min : Math.max(min, Math.min(max, next)))}
      />
    );

    const button = (label: string, on: boolean, onClick: () => void) => (
      <button
        type="button"
        onClick={onClick}
        style={{ font: "inherit", fontSize: "0.7rem", padding: "6px 10px", cursor: "pointer", fontWeight: on ? 700 : 400 }}
      >
        {label}
      </button>
    );

    return (
      <div style={{ display: "flex", gap: 32, alignItems: "flex-start", padding: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, width: 210 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {button("Droit", kind === "straight", () => setKind("straight"))}
            {button("Angle", kind === "corner", () => setKind("corner"))}
          </div>
          {kind === "straight" && field("Longueur", size.length, (length) => setSize((s) => ({ ...s, length })), { min: 2, max: 16, step: 0.5 })}
          {field("Largeur", size.width, (width) => setSize((s) => ({ ...s, width })), { min: 0.8, max: 4, step: 0.2 })}
          {field("Hauteur des pieds", size.legs, (legs) => setSize((s) => ({ ...s, legs })), { min: 0, max: 4, step: 0.1 })}
          {field("Vitesse (cases/s)", speed, setSpeed, { min: 0.1, max: 6, step: 0.1 })}
          <div style={{ display: "flex", gap: 6 }}>
            {button(reversed ? "← Arrière" : "Avant →", true, () => setReversed((r) => !r))}
            {button(running ? "En marche" : "Arrêté", running, () => setRunning((r) => !r))}
          </div>
        </div>

        <div style={{ flex: "1 1 360px", minWidth: 0, overflow: "auto" }}>
          <Conveyor
            kind={kind}
            length={size.length}
            width={size.width}
            legHeight={size.legs}
            load="carton"
            loadCount={kind === "straight" ? 2 : 1}
            speed={speed}
            reversed={reversed}
            running={running}
            cellSize={38}
          />
        </div>
      </div>
    );
  },
};

/** Un droit, un angle, un droit : les trois se raccordent parce que la bande de l'angle est
 *  tangente à ses deux bords. Les tapis sont posés côte à côte ici, chacun dans son propre
 *  dessin — le plan d'entrepôt, lui, les ordonnerait dans une seule image. */
export const Ligne: Story = {
  name: "Une ligne",
  render: () => (
    <div style={{ display: "flex", alignItems: "flex-end", padding: 40, gap: 0 }}>
      <Conveyor kind="straight" length={4} width={2} legHeight={1} cellSize={34} load="carton" />
      <Conveyor kind="corner" width={2.4} legHeight={1} cellSize={34} load="boite" />
    </div>
  ),
};

/** Un colis rond est dispensé du découpage en tronçons : un fût a le même dessin sous tous les
 *  caps, donc il est dessiné une fois et simplement porté. */
export const Rond: Story = {
  name: "Une charge ronde",
  render: () => (
    <div style={{ display: "flex", gap: 48, alignItems: "flex-end", padding: 40, flexWrap: "wrap" }}>
      <Conveyor kind="corner" width={2.4} legHeight={1} cellSize={40} load="bidon" />
      <Conveyor kind="corner" width={2.4} legHeight={1} cellSize={40} load="carton" />
    </div>
  ),
};
