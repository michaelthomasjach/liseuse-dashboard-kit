import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Barrier } from "./Barrier";
import { SlidingGate } from "./SlidingGate";
import { FlowerBed } from "./FlowerBed";
import { TollBooth } from "./TollBooth";
import { Transformer } from "./Transformer";
import { Roof } from "./Roof";
import { StandardWall } from "./BuildingWalls";
import { PACKING_LABEL, PackingMachine } from "./PackingMachine";
import { ROBOT_CELL_LABEL, RobotCell } from "./RobotCell";
import { PalletRack } from "./PalletRack";
import { RackV2 } from "./RackV2";
import { Forklift } from "./Forklift";
import { SceneBox } from "./sceneStory";
import { STORAGE_CLASSES, STORAGE_LABEL } from "./storageClass";

/**
 * Les équipements d'un site : ce qui contrôle les accès, ce qui habille les bâtiments, ce qui
 * transforme les colis, et les options des étagères.
 */
const meta: Meta = {
  title: "Warehouse/Équipements",
};
export default meta;
type Story = StoryObj;

const row = { display: "flex", gap: 36, alignItems: "flex-end", flexWrap: "wrap" as const, padding: 24 };
const cell = (node: ReactNode, text: string) => (
  <div key={text} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
    {node}
    <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{text}</span>
  </div>
);

export const Acces: Story = {
  name: "Barrières et portail",
  render: () => (
    <div style={row}>
      {cell(<Barrier kind="boom" cycle={5} cellSize={60} />, "Barrière levante")}
      {cell(<Barrier kind="gantry" cellSize={50} />, "Portique de hauteur")}
      {cell(<SlidingGate length={4} cycle={8} cellSize={34} />, "Portail coulissant")}
    </div>
  ),
};

export const Peage: Story = {
  name: "Poste de péage",
  render: () => (
    <div style={row}>
      {cell(<TollBooth lanes={1} cellSize={34} />, "Une voie")}
      {cell(<TollBooth lanes={3} cellSize={24} />, "Trois voies")}
    </div>
  ),
};

export const Parterres: Story = {
  name: "Parterres de fleurs",
  render: () => (
    <div style={row}>
      {cell(<FlowerBed length={3} width={1} seed={2} cellSize={60} />, "Parterre")}
      {cell(<FlowerBed length={3} width={1} seed={5} border="wood" density={0.6} cellSize={60} />, "Bordure bois")}
      {cell(<FlowerBed shape="round" length={2.2} seed={3} cellSize={60} />, "Rond fleuri")}
    </div>
  ),
};

export const Transformateurs: Story = {
  name: "Transformateurs électriques",
  render: () => (
    <div style={row}>
      {cell(<Transformer kind="pad" cellSize={60} />, "Sur socle")}
      {cell(<Transformer kind="kiosk" cellSize={50} />, "Poste préfabriqué")}
      {cell(<Transformer kind="substation" cellSize={22} />, "Poste de livraison")}
    </div>
  ),
};

/** Une toiture, et ses évolutions — jusqu'à la chambre froide et ses groupes frigorifiques. */
export const Toitures: Story = {
  name: "Toitures et chambre froide",
  render: () => (
    <div style={row}>
      {cell(<Roof kind="deck" length={8} width={5} height={0.4} cellSize={26} />, "Bac acier")}
      {cell(<Roof kind="skylight" length={8} width={5} height={0.4} cellSize={26} />, "Lanterneaux")}
      {cell(<Roof kind="cold" length={8} width={5} height={0.4} cellSize={26} />, "Chambre froide")}
    </div>
  ),
};

export const Ouvertures: Story = {
  name: "Portes, fenêtres, baies vitrées",
  render: () => (
    <div style={row}>
      {cell(
        <StandardWall
          length={10}
          level={0}
          slab={false}
          cellSize={30}
          rotation={180}
          openings={[
            { at: 1, width: 0.55, kind: "door" },
            { at: 2.5, width: 1, kind: "window" },
            { at: 4.2, width: 1, kind: "window" },
            { at: 6, width: 3, kind: "bay" },
          ]}
        />,
        "Un mur de local : porte, fenêtres, baie"
      )}
    </div>
  ),
};

export const Emballage: Story = {
  name: "Machines d'emballage",
  render: () => (
    <div style={row}>
      {(["wrap", "strap", "label", "box"] as const).map((p) => cell(<PackingMachine process={p} cellSize={34} />, PACKING_LABEL[p]))}
    </div>
  ),
};

export const Robots: Story = {
  name: "Robots qui agissent sur les produits",
  render: () => (
    <div style={row}>
      {(["gantry", "delta", "palletizer"] as const).map((k) => cell(<RobotCell kind={k} cellSize={30} />, ROBOT_CELL_LABEL[k]))}
    </div>
  ),
};

/**
 * Les classes de stockage : une par niveau du rack, et les marchandises qui suivent. Et le passage
 * sous le rack, par où passe un chariot.
 */
export const Stockage: Story = {
  name: "Classes de stockage et passage",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16 }}>
      <SceneBox frame={{ x: -0.5, y: -2.5, width: 14, depth: 4, height: 4.5 }} cellSize={34}>
        <PalletRack bays={9} levels={4} fill={0.9} seed={3} storage={["liquid", "flammable", "dry", "cold"]} passage={{ from: 4, to: 5, clearance: 2.2 }} />
        <Forklift origin={{ x: 4.9, y: -1.8 }} rotation={90} load="carton" driver />
      </SceneBox>
      <SceneBox frame={{ x: -0.5, y: -1, width: 12, depth: 3, height: 4 }} cellSize={34}>
        <RackV2 width={4} depth={1.2} height={2.4} shelves={3} deckThickness={0.05} slotsX={3} posts braces storage={["solvent", "corrosive", "fragile"]} />
        <RackV2 width={4} depth={1.2} height={1.8} shelves={2} deckThickness={0.05} slotsX={3} posts braces clearance={1.8} origin={{ x: 5, y: 0 }} storage="heavy" />
      </SceneBox>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: "0.72rem" }}>
        {STORAGE_CLASSES.map((c) => (
          <span key={c}>
            <code>{c}</code> — {STORAGE_LABEL[c]}
          </span>
        ))}
      </div>
    </div>
  ),
};
