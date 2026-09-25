import { useEffect, useMemo, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { WarehousePlanner } from "./WarehousePlanner";
import type { PlannerItem } from "./plannerModel";
import { PlannerDockTraffic, PlannerShuttle, PlannerTransporter } from "./PlannerLogistics";
import { plannerObstacles } from "./aisleRoute";
import { dockLoadingPoints } from "./dockManeuver";
import { AllocationSlider } from "../widgets/AllocationSlider";
import { BoxesIcon, ForkliftIcon, TruckIcon } from "../icons";
import { useTraffic } from "./three/traffic";

/** Pour les tests : la circulation de la scène, lisible depuis la page. */
function Probe() {
  const traffic = useTraffic();
  useEffect(() => {
    (window as unknown as { __lqTraffic?: unknown }).__lqTraffic = traffic;
  }, [traffic]);
  return null;
}

/**
 * Une flotte partagée : un seul chariot élévateur pour trois tâches — décharger les camions, ranger
 * en rack, approvisionner le tapis — dont on règle le partage du temps en direct, et deux
 * transpalettes sur leurs propres flux.
 */
const meta: Meta<typeof WarehousePlanner> = {
  title: "Warehouse/Flotte partagée",
  component: WarehousePlanner,
  parameters: { layout: "fullscreen", isoCamera: false },
};
export default meta;
type Story = StoryObj<typeof WarehousePlanner>;

const BAY = { x: 20, y: 8.45, rotation: 90, bays: 1 };
const ITEMS: PlannerItem[] = [
  { id: "dock", kind: "dock", level: 2, x0: 12, y0: 14, x1: 40, y1: 14 },
  { id: "bay", kind: "truckBay", level: 1, x: BAY.x, y: BAY.y, rotation: BAY.rotation },
  { id: "rackA", kind: "palletRack", level: 2, x0: 16, y0: 25, x1: 32, y1: 25 },
  { id: "rackB", kind: "palletRack", level: 2, x0: 16, y0: 29, x1: 32, y1: 29 },
  { id: "belt", kind: "conveyor", level: 2, x0: 35, y0: 20, x1: 35, y1: 32 },
  { id: "zone", kind: "zone", level: 2, x: 17, y: 18.5, rotation: 0 },
];

const TASKS = [
  { id: "unload", label: "Décharger", icon: <TruckIcon size={10} /> },
  { id: "putaway", label: "Ranger en rack", icon: <BoxesIcon size={10} /> },
  { id: "feed", label: "Rack → tapis", icon: <ForkliftIcon size={10} /> },
];

declare global {
  interface Window {
    __lqFleet?: { shares: Record<string, number>; window: number };
    __lqSetShares?: (v: Record<string, number>) => void;
  }
}

/**
 * Le chariot choisit son prochain voyage parmi les tâches qui ont du travail : celle qui est le plus
 * en retard sur sa part. Le panneau mesure le temps réellement passé sur chacune (fenêtre glissante
 * de deux minutes) : il converge vers les parts réglées. Toucher le chariot le choisit — son nom, ses
 * trois routes et leurs parts apparaissent. Le quai n'a pas de chargeur (`loader="none"`) : c'est le
 * chariot, en déchargeant, qui vide le camion.
 */
export const UnChariotTroisTaches: Story = {
  name: "Un chariot, trois tâches",
  render: function Render() {
    const [items, setItems] = useState<PlannerItem[]>(ITEMS);
    const [shares, setShares] = useState<Record<string, number>>({ unload: 50, putaway: 30, feed: 20 });
    const [selected, setSelected] = useState(true);
    const [owed, setOwed] = useState({ unload: 0, putaway: 0, feed: 0, jackA: 0, jackB: 0 });
    const [unloaded, setUnloaded] = useState(0);
    const obstacles = useMemo(() => plannerObstacles(items, { except: ["zone"] }), [items]);
    const door = useMemo(() => dockLoadingPoints(BAY)[0], []);
    // Le jeu : du travail qui arrive plus vite qu'un seul chariot ne le fait — toutes les tâches en ont
    // toujours, et le partage se voit.
    useEffect(() => {
      const id = window.setInterval(() => setOwed((o) => ({ unload: o.unload + 1, putaway: o.putaway + 1, feed: o.feed + 1, jackA: o.jackA + 2, jackB: o.jackB + 2 })), 1500);
      return () => window.clearInterval(id);
    }, []);
    useEffect(() => {
      window.__lqSetShares = setShares;
    }, []);
    // La mesure : le temps passé sur chaque tâche, sur les deux dernières minutes.
    const log = useRef<{ at: number; task: string | null }[]>([]);
    const [measured, setMeasured] = useState<Record<string, number>>({});
    useEffect(() => {
      const id = window.setInterval(() => {
        const now = performance.now();
        const from = now - 120000;
        const acc: Record<string, number> = {};
        const L = log.current;
        for (let i = 0; i < L.length; i += 1) {
          const a = Math.max(from, L[i].at);
          const b = i + 1 < L.length ? L[i + 1].at : now;
          const task = L[i].task;
          if (b > a && task) acc[task] = (acc[task] ?? 0) + (b - a);
        }
        const tot = Object.values(acc).reduce((s, v) => s + v, 0) || 1;
        const out: Record<string, number> = {};
        for (const k of Object.keys(acc)) out[k] = acc[k] / tot;
        setMeasured(out);
        window.__lqFleet = { shares: out, window: Math.min(120, (now - (L[0]?.at ?? now)) / 1000) };
      }, 1000);
      return () => window.clearInterval(id);
    }, []);
    const total = TASKS.reduce((s, t) => s + (shares[t.id] ?? 0), 0) || 1;
    return (
      <div style={{ height: "calc(100dvh - 64px)", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 420px", minWidth: 0, height: "100%", minHeight: 420 }}>
          <WarehousePlanner
            seed={4}
            shape="rect"
            plotSize={{ width: 48, depth: 38 }}
            items={items}
            onItemsChange={setItems}
            groundStyle="clean"
            scenery={{ traffic: false }}
            defaultView="3d"
            defaultZoom={1.7}
            height="100%"
            paletteLayout="bottom"
            sceneChildren={
              <>
                <Probe />
                <PlannerDockTraffic bay={BAY} mode="receive" count={unloaded} capacity={4} staging={{ x: 18, y: 18 }} loader="none" unit="palettes" />
                <PlannerTransporter
                  id="chariot"
                  vehicle="forklift"
                  label="Chariot 1"
                  home={{ x: 26, y: 18 }}
                  obstacles={obstacles}
                  selected={selected}
                  onSelect={() => setSelected((v) => !v)}
                  showTasks
                  tasks={[
                    { id: "unload", label: "Décharger", from: door.apron, to: { x: 17, y: 18.5 }, share: (shares.unload ?? 0) / 100, trips: owed.unload },
                    { id: "putaway", label: "Ranger", from: { x: 17, y: 18.5 }, to: { x: 21, y: 23.2 }, share: (shares.putaway ?? 0) / 100, trips: owed.putaway },
                    { id: "feed", label: "Tapis", from: { x: 29, y: 27 }, to: { x: 33.4, y: 27 }, share: (shares.feed ?? 0) / 100, trips: owed.feed },
                  ]}
                  onActivity={(e) => log.current.push({ at: performance.now(), task: e.taskId })}
                  onTripDone={(e) => {
                    if (e.taskId === "unload") setUnloaded((n) => n + e.units);
                  }}
                />
                <PlannerShuttle vehicle="palletJack" from={{ x: 37.5, y: 31 }} to={{ x: 44, y: 20 }} trips={owed.jackA} batch={4} obstacles={obstacles} label="Transpalette A" />
                <PlannerShuttle vehicle="palletJack" from={{ x: 34, y: 18 }} to={{ x: 12, y: 33 }} trips={owed.jackB} batch={4} obstacles={obstacles} label="Transpalette B" />
              </>
            }
          />
        </div>
        <aside style={{ flex: "0 1 320px", minWidth: 260, display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
          <strong>Temps du chariot</strong>
          <AllocationSlider items={TASKS} values={shares} onChange={setShares} ariaLabel="Partage du temps du chariot" />
          <div data-testid="fleet-measure">
            <strong>Mesuré (2 min)</strong>
            {TASKS.map((t) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{t.label}</span>
                <span>
                  {Math.round((measured[t.id] ?? 0) * 100)} % <span style={{ opacity: 0.6 }}>(visé {Math.round(((shares[t.id] ?? 0) / total) * 100)} %)</span>
                </span>
              </div>
            ))}
          </div>
          <span style={{ opacity: 0.7 }}>Palettes déchargées : {unloaded}</span>
        </aside>
      </div>
    );
  },
};
