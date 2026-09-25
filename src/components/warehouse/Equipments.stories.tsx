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
import { RoofHvac, RoofSolar } from "./RoofUnits";
import { ColdRoom } from "./ColdRoom";
import { Office } from "./Office";
import { TruckBay } from "./TruckBay";
import { PalletJack } from "./PalletJack";
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
      {cell(<Transformer kind="gridStation" cellSize={18} />, "Poste source HTB")}
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

/** Ce qu'on pose sur un toit : chaque équipement sur sa dalle, qui dit « ceci est en toiture ». */
export const EquipementsDeToiture: Story = {
  name: "Équipements de toiture",
  render: () => (
    <div style={row}>
      {cell(<RoofSolar rows={1} columns={6} height={0.2} cellSize={40} />, "Petit champ en toiture")}
      {cell(<RoofSolar rows={2} columns={8} height={0.2} cellSize={30} />, "Champ en toiture")}
      {cell(<RoofHvac units={1} height={0.2} cellSize={60} />, "Groupe froid simple")}
      {cell(<RoofHvac units={3} height={0.2} cellSize={44} />, "Groupe froid triple")}
    </div>
  ),
};

/** Un équipement de toiture posé là où il n'y a pas de toit : une ossature d'acier le porte jusqu'au
 *  sol — poteaux sur platines, ceinture sous la dalle, croix de contreventement. C'est ce que le plan
 *  dessine quand un champ de panneaux ou un groupe froid n'a ni toiture ni chambre froide dessous. */
export const PlateformesTechniques: Story = {
  name: "Plates-formes techniques",
  render: () => (
    <div style={row}>
      {cell(<RoofSolar rows={1} columns={6} height={3} legs cellSize={30} />, "Champ sur ossature")}
      {cell(<RoofHvac units={2} height={3} legs cellSize={44} />, "Groupe froid sur ossature")}
      {cell(<RoofHvac units={3} height={1.68} cellSize={44} />, "Posé sur une chambre froide (1,68)")}
    </div>
  ),
};

/** Des bureaux, sans leurs murs : un îlot de quatre postes, deux îlots, puis la salle de réunion vitrée. */
export const Bureaux: Story = {
  name: "Bureaux",
  render: () => (
    <div style={row}>
      {cell(<Office workstations={4} cellSize={34} />, "Open space 4 postes")}
      {cell(<Office workstations={8} cellSize={34} />, "Open space 8 postes")}
      {cell(<Office workstations={8} meetingRoom cellSize={34} />, "Bureaux et salle de réunion")}
    </div>
  ),
};

/** La chambre froide : positive, négative, et sans plafond — comme quand les toits sont masqués. */
export const ChambresFroides: Story = {
  name: "Chambres froides",
  render: () => (
    <div style={row}>
      {cell(<ColdRoom kind="positive" cellSize={34} />, "Positive")}
      {cell(<ColdRoom kind="negative" cellSize={34} />, "Négative")}
      {cell(<ColdRoom kind="negative" ceiling={false} cellSize={34} />, "Sans plafond : on voit dedans")}
    </div>
  ),
};

/** Le parking poids lourds, vide : les marquages, la flèche de la marche arrière, le butoir au bout
 *  quai (à droite), et le transpalette qui fait le lien entre le quai et l'entrepôt. */
export const QuaiPoidsLourds: Story = {
  name: "Parking poids lourds et transpalette",
  render: () => (
    <div style={row}>
      {cell(<TruckBay bays={1} cellSize={26} />, "1 place")}
      {cell(<TruckBay bays={3} cellSize={22} />, "3 places")}
      {cell(<PalletJack cellSize={70} />, "Transpalette")}
      {cell(<PalletJack load="carton" cartons={6} cellSize={70} />, "Six cartons")}
      {cell(<PalletJack load="palette" operator={false} cellSize={70} />, "Palette pleine, sans opérateur")}
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
