import { useEffect, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { WarehousePlanner } from "./WarehousePlanner";
import { generatePlot } from "./plot";
import { SCENERY_OPTIONS, type SceneryToggles } from "./BuildPlot";
import type { PlannerItem } from "./plannerModel";
import type { PlannerEdit, PlannerLink, PlannerPaletteEntry } from "./WarehousePlanner";
import { dockTrafficClearance } from "./dockManeuver";
import { semiTruckGeometry } from "./SemiTruck";
import { dockDoorCenters } from "./BuildingWalls";
import { PlannerDockTraffic, PlannerShuttle, type DockTruckInfo } from "./PlannerLogistics";
import { accessRoadRoute, gateEntry, type PlannerGate } from "./accessRoad";
import type { PlannerZone } from "./PlannerZones";
import { DemandMeters, IconDock } from "../widgets";
import { BoltIcon, BoxesIcon, BuildingWarehouseIcon, ClipboardListIcon, GaugeIcon, TruckIcon } from "../icons";

/**
 * Le plan de l'entrepôt : un terrain tiré d'une graine, une palette d'éléments 3D, et la vue de
 * dessus où l'on construit. Les murs s'étirent par leurs deux bouts et se déplacent par leur
 * milieu.
 */
const meta: Meta<typeof WarehousePlanner> = {
  title: "Warehouse/Plan d'entrepôt",
  component: WarehousePlanner,
  // La caméra est celle de l'éditeur — vue de dessus — et non celle du gizmo de la planche.
  parameters: { layout: "fullscreen", isoCamera: false },
};
export default meta;
type Story = StoryObj<typeof WarehousePlanner>;

// La planche entoure chaque story d'une marge de 32 px : l'éditeur remplit ce qui reste.
const frame = { height: "calc(100dvh - 64px)" };

export const Construire: Story = {
  name: "Construire sur un terrain",
  render: function Render() {
    const [seed, setSeed] = useState(7);
    const [items, setItems] = useState<PlannerItem[]>([]);
    return (
      <div style={frame}>
        <WarehousePlanner seed={seed} onSeedChange={setSeed} items={items} onItemsChange={setItems} height="100%" />
      </div>
    );
  },
};

/** Un entrepôt déjà commencé : un bâtiment fermé — un mur de quai et trois murs —, des racks, un
 *  tapis, des engins. Tout reste modifiable. */
export const EnCours: Story = {
  name: "Un entrepôt en cours",
  render: function Render() {
    const plot = useMemo(() => generatePlot(21, { shape: "rect" }), []);
    const initial = useMemo<PlannerItem[]>(() => {
      const x0 = 4;
      const y0 = 7;
      const x1 = Math.min(plot.width - 4, 28);
      const y1 = Math.min(plot.depth - 2, 20);
      const out: PlannerItem[] = [
        { id: "dock", kind: "dock", level: 2, x0, y0, x1, y1: y0 },
        { id: "east", kind: "wall", level: 2, x0: x1, y0, x1, y1 },
        { id: "north", kind: "wall", level: 2, x0: x1, y0: y1, x1: x0, y1 },
        { id: "west", kind: "wall", level: 2, x0, y0: y1, x1: x0, y1: y0 },
      ];
      for (let i = 0; i < 3; i += 1) out.push({ id: `rack${i}`, kind: "palletRack", level: 2, x0: x0 + 2, y0: y1 - 2 - i * 3, x1: x0 + 13, y1: y1 - 2 - i * 3 });
      out.push({ id: "belt", kind: "conveyor", level: 2, x0: x1 - 3, y0: y0 + 3, x1: x1 - 3, y1: y1 - 2 });
      out.push({ id: "fk", kind: "forklift", x: x0 + 8, y: y0 + 3, rotation: 0 });
      out.push({ id: "amr", kind: "amr", level: 2, x: x0 + 15, y: y0 + 4, rotation: 90 });
      out.push({ id: "w1", kind: "worker", x: x0 + 17, y: y0 + 3, rotation: 180 });
      out.push({ id: "c1", kind: "container", level: 2, x: plot.width - 5, y: 3, rotation: 90 });
      out.push({ id: "t1", kind: "tree", level: 2, x: 2, y: 2, rotation: 0 }, { id: "t2", kind: "tree", level: 2, x: 2, y: plot.depth - 2, rotation: 0 });
      return out;
    }, [plot]);
    const [items, setItems] = useState<PlannerItem[]>(initial);
    return (
      <div style={frame}>
        <WarehousePlanner seed={21} shape="rect" items={items} onItemsChange={setItems} height="100%" />
      </div>
    );
  },
};

/** Un terrain en L : une partie du rectangle est au voisin, derrière sa clôture. */
export const TerrainEnL: Story = {
  name: "Un terrain en L",
  render: () => (
    <div style={frame}>
      <WarehousePlanner defaultSeed={4} shape="L" height="100%" />
    </div>
  ),
};

/**
 * La démo : un centre de distribution complet, tous les éléments de la palette réunis.
 *
 * Un bâtiment de 88 × 56 m fermé par quatre murs, dont une façade de quai à sept portes — trois
 * semi-remorques à quai. Dedans : trois rangées de racks à palettes, des étagères, deux zones de
 * stockage au sol derrière les quais, une ligne de tapis (droits, un angle, un T qui dérive vers un
 * second tapis), un picker sur son rail qui tourne au bout de la travée, un bras robotisé en bout de
 * ligne, des chariots, un robot autonome, des opérateurs. Dehors : des conteneurs, des mâts
 * d'éclairage, des arbres, une clôture.
 *
 * Elle s'ouvre en vue 3D ; tout y reste modifiable — et « Dessus » ramène à la vue de plan.
 */
export const Demo: Story = {
  name: "Démo : un entrepôt complet",
  render: function Render() {
    const initial = useMemo<PlannerItem[]>(() => {
      const X0 = 6;
      const X1 = 50;
      const Y0 = 12;
      const Y1 = 40;
      const DOCK = 24;
      const truck = semiTruckGeometry().length;
      const doors = dockDoorCenters(DOCK, Math.floor((DOCK - 1) / 3), 3, 1.75);
      const list: PlannerItem[] = [
        // Le bâtiment : la façade de quai, puis les murs, tournés pour que leur dehors soit dehors.
        { id: "dock", kind: "dock", level: 2, x0: X0, y0: Y0, x1: X0 + DOCK, y1: Y0 },
        { id: "front", kind: "wall", level: 3, x0: X0 + DOCK, y0: Y0, x1: X1, y1: Y0 },
        { id: "east", kind: "wall", level: 2, x0: X1, y0: Y0, x1: X1, y1: Y1 },
        { id: "north", kind: "wall", level: 2, x0: X1, y0: Y1, x1: X0, y1: Y1 },
        { id: "west", kind: "wall", level: 2, x0: X0, y0: Y1, x1: X0, y1: Y0 },
      ];
      // Trois camions à quai, arrière contre la porte.
      for (const i of [0, 2, 4]) list.push({ id: `truck${i}`, kind: "truck", level: 2, x: X0 + doors[i], y: Y0 - 0.35 - truck / 2, rotation: -90 });
      // Le stockage lourd : trois rangées de racks, au fond.
      for (const [i, y] of [30, 33.5, 37].entries()) list.push({ id: `rack${i}`, kind: "palletRack", level: 2, x0: X0 + 3, y0: y, x1: X0 + 21, y1: y });
      // Derrière les quais, la réception : deux zones au sol, et les chariots qui les desservent.
      list.push({ id: "zone1", kind: "zone", level: 3, x: X0 + 6, y: Y0 + 4, rotation: 0 }, { id: "zone2", kind: "zone", level: 2, x: X0 + 13, y: Y0 + 4, rotation: 0 });
      list.push({ id: "fork1", kind: "forklift", x: X0 + 9, y: Y0 + 10, rotation: 90 }, { id: "fork2", kind: "forklift", level: 2, x: X0 + 17, y: Y0 + 21, rotation: 180 });
      // La ligne de tapis : un droit, un angle, un droit qui monte, un T qui dérive vers la gauche.
      list.push(
        { id: "belt1", kind: "conveyor", level: 3, x0: 30, y0: 18, x1: 40, y1: 18 },
        { id: "corner1", kind: "conveyorCorner", level: 2, x: 40.8, y: 18, rotation: 0 },
        { id: "belt2", kind: "conveyor", level: 2, x0: 40.8, y0: 18.8, x1: 40.8, y1: 26 },
        { id: "tee1", kind: "conveyorTee", level: 2, x: 40.8, y: 26.8, rotation: 90 },
        { id: "belt3", kind: "conveyor", level: 2, x0: 40.8, y0: 27.6, x1: 40.8, y1: 31 },
        { id: "belt4", kind: "conveyor", level: 2, x0: 40, y0: 26.8, x1: 33, y1: 26.8 }
      );
      list.push({ id: "arm1", kind: "arm", level: 2, x: 43.2, y: 30.5, rotation: 180 });
      // Le picker et sa voie : la travée, puis un rail d'angle et un rail qui remonte.
      list.push(
        { id: "picker1", kind: "picker", x0: 30, y0: 34, x1: 46, y1: 34 },
        { id: "railC", kind: "railCorner", x: 47.35, y: 34.45, rotation: 0 },
        { id: "rail1", kind: "rail", x0: 47.8, y0: 35.8, x1: 47.8, y1: 39 }
      );
      list.push({ id: "decks1", kind: "shelf", level: 2, x: 34, y: 37.5, rotation: 0 }, { id: "decks2", kind: "shelf", level: 2, x: 39, y: 37.5, rotation: 0 });
      list.push({ id: "shelf1", kind: "shelf", x: 47.5, y: 22, rotation: 90 }, { id: "shelf2", kind: "shelf", x: 47.5, y: 27, rotation: 90 });
      list.push({ id: "amr1", kind: "amr", level: 2, x: 34, y: 22, rotation: 0 });
      list.push({ id: "w1", kind: "worker", x: 28.5, y: 20, rotation: 180 }, { id: "w2", kind: "worker", x: 37, y: 30, rotation: 90 }, { id: "w3", kind: "worker", x: 12, y: 16.5, rotation: 0 });
      // Dehors.
      list.push({ id: "cont1", kind: "container", level: 2, x: 54, y: 20, rotation: 90 }, { id: "cont2", kind: "container", level: 3, x: 56, y: 20, rotation: 90 });
      list.push({ id: "light1", kind: "light", level: 3, x: 3, y: 8, rotation: 0 }, { id: "light2", kind: "light", level: 3, x: 34, y: 7, rotation: 0 });
      // L'énergie : un parking solaire, un petit champ de panneaux, la ligne qui alimente le site.
      list.push({ id: "parking1", kind: "parking", level: 3, x: 55.5, y: 33, rotation: 90 });
      list.push({ id: "solar1", kind: "solar", level: 1, x: 3, y: 30, rotation: 90 });
      list.push({ id: "line1", kind: "powerLine", level: 2, x0: 2, y0: 43, x1: 58, y1: 43 });
      for (const [i, [x, y]] of [
        [2, 2],
        [57, 3],
        [2, 41],
        [57, 41],
      ].entries())
        list.push({ id: `tree${i}`, kind: "tree", level: 3, x, y, rotation: 0 });
      // Des équipements : le poste qui alimente le site, des parterres devant les bureaux, une
      // barrière sur l'accès, des fenêtres et une porte sur le mur arrière.
      list.push({ id: "transfo", kind: "transformer", level: 2, x: 20, y: 41.3, rotation: 0 });
      list.push({ id: "flowers1", kind: "flowerBed", level: 2, x: 40, y: 6, rotation: 0 }, { id: "flowers2", kind: "flowerBed", level: 3, x: 47, y: 6, rotation: 0 });
      list.push({ id: "door1", kind: "door", x: 44, y: 12, rotation: 0 }, { id: "win1", kind: "window", x: 38, y: 12, rotation: 0 }, { id: "bay1", kind: "bay", level: 2, x: 31.5 + 2.5, y: 40, rotation: 180 });
      list.push({ id: "fence1", kind: "fence", level: 2, x0: 52, y0: 26, x1: 52, y1: 42 });
      return list;
    }, []);
    const [items, setItems] = useState<PlannerItem[]>(initial);
    return (
      <div style={frame}>
        <WarehousePlanner seed={12} shape="rect" plotSize={{ width: 60, depth: 44 }} items={items} onItemsChange={setItems} defaultView="3d" defaultOrbit={{ yaw: 210, tilt: 36 }} defaultZoom={1.9} height="100%" />
      </div>
    );
  },
};

/**
 * Piloté par une application — un jeu de gestion : sa palette (des éléments du kit, à un niveau et
 * une longueur fixés, avec leur prix), sa règle (le budget), et ses comptes, tenus à chaque geste
 * terminé (`onEdit`). Les racks ne s'étirent pas et ne se rétrogradent pas : ce sont des achats.
 * « Observer » passe l'éditeur en lecture seule ; « Montrer les racks » les désigne et les cadre.
 */
/**
 * Le plan qui **travaille** : un bâtiment, ses toits équipés (panneaux, climatiseurs), une chambre
 * froide, deux parkings poids lourds et une parcelle voisine à vendre. Des compteurs, incrémentés
 * par une minuterie comme le ferait un jeu, font rouler les engins : un transpalette et un
 * préparateur font la navette dans l'entrepôt ; à l'est, des camions vides viennent à quai et
 * repartent pleins ; à l'ouest, des camions pleins sont vidés au chariot. « Toits » masque les
 * toitures et tout ce qui est posé dessus.
 */
export const Logistique: Story = {
  name: "Logistique animée",
  render: function Render() {
    const initial = useMemo<PlannerItem[]>(() => {
      const x0 = 16;
      const y0 = 8;
      const x1 = 40;
      const y1 = 32;
      return [
        { id: "south", kind: "wall", level: 2, x0, y0, x1, y1: y0 },
        { id: "east", kind: "dock", level: 2, x0: x1, y0, x1, y1 },
        { id: "north", kind: "wall", level: 2, x0: x1, y0: y1, x1: x0, y1 },
        { id: "west", kind: "dock", level: 2, x0, y0: y1, x1: x0, y1: y0 },
        { id: "roof", kind: "roof", level: 1, x: 28, y: 20, rotation: 0, size: { length: 24, width: 24 } },
        { id: "pv", kind: "roofSolar", level: 3, x: 24, y: 14, rotation: 0 },
        { id: "hvac", kind: "hvac", level: 3, x: 34, y: 28, rotation: 0 },
        { id: "cold", kind: "coldRoom", level: 2, x: 21, y: 27, rotation: 0 },
        { id: "rack1", kind: "palletRack", level: 2, x0: 19, y0: 12, x1: 30, y1: 12 },
        { id: "rack2", kind: "palletRack", level: 2, x0: 19, y0: 16, x1: 30, y1: 16 },
        { id: "ship", kind: "truckBay", level: 3, x: 45.55, y: 20, rotation: 180 },
        { id: "recv", kind: "truckBay", level: 2, x: 10.45, y: 20, rotation: 0 },
        { id: "mast", kind: "light", level: 3, x: 48, y: 30, rotation: 0 },
        { id: "grid", kind: "transformer", level: 4, x: 60, y: 8, rotation: 0 },
      ];
    }, []);
    const [items, setItems] = useState<PlannerItem[]>(initial);
    const [roofs, setRoofs] = useState(true);
    const [paused, setPaused] = useState(false);
    const [shipped, setShipped] = useState(0);
    const [received, setReceived] = useState(0);
    const [moved, setMoved] = useState(0);
    const [picked, setPicked] = useState(0);
    const [events, setEvents] = useState<string[]>([]);
    const [traffic, setTraffic] = useState(0.4);
    const [night, setNight] = useState(0);
    const [electric, setElectric] = useState(false);
    const [clean, setClean] = useState(true);
    useEffect(() => {
      if (paused) return;
      const id = window.setInterval(() => {
        setShipped((n) => n + 3);
        setReceived((n) => n + 2);
        setMoved((n) => n + 2);
        setPicked((n) => n + 1);
      }, 1500);
      return () => window.clearInterval(id);
    }, [paused]);
    const bayOf = (id: string) => {
      const it = items.find((i) => i.id === id);
      return it && !("x0" in it) ? { x: it.x, y: it.y, rotation: it.rotation, bays: it.level ?? 1 } : null;
    };
    const ship = bayOf("ship");
    const recv = bayOf("recv");
    // Ce que balaient les camions : on n'y plante ni candélabre ni arbre.
    const clearance = [ship, recv].flatMap((b) => (b ? dockTrafficClearance(b) : []));
    const log = (text: string) => setEvents((e) => [text, ...e].slice(0, 4));
    return (
      <div style={{ ...frame, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setPaused((p) => !p)}>{paused ? "Reprendre" : "Pause"}</button>
          <button type="button" onClick={() => setRoofs((r) => !r)}>{roofs ? "Masquer les toits" : "Afficher les toits"}</button>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            Circulation
            <input type="range" min={0} max={1} step={0.05} value={traffic} onChange={(e) => setTraffic(Number(e.target.value))} />
          </label>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            Nuit
            <input type="range" min={0} max={1} step={0.05} value={night} onChange={(e) => setNight(Number(e.target.value))} />
          </label>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={electric} onChange={(e) => setElectric(e.target.checked)} />
            Camions électriques
          </label>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} />
            Sol propre
          </label>
          <span>Expédiés : {shipped}</span>
          <span>Reçus : {received}</span>
          <span>Palettes déplacées : {moved}</span>
          <span>Colis préparés : {picked}</span>
          <span style={{ opacity: 0.7 }}>{events.join(" · ")}</span>
        </div>
        <WarehousePlanner
          seed={5}
          shape="rect"
          plotSize={{ width: 72, depth: 44 }}
          items={items}
          onItemsChange={setItems}
          roofs={roofs}
          onRoofsChange={setRoofs}
          lockedAreas={[{ id: "lot-nord", x: 52, y: 30, width: 20, depth: 14, label: "Parcelle nord · 120 000 €" }]}
          traffic={traffic}
          night={night}
          groundStyle={clean ? "clean" : "site"}
          lightExclusions={clearance}
          treeExclusions={clearance}
          defaultView="3d"
          defaultZoom={1.4}
          height="100%"
          sceneChildren={
            <>
              {ship && (
                <PlannerDockTraffic bay={ship} mode="ship" count={shipped} capacity={18} roadSpeed={1 - 0.6 * traffic} electric={electric} staging={{ x: 36, y: 20 }} paused={paused} onTruck={(e) => log(`expédition : camion ${e.kind === "arrive" ? "à quai" : "parti"} (place ${e.slot + 1})`)} />
              )}
              {recv && (
                <PlannerDockTraffic bay={recv} mode="receive" count={received} capacity={12} roadSpeed={1 - 0.6 * traffic} electric={electric} staging={{ x: 20, y: 22 }} paused={paused} onTruck={(e) => log(`réception : camion ${e.kind === "arrive" ? "à quai" : "parti"} (place ${e.slot + 1})`)} />
              )}
              <PlannerShuttle vehicle="palletJack" from={{ x: 22, y: 20 }} to={{ x: 34, y: 20 }} trips={moved} batch={4} paused={paused} label="Transpalette" />
              <PlannerShuttle vehicle="worker" from={{ x: 31, y: 14 }} to={{ x: 33, y: 24 }} via={[{ x: 32, y: 18 }]} trips={picked} batch={1} speed={1.4} paused={paused} label="Préparateur" />
              <PlannerShuttle vehicle="amr" from={{ x: 25, y: 23 }} to={{ x: 25, y: 30 }} trips={picked} batch={2} load="palette" paused={paused} label="Robot" />
            </>
          }
        />
      </div>
    );
  },
};

export const Application: Story = {
  name: "Piloté par une application",
  render: function Render() {
    const prices: Record<string, number> = { rack: 6500, shelf: 1500, zone: 2500, belt: 4000, worker: 8000, packer: 6000 };
    const [budget, setBudget] = useState(20000);
    const [items, setItems] = useState<PlannerItem[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [readOnly, setReadOnly] = useState(false);
    const [focus, setFocus] = useState<{ key: number; ids: string[] } | undefined>();
    const [log, setLog] = useState<string[]>([]);
    const owner = useMemo(() => new Map<string, string>(), []);
    const entries: PlannerPaletteEntry[] = [
      { id: "rack", label: "Rack palettier", kind: "palletRack", length: 5.5, group: "Stockage", sub: "Racks", meta: `${prices.rack} €`, disabled: budget < prices.rack },
      { id: "shelf", label: "Étagère", kind: "shelf", group: "Stockage", sub: "Étagères", meta: `${prices.shelf} €`, disabled: budget < prices.shelf },
      { id: "zone", label: "Zone de réception", kind: "zone", group: "Stockage", sub: "Au sol", meta: `${prices.zone} €`, disabled: budget < prices.zone },
      { id: "belt", label: "Tapis", kind: "conveyor", length: 6, level: 2, group: "Flux", meta: `${prices.belt} €`, disabled: budget < prices.belt },
      { id: "worker", label: "Préparateur", kind: "worker", group: "Flux", meta: `${prices.worker} €`, disabled: budget < prices.worker },
      { id: "packer", label: "Emballage", kind: "packer", group: "Flux", meta: `${prices.packer} €`, disabled: budget < prices.packer },
    ];
    const onEdit = (edit: PlannerEdit) => {
      if (edit.type === "add") {
        edit.items.forEach((it) => owner.set(it.id, edit.entryId));
        setBudget((b) => b - prices[edit.entryId]);
      }
      if (edit.type === "remove") edit.items.forEach((it) => setBudget((b) => b + Math.round(prices[owner.get(it.id) ?? ""] * 0.7)));
      setLog((l) => [`${edit.type}${edit.type === "add" ? ` ${edit.entryId}` : ""}`, ...l].slice(0, 6));
    };
    return (
      <div style={{ ...frame, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13 }}>
          <strong>Budget : {budget} €</strong>
          <button type="button" onClick={() => setReadOnly((r) => !r)}>{readOnly ? "Construire" : "Observer"}</button>
          <button type="button" onClick={() => setFocus((f) => ({ key: (f?.key ?? 0) + 1, ids: items.filter((it) => it.kind === "palletRack").map((it) => it.id) }))}>
            Montrer les racks
          </button>
          <span>Choisi : {selectedId ?? "—"}</span>
          <span style={{ opacity: 0.7 }}>{log.join(" · ")}</span>
        </div>
        <WarehousePlanner
          seed={12}
          shape="rect"
          plotSize={{ width: 40, depth: 26 }}
          items={items}
          onItemsChange={setItems}
          entries={entries}
          selectedId={selectedId}
          onSelectedIdChange={setSelectedId}
          readOnly={readOnly}
          allowStretch={false}
          allowDowngrade={false}
          validate={(_, __, { entryId }) => (entryId && budget < prices[entryId] ? `Budget insuffisant : il manque ${prices[entryId] - budget} €.` : null)}
          onEdit={onEdit}
          highlightIds={focus?.ids}
          focus={focus}
          showStatus={false}
          height="100%"
        />
      </div>
    );
  },
};

/**
 * Les équipements de toiture ne flottent jamais. Le plan cherche ce qu'il y a sous chacun :
 *
 * - une **toiture** : il est posé dessus, à l'acrotère (le champ de gauche, sur le bâtiment) ;
 * - une **chambre froide** hors du bâtiment couvert : il est posé sur son plafond (les condenseurs
 *   au milieu) ;
 * - rien : il reste à hauteur de toit, mais sur une **ossature d'acier** jusqu'au sol — une plate-forme
 *   technique (le champ et le groupe de droite).
 *
 * Tenez un « Climatiseur de toiture » en main et promenez-le : le fantôme change d'appui en passant
 * au-dessus du toit, de la chambre froide ou du vide.
 */
export const AppuisDeToiture: Story = {
  name: "Appuis des équipements de toiture",
  render: function Render() {
    const [items, setItems] = useState<PlannerItem[]>([
      { id: "s", kind: "wall", level: 2, x0: 6, y0: 6, x1: 20, y1: 6 },
      { id: "e", kind: "wall", level: 2, x0: 20, y0: 6, x1: 20, y1: 18 },
      { id: "n", kind: "wall", level: 2, x0: 20, y0: 18, x1: 6, y1: 18 },
      { id: "w", kind: "wall", level: 2, x0: 6, y0: 18, x1: 6, y1: 6 },
      { id: "roof", kind: "roof", level: 1, x: 13, y: 12, rotation: 0, size: { length: 14, width: 12 } },
      { id: "pv-roof", kind: "roofSolar", level: 1, x: 12, y: 10, rotation: 0 },
      { id: "cold", kind: "coldRoom", level: 1, x: 27, y: 12, rotation: 0 },
      { id: "hvac-cold", kind: "hvac", level: 2, x: 27, y: 12.5, rotation: 0 },
      { id: "pv-legs", kind: "roofSolar", level: 1, x: 36, y: 9, rotation: 0 },
      { id: "hvac-legs", kind: "hvac", level: 3, x: 36, y: 15, rotation: 0 },
    ]);
    return (
      <div style={frame}>
        <WarehousePlanner seed={9} shape="rect" plotSize={{ width: 44, depth: 26 }} items={items} onItemsChange={setItems} groundStyle="clean" defaultView="3d" defaultZoom={1.5} height="100%" />
      </div>
    );
  },
};

/**
 * Des flux tracés à la main. « Tracer un flux » : pressez sur un élément, tirez — l'élastique suit et
 * désigne l'élément survolé —, lâchez sur un autre. Un lien vers un arbre est refusé (`canLink`),
 * l'élastique passe au rouge et dit pourquoi. Hors du mode de tracé, un clic sur une flèche la
 * choisit, Suppr l'efface.
 */
export const Flux: Story = {
  name: "Flux tracés par le joueur",
  render: function Render() {
    const [items, setItems] = useState<PlannerItem[]>([
      { id: "recv", kind: "zone", level: 2, x: 8, y: 8, rotation: 0 },
      { id: "rack", kind: "palletRack", level: 2, x0: 14, y0: 6, x1: 24, y1: 6 },
      { id: "shelf", kind: "shelf", level: 2, x: 18, y: 12, rotation: 0 },
      { id: "pack", kind: "packer", level: 2, x: 28, y: 12, rotation: 0 },
      { id: "ship", kind: "zone", level: 1, x: 34, y: 6, rotation: 0 },
      { id: "tree", kind: "tree", level: 2, x: 32, y: 18, rotation: 0 },
    ]);
    const [links, setLinks] = useState<PlannerLink[]>([
      { id: "l1", from: "recv", to: "rack", label: "Palettes" },
      { id: "l2", from: "rack", to: "shelf" },
      { id: "l3", from: "shelf", to: "pack", color: "#6faf82", label: "Préparation" },
      { id: "l4", from: "pack", to: "ship", dashed: true, label: "Prévu" },
    ]);
    const [linkMode, setLinkMode] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);
    return (
      <div style={{ ...frame, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13 }}>
          <button type="button" onClick={() => setLinkMode((m) => !m)} aria-pressed={linkMode}>
            {linkMode ? "Terminer le tracé" : "Tracer un flux"}
          </button>
          <span>{links.length} flux{selected ? ` · choisi : ${selected} (Suppr pour l'effacer)` : ""}</span>
        </div>
        <WarehousePlanner
          seed={3}
          shape="rect"
          plotSize={{ width: 42, depth: 24 }}
          items={items}
          onItemsChange={setItems}
          groundStyle="clean"
          links={links}
          linkMode={linkMode}
          canLink={(from, to) => (to === "tree" || from === "tree" ? "Un arbre ne reçoit pas de marchandise." : links.some((l) => l.from === from && l.to === to) ? "Ce flux existe déjà." : null)}
          onLink={(from, to) => setLinks((ls) => [...ls, { id: `l${Date.now()}`, from, to }])}
          selectedLinkId={selected}
          onLinkSelect={setSelected}
          onLinkRemove={(id) => {
            setLinks((ls) => ls.filter((l) => l.id !== id));
            setSelected(null);
          }}
          height="100%"
        />
      </div>
    );
  },
};

// --- Les zones, la voie d'accès, la clôture, le bandeau --------------------------------------------

/** Les usages qu'on donne à une zone dans l'histoire ci-dessous : un nom, une couleur. */
const ZONE_USES = [
  { kind: "storage", label: "Stockage", color: "var(--lq-color-sky)" },
  { kind: "picking", label: "Préparation", color: "var(--lq-color-green)" },
  { kind: "shipping", label: "Expédition", color: "var(--lq-color-amber)" },
] as const;

/**
 * Le zonage, comme dans Cities: Skylines. « Tracer une zone » : pressez sur le terrain et tirez —
 * l'élastique montre les cotes et la surface, et passe au rouge sur une zone refusée (ici, plus de
 * 600 m², ou à cheval sur une autre). Hors du mode de tracé, un clic sur une zone la choisit : les
 * boutons lui donnent un usage — elle perd ses hachures et prend sa couleur. Suppr l'efface. Le rack
 * posé dans la zone de stockage reste cliquable : les éléments passent avant les zones.
 */
export const Zonage: Story = {
  name: "Zonage",
  render: function Render() {
    const [items, setItems] = useState<PlannerItem[]>([{ id: "rack", kind: "palletRack", level: 2, x0: 6, y0: 8, x1: 14, y1: 8 }]);
    const [zones, setZones] = useState<PlannerZone[]>([
      { id: "z1", x: 4, y: 5, width: 12, depth: 7, assigned: true, kind: "storage", label: "Stockage", color: "var(--lq-color-sky)" },
      { id: "z2", x: 20, y: 5, width: 8, depth: 8 },
    ]);
    const [zoneMode, setZoneMode] = useState(false);
    const [selected, setSelected] = useState<string | null>("z2");
    const zone = zones.find((z) => z.id === selected);
    const overlaps = (r: { x: number; y: number; width: number; depth: number }) => zones.some((z) => r.x < z.x + z.width && z.x < r.x + r.width && r.y < z.y + z.depth && z.y < r.y + r.depth);
    return (
      <div style={{ ...frame, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setZoneMode((m) => !m)} aria-pressed={zoneMode}>
            {zoneMode ? "Terminer le zonage" : "Tracer une zone"}
          </button>
          {zone ? (
            <>
              <span>Zone choisie : {zone.label ?? "à affecter"} —</span>
              {ZONE_USES.map((u) => (
                <button key={u.kind} type="button" onClick={() => setZones((zs) => zs.map((z) => (z.id === zone.id ? { ...z, assigned: true, kind: u.kind, label: u.label, color: u.color } : z)))}>
                  Affecter : {u.label}
                </button>
              ))}
              <button type="button" onClick={() => setZones((zs) => zs.map((z) => (z.id === zone.id ? { id: z.id, x: z.x, y: z.y, width: z.width, depth: z.depth } : z)))}>
                Désaffecter
              </button>
              <button type="button" onClick={() => {
                setZones((zs) => zs.filter((z) => z.id !== zone.id));
                setSelected(null);
              }}>
                Supprimer
              </button>
            </>
          ) : (
            <span style={{ opacity: 0.7 }}>{zones.length} zones · cliquez une zone pour l'affecter</span>
          )}
        </div>
        <WarehousePlanner
          seed={4}
          shape="rect"
          plotSize={{ width: 40, depth: 24 }}
          items={items}
          onItemsChange={setItems}
          groundStyle="clean"
          zones={zones}
          zoneMode={zoneMode}
          canZone={(r) => (r.width * r.depth * 4 > 600 ? "Une zone fait au plus 600 m²." : overlaps(r) ? "Elle chevauche une autre zone." : null)}
          onZoneDraw={(r) => {
            const id = `z${Date.now()}`;
            setZones((zs) => [...zs, { id, ...r }]);
            setSelected(id);
          }}
          selectedZoneId={selected}
          onZoneSelect={setSelected}
          onZoneRemove={(id) => {
            setZones((zs) => zs.filter((z) => z.id !== id));
            setSelected(null);
          }}
          height="100%"
        />
      </div>
    );
  },
};

/**
 * Une voie d'accès raccordée à la rue, et des camions qui entrent par elle.
 *
 * - Au sud, une **voie double** (`accessRoad`, niveau 2) part du bord du terrain : le trottoir est
 *   ouvert en bateau et l'enrobé rejoint la chaussée. Les camions de l'expédition apparaissent sur la
 *   rue, à `accessRoadEntry`, et la remontent (`via` : `accessRoadRoute(…).slice(1)`) avant de reculer
 *   à quai.
 * - À l'ouest, une **voie simple** (niveau 1), raccordée elle aussi.
 * - Au nord, une **voie avec trottoirs** (niveau 3) posée loin du bord : ses bouts restent de simples
 *   bouts.
 * - Au nord-ouest, un **portail** de la clôture de pourtour : les camions de la réception passent par
 *   lui (`gateEntry`).
 */
export const VoieDAcces: Story = {
  name: "Voie d'accès et camions",
  render: function Render() {
    const plot = useMemo(() => generatePlot(5, { shape: "rect", width: 72, depth: 44 }), []);
    const [items, setItems] = useState<PlannerItem[]>(() => {
      const x0 = 20;
      const y0 = 10;
      const x1 = 44;
      const y1 = 34;
      return [
        { id: "south", kind: "wall", level: 2, x0, y0, x1, y1: y0 },
        { id: "east", kind: "dock", level: 2, x0: x1, y0, x1, y1 },
        { id: "north", kind: "wall", level: 2, x0: x1, y0: y1, x1: x0, y1 },
        { id: "west", kind: "dock", level: 2, x0, y0: y1, x1: x0, y1: y0 },
        { id: "ship", kind: "truckBay", level: 2, x: 49.55, y: 16, rotation: 180 },
        { id: "recv", kind: "truckBay", level: 1, x: 14.45, y: 26, rotation: 0 },
        { id: "road-south", kind: "accessRoad", level: 2, x0: 62, y0: 0, x1: 62, y1: 12 },
        { id: "road-west", kind: "accessRoad", level: 1, x0: 0, y0: 5, x1: 12, y1: 5 },
        { id: "road-north", kind: "accessRoad", level: 3, x0: 24, y0: 39, x1: 40, y1: 39 },
      ];
    });
    const [gates] = useState<PlannerGate[]>([{ id: "gate-nw", x: 4, y: 44, width: 3 }]);
    const [shipped, setShipped] = useState(0);
    const [received, setReceived] = useState(0);
    const [clean, setClean] = useState(true);
    useEffect(() => {
      const id = window.setInterval(() => {
        setShipped((n) => n + 3);
        setReceived((n) => n + 2);
      }, 1500);
      return () => window.clearInterval(id);
    }, []);
    const road = items.find((it) => it.id === "road-south");
    const route = road && "x0" in road ? accessRoadRoute(road, plot) : null;
    const gate = gateEntry(gates[0], plot);
    const bayOf = (id: string) => {
      const it = items.find((i) => i.id === id);
      return it && !("x0" in it) ? { x: it.x, y: it.y, rotation: it.rotation, bays: it.level ?? 1 } : null;
    };
    const ship = bayOf("ship");
    const recv = bayOf("recv");
    const shipRoute = route ? { entry: route[0], via: route.slice(1) } : undefined;
    const recvRoute = gate ? { entry: gate.entry, via: [gate.inside] } : undefined;
    const clearance = [
      ...(ship ? dockTrafficClearance(ship, shipRoute) : []),
      ...(recv ? dockTrafficClearance(recv, recvRoute) : []),
    ];
    return (
      <div style={{ ...frame, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13, flexWrap: "wrap" }}>
          <span>
            Entrée de l'expédition : {route ? `(${route[0].x.toFixed(2)}, ${route[0].y.toFixed(2)})` : "voie non raccordée"}
          </span>
          <span>Entrée de la réception : {gate ? `(${gate.entry.x.toFixed(2)}, ${gate.entry.y.toFixed(2)})` : "—"}</span>
          <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} />
            Sol propre
          </label>
          <span style={{ opacity: 0.7 }}>Déplacez la voie du sud : le raccordement suit, ou disparaît loin du bord.</span>
        </div>
        <WarehousePlanner
          seed={5}
          shape="rect"
          plotSize={{ width: 72, depth: 44 }}
          items={items}
          onItemsChange={setItems}
          groundStyle={clean ? "clean" : "site"}
          perimeterFence
          gates={gates}
          lightExclusions={clearance}
          treeExclusions={clearance}
          defaultView="3d"
          defaultZoom={1.3}
          height="100%"
          sceneChildren={
            <>
              {ship && <PlannerDockTraffic bay={ship} mode="ship" count={shipped} capacity={18} staging={{ x: 40, y: 16 }} entry={shipRoute?.entry} via={shipRoute?.via} />}
              {recv && <PlannerDockTraffic bay={recv} mode="receive" count={received} capacity={12} staging={{ x: 24, y: 26 }} entry={recvRoute?.entry} via={recvRoute?.via} />}
            </>
          }
        />
      </div>
    );
  },
};

/**
 * La clôture de pourtour et ses portails. Tout le terrain possédé est clos ; la parcelle à vendre
 * reste dehors — achetez-la, la clôture recule jusqu'au nouveau bord. Survolez la clôture : la place
 * d'un portail s'y dessine, rouge là où il ne peut pas aller (trop près d'un angle, d'un autre
 * portail, ou d'un côté sans rue). Un clic y perce un portail ; un clic sur un portail le choisit,
 * Suppr l'enlève. La voie d'accès du sud traverse la clôture : elle y fait son ouverture.
 */
export const ClotureEtPortails: Story = {
  name: "Clôture et portails",
  render: function Render() {
    const [items, setItems] = useState<PlannerItem[]>([{ id: "road", kind: "accessRoad", level: 2, x0: 18, y0: 0, x1: 18, y1: 10 }]);
    const [gates, setGates] = useState<PlannerGate[]>([{ id: "g1", x: 30, y: 26, width: 3 }]);
    const [selected, setSelected] = useState<string | null>(null);
    const [bought, setBought] = useState(false);
    const [last, setLast] = useState<string>("—");
    return (
      <div style={{ ...frame, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setBought((b) => !b)}>{bought ? "Revendre la parcelle" : "Acheter la parcelle est"}</button>
          <span>{gates.length} portail{gates.length > 1 ? "s" : ""}{selected ? ` · choisi : ${selected} (Suppr pour l'enlever)` : ""}</span>
          <span style={{ opacity: 0.7 }}>Dernier clic sur la clôture : {last}</span>
        </div>
        <WarehousePlanner
          seed={8}
          shape="rect"
          plotSize={{ width: 44, depth: 26 }}
          items={items}
          onItemsChange={setItems}
          groundStyle="clean"
          lockedAreas={bought ? [] : [{ id: "est", x: 34, y: 0, width: 10, depth: 26, label: "Parcelle est · 80 000 €" }]}
          perimeterFence
          gates={gates}
          onFenceSelect={(p) => {
            setLast(`${p.edge} (${p.x}, ${p.y}) — ${p.valid ? "portail possible" : p.reason}`);
            if (p.valid) setGates((gs) => [...gs, { id: `g${Date.now()}`, x: p.x, y: p.y, width: 3 }]);
          }}
          selectedGateId={selected}
          onGateSelect={setSelected}
          onGateRemove={(id) => {
            setGates((gs) => gs.filter((g) => g.id !== id));
            setSelected(null);
          }}
          defaultView="3d"
          defaultZoom={1.2}
          height="100%"
        />
      </div>
    );
  },
};

/** Les entrées d'une application de jeu, rangées par familles — pour le bandeau. */
const GAME_ENTRIES: PlannerPaletteEntry[] = [
  { id: "wall", label: "Mur", kind: "wall", length: 10, level: 2, group: "Infrastructure", meta: "1 200 €" },
  { id: "dock", label: "Mur de quai", kind: "dock", length: 12, level: 2, group: "Infrastructure", meta: "4 800 €" },
  { id: "office", label: "Bureaux", kind: "office", group: "Infrastructure", meta: "9 000 €" },
  { id: "rack", label: "Rack palettier", kind: "palletRack", length: 5.5, level: 2, group: "Stockage", meta: "6 500 €" },
  { id: "shelf", label: "Étagère", kind: "shelf", level: 2, group: "Stockage", meta: "1 500 €" },
  { id: "floor", label: "Stockage au sol", kind: "zone", level: 2, group: "Stockage", meta: "2 500 €" },
  { id: "cold", label: "Chambre froide", kind: "coldRoom", group: "Stockage", meta: "24 000 €", disabled: true },
  { id: "picker", label: "Préparateur", kind: "worker", group: "Picking", meta: "8 000 €" },
  { id: "amr", label: "Robot porteur", kind: "amr", level: 2, group: "Picking", meta: "18 000 €" },
  { id: "belt", label: "Tapis", kind: "conveyor", length: 6, level: 2, group: "Convoyage", meta: "4 000 €" },
  { id: "corner", label: "Tapis d'angle", kind: "conveyorCorner", level: 2, group: "Convoyage", meta: "1 800 €" },
  { id: "arm", label: "Bras robotisé", kind: "arm", level: 2, group: "Robotique", meta: "35 000 €" },
  { id: "delta", label: "Robot delta", kind: "delta", group: "Robotique", meta: "52 000 €", disabled: true },
  { id: "packer", label: "Filmeuse", kind: "packer", level: 3, group: "Emballage", meta: "6 000 €" },
  { id: "bay", label: "Quai camion", kind: "truckBay", level: 2, group: "Expédition", meta: "12 000 €" },
  { id: "road", label: "Voie d'accès", kind: "accessRoad", length: 12, level: 2, group: "Expédition", meta: "3 000 €" },
  { id: "solar", label: "Panneaux solaires", kind: "solar", level: 2, group: "Énergie", meta: "15 000 €" },
  { id: "transfo", label: "Transformateur", kind: "transformer", level: 2, group: "Énergie", meta: "22 000 €" },
  { id: "tree", label: "Arbre", kind: "tree", level: 2, group: "Extérieurs", meta: "300 €" },
  { id: "parking", label: "Parking", kind: "parking", level: 2, group: "Extérieurs", meta: "5 000 €" },
  { id: "roof", label: "Toiture", kind: "roof", group: "Toiture", meta: "8 000 €" },
  { id: "roofSolar", label: "Solaire en toiture", kind: "roofSolar", group: "Toiture", meta: "11 000 €" },
];

/**
 * Un écran de jeu : la palette en **bandeau** au bas de la scène (`paletteLayout="bottom"`), un onglet
 * en icône par famille, les vignettes de la famille au-dessus, la recherche au bout, le chevron qui
 * replie le bandeau. Par-dessus, dans le calque de l'application, le dock de navigation (`IconDock`)
 * en haut à gauche et les jauges de demande (`DemandMeters`) posées juste au-dessus du bandeau, grâce
 * à `--lq-planner-palette-height`.
 */
export const BandeauDePalette: Story = {
  name: "Palette en bandeau (écran de jeu)",
  render: function Render() {
    const [items, setItems] = useState<PlannerItem[]>([]);
    const [view, setView] = useState("warehouse");
    return (
      <div style={frame}>
        <WarehousePlanner
          seed={11}
          shape="rect"
          plotSize={{ width: 48, depth: 30 }}
          items={items}
          onItemsChange={setItems}
          entries={GAME_ENTRIES}
          paletteLayout="bottom"
          groundStyle="clean"
          perimeterFence
          showStatus={false}
          height="100%"
          renderOverlay={() => (
            <>
              <div style={{ position: "absolute", left: 8, top: 8, pointerEvents: "auto" }}>
                <IconDock
                  items={[
                    { id: "warehouse", label: "Entrepôt", icon: <BuildingWarehouseIcon />, active: view === "warehouse", onClick: () => setView("warehouse") },
                    { id: "ops", label: "Opérations", icon: <GaugeIcon />, active: view === "ops", onClick: () => setView("ops") },
                    { id: "orders", label: "Commandes", icon: <ClipboardListIcon />, badge: 3, active: view === "orders", onClick: () => setView("orders") },
                    { id: "stock", label: "Stocks", icon: <BoxesIcon />, active: view === "stock", onClick: () => setView("stock") },
                  ]}
                />
              </div>
              <div style={{ position: "absolute", left: 8, bottom: "calc(var(--lq-planner-palette-height, 0px) + 16px)", pointerEvents: "auto" }}>
                <DemandMeters
                  compact
                  meters={[
                    { id: "orders", label: "Commandes", icon: <ClipboardListIcon />, value: 0.62, tone: "good", detail: "144 commandes/h demandées pour 286/h de capacité" },
                    { id: "docks", label: "Quais", icon: <TruckIcon />, value: 0.91, tone: "warning", detail: "11 camions/h pour 12 de capacité" },
                    { id: "power", label: "Énergie", icon: <BoltIcon />, value: 1.12, tone: "critical", detail: "Consommation au-delà de l'abonnement" },
                  ]}
                />
              </div>
            </>
          )}
        />
      </div>
    );
  },
};

/** Le même écran sur un téléphone : bandeau resserré, onglets de 44 px, gestes au doigt. */
export const BandeauTelephone: Story = {
  ...BandeauDePalette,
  name: "Palette en bandeau, au téléphone",
  globals: { viewport: { value: "mobile2", isRotated: false } },
};

/* --- Camions sélectionnables ---------------------------------------------------------------------- */

const DOCK_ITEMS: PlannerItem[] = [
  { id: "south", kind: "wall", level: 2, x0: 16, y0: 8, x1: 40, y1: 8 },
  { id: "east", kind: "dock", level: 2, x0: 40, y0: 8, x1: 40, y1: 32 },
  { id: "north", kind: "wall", level: 2, x0: 40, y0: 32, x1: 16, y1: 32 },
  { id: "west", kind: "dock", level: 2, x0: 16, y0: 32, x1: 16, y1: 8 },
  { id: "rack1", kind: "palletRack", level: 2, x0: 19, y0: 12, x1: 30, y1: 12 },
  { id: "rack2", kind: "palletRack", level: 2, x0: 19, y0: 16, x1: 30, y1: 16 },
  { id: "ship", kind: "truckBay", level: 3, x: 45.55, y: 20, rotation: 180 },
  { id: "recv", kind: "truckBay", level: 2, x: 10.45, y: 20, rotation: 0 },
];

function TruckPicking({ fillLabel }: { fillLabel: "selected" | "always" }) {
  const [items, setItems] = useState<PlannerItem[]>(DOCK_ITEMS);
  const [shipped, setShipped] = useState(0);
  const [received, setReceived] = useState(0);
  const [night, setNight] = useState(0);
  const [plannerSel, setPlannerSel] = useState<string | null>("rack1");
  // Un seul camion choisi dans la scène : la place, et le quai où elle est.
  const [chosen, setChosen] = useState<{ bay: "ship" | "recv"; slot: number } | null>(null);
  const [info, setInfo] = useState<DockTruckInfo | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => {
      setShipped((n) => n + 2);
      setReceived((n) => n + 1);
    }, 1200);
    return () => window.clearInterval(id);
  }, []);
  const bayOf = (id: string) => {
    const it = items.find((i) => i.id === id);
    return it && !("x0" in it) ? { x: it.x, y: it.y, rotation: it.rotation, bays: it.level ?? 1 } : null;
  };
  const ship = bayOf("ship");
  const recv = bayOf("recv");
  const clearance = [ship, recv].flatMap((b) => (b ? dockTrafficClearance(b) : []));
  const selectOn = (bay: "ship" | "recv") => (t: DockTruckInfo | null) => {
    setChosen(t ? { bay, slot: t.slot } : null);
    setInfo(t);
  };
  const phase: Record<DockTruckInfo["phase"], string> = { arriving: "arrive", docking: "se met à quai", docked: "à quai", departing: "repart" };
  return (
    <div style={{ ...frame, display: "flex", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 360px", minWidth: 0, height: "100%", minHeight: 420 }}>
        <WarehousePlanner
          seed={5}
          shape="rect"
          plotSize={{ width: 60, depth: 40 }}
          items={items}
          onItemsChange={setItems}
          selectedId={plannerSel}
          onSelectedIdChange={setPlannerSel}
          night={night}
          groundStyle="clean"
          lightExclusions={clearance}
          treeExclusions={clearance}
          defaultView="3d"
          defaultZoom={1.4}
          height="100%"
          paletteLayout="bottom"
          sceneChildren={
            <>
              {ship && (
                <PlannerDockTraffic
                  bay={ship}
                  mode="ship"
                  count={shipped}
                  capacity={18}
                  staging={{ x: 36, y: 20 }}
                  selectedSlot={chosen?.bay === "ship" ? chosen.slot : null}
                  onTruckSelect={selectOn("ship")}
                  onSelectedTruckChange={setInfo}
                  fillLabel={fillLabel}
                />
              )}
              {recv && (
                <PlannerDockTraffic
                  bay={recv}
                  mode="receive"
                  count={received}
                  capacity={12}
                  unit="palettes"
                  staging={{ x: 20, y: 22 }}
                  selectedSlot={chosen?.bay === "recv" ? chosen.slot : null}
                  onTruckSelect={selectOn("recv")}
                  onSelectedTruckChange={setInfo}
                  fillLabel={fillLabel}
                />
              )}
            </>
          }
        />
      </div>
      <aside data-testid="truck-readout" style={{ flex: "0 1 240px", minWidth: 200, fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
        <strong>Camion choisi</strong>
        {info ? (
          <>
            <span>
              {info.mode === "ship" ? "Expédition" : "Réception"} · place {info.slot + 1} · {phase[info.phase]}
            </span>
            <span>
              Remplissage : <strong>{Math.round(info.fill * 100)} %</strong> ({info.load} / {info.capacity})
            </span>
          </>
        ) : (
          <span style={{ opacity: 0.7 }}>Touchez un camion pour voir son remplissage.</span>
        )}
        <span data-testid="planner-selection" style={{ opacity: 0.7 }}>
          Élément choisi sur le plan : {plannerSel ?? "aucun"}
        </span>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          Nuit
          <input type="range" min={0} max={1} step={0.05} value={night} onChange={(e) => setNight(Number(e.target.value))} />
        </label>
      </aside>
    </div>
  );
}

/**
 * Toucher un camion — tracteur ou remorque — le choisit : un liseré au sol l'entoure et une jauge
 * le suit, avec son remplissage (« 12 / 18 colis »). Un quai d'expédition (les camions se
 * remplissent) et un quai de réception (ils se vident, en palettes). Le plan garde sa propre
 * sélection (le rack) : toucher un camion ne la relâche pas et ne déplace rien.
 */
export const CamionsSelectionnables: Story = {
  name: "Camions : remplissage au toucher",
  render: () => <TruckPicking fillLabel="selected" />,
};

/** `fillLabel="always"` : une petite jauge sur chaque camion à quai, la grande sur celui qu'on choisit. */
export const CamionsJaugesPermanentes: Story = {
  name: "Camions : jauges permanentes",
  render: () => <TruckPicking fillLabel="always" />,
};

/* --- Façades : le contraste des murs et de ce qui y est posé ---------------------------------------- */

/**
 * Un petit bâtiment vu de près, pour juger le contraste des façades : un mur de quai et ses portes
 * sectionnelles (tablier bleu, bande jaune, butoirs, niveleurs), une porte de local, une fenêtre et
 * une baie vitrée sur le mur voisin. Le bardage est d'un gris moyen, distinct de la dalle et des
 * toits ; menuiseries et couvertine sombres cernent chaque ouverture. « Nuit » pour la voir éclairée.
 */
export const Facades: Story = {
  name: "Façades : contraste des murs",
  render: function Render() {
    const [items, setItems] = useState<PlannerItem[]>(() => [
      { id: "dock", kind: "dock", level: 2, x0: 10, y0: 14, x1: 28, y1: 14 },
      { id: "front", kind: "wall", level: 2, x0: 28, y0: 14, x1: 40, y1: 14 },
      { id: "east", kind: "wall", level: 2, x0: 40, y0: 14, x1: 40, y1: 30 },
      { id: "north", kind: "wall", level: 2, x0: 40, y0: 30, x1: 10, y1: 30 },
      { id: "west", kind: "wall", level: 2, x0: 10, y0: 30, x1: 10, y1: 14 },
      { id: "door1", kind: "door", x: 37, y: 14, rotation: 0 },
      { id: "win1", kind: "window", x: 33.5, y: 14, rotation: 0 },
      { id: "bay1", kind: "bay", level: 2, x: 30.5, y: 14, rotation: 0 },
    ]);
    const [night, setNight] = useState(0);
    return (
      <div style={{ ...frame, display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          Nuit
          <input type="range" min={0} max={1} step={0.05} value={night} onChange={(e) => setNight(Number(e.target.value))} />
        </label>
        <WarehousePlanner seed={3} shape="rect" plotSize={{ width: 50, depth: 36 }} items={items} onItemsChange={setItems} night={night} groundStyle="clean" defaultView="3d" defaultOrbit={{ yaw: 200, tilt: 24 }} defaultZoom={3.2} height="100%" />
      </div>
    );
  },
};

/* --- Décor réglable et compteur d'images --------------------------------------------------------- */

/**
 * Le décor autour du terrain, élément par élément, depuis `SCENERY_OPTIONS` — l'écran de
 * paramètres d'un jeu se construit de la même façon. Un élément décoché n'est ni monté ni animé.
 * Le compteur d'images (`fpsMeter`), en bas à droite, dit ce que cela change.
 */
export const DecorReglable: Story = {
  name: "Décor réglable et compteur d'images",
  render: function Render() {
    const [items, setItems] = useState<PlannerItem[]>(DOCK_ITEMS);
    const [scenery, setScenery] = useState<Partial<SceneryToggles>>({});
    return (
      <div style={{ ...frame, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
          {SCENERY_OPTIONS.map((o) => (
            <label key={o.key} title={o.description} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
              <input type="checkbox" checked={scenery[o.key] !== false} onChange={(e) => setScenery((s) => ({ ...s, [o.key]: e.target.checked }))} />
              {o.label}
              <small style={{ opacity: 0.6 }}>({o.costHint === "high" ? "coûteux" : o.costHint === "medium" ? "moyen" : "léger"})</small>
            </label>
          ))}
        </div>
        <WarehousePlanner seed={5} shape="rect" plotSize={{ width: 60, depth: 40 }} items={items} onItemsChange={setItems} scenery={scenery} fpsMeter defaultView="3d" height="100%" />
      </div>
    );
  },
};
