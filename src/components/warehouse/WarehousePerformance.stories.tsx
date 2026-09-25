import { Profiler, useEffect, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { addAfterEffect, addEffect, useThree } from "@react-three/fiber";
import { WarehousePlanner } from "./WarehousePlanner";
import { PlannerItem3D, rooftopSupport } from "./PlannerItem3D";
import { PlotScene } from "./BuildPlot";
import { generatePlot } from "./plot";
import { isRooftop, type PlannerItem } from "./plannerModel";
import { dockTrafficClearance } from "./dockManeuver";
import { PlannerDockTraffic, PlannerShuttle, type ShuttleVehicle } from "./PlannerLogistics";
import type { SceneQuality } from "./three/scene";

/**
 * Le banc d'essai de la scène 3D : **une partie comme on en joue**, pour mesurer ce qu'elle coûte.
 *
 * Environ cent trente éléments — le bâtiment, ses quais et son toit équipé, une vingtaine de racks,
 * des étagères, une ligne de tapis, le parking, les arbres, les candélabres, les panneaux solaires —,
 * deux parkings poids lourds où cinq camions vont et viennent, dix navettes qui roulent dans les
 * allées, la rue et sa circulation. C'est la scène qu'un téléphone doit tenir sans à-coups.
 *
 * La story ne fait pas que la montrer : une sonde, posée dans la scène, relève **chaque image
 * rendue** — l'instant où elle part, ce qu'elle a coûté au processeur, ses appels de dessin, sa
 * densité de pixels — dans `window.__lqPerf`, et un `Profiler` React compte les rendus. Un script
 * (Chrome sans tête, un téléphone émulé, le processeur bridé) lit ces relevés : c'est ainsi qu'on
 * mesure au lieu de deviner.
 */
const meta: Meta = {
  title: "Warehouse/Performance",
  parameters: { layout: "fullscreen", isoCamera: false },
};
export default meta;

/** Les relevés de la sonde, lus par le script de mesure. */
interface PerfLog {
  /** L'instant (`performance.now()`) de la première image rendue. */
  first: number | null;
  frames: { t: number; cpu: number; calls: number; triangles: number; dpr: number; shadows: boolean; cam: number }[];
  commits: number;
  commitMs: number;
}

declare global {
  interface Window {
    __lqPerf?: PerfLog;
  }
}

function perfLog(): PerfLog {
  if (!window.__lqPerf) window.__lqPerf = { first: null, frames: [], commits: 0, commitMs: 0 };
  return window.__lqPerf;
}

/**
 * La sonde : posée dans la scène, elle encadre chaque tour de la boucle de rendu — de l'avant des
 * animations à l'après du dessin — et note ce que le moteur a envoyé à la carte graphique. Elle ne
 * s'inscrit pas à l'horloge : une scène au repos reste au repos, et c'est justement ce qu'on vérifie.
 */
function PerfProbe() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const log = perfLog();
    (window as unknown as { __lqScene?: unknown }).__lqScene = scene;
    let start = 0;
    const off1 = addEffect((t) => {
      start = performance.now();
      void t;
    });
    const off2 = addAfterEffect(() => {
      const now = performance.now();
      if (log.first === null) log.first = now;
      const info = gl.info.render;
      log.frames.push({ t: start, cpu: now - start, calls: info.calls, triangles: info.triangles, dpr: gl.getPixelRatio(), shadows: gl.shadowMap.enabled, cam: Math.round(camera.position.x * 100) / 100 });
      if (log.frames.length > 4000) log.frames.splice(0, 2000);
    });
    return () => {
      off1();
      off2();
    };
  }, [gl, scene, camera]);
  return null;
}

const onCommit = (_id: string, _phase: string, actual: number) => {
  const log = perfLog();
  log.commits += 1;
  log.commitMs += actual;
};

/** Le plan de la partie : environ 130 éléments, disposés comme un joueur les aurait posés. */
function tutorialItems(): PlannerItem[] {
  const X0 = 18;
  const X1 = 50;
  const Y0 = 8;
  const Y1 = 36;
  const out: PlannerItem[] = [
    { id: "s1", kind: "wall", level: 2, x0: X0, y0: Y0, x1: 34, y1: Y0 },
    { id: "s2", kind: "wall", level: 3, x0: 34, y0: Y0, x1: X1, y1: Y0 },
    { id: "n1", kind: "wall", level: 2, x0: X1, y0: Y1, x1: 34, y1: Y1 },
    { id: "n2", kind: "wall", level: 2, x0: 34, y0: Y1, x1: X0, y1: Y1 },
    { id: "east", kind: "dock", level: 2, x0: X1, y0: Y0, x1: X1, y1: Y1 },
    { id: "west", kind: "dock", level: 2, x0: X0, y0: Y1, x1: X0, y1: Y0 },
    { id: "win1", kind: "window", x: 24, y: Y0, rotation: 0 },
    { id: "win2", kind: "window", x: 30, y: Y0, rotation: 0 },
    { id: "door1", kind: "door", x: 40, y: Y0, rotation: 0 },
    // Le toit sur la moitié nord : on voit dedans par la moitié sud.
    { id: "roof", kind: "roof", level: 2, x: 34, y: 29, rotation: 0, size: { length: 32, width: 14 } },
    { id: "pv1", kind: "roofSolar", level: 2, x: 26, y: 30, rotation: 0 },
    { id: "pv2", kind: "roofSolar", level: 2, x: 42, y: 30, rotation: 0 },
    { id: "hvac1", kind: "hvac", level: 2, x: 30, y: 34, rotation: 0 },
    { id: "hvac2", kind: "hvac", level: 2, x: 38, y: 34, rotation: 0 },
  ];
  // Vingt racks : trois colonnes, sous le toit et devant.
  let r = 0;
  for (const y of [16, 18.8, 21.6, 24, 26.8, 29.6, 32.4])
    for (const [a, b] of [
      [20, 27],
      [29, 36],
      [38, 45],
    ]) {
      if (r >= 20) break;
      out.push({ id: `rack${r}`, kind: "palletRack", level: 2, x0: a, y0: y, x1: b, y1: y });
      r += 1;
    }
  // Dix étagères, en deux rangées le long de la façade.
  for (let i = 0; i < 10; i += 1) out.push({ id: `shelf${i}`, kind: "shelf", level: 1 + (i % 2), x: 21 + (i % 5) * 4.6, y: i < 5 ? 10.6 : 12.9, rotation: 0 });
  // La ligne de tapis, le long du quai d'expédition.
  out.push(
    { id: "belt1", kind: "conveyor", level: 2, x0: 47.5, y0: 10, x1: 47.5, y1: 16 },
    { id: "belt2", kind: "conveyor", level: 2, x0: 47.5, y0: 16, x1: 47.5, y1: 21 },
    { id: "tee", kind: "conveyorTee", level: 2, x: 47.5, y: 21.8, rotation: 90 },
    { id: "belt3", kind: "conveyor", level: 3, x0: 47.5, y0: 22.6, x1: 47.5, y1: 28 },
    { id: "belt4", kind: "conveyor", level: 2, x0: 47.5, y0: 28, x1: 47.5, y1: 33 },
    { id: "corner", kind: "conveyorCorner", level: 2, x: 47.5, y: 33.8, rotation: 90 },
    { id: "belt5", kind: "conveyor", level: 1, x0: 46.7, y0: 33.8, x1: 43, y1: 33.8 },
    { id: "belt6", kind: "conveyor", level: 1, x0: 46.7, y0: 21.8, x1: 44, y1: 21.8 }
  );
  // Dedans : des engins garés, des zones au sol.
  out.push(
    { id: "zone1", kind: "zone", level: 2, x: 23, y: 20.5, rotation: 0 },
    { id: "fk1", kind: "forklift", x: 32, y: 14.5, rotation: 0 },
    { id: "fk2", kind: "forklift", level: 2, x: 40, y: 14.5, rotation: 180 },
    { id: "amr1", kind: "amr", level: 2, x: 44.5, y: 12, rotation: 90 },
    { id: "wk1", kind: "worker", x: 36.5, y: 11.8, rotation: 0 },
    { id: "wk2", kind: "worker", x: 44, y: 18, rotation: 90 }
  );
  // Dehors, au sud : le parking du personnel, des parterres, un poste électrique.
  out.push(
    { id: "park1", kind: "parking", level: 2, x: 24, y: 3.6, rotation: 0 },
    { id: "park2", kind: "parking", level: 3, x: 32, y: 3.6, rotation: 0 },
    { id: "flow1", kind: "flowerBed", level: 2, x: 40, y: 5.5, rotation: 0 },
    { id: "flow2", kind: "flowerBed", level: 3, x: 45, y: 5, rotation: 0 },
    { id: "transfo", kind: "transformer", level: 2, x: 8, y: 42, rotation: 0 },
    { id: "cont1", kind: "container", level: 2, x: 66, y: 38, rotation: 90 },
    { id: "cont2", kind: "container", level: 1, x: 69, y: 38, rotation: 90 },
    { id: "solar1", kind: "solar", level: 2, x: 30, y: 42, rotation: 0 },
    { id: "solar2", kind: "solar", level: 1, x: 44, y: 42, rotation: 0 },
    { id: "line", kind: "powerLine", level: 1, x0: 2, y0: 46, x1: 74, y1: 46 }
  );
  // Les deux parkings poids lourds, face aux quais.
  out.push({ id: "ship", kind: "truckBay", level: 3, x: X1 + 5.55, y: 22, rotation: 180 }, { id: "recv", kind: "truckBay", level: 2, x: X0 - 5.55, y: 22, rotation: 0 });
  // Les candélabres de la cour, la clôture de l'est.
  for (const [i, [x, y]] of [
    [16, 4],
    [52, 4],
    [16, 40],
    [52, 40],
    [60, 10],
    [60, 34],
    [4, 10],
    [4, 34],
  ].entries())
    out.push({ id: `light${i}`, kind: "light", level: i < 4 ? 2 : 3, x, y, rotation: 0 });
  for (let i = 0; i < 4; i += 1) out.push({ id: `fence${i}`, kind: "fence", level: 2, x0: 74, y0: 2 + i * 10, x1: 74, y1: 12 + i * 10 });
  // Des arbres et des massifs tout autour.
  const green: [number, number][] = [];
  for (let x = 3; x <= 72; x += 7.5) green.push([x, 1.4]);
  for (let y = 12; y <= 36; y += 6) green.push([66, y], [71, y]);
  for (let y = 16; y <= 32; y += 8) green.push([2, y]);
  for (const [i, [x, y]] of green.entries()) out.push({ id: `g${i}`, kind: i % 3 === 2 ? "shrub" : "tree", level: 1 + (i % 3), x, y, rotation: 0 });
  return out;
}

/** Les dix navettes : dans chaque allée, et dans la cour. */
const SHUTTLES: { vehicle: ShuttleVehicle; from: { x: number; y: number }; to: { x: number; y: number }; batch: number; load?: "carton" | "palette" }[] = [
  { vehicle: "palletJack", from: { x: 21, y: 25.4 }, to: { x: 44, y: 25.4 }, batch: 4 },
  { vehicle: "worker", from: { x: 21, y: 28.2 }, to: { x: 44, y: 28.2 }, batch: 1 },
  { vehicle: "amr", from: { x: 21, y: 31 }, to: { x: 44, y: 31 }, batch: 2, load: "palette" },
  { vehicle: "forklift", from: { x: 21, y: 34.2 }, to: { x: 42, y: 34.2 }, batch: 3 },
  { vehicle: "palletJack", from: { x: 21, y: 14.6 }, to: { x: 44, y: 14.6 }, batch: 4 },
  { vehicle: "worker", from: { x: 21, y: 17.4 }, to: { x: 44, y: 17.4 }, batch: 1 },
  { vehicle: "amr", from: { x: 21, y: 20.2 }, to: { x: 36, y: 20.2 }, batch: 2 },
  { vehicle: "worker", from: { x: 46, y: 10 }, to: { x: 46, y: 34 }, batch: 1 },
  { vehicle: "palletJack", from: { x: 45.5, y: 23 }, to: { x: 38, y: 23 }, batch: 4 },
  { vehicle: "forklift", from: { x: 20, y: 6.3 }, to: { x: 46, y: 6.3 }, batch: 3 },
];

interface PerfArgs {
  /** La qualité de rendu demandée. */
  quality: SceneQuality;
  /** Les compteurs tournent : les camions et les navettes travaillent. */
  running: boolean;
  /** La circulation sur la rue. */
  traffic: number;
}

function useCounters(running: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setN((v) => v + 1), 1200);
    return () => window.clearInterval(id);
  }, [running]);
  return n;
}

/** Les engins de la partie : les deux quais et les dix navettes, pilotés par un même compteur. */
function Logistics({ tick, items }: { tick: number; items: PlannerItem[] }) {
  const bayOf = (id: string) => {
    const it = items.find((i) => i.id === id);
    return it && !("x0" in it) ? { x: it.x, y: it.y, rotation: it.rotation, bays: it.level ?? 1 } : null;
  };
  const ship = bayOf("ship");
  const recv = bayOf("recv");
  return (
    <>
      <PerfProbe />
      {ship && <PlannerDockTraffic bay={ship} mode="ship" count={tick * 3} capacity={18} roadSpeed={0.64} staging={{ x: 48.5, y: 22 }} />}
      {recv && <PlannerDockTraffic bay={recv} mode="receive" count={tick * 2} capacity={12} roadSpeed={0.64} staging={{ x: 19.5, y: 22 }} />}
      {SHUTTLES.map((s, i) => (
        <PlannerShuttle key={i} vehicle={s.vehicle} from={s.from} to={s.to} trips={tick * s.batch} batch={s.batch} load={s.load} speed={s.vehicle === "worker" ? 1.4 : 2.2} label={`Navette ${i + 1}`} />
      ))}
    </>
  );
}

/**
 * La partie en cours, plein écran : c'est la scène qu'on mesure. `running` fait tourner les
 * compteurs (les camions et les navettes travaillent), `traffic` règle la rue, `quality` la
 * qualité de rendu.
 */
export const Scene: StoryObj<PerfArgs> = {
  name: "Une partie complète",
  args: { quality: "auto", running: true, traffic: 0.6 },
  argTypes: {
    quality: { control: "inline-radio", options: ["auto", "high", "low"] },
    traffic: { control: { type: "range", min: 0, max: 1, step: 0.05 } },
  },
  render: function Render({ quality, running, traffic }) {
    const items = useMemo(tutorialItems, []);
    const tick = useCounters(running);
    const clearance = useMemo(
      () =>
        items
          .filter((i) => i.kind === "truckBay" && !("x0" in i))
          .flatMap((i) => ("x0" in i ? [] : dockTrafficClearance({ x: i.x, y: i.y, rotation: i.rotation, bays: i.level ?? 1 }))),
      [items]
    );
    return (
      <Profiler id="planner" onRender={onCommit}>
        <div style={{ height: "100dvh" }}>
          <style>{".lq-perf { grid-template-columns: minmax(0, 1fr) !important; } .lq-perf .lq-planner__palette, .lq-perf .lq-planner__hint { display: none !important; }"}</style>
          <WarehousePlanner
            className="lq-perf"
            seed={5}
            shape="rect"
            plotSize={{ width: 76, depth: 48 }}
            items={items}
            traffic={traffic}
            groundStyle="clean"
            quality={quality}
            lightExclusions={clearance}
            treeExclusions={clearance}
            defaultView="3d"
            defaultZoom={1.25}
            showInspector={false}
            showStatus={false}
            readOnly
            height="100%"
            sceneChildren={<Logistics tick={tick} items={items} />}
          />
        </div>
      </Profiler>
    );
  },
};

/**
 * La même partie **au repos** : les engins garés, pas de tapis chargés, pas de rue animée. Une scène
 * au repos ne doit rien coûter : après sa première image, la toile ne se redessine plus du tout.
 */
export const Idle: StoryObj<PerfArgs> = {
  name: "La même partie, au repos",
  args: { quality: "auto" },
  argTypes: { quality: { control: "inline-radio", options: ["auto", "high", "low"] } },
  render: function Render({ quality }) {
    // Sans ce qui tourne en continu — les tapis chargés, la rue —, tout le reste est immobile.
    const items = useMemo(() => tutorialItems().filter((i) => !i.kind.startsWith("conveyor")), []);
    const plot = useMemo(() => generatePlot(5, { shape: "rect", width: 76, depth: 48 }), []);
    return (
      <Profiler id="idle" onRender={onCommit}>
        <PlotScene layout={plot} traffic={false} groundStyle="clean" cellSize={5} quality={quality}>
          {items.map((it) => (
            <PlannerItem3D key={it.id} item={it} support={isRooftop(it) ? rooftopSupport(it, items) : undefined} />
          ))}
          <Logistics tick={0} items={items} />
        </PlotScene>
      </Profiler>
    );
  },
};
