import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";
import { Builder } from "./three/builder";
import { Parts, Solo, useBuilt, type Bounds } from "./three/scene";
import { useSimFrame } from "./three/time";
import { Mover, type MoverStyle, type MoverTask } from "./three/mover";
import { planDock } from "./dockManeuver";
import { addGood } from "./three/goods";
import { PALLET_JACK_LENGTH, PALLET_JACK_WIDTH, PalletJackBody, addHaul, type HaulLoad } from "./PalletJack";
import { Forklift } from "./Forklift";
import { Worker } from "./Worker";
import { Amr } from "./Amr";
import { SemiTruck, semiTruckGeometry } from "./SemiTruck";
import { TRUCK_BAY_LENGTH, TRUCK_BAY_WIDTH } from "./plannerModel";

/**
 * La logistique **qui bouge** sur le plan : des engins qui font la navette, des camions qui
 * viennent à quai et repartent.
 *
 * ## Piloté par des compteurs
 *
 * Un jeu ne dit pas à un transpalette où aller : il compte. « 42 colis préparés », « 18 colis
 * chargés ». Ces composants prennent ces compteurs tels quels — **cumulés**, toujours croissants —
 * et en font du mouvement : chaque fois qu'un compteur monte, la différence est mise en file et un
 * engin l'emporte, par lots. Le jeu reste maître de ce qui s'est passé ; la scène ne fait que le
 * montrer, avec un temps de retard qui est celui d'un vrai trajet.
 *
 * Deux règles en découlent :
 * - **on ne rejoue pas l'histoire** : au montage, ce que le compteur dit déjà est tenu pour fait.
 *   Une partie rechargée à 4 000 colis n'envoie pas 4 000 colis sur le quai ;
 * - **une scène au repos dort** : un engin qui n'a rien à faire ne s'inscrit pas à l'horloge, et la
 *   toile ne se redessine pas pour lui (voir `time.tsx`). Il se réveille quand le compteur bouge.
 *
 * Tout est en cases, dans le repère du plan (`WarehousePlanner`), et ces composants se posent dans
 * sa scène (`sceneChildren`). Posés seuls, ils ouvrent la leur.
 */

export type ShuttleVehicle = "palletJack" | "forklift" | "worker" | "amr";

type Pt = { x: number; y: number };

/** L'horloge propre d'un composant : le temps de la scène, gelé pendant sa pause. */
function useLocalClock() {
  const last = useRef<number | null>(null);
  return {
    /** Le pas depuis l'image précédente, borné — la première image après un réveil ne compte pas. */
    tick(t: number): number {
      const dt = last.current === null ? 0 : Math.min(0.25, Math.max(0, t - last.current));
      last.current = t;
      return dt;
    },
    reset() {
      last.current = null;
    },
  };
}

// --- Les engins ----------------------------------------------------------------------------------

/** Ce qu'un engin montre de son état : ce qu'il porte, et s'il roule. */
interface HaulerView {
  carry: number;
  moving: boolean;
  speed: number;
}

/** Une charge posée à part, pour les engins du kit qui ne savent pas porter une pile. */
function Haul({ load, count, fill, x, z, half = 0.3 }: { load: HaulLoad; count: number; fill: number; x: number; z: number; half?: number }) {
  const built = useBuilt(() => {
    const b = new Builder();
    addHaul(b, load, count, x, 0, z, half, fill);
    return b.build();
  }, [load, count, fill, x, z, half]);
  return <Parts built={built} />;
}

/** Le carton qu'un opérateur porte à bout de bras. */
function HandCarton() {
  const built = useBuilt(() => {
    const b = new Builder();
    addGood(b, "carton", 0.27, 0, 0.62, 0.15, 0.24);
    return b.build();
  }, []);
  return <Parts built={built} />;
}

/**
 * Un engin, **centré sur l'origine et tourné vers les `x` croissants** : le groupe mobile qui le
 * porte n'a plus qu'à le poser et à l'orienter à chaque image, comme `Amr` le fait sur un itinéraire.
 */
function Hauler({ vehicle, load, batch, view }: { vehicle: ShuttleVehicle; load: HaulLoad; batch: number; view: HaulerView }) {
  const { carry, moving, speed } = view;
  const fill = Math.max(0.15, Math.min(1, carry / Math.max(1, batch)));
  switch (vehicle) {
    case "forklift":
      return (
        <>
          <Forklift origin={{ x: -1.35, y: -0.5 }} load={null} lift={0.3} rolling={moving ? speed : 0} />
          {carry > 0 && <Haul load={load} count={carry} fill={fill} x={0.82} z={0.35} half={0.38} />}
        </>
      );
    case "amr":
      return (
        <>
          <Amr origin={{ x: -0.8, y: -0.575 }} load={null} />
          {carry > 0 && <Haul load={load} count={carry} fill={fill} x={0} z={0.34} />}
        </>
      );
    case "worker":
      return (
        <>
          <Worker origin={{ x: 0, y: 0 }} pose={moving ? "walk" : "stand"} walking={Math.abs(speed)} />
          {carry > 0 && <HandCarton />}
        </>
      );
    default:
      return (
        <PalletJackBody
          origin={{ x: -PALLET_JACK_LENGTH / 2, y: -PALLET_JACK_WIDTH / 2 }}
          load={carry > 0 ? load : null}
          cartons={carry}
          fill={fill}
          operator
          walking={moving ? speed : 0}
        />
      );
  }
}

/** Relire l'état d'un engin, et ne redessiner que s'il a changé. */
function sameView(a: HaulerView, b: HaulerView) {
  return a.carry === b.carry && a.moving === b.moving && Math.abs(a.speed - b.speed) < 1e-3;
}

function boundsOf(points: Pt[], margin = 3, height = 4.5): Bounds {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { x0: Math.min(...xs) - margin, x1: Math.max(...xs) + margin, y0: Math.min(...ys) - margin, y1: Math.max(...ys) + margin, z0: 0, z1: height };
}

// --- La navette ------------------------------------------------------------------------------------

export interface PlannerShuttleProps {
  /** L'engin : transpalette et son opérateur (défaut), chariot élévateur, opérateur à pied, robot. */
  vehicle?: ShuttleVehicle;
  /** Où il charge — et où il attend, face à `to`, quand il n'a rien à faire. En cases. */
  from: Pt;
  /** Où il décharge. */
  to: Pt;
  /** Des points de passage, dans l'ordre, entre les deux. */
  via?: Pt[];
  /**
   * Le nombre **cumulé** d'unités à porter de `from` à `to`, toujours croissant. Chaque hausse met
   * la différence en file. Au montage, la valeur du moment est tenue pour déjà faite ; une baisse
   * repart de la nouvelle valeur, sans rien porter.
   */
  trips: number;
  /** Ce qu'un aller emporte au plus. Défaut : 6. */
  batch?: number;
  /** En cases par seconde de simulation. Défaut : 2,2. */
  speed?: number;
  /** Le temps de charger ou de décharger, en secondes. Défaut : 1. */
  dwell?: number;
  /** Ce qu'il porte : une pile de cartons, à la mesure du lot, ou une palette pleine. */
  load?: HaulLoad;
  /** Figer l'engin où il est. */
  paused?: boolean;
  /** Un nom, pour l'accessibilité et le débogage de la scène. */
  label?: string;
}

/**
 * La conduite de chaque engin : son rayon de braquage, son allure dans les virages, la vivacité de
 * ses départs. Un opérateur à pied tourne presque sur lui-même ; un robot pivote sur place, posément ;
 * un transpalette et un chariot prennent leurs demi-tours en arc serré, au pas.
 */
const STYLES: Record<ShuttleVehicle, Partial<MoverStyle>> = {
  palletJack: { radius: 0.6, accel: 0.9, lateral: 1.0, yawRate: 1.3, spin: 1.0 },
  forklift: { radius: 0.8, accel: 1.0, lateral: 1.2, yawRate: 1.3, spin: 1.0 },
  worker: { radius: 0.3, accel: 1.6, lateral: 2.2, yawRate: 3.2, spin: 3.0 },
  amr: { radius: 0.45, accel: 0.8, lateral: 1.0, yawRate: 1.4, spin: 1.3 },
};

/** Ce qui peut pivoter sur place quand il attend : un piéton, un robot à roues différentielles. */
const SPINS: ShuttleVehicle[] = ["worker", "amr"];

/** La vitesse montrée à l'engin (ses roues, ses pas), arrondie : on ne redessine pas à chaque image. */
const shownSpeed = (v: number) => Math.round(v * 4) / 4;

/**
 * Une navette : un engin qui porte des lots de `from` à `to`, à mesure qu'un compteur monte.
 *
 *  Au repos, il attend à `from`. Quand il y a du travail, il charge un lot (`batch` au plus), roule
 *  par les points de passage, décharge, revient à vide — et recommence tant qu'il en reste. Il
 *  **conduit** : il part d'où il regarde, prend ses virages et ses demi-tours en arc, à son rayon de
 *  braquage, accélère et freine en douceur et ralentit dans les courbes serrées. Un opérateur à pied
 *  et un robot se remettent face à `to` en attendant ; un transpalette ou un chariot reste comme il
 *  s'est garé, et repartira par un demi-tour.
 */
export function PlannerShuttle(props: PlannerShuttleProps) {
  const bounds = boundsOf([props.from, props.to, ...(props.via ?? [])]);
  return (
    <Solo bounds={bounds} cellSize={30} ariaLabel={props.label ?? "Navette"}>
      <ShuttleBody {...props} />
    </Solo>
  );
}

function ShuttleBody({ vehicle = "palletJack", from, to, via, trips, batch = 6, speed = 2.2, dwell = 1, load = "carton", paused = false, label }: PlannerShuttleProps) {
  const size = Math.max(1, Math.round(batch));
  const key = JSON.stringify([vehicle, from.x, from.y, to.x, to.y, (via ?? []).map((p) => [p.x, p.y])]);
  const tripsRef = useRef(trips);
  tripsRef.current = trips;
  const engine = useMemo(() => {
    const first = (via ?? [])[0] ?? to;
    const face = Math.atan2(first.y - from.y, first.x - from.x);
    // Ce que le compteur dit au montage est déjà fait : on ne rejoue pas l'histoire.
    return { mover: new Mover(from.x, from.y, face, STYLES[vehicle]), go: [...(via ?? []), to], back: [...[...(via ?? [])].reverse(), from], face, claimed: tripsRef.current, carry: 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const [view, setView] = useState<HaulerView>({ carry: 0, moving: false, speed: 0 });
  const shown = useRef(view);
  const [awake, setAwake] = useState(false);
  const group = useRef<Group>(null);
  const clock = useLocalClock();

  // Un compteur qui monte réveille l'engin ; un compteur qui baisse est une nouvelle partie.
  useEffect(() => {
    if (trips < engine.claimed) engine.claimed = trips;
    if (trips > engine.claimed) setAwake(true);
  }, [trips, engine]);
  useEffect(() => {
    clock.reset();
    if (!paused && (engine.mover.busy || tripsRef.current > engine.claimed)) setAwake(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, engine]);

  const schedule = () => {
    const m = engine.mover;
    if (m.busy) return;
    const pending = tripsRef.current - engine.claimed;
    if (pending <= 0) return;
    const k = Math.min(pending, size);
    engine.claimed += k;
    engine.carry = k;
    m.push(
      { kind: "wait", secs: dwell },
      { kind: "go", to: engine.go, speed },
      {
        kind: "wait",
        secs: dwell,
        done: () => {
          engine.carry = 0;
        },
      },
      {
        kind: "go",
        to: engine.back,
        speed,
        // De retour : s'il n'y a plus rien, un piéton ou un robot se remet face à la destination.
        done: () => {
          if (tripsRef.current - engine.claimed <= 0 && SPINS.includes(vehicle)) m.push({ kind: "turn", to: engine.face });
        },
      }
    );
  };

  const sync = () => {
    const g = group.current;
    if (!g) return;
    g.position.set(engine.mover.x, engine.mover.y, 0);
    g.rotation.set(0, 0, engine.mover.heading);
  };
  useLayoutEffect(sync);

  useSimFrame(
    (t) => {
      const dt = clock.tick(t);
      schedule();
      engine.mover.step(dt);
      schedule();
      sync();
      const next: HaulerView = { carry: engine.carry, moving: engine.mover.moving, speed: shownSpeed(engine.mover.speed) };
      if (!sameView(shown.current, next)) setView((shown.current = next));
      if (!engine.mover.busy && tripsRef.current - engine.claimed <= 0) {
        clock.reset();
        setAwake(false);
      }
    },
    awake && !paused
  );

  return (
    <group ref={group} name={label}>
      <Hauler vehicle={vehicle} load={load} batch={size} view={view} />
    </group>
  );
}

// --- Le quai : les camions et le chargeur -----------------------------------------------------------


export interface PlannerDockTrafficProps {
  /**
   * Le parking poids lourds, tel qu'il est posé sur le plan : son centre, son cap (`rotation`, en
   * degrés) et son nombre de places. Même repère que l'élément `truckBay` : les places le long des
   * `x` locaux, l'entrée en `−x`, le bout quai en `+x`.
   */
  bay: { x: number; y: number; rotation: number; bays?: number };
  /** Expédier (on charge des camions vides) ou recevoir (on vide des camions pleins). */
  mode: "ship" | "receive";
  /** Le nombre **cumulé** de colis chargés dans les camions (expédition) ou tirés des camions
   *  (réception). Même règle que `PlannerShuttle.trips`. */
  count: number;
  /** Ce qu'un camion emporte ou apporte. Défaut : 24. */
  capacity?: number;
  /** Le point, côté entrepôt, où le chargeur prend (expédition) ou pose (réception) les colis. */
  staging: Pt;
  /** Où les camions apparaissent et disparaissent. Défaut : 14 cases au-delà de l'entrée. */
  entry?: Pt;
  /** L'engin du chargeur. Défaut : transpalette en expédition, chariot en réception. */
  loader?: "palletJack" | "forklift" | "worker";
  /** Ce qu'un aller du chargeur emporte au plus. Défaut : 6. */
  batch?: number;
  /** Figer la scène du quai. */
  paused?: boolean;
  /**
   * Un multiplicateur de la vitesse des camions sur la route — à l'approche, en marche arrière, au
   * départ. Défaut : 1. À l'heure de pointe, `0.4` : les camions arrivent au pas. Pris en compte
   * en cours de route.
   */
  roadSpeed?: number;
  /** Des camions électriques (`SemiTruck variant="electric"`) : les livraisons de nuit en silence. */
  electric?: boolean;
  /** Un camion est à quai (`arrive`) ou s'en va (`depart`), à la place `slot`. */
  onTruck?: (e: { kind: "arrive" | "depart"; slot: number }) => void;
}

interface Slot {
  i: number;
  /** Le camion, par sa sellette : `heading` est le cap du tracteur, `trailer` celui de la remorque. */
  mover: Mover;
  /** Le camion est sur le site — il roule, recule ou attend à quai. */
  present: boolean;
  docked: boolean;
  leaving: boolean;
  /** Ce qu'il contient, et ce que le chargeur a déjà promis d'y mettre ou d'en tirer. */
  loaded: number;
  reserved: number;
}

interface TruckView {
  present: boolean;
  docked: boolean;
  cartons: number;
  rolling: number;
}

/**
 * Le trafic d'un quai : des semi-remorques qui viennent se mettre à quai **en marche arrière**, un
 * chargeur qui fait la navette entre le quai et l'entrepôt, et des camions qui repartent pleins
 * (expédition) ou vides (réception).
 *
 * ## La manœuvre
 *
 *  Un camion est **articulé** : le tracteur, et la remorque qui pivote sur la sellette. Il apparaît à
 *  `entry`, roule jusque devant les places, tourne pour longer leur entrée et la dépasse — la
 *  remorque suit en coupant le virage, puis se remet dans l'axe. Il recule alors comme un chauffeur à
 *  quai : c'est l'arrière de la remorque qui décrit une courbe lisse jusqu'à la place, le tracteur
 *  braquant ce qu'il faut pour l'y mener, et il vient mettre ses portes au bout quai. Il les ouvre
 *  et attend. Une place a toujours son camion : à quai, ou en train d'arriver. Voir `planDock`, et
 *  `dockTrafficClearance` pour la place que prend la manœuvre.
 *
 * ## Le chargement
 *
 *  Expédition : les camions arrivent vides ; à mesure que `count` monte, le chargeur emporte des
 *  lots de `staging` jusqu'à l'arrière du camion en cours — les places se remplissent l'une après
 *  l'autre. Un camion qui a reçu `capacity` colis referme ses portes et s'en va ; le suivant arrive.
 *  Réception : les camions arrivent pleins, le chargeur en tire des lots jusqu'à `staging`, et un
 *  camion vide repart. Le chargement se voit par les portes ouvertes : la caisse se remplit ou se
 *  vide.
 *
 *  Au montage, chaque place a déjà son camion à quai — vide en expédition, plein en réception — et
 *  le compteur du moment est tenu pour fait.
 */
export function PlannerDockTraffic(props: PlannerDockTrafficProps) {
  const n = Math.max(1, Math.round(props.bay.bays ?? 1));
  const t = (props.bay.rotation * Math.PI) / 180;
  const corners = [
    [-TRUCK_BAY_LENGTH / 2 - 16, -n * TRUCK_BAY_WIDTH - 16],
    [TRUCK_BAY_LENGTH / 2 + 3, n * TRUCK_BAY_WIDTH + 6],
  ].map(([u, v]) => ({ x: props.bay.x + u * Math.cos(t) - v * Math.sin(t), y: props.bay.y + u * Math.sin(t) + v * Math.cos(t) }));
  const bounds = boundsOf([...corners, props.staging, ...(props.entry ? [props.entry] : [])], 2, 3);
  return (
    <Solo bounds={bounds} cellSize={16} ariaLabel="Trafic du quai">
      <DockBody {...props} />
    </Solo>
  );
}

const TRUCK = semiTruckGeometry();
const FORWARD_SPEED = 3.2;
const REVERSE_SPEED = 1.3;
/** La conduite d'un semi : un grand rayon, des départs posés, et un tracteur qui ne pivote pas vite. */
const TRUCK_STYLE: Partial<MoverStyle> = { radius: 4.5, accel: 0.6, lateral: 0.8, yawRate: 0.45, spin: 0.3 };

function DockBody({ bay, mode, count, capacity = 24, staging, entry, loader, batch = 6, paused = false, roadSpeed = 1, electric = false, onTruck }: PlannerDockTrafficProps) {
  const roadRef = useRef(roadSpeed);
  roadRef.current = Math.max(0.05, roadSpeed);
  const forward = () => FORWARD_SPEED * roadRef.current;
  const backward = () => REVERSE_SPEED * roadRef.current;
  const bays = Math.max(1, Math.round(bay.bays ?? 1));
  const cap = Math.max(1, Math.round(capacity));
  const size = Math.max(1, Math.round(batch));
  const vehicle: ShuttleVehicle = loader ?? (mode === "ship" ? "palletJack" : "forklift");
  const countRef = useRef(count);
  countRef.current = count;
  const onTruckRef = useRef(onTruck);
  onTruckRef.current = onTruck;
  const key = JSON.stringify([bay.x, bay.y, bay.rotation, bays, mode, cap, size, staging.x, staging.y, entry?.x, entry?.y, vehicle]);

  const engine = useMemo(() => {
    const plan = planDock({ ...bay, bays }, entry);
    // Au montage : chaque place a son camion à quai.
    const slots: Slot[] = plan.lanes.map((lane, i) => ({
      i,
      mover: new Mover(lane.park.x, lane.park.y, lane.park.heading, TRUCK_STYLE),
      present: true,
      docked: true,
      leaving: false,
      loaded: mode === "ship" ? 0 : cap,
      reserved: 0,
    }));
    const first = plan.lanes[0].apron;
    const home = Math.atan2(first.y - staging.y, first.x - staging.x);
    return { plan, slots, loader: new Mover(staging.x, staging.y, home, STYLES[vehicle]), home, carry: 0, claimed: countRef.current, cursor: 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const [awake, setAwake] = useState(false);
  const [loaderView, setLoaderView] = useState<HaulerView>({ carry: 0, moving: false, speed: 0 });
  const loaderShown = useRef(loaderView);
  const truckViewOf = (sl: Slot): TruckView => ({
    present: sl.present,
    docked: sl.docked,
    cartons: Math.round((Math.max(0, Math.min(cap, sl.loaded)) / cap) * 20),
    rolling: sl.mover.moving ? shownSpeed(sl.mover.speed) : 0,
  });
  const [trucks, setTrucks] = useState<TruckView[]>(() => engine.slots.map(truckViewOf));
  const trucksShown = useRef(trucks);
  useEffect(() => setTrucks((trucksShown.current = engine.slots.map(truckViewOf))), [engine]); // eslint-disable-line react-hooks/exhaustive-deps
  const tractorGroups = useRef<(Group | null)[]>([]);
  const trailerGroups = useRef<(Group | null)[]>([]);
  const loaderGroup = useRef<Group>(null);
  const clock = useLocalClock();

  useEffect(() => {
    if (count < engine.claimed) engine.claimed = count;
    if (count > engine.claimed) setAwake(true);
  }, [count, engine]);
  useEffect(() => {
    clock.reset();
    if (!paused && (engine.loader.busy || engine.slots.some((sl) => sl.mover.busy) || countRef.current > engine.claimed)) setAwake(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, engine]);

  const depart = (sl: Slot) => {
    sl.docked = false;
    sl.leaving = true;
    onTruckRef.current?.({ kind: "depart", slot: sl.i });
    const lane = engine.plan.lanes[sl.i];
    sl.mover.push(
      { kind: "wait", secs: 0.8 },
      {
        kind: "track",
        track: lane.depart,
        speed: forward,
        // Il quitte le site en roulant : pas de freinage devant le point où il disparaît.
        endSpeed: FORWARD_SPEED,
        done: () => {
          sl.present = false;
          sl.leaving = false;
        },
      }
    );
  };

  const spawn = (sl: Slot) => {
    const lane = engine.plan.lanes[sl.i];
    sl.present = true;
    sl.docked = false;
    sl.loaded = mode === "ship" ? 0 : cap;
    sl.reserved = 0;
    const a = lane.approach;
    sl.mover.place(a.x[0], a.y[0], a.heading[0], a.trailer?.[0] ?? a.heading[0]);
    sl.mover.push(
      // Il arrive de la rue déjà lancé, et s'arrête au-delà de la place.
      { kind: "track", track: a, speed: forward, startSpeed: FORWARD_SPEED },
      { kind: "wait", secs: 0.8 },
      {
        kind: "track",
        track: lane.reverse,
        speed: backward,
        done: () => {
          sl.docked = true;
          onTruckRef.current?.({ kind: "arrive", slot: sl.i });
        },
      }
    );
  };

  const trip = (sl: Slot, q: number) => {
    const m = engine.loader;
    const lane = engine.plan.lanes[sl.i];
    engine.claimed += q;
    sl.reserved += q;
    const go: MoverTask = { kind: "go", to: [lane.apron, lane.dock], speed: 2.2 };
    const settle = () => {
      if (countRef.current - engine.claimed <= 0 && SPINS.includes(vehicle)) m.push({ kind: "turn", to: engine.home });
    };
    const tail: MoverTask = { kind: "go", to: [lane.apron, staging], speed: 2.2, done: settle };
    if (mode === "ship") {
      engine.carry = q;
      m.push(
        { kind: "wait", secs: 1 },
        go,
        {
          kind: "wait",
          secs: 1,
          done: () => {
            engine.carry = 0;
            sl.loaded += q;
            sl.reserved -= q;
            if (sl.loaded >= cap) depart(sl);
          },
        },
        tail
      );
    } else {
      engine.carry = 0;
      m.push(
        go,
        {
          kind: "wait",
          secs: 1,
          done: () => {
            engine.carry = q;
            sl.loaded -= q;
            sl.reserved -= q;
            if (sl.loaded <= 0) depart(sl);
          },
        },
        { ...tail, done: undefined },
        {
          kind: "wait",
          secs: 1,
          done: () => {
            engine.carry = 0;
            settle();
          },
        }
      );
    }
  };

  const schedule = () => {
    for (const sl of engine.slots) if (!sl.present) spawn(sl);
    if (engine.loader.busy) return;
    const pending = countRef.current - engine.claimed;
    if (pending <= 0) return;
    const n = engine.slots.length;
    for (let k = 0; k < n; k += 1) {
      const sl = engine.slots[(engine.cursor + k) % n];
      if (!sl.docked || sl.leaving) continue;
      const room = mode === "ship" ? cap - sl.loaded - sl.reserved : sl.loaded - sl.reserved;
      if (room <= 0) continue;
      engine.cursor = sl.i;
      trip(sl, Math.min(pending, size, room));
      return;
    }
  };

  const sync = () => {
    engine.slots.forEach((sl, i) => {
      // Le tracteur et la remorque se posent tous deux sur la sellette, chacun à son cap.
      const m = sl.mover;
      const tg = tractorGroups.current[i];
      if (tg) {
        tg.visible = sl.present;
        tg.position.set(m.x, m.y, 0);
        tg.rotation.set(0, 0, m.heading);
      }
      const rg = trailerGroups.current[i];
      if (rg) {
        rg.visible = sl.present;
        rg.position.set(m.x, m.y, 0);
        rg.rotation.set(0, 0, m.trailer);
      }
    });
    const lg = loaderGroup.current;
    if (lg) {
      lg.position.set(engine.loader.x, engine.loader.y, 0);
      lg.rotation.set(0, 0, engine.loader.heading);
    }
  };
  useLayoutEffect(sync);

  useSimFrame(
    (t) => {
      const dt = clock.tick(t);
      schedule();
      for (const sl of engine.slots) sl.mover.step(dt);
      engine.loader.step(dt);
      schedule();
      sync();
      const lv: HaulerView = { carry: engine.carry, moving: engine.loader.moving, speed: shownSpeed(engine.loader.speed) };
      if (!sameView(loaderShown.current, lv)) setLoaderView((loaderShown.current = lv));
      const tv = engine.slots.map(truckViewOf);
      const prev = trucksShown.current;
      const same = prev.length === tv.length && prev.every((p, i) => p.present === tv[i].present && p.docked === tv[i].docked && p.cartons === tv[i].cartons && p.rolling === tv[i].rolling);
      if (!same) setTrucks((trucksShown.current = tv));
      const busy = engine.loader.busy || engine.slots.some((sl) => sl.mover.busy || !sl.present);
      if (!busy) {
        clock.reset();
        setAwake(false);
      }
    },
    awake && !paused
  );

  // Les deux véhicules d'un semi, chacun dans le repère de la sellette : le kit les pose par le coin
  // de leur emprise commune, on les recale pour que la sellette soit à l'origine.
  const hitch = { x: -TRUCK.kingpin, y: -TRUCK.width / 2 };
  const variant = electric ? "electric" : "diesel";
  return (
    <group>
      {engine.slots.map((sl, i) => {
        const v = trucks[i] ?? truckViewOf(sl);
        return (
          <group key={`${key}-${i}`}>
            <group ref={(el) => (tractorGroups.current[i] = el)}>
              <SemiTruck vehicle="tractor" origin={hitch} rotation={0} rolling={v.rolling} variant={variant} />
            </group>
            <group ref={(el) => (trailerGroups.current[i] = el)}>
              <SemiTruck vehicle="trailer" origin={hitch} rotation={0} doorsOpen={v.docked} load={Array.from({ length: v.cartons }, () => "carton" as const)} rolling={v.rolling} variant={variant} />
            </group>
          </group>
        );
      })}
      <group ref={loaderGroup}>
        <Hauler vehicle={vehicle} load="carton" batch={size} view={loaderView} />
      </group>
    </group>
  );
}
