import { useEffect, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { useFrame } from "@react-three/fiber";
import { WarehousePlanner } from "./WarehousePlanner";
import { generatePlot } from "./plot";
import type { PlannerItem } from "./plannerModel";
import { PlannerDockTraffic, PlannerShuttle } from "./PlannerLogistics";
import { plannerObstacles, type AisleObstacle } from "./aisleRoute";
import { gateEntry, type PlannerGate } from "./accessRoad";
import { streetRoute } from "./streetRoute";
import { truckBoxes } from "./dockManeuver";
import { boxCorners, boxesOverlap, useTraffic, type OrientedBox } from "./three/traffic";
import { semiTruckGeometry } from "./SemiTruck";

/**
 * La circulation dans l'entrepôt : des engins qui **contournent** les racks par les allées et se
 * laissent passer, et des camions qui viennent **par les rues**, franchissent le portail un par un
 * et manœuvrent chacun à leur tour dans la cour.
 */
const meta: Meta<typeof WarehousePlanner> = {
  title: "Warehouse/Circulation",
  component: WarehousePlanner,
  parameters: { layout: "fullscreen", isoCamera: false },
};
export default meta;
type Story = StoryObj<typeof WarehousePlanner>;

const frame = { height: "calc(100dvh - 64px)" };

/** Un compteur qui monte tout seul, comme le ferait un jeu. */
function useTicker(every: number, step = 1) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setN((v) => v + step), every);
    return () => window.clearInterval(id);
  }, [every, step]);
  return n;
}

// --- Une sonde pour les vérifications ------------------------------------------------------------------

type Sample = { t: number; vehicles: { id: string; discs: { x: number; y: number }[]; r: number; m?: number; w?: boolean; p?: number }[]; trucks: { id: string; boxes: OrientedBox[] }[] };
declare global {
  interface Window {
    __lqTrafficSamples?: Sample[];
  }
}

const TRUCK = semiTruckGeometry();
const DISC_R = TRUCK.width / 2 + 0.06;
const TRAILER_U0 = -TRUCK.kingpin + DISC_R * 0.6;

/**
 * Ce que la circulation de la scène sait, relevé à chaque image dans `window.__lqTrafficSamples` :
 * les disques des engins, et les rectangles des camions (reconstruits depuis leur chenille). Pour
 * les tests : on vérifie ensuite qu'aucun ne traverse un obstacle, une clôture ou un autre.
 */
function TrafficProbe() {
  const traffic = useTraffic();
  useEffect(() => {
    (window as unknown as { __lqTraffic?: unknown }).__lqTraffic = traffic;
  }, [traffic]);
  useFrame((state) => {
    const out: Sample = { t: state.clock.elapsedTime, vehicles: [], trucks: [] };
    for (const a of traffic.agents) {
      if (a.ghost) continue;
      if (a.kind === "truck") {
        const d = a.body.discs;
        const tractor = Math.atan2(d[1].y - d[0].y, d[1].x - d[0].x);
        const trailer = Math.atan2(d[7].y - d[2].y, d[7].x - d[2].x);
        const kx = d[2].x - Math.cos(trailer) * TRAILER_U0;
        const ky = d[2].y - Math.sin(trailer) * TRAILER_U0;
        out.trucks.push({ id: a.id, boxes: truckBoxes(kx, ky, tractor, trailer, 0) });
      } else out.vehicles.push({ id: a.id, discs: a.body.discs.map((p) => ({ ...p })), r: a.body.radius, m: a.motion, w: a.waiting, p: a.priority });
    }
    const list = (window.__lqTrafficSamples ??= []);
    list.push(out);
    if (list.length > 20000) list.shift();
  });
  return null;
}

/** Les vérifications, dans la page : rien dans un obstacle, personne dans personne, pas de clôture franchie. */
function checkSamples(samples: Sample[], obstacles: AisleObstacle[], fence?: { segments: [{ x: number; y: number }, { x: number; y: number }][]; gaps: { a: { x: number; y: number }; b: { x: number; y: number } }[] }) {
  let obstacleHits = 0;
  let vehicleHits = 0;
  let truckHits = 0;
  let fenceHits = 0;
  const rectDist = (p: { x: number; y: number }, o: AisleObstacle) => {
    const th = ((o.rotation ?? 0) * Math.PI) / 180;
    const px = p.x - o.x;
    const py = p.y - o.y;
    const u = Math.abs(px * Math.cos(th) + py * Math.sin(th)) - o.width / 2;
    const v = Math.abs(-px * Math.sin(th) + py * Math.cos(th)) - o.depth / 2;
    return u <= 0 && v <= 0 ? -Math.min(-u, -v) : Math.hypot(Math.max(0, u), Math.max(0, v));
  };
  for (const s of samples) {
    for (const v of s.vehicles) for (const d of v.discs) for (const o of obstacles) if (rectDist(d, o) < v.r * 0.55) obstacleHits += 1;
    for (let i = 0; i < s.vehicles.length; i += 1)
      for (let j = i + 1; j < s.vehicles.length; j += 1) {
        const a = s.vehicles[i];
        const b = s.vehicles[j];
        if (a.discs.some((p) => b.discs.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < (a.r + b.r) * 0.75))) vehicleHits += 1;
      }
    for (let i = 0; i < s.trucks.length; i += 1)
      for (let j = i + 1; j < s.trucks.length; j += 1) if (s.trucks[i].boxes.some((p) => s.trucks[j].boxes.some((q) => boxesOverlap(p, q)))) truckHits += 1;
    if (fence)
      for (const tr of s.trucks)
        for (const b of tr.boxes) {
          const c = boxCorners(b);
          const edges = c.map((p, k) => [p, c[(k + 1) % 4]] as const);
          for (const [f0, f1] of fence.segments)
            for (const [e0, e1] of edges) {
              const hit = segHit(f0, f1, e0, e1);
              if (!hit) continue;
              const inGap = fence.gaps.some((g) => onSeg(hit, g.a, g.b));
              if (!inGap) fenceHits += 1;
            }
        }
  }
  return { samples: samples.length, obstacleHits, vehicleHits, truckHits, fenceHits };
}

if (typeof window !== "undefined") (window as unknown as { __lqCheck?: typeof checkSamples }).__lqCheck = checkSamples;

function segHit(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a.x + r.x * t, y: a.y + r.y * t };
}
function onSeg(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const l = Math.hypot(b.x - a.x, b.y - a.y);
  const d = Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / (l || 1);
  const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / ((l || 1) * (l || 1));
  return d < 0.3 && t >= -0.02 && t <= 1.02;
}

// --- Des engins dans les allées -------------------------------------------------------------------------

const RACK_ROWS: PlannerItem[] = [12, 16, 20, 24].map((y, i) => ({ id: `row${i}`, kind: "palletRack", level: 2, x0: 14, y0: y, x1: 34, y1: y }));

/**
 * Quatre rangées de racks et quatre flux tracés à travers : deux chariots qui se croisent en
 * diagonale, un transpalette qui traverse, un autre qui doit aller de part et d'autre des rangées.
 * Chacun **contourne** par les allées (`obstacles={plannerObstacles(items)}`), au milieu, en
 * gardant sa droite ; quand deux engins se trouvent sur le même chemin, le moins prioritaire (à vide)
 * ralentit et attend.
 */
export const DansLesAllees: Story = {
  name: "Engins dans les allées",
  render: function Render() {
    const [items, setItems] = useState<PlannerItem[]>(RACK_ROWS);
    const obstacles = useMemo(() => plannerObstacles(items), [items]);
    const trips = useTicker(1400);
    useEffect(() => {
      (window as unknown as { __lqObstacles?: AisleObstacle[] }).__lqObstacles = obstacles;
    }, [obstacles]);
    return (
      <div style={frame}>
        <WarehousePlanner
          seed={4}
          shape="rect"
          plotSize={{ width: 48, depth: 36 }}
          items={items}
          onItemsChange={setItems}
          groundStyle="clean"
          defaultView="3d"
          defaultZoom={1.6}
          height="100%"
          scenery={{ traffic: false }}
          sceneChildren={
            <>
              <TrafficProbe />
              <PlannerShuttle vehicle="forklift" from={{ x: 10, y: 14 }} to={{ x: 38, y: 22 }} trips={trips} batch={1} load="palette" obstacles={obstacles} label="Chariot A" />
              <PlannerShuttle vehicle="forklift" from={{ x: 38, y: 14 }} to={{ x: 10, y: 22 }} trips={trips} batch={1} load="palette" obstacles={obstacles} label="Chariot B" />
              <PlannerShuttle vehicle="palletJack" from={{ x: 11, y: 27 }} to={{ x: 37, y: 9 }} trips={trips} batch={4} obstacles={obstacles} label="Transpalette C" />
              <PlannerShuttle vehicle="palletJack" from={{ x: 24, y: 8 }} to={{ x: 24, y: 28 }} trips={trips} batch={4} obstacles={obstacles} label="Transpalette D" />
            </>
          }
        />
      </div>
    );
  },
};

/**
 * Le cas d'école : le départ et l'arrivée de part et d'autre d'une longue rangée de racks. En ligne
 * droite, le chariot passerait au travers ; il en fait le tour.
 */
export const Contournement: Story = {
  name: "Contourner une rangée",
  render: function Render() {
    const [items, setItems] = useState<PlannerItem[]>([{ id: "long", kind: "palletRack", level: 3, x0: 8, y0: 18, x1: 38, y1: 18 }]);
    const obstacles = useMemo(() => plannerObstacles(items), [items]);
    const trips = useTicker(1200);
    useEffect(() => {
      (window as unknown as { __lqObstacles?: AisleObstacle[] }).__lqObstacles = obstacles;
    }, [obstacles]);
    return (
      <div style={frame}>
        <WarehousePlanner
          seed={4}
          shape="rect"
          plotSize={{ width: 48, depth: 36 }}
          items={items}
          onItemsChange={setItems}
          groundStyle="clean"
          defaultView="3d"
          defaultZoom={1.6}
          height="100%"
          scenery={{ traffic: false }}
          sceneChildren={
            <>
              <TrafficProbe />
              <PlannerShuttle vehicle="forklift" from={{ x: 22, y: 15 }} to={{ x: 22, y: 21 }} trips={trips} batch={1} load="palette" obstacles={obstacles} label="Chariot" />
            </>
          }
        />
      </div>
    );
  },
};

// --- Des camions qui viennent par les rues ------------------------------------------------------------------

const YARD_W = 70;
const YARD_D = 50;

/**
 * Trois quais côte à côte, un par `PlannerDockTraffic` (comme un jeu les monte), servis par un seul
 * portail au sud. Chaque camion apparaît **au bord de la carte**, roule dans sa voie par les rues
 * (`streetRoute`), attend son tour avant le portail — qui s'ouvre à son approche (`open: "auto"`) —
 * et ne manœuvre dans la cour que quand elle est libre : les trois ne reculent jamais ensemble. Les
 * départs rendent la cour de même, et repartent par les rues jusqu'au bord de la carte. Le terrain
 * clos (`bounds`) et le portail (`openings`) bornent la manœuvre : aucun camion ne franchit la clôture
 * ailleurs.
 */
export const CamionsParLesRues: Story = {
  name: "Camions par les rues, un portail, trois quais",
  render: function Render() {
    const plot = useMemo(() => generatePlot(9, { shape: "rect", width: YARD_W, depth: YARD_D }), []);
    const gate: PlannerGate = { id: "g", x: 21, y: 0, width: 8, open: "auto" };
    const ge = useMemo(() => gateEntry(gate, plot), [plot]); // eslint-disable-line react-hooks/exhaustive-deps
    const approach = useMemo(() => (ge ? streetRoute(plot, ge) : []), [plot, ge]);
    const leave = useMemo(() => (ge ? streetRoute(plot, ge, { direction: "out" }) : []), [plot, ge]);
    const bays = [16, 21, 26].map((x, i) => ({ id: `bay${i}`, x, y: 34, rotation: 90, bays: 1 }));
    const [items, setItems] = useState<PlannerItem[]>(() => [
      { id: "dockwall", kind: "dock", level: 2, x0: 10, y0: 39.6, x1: 34, y1: 39.6 },
      ...bays.map((b) => ({ id: b.id, kind: "truckBay" as const, level: 1, x: b.x, y: b.y, rotation: b.rotation })),
    ]);
    const shipped = useTicker(700, 3);
    const bounds = [{ x: 0, y: 0, width: YARD_W, depth: YARD_D }];
    const openings = [{ x: gate.x, y: gate.y, width: gate.width ?? 3, edge: "south" as const }];
    const [problems, setProblems] = useState<string[]>([]);
    useEffect(() => {
      // Pour les tests : la clôture et son ouverture.
      (window as unknown as { __lqFence?: unknown }).__lqFence = {
        segments: [
          [{ x: 0, y: 0 }, { x: YARD_W, y: 0 }],
          [{ x: YARD_W, y: 0 }, { x: YARD_W, y: YARD_D }],
          [{ x: YARD_W, y: YARD_D }, { x: 0, y: YARD_D }],
          [{ x: 0, y: YARD_D }, { x: 0, y: 0 }],
        ],
        gaps: [{ a: { x: gate.x - (gate.width ?? 3) / 2, y: 0 }, b: { x: gate.x + (gate.width ?? 3) / 2, y: 0 } }],
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return (
      <div style={{ ...frame, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 13 }}>
          Expédiés : {shipped} {problems.length > 0 && <span style={{ color: "var(--lq-color-danger)" }}> · {problems.join(" · ")}</span>}
        </div>
        <WarehousePlanner
          seed={9}
          shape="rect"
          plotSize={{ width: YARD_W, depth: YARD_D }}
          items={items}
          onItemsChange={setItems}
          groundStyle="clean"
          perimeterFence
          gates={[gate]}
          defaultView="3d"
          defaultZoom={1}
          height="100%"
          sceneChildren={
            <>
              <TrafficProbe />
              {ge &&
                bays.map((b) => (
                  <PlannerDockTraffic
                    key={b.id}
                    bay={b}
                    mode="ship"
                    count={shipped}
                    capacity={9}
                    staging={{ x: b.x, y: 43 }}
                    entry={ge.entry}
                    via={[ge.inside]}
                    approach={approach}
                    leave={leave}
                    bounds={bounds}
                    openings={openings}
                    onYardProblem={(e) => setProblems((p) => [...p, `${b.id} : ${e.problem.message}`])}
                  />
                ))}
            </>
          }
        />
      </div>
    );
  },
};
