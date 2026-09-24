import type { Meta, StoryObj } from "@storybook/react";
import { Tree, Trees, treeLine } from "./Tree";
import { Road, roadTrack } from "./Road";
import { Fence } from "./Fence";
import { Gatehouse } from "./Gatehouse";
import { StreetLight } from "./StreetLight";
import { ShippingContainer } from "./ShippingContainer";
import { PalletRack } from "./PalletRack";
import { Car } from "./Car";
import { Worker } from "./Worker";
import { SceneBox } from "./sceneStory";

/**
 * Le site autour de l'entrepôt : ce qui en fait un lieu et non un plan. Arbres, routes et
 * carrefours, clôtures, poste de garde, éclairage, conteneurs, et le rack à palettes du stockage
 * lourd.
 */
const meta: Meta = {
  title: "Warehouse/Site",
};
export default meta;
type Story = StoryObj;

const row = { display: "flex", gap: 36, alignItems: "flex-end", flexWrap: "wrap" as const, padding: 24 };
const label = { fontSize: "0.72rem", fontWeight: 600 };
const cell = (node: React.ReactNode, text: string) => (
  <div key={text} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
    {node}
    <span style={label}>{text}</span>
  </div>
);

export const Arbres: Story = {
  name: "Arbres",
  render: () => (
    <div style={row}>
      {cell(<Tree kind="round" seed={2} cellSize={40} />, "Feuillu")}
      {cell(<Tree kind="conifer" seed={4} cellSize={40} />, "Résineux")}
      {cell(<Tree kind="poplar" seed={5} cellSize={40} />, "Peuplier")}
      {cell(<Tree kind="bush" seed={6} cellSize={60} />, "Arbuste")}
    </div>
  ),
};

/** Un alignement et un bosquet : des dizaines d'arbres en un seul maillage. */
export const Bosquet: Story = {
  name: "Alignement et bosquet",
  render: () => (
    <Trees
      cellSize={22}
      trees={[
        ...treeLine({ x: 0, y: 0 }, { x: 14, y: 0 }, 8, "poplar", 2),
        ...treeLine({ x: 0, y: 3 }, { x: 6, y: 5 }, 5, "round", 7),
        ...treeLine({ x: 8, y: 3 }, { x: 13, y: 6 }, 4, "conifer", 9),
        ...treeLine({ x: 1, y: 7 }, { x: 12, y: 8 }, 9, "bush", 4),
      ]}
    />
  ),
};

export const Routes: Story = {
  name: "Tuiles de route",
  render: () => (
    <div style={row}>
      {cell(<Road kind="straight" length={8} crosswalk="end" cellSize={16} />, "Droite")}
      {cell(<Road kind="corner" cellSize={16} />, "Virage")}
      {cell(<Road kind="tee" cellSize={16} />, "Té")}
      {cell(<Road kind="cross" cellSize={16} />, "Carrefour")}
    </div>
  ),
};

/**
 * Une boucle de rues, et des voitures qui y roulent : chaque voiture suit l'axe de sa voie
 * (`roadTrack`), tuile après tuile, sans jamais sauter d'une tuile à l'autre.
 */
export const Circulation: Story = {
  name: "Des voitures qui circulent",
  render: function Render() {
    const W = 5.5; // 2 voies de 1,75 et deux trottoirs de 1
    const S = 10;
    // Quatre virages, quatre droites : un îlot carré.
    const tiles = [
      { kind: "straight" as const, length: S, origin: { x: W, y: 0 }, rotation: 0 },
      { kind: "corner" as const, origin: { x: W + S, y: 0 }, rotation: 0 },
      { kind: "straight" as const, length: S, origin: { x: W + S + W / 2 - S / 2, y: W + S / 2 - W / 2 }, rotation: 90 },
      { kind: "corner" as const, origin: { x: W + S, y: W + S }, rotation: 90 },
      { kind: "straight" as const, length: S, origin: { x: W, y: W + S }, rotation: 180 },
      { kind: "corner" as const, origin: { x: 0, y: W + S }, rotation: 180 },
      { kind: "straight" as const, length: S, origin: { x: W / 2 - S / 2, y: W + S / 2 - W / 2 }, rotation: 270 },
      { kind: "corner" as const, origin: { x: 0, y: 0 }, rotation: 270 },
    ];
    const lane = (reverse: boolean) => {
      const list = tiles.map((t) => roadTrack(t, { reverse }));
      return reverse ? list.reverse() : list;
    };
    const frame = { x: -0.5, y: -0.5, width: 2 * W + S + 1, depth: 2 * W + S + 1, height: 3 };
    return (
      <SceneBox frame={frame} cellSize={16}>
        {tiles.map((t, i) => (
          <Road key={i} {...t} />
        ))}
        <Trees trees={[...treeLine({ x: W + 1, y: W + 1 }, { x: W + S - 1, y: W + 1 }, 4, "round", 3), ...treeLine({ x: W + 1, y: W + S - 1 }, { x: W + S - 1, y: W + S - 1 }, 4, "round", 5)]} />
        <Car kind="sedan" tone="accent" follow={{ route: lane(false), speed: 2.4, phase: 0 }} />
        <Car kind="van" tone="light" follow={{ route: lane(false), speed: 2.4, phase: 18 }} />
        <Car kind="hatch" tone="warm" follow={{ route: lane(true), speed: 2, phase: 5 }} />
        <Car kind="sedan" tone="dark" follow={{ route: lane(true), speed: 2, phase: 30 }} />
      </SceneBox>
    );
  },
};

export const Clotures: Story = {
  name: "Clôtures et barrières",
  render: () => (
    <div style={row}>
      {cell(<Fence kind="mesh" length={5} cellSize={30} />, "Clôture de site")}
      {cell(<Fence kind="jersey" length={4} cellSize={30} />, "Séparateur béton")}
      {cell(<Fence kind="guard" length={4} cellSize={30} />, "Glissière")}
      {cell(<Fence kind="barrier" length={3} cellSize={30} />, "Protection d'allée")}
    </div>
  ),
};

export const Entree: Story = {
  name: "Poste de garde",
  render: () => (
    <div style={row}>
      {cell(<Gatehouse cycle={6} cellSize={34} />, "Barrières en cycle")}
      {cell(<Gatehouse open={1} barriers={1} cellSize={34} />, "Une voie, levée")}
    </div>
  ),
};

export const Eclairage: Story = {
  name: "Éclairage et bornes",
  render: () => (
    <div style={row}>
      {cell(<StreetLight kind="street" cellSize={30} />, "Candélabre")}
      {cell(<StreetLight kind="flood" cellSize={24} />, "Mât de cour")}
      {cell(<StreetLight kind="bollard" cellSize={60} />, "Borne")}
    </div>
  ),
};

export const Conteneurs: Story = {
  name: "Conteneurs",
  render: () => (
    <div style={row}>
      {cell(<ShippingContainer size="20" cellSize={30} />, "20 pieds")}
      {cell(<ShippingContainer size="40" highCube tone={1} cellSize={26} />, "40 pieds high cube")}
      {cell(<ShippingContainer size="40" stack={3} tone={2} cellSize={22} />, "Une pile")}
      {cell(<ShippingContainer size="20" open tone={3} cellSize={30} />, "Portes ouvertes")}
    </div>
  ),
};

export const Racks: Story = {
  name: "Rack à palettes",
  render: () => (
    <div style={row}>
      {cell(<PalletRack bays={4} levels={4} cellSize={30} />, "Simple")}
      {cell(<PalletRack bays={3} levels={5} double fill={0.9} seed={8} cellSize={30} />, "Double, dos à dos")}
    </div>
  ),
};

export const Personnes: Story = {
  name: "Opérateurs",
  render: () => (
    <div style={row}>
      {cell(<Worker pose="stand" cellSize={90} />, "Debout")}
      {cell(<Worker pose="walk" walking={0.7} cellSize={90} />, "En marche")}
      {cell(<Worker pose="sit" cellSize={90} />, "Assis")}
    </div>
  ),
};
