import type { Meta, StoryObj } from "@storybook/react";
import { Monorail, MONORAIL_WIDTH, monorailTrack, monorailSize, type MonorailProps } from "./Monorail";
import { Picker } from "./Picker";
import { PalletRack } from "./PalletRack";
import { SceneBox } from "./sceneStory";

/**
 * Le monorail : une poutre en I sur la tranche, posée sur des plots en béton, et la machine qu'elle
 * guide — quatre roues au sol, deux de chaque côté, des galets qui pincent la semelle haute.
 */
const meta: Meta<typeof Monorail> = {
  title: "Warehouse/Monorail",
  component: Monorail,
};
export default meta;
type Story = StoryObj<typeof Monorail>;

export const Droit: Story = {
  name: "Tronçon droit",
  args: { kind: "straight", length: 6, plinthEvery: 1.5, cellSize: 46 },
};

export const Virage: Story = {
  name: "Virage à 90°",
  args: { kind: "corner", radius: 2, cellSize: 46 },
};

/** Sur un tronçon droit, la machine fait son cycle : elle va prendre dans l'étagère d'un côté et
 *  déposer de l'autre, en roulant de part et d'autre de la poutre. */
export const Machine: Story = {
  name: "Picker sur monorail",
  render: () => {
    const L = 10;
    const W = MONORAIL_WIDTH;
    const frame = { x: -0.5, y: -3, width: L + 1, depth: W + 6, height: 4.2 };
    return (
      <SceneBox frame={frame} cellSize={34}>
        <Monorail length={L} />
        <Picker track="mono" travel={L} pick={{ at: 2.5, side: "left", level: 1.6 }} drop={{ at: 7.5, side: "right", level: 0.9 }} />
        <PalletRack bays={6} levels={3} origin={{ x: 0.6, y: W + 0.9 }} rotation={180} fill={0.8} seed={4} />
      </SceneBox>
    );
  },
};

/**
 * Un circuit fermé : quatre tronçons droits, quatre virages. Les pistes des tronçons, mises bout à
 * bout (`monorailTrack`), sont l'itinéraire des deux machines : elles prennent les virages au lieu
 * de s'arrêter à leur entrée.
 */
export const Circuit: Story = {
  name: "Un circuit, et deux pickers qui le suivent",
  render: () => {
    const W = MONORAIL_WIDTH;
    const R = 2;
    const C = monorailSize({ kind: "corner", radius: R }).width;
    const off = W / 2;
    const Sx = 12;
    const Sy = 6;
    const X = 2 * C + Sx;
    const Y = 2 * C + Sy;
    const vertical = (cx: number, len: number, rotation: number): MonorailProps => ({ kind: "straight", length: len, rotation, origin: { x: cx - len / 2, y: C + Sy / 2 - off } });
    const tiles: MonorailProps[] = [
      { kind: "straight", length: Sx, origin: { x: C, y: 0 }, rotation: 0 },
      { kind: "corner", radius: R, origin: { x: C + Sx, y: 0 }, rotation: 0 },
      vertical(X - off, Sy, 90),
      { kind: "corner", radius: R, origin: { x: C + Sx, y: C + Sy }, rotation: 90 },
      { kind: "straight", length: Sx, origin: { x: C, y: Y - W }, rotation: 180 },
      { kind: "corner", radius: R, origin: { x: 0, y: C + Sy }, rotation: 180 },
      vertical(off, Sy, 270),
      { kind: "corner", radius: R, origin: { x: 0, y: 0 }, rotation: 270 },
    ];
    const route = tiles.map((t) => monorailTrack(t));
    const frame = { x: -1, y: -1, width: X + 2, depth: Y + 2, height: 4.2 };
    return (
      <SceneBox frame={frame} cellSize={28}>
        {tiles.map((t, i) => (
          <Monorail key={i} {...t} />
        ))}
        <PalletRack bays={8} levels={3} origin={{ x: C + 0.6, y: W + 0.8 }} fill={0.7} seed={2} />
        <PalletRack bays={8} levels={3} origin={{ x: C + 0.6, y: Y - W - 1.35 }} fill={0.7} seed={5} />
        <Picker track="mono" follow={{ route, closed: true, speed: 1.2, phase: 0 }} />
        <Picker track="mono" follow={{ route, closed: true, speed: 1.2, phase: 22 }} />
      </SceneBox>
    );
  },
};
