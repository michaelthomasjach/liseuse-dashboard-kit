import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Rail } from "./Rail";
import { useIsoCamera } from "./isoCamera";
import { footprint, useFrameBox } from "./sceneStory";
import { NumberField } from "../forms";
import { railCircuit } from "./railCircuit";

const meta: Meta<typeof Rail> = {
  title: "Warehouse/Rail",
  component: Rail,
};
export default meta;
type Story = StoryObj<typeof Rail>;

export const Droit: Story = {
  name: "Rail droit",
  args: {
    kind: "straight",
    length: 9,
    width: 1.8,
    gauge: 1.1,
    railSize: 0.16,
    sleeperEvery: 1.1,
    sleeperSize: 0.34,
    shadows: true,
    cellSize: 34,
  },
  render: (args) => (
    <div style={{ padding: 40 }}>
      <Rail {...args} />
    </div>
  ),
};

/** L'angle est carré : il tient dans sa propre largeur, et sa voie est le **même quart de cercle**
 *  que celui d'un tapis d'angle de même largeur — centré sur le coin, tangent à l'entrée comme à la
 *  sortie. C'est voulu : un rail et un tapis de même largeur se raccordent alors d'équerre l'un à
 *  l'autre comme à eux-mêmes, sans que rien n'ait à être ajusté à l'œil.
 *
 *  Les traverses y sont **radiales**, parce que c'est ainsi qu'elles portent la voie. Une traverse
 *  de biais n'est pas une boîte alignée sur les axes, et ce n'est pas la boîte qu'on tourne mais le
 *  projecteur — comme pour une charge dans un virage. Les trois orientations montrent que la
 *  rotation ne change pas le module, seulement d'où on le regarde. */
export const Angle: Story = {
  name: "Rail d'angle",
  args: { kind: "corner", width: 2.2, gauge: 1.3, shadows: true, cellSize: 34 },
  render: (args) => (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-end", padding: 32, flexWrap: "wrap" }}>
      {[0, 45, 90].map((angle) => (
        <div key={angle} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Rail {...args} rotation={angle} />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{angle}°</span>
        </div>
      ))}
    </div>
  ),
};

/**
 * Une voie en trois modules — droit, angle, droit — **réellement raccordés** et non posés côte à
 * côte.
 *
 * Les trois **partagent un cadre** (`frame`), donc la même `viewBox` et la même taille : les
 * superposer suffit à les raccorder, il n'y a rien à aligner puisqu'ils sont déjà dans le même
 * repère. Chacun est posé par l'`origin` et la `rotation` que `railCircuit` calcule en chaînant les
 * modules : l'entrée de la voie est au même endroit dans le repère local d'un droit et d'un angle,
 * donc il suffit de faire coïncider l'entrée de l'un avec la sortie du précédent.
 *
 * Le raccord tient parce que la voie de l'angle est **tangente** à ses deux bords : elle arrive
 * d'équerre sur le droit, au même écartement et au même endroit. Et le virage a un vrai rayon — la
 * largeur de la voie par défaut — et non la demi-largeur, qui faisait tourner la file intérieure sur
 * elle-même.
 */
export const Voie: Story = {
  name: "Une voie qui tourne",
  render: function Render() {
    const cam = useIsoCamera();
    const cellSize = 34;
    const W = 2;
    const circuit = railCircuit(
      [
        { kind: "straight", length: 6 },
        { kind: "corner" },
        { kind: "straight", length: 4 },
      ],
      W
    );
    const b = circuit.bounds;
    const frame = { x: b.x - 0.5, y: b.y - 0.5, width: b.width + 1, depth: b.depth + 1, height: 0.6 };
    const box = useFrameBox(frame, cellSize);

    const shared = { width: W, gauge: 1.2, cellSize, frame, shadows: true };
    // Du fond vers l'avant, pour la caméra courante : les modules sont disjoints, donc c'est elle
    // qui dit lequel est devant.
    const modules = cam.order(circuit.modules.map((m) => ({ ...m, ...footprint(m.origin, m.length, m.kind === "corner" ? m.length : W, m.rotation) })));

    return (
      <div style={{ padding: 32 }}>
        <div style={{ position: "relative", width: box.width, height: box.height }}>
          {/* Toutes les ombres d'abord, puis toutes les voies : une ombre est au sol et doit passer
              sous *tous* les modules, pas seulement sous le sien. */}
          {(["shadow", "machine"] as const).map((part) =>
            modules.map((m, i) => (
              <div key={`${part}${i}`} style={{ position: "absolute", left: 0, top: 0 }}>
                <Rail {...shared} kind={m.kind} length={m.length} rotation={m.rotation} origin={m.origin} parts={part} />
              </div>
            ))
          )}
        </div>
      </div>
    );
  },
};

/** Ce que chaque cote change. L'écartement et la largeur sont deux choses différentes : la largeur
 *  est la longueur d'une traverse — l'emprise du module, celle qui doit valoir celle du tapis ou du
 *  picker d'à côté — et l'écartement est la distance entre les deux files, qui tient dedans. */
export const Atelier: Story = {
  name: "Régler la voie",
  render: function Render() {
    const [kind, setKind] = useState<"straight" | "corner">("straight");
    const [size, setSize] = useState({ length: 8, width: 1.8, gauge: 1.1, every: 1.1 });

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
          {kind === "straight" && field("Longueur", size.length, (length) => setSize((s) => ({ ...s, length })), { min: 2, max: 20, step: 0.5 })}
          {field("Largeur", size.width, (width) => setSize((s) => ({ ...s, width })), { min: 0.8, max: 4, step: 0.1 })}
          {field("Écartement", size.gauge, (gauge) => setSize((s) => ({ ...s, gauge })), { min: 0.3, max: 3, step: 0.1 })}
          {field("Pas des traverses", size.every, (every) => setSize((s) => ({ ...s, every })), { min: 0.4, max: 4, step: 0.1 })}
        </div>

        <div style={{ flex: "1 1 360px", minWidth: 0, overflow: "auto" }}>
          <Rail
            kind={kind}
            length={size.length}
            width={size.width}
            gauge={size.gauge}
            sleeperEvery={size.every}
            shadows
            cellSize={38}
          />
        </div>
      </div>
    );
  },
};
