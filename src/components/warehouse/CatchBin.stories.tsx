import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { CatchBin } from "./CatchBin";
import { Conveyor } from "./Conveyor";
import { projectIso } from "./warehouseIso";
import { NumberField } from "../forms";

const meta: Meta<typeof CatchBin> = {
  title: "Warehouse/Bac récupérateur",
  component: CatchBin,
};
export default meta;
type Story = StoryObj<typeof CatchBin>;

export const Bac: Story = {
  name: "Un bac",
  args: { width: 3, depth: 2.4, height: 1.1, count: 11, itemSize: 0.7, seed: 7, shadows: true, cellSize: 40 },
  render: (args) => (
    <div style={{ padding: 40 }}>
      <CatchBin {...args} />
    </div>
  ),
};

/** Le vrac est tiré d'un générateur à **graine**, pas de `Math.random` : un dessin qui change à
 *  chaque rendu n'est pas un dessin, c'est une animation involontaire — et il rend toute
 *  comparaison d'images impossible. Changer la graine rebrasse le tas ; la garder le fige. */
export const Graines: Story = {
  name: "Trois graines",
  render: () => (
    <div style={{ display: "flex", gap: 40, alignItems: "flex-end", padding: 40, flexWrap: "wrap" }}>
      {[3, 7, 11].map((seed) => (
        <div key={seed} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <CatchBin width={2.6} depth={2.2} count={10} seed={seed} shadows cellSize={34} />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>graine {seed}</span>
        </div>
      ))}
    </div>
  ),
};

/** Le remplissage, d'un bac vide à un bac qui déborde. Les couches se tassent d'un peu moins que la
 *  hauteur d'un colis : un tas n'est pas un empilement, les colis se calent les uns dans les
 *  autres. */
export const Remplissage: Story = {
  name: "Le remplissage",
  render: () => (
    <div style={{ display: "flex", gap: 36, alignItems: "flex-end", padding: 40, flexWrap: "wrap" }}>
      {[0, 4, 9, 18].map((count) => (
        <div key={count} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <CatchBin width={2.4} depth={2} count={count} shadows cellSize={32} />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{count} colis</span>
        </div>
      ))}
    </div>
  ),
};

/**
 * Le bac au bout d'une ligne : le tapis s'arrête, le colis tombe dedans.
 *
 * Le tapis et le bac partagent le repère du monde, donc le point de chute se calcule et ne se règle
 * pas : le colis quitte la bande à son extrémité, avance encore un peu en tombant, et le bac est
 * posé là où il touche. Sa profondeur de chute est celle de la bande moins la hauteur des parois —
 * un colis tombe *dans* le bac, pas dessus.
 */
export const BoutDeLigne: Story = {
  name: "Au bout d'une ligne",
  render: function Render() {
    const cellSize = 30;
    const W = 1.8;
    const L = 5;
    const legs = 1.5;
    const thick = 0.22;
    const dropRun = 0.8;
    const binWalls = 0.9;
    // La bande est à `legs + thick` ; le colis doit finir au fond du bac, donc il tombe de cette
    // hauteur moins ce que les parois laissent dépasser.
    const fall = legs + thick - binWalls * 0.55;
    const bin = { width: 2.4, depth: 2.2 };
    const origin = { x: L + dropRun - bin.width / 2, y: W / 2 - bin.depth / 2 };
    const shift = projectIso(origin.x * cellSize, origin.y * cellSize, 0);

    return (
      <div style={{ padding: 40 }}>
        <div style={{ position: "relative", height: 260 }}>
          <div style={{ position: "absolute", left: 0, top: 0 }}>
            <Conveyor
              kind="straight"
              length={L}
              width={W}
              legHeight={legs}
              bedThickness={thick}
              cellSize={cellSize}
              load="carton"
              speed={1.3}
              drop={{ fall, run: dropRun }}
              fadeOut={false}
              shadows
            />
          </div>
          <div style={{ position: "absolute", left: shift.x, top: shift.y }}>
            <CatchBin width={bin.width} depth={bin.depth} height={binWalls} count={7} cellSize={cellSize} shadows />
          </div>
        </div>
      </div>
    );
  },
};

/** Les mêmes réglages, à la main. */
export const Atelier: Story = {
  name: "Régler le bac",
  render: function Render() {
    const [b, setB] = useState({ width: 3, depth: 2.4, height: 1.1, count: 11, seed: 7, rotation: 0 });
    const field = (label: string, key: keyof typeof b, min: number, max: number, step: number) => (
      <NumberField
        label={label}
        size="small"
        value={b[key]}
        min={min}
        max={max}
        step={step}
        onChange={(next) => setB((s) => ({ ...s, [key]: next === "" ? min : Math.max(min, Math.min(max, next)) }))}
      />
    );
    return (
      <div style={{ display: "flex", gap: 32, alignItems: "flex-start", padding: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 200 }}>
          {field("Longueur", "width", 1, 8, 0.2)}
          {field("Profondeur", "depth", 1, 8, 0.2)}
          {field("Hauteur des parois", "height", 0.3, 3, 0.1)}
          {field("Colis", "count", 0, 40, 1)}
          {field("Graine", "seed", 1, 99, 1)}
          {field("Rotation °", "rotation", 0, 360, 45)}
        </div>
        <div style={{ flex: "1 1 320px", minWidth: 0, overflow: "auto" }}>
          <CatchBin {...b} shadows cellSize={38} />
        </div>
      </div>
    );
  },
};
