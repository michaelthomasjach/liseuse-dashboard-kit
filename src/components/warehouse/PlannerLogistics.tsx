import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";
import { Builder, type P3 } from "./three/builder";
import { Parts, Solo, useBuilt, type Bounds } from "./three/scene";
import { useSimFrame } from "./three/time";
import { Mover, groundPath, type MoverTask } from "./three/mover";
import { makeRoute, sampleRoute } from "./three/transport";
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
 * Une navette : un engin qui porte des lots de `from` à `to`, à mesure qu'un compteur monte.
 *
 *  Au repos, il attend à `from`, tourné vers `to`. Quand il y a du travail, il charge un lot
 *  (`batch` au plus), roule par les points de passage, décharge, revient à vide — et recommence
 *  tant qu'il en reste. Il pivote sur place avant de partir, et prend ses virages en courbe.
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
  const key = JSON.stringify([from.x, from.y, to.x, to.y, (via ?? []).map((p) => [p.x, p.y])]);
  const tripsRef = useRef(trips);
  tripsRef.current = trips;
  const engine = useMemo(() => {
    const pts = [from, ...(via ?? []), to];
    const go = groundPath(pts);
    const back = groundPath([...pts].reverse());
    const face = go.length > 1e-3 ? sampleRoute(go, Math.min(0.05, go.length / 2)).heading : 0;
    // Ce que le compteur dit au montage est déjà fait : on ne rejoue pas l'histoire.
    return { mover: new Mover(from.x, from.y, face), go, back, face, claimed: tripsRef.current, carry: 0 };
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
      { kind: "drive", route: engine.go, speed },
      {
        kind: "wait",
        secs: dwell,
        done: () => {
          engine.carry = 0;
        },
      },
      {
        kind: "drive",
        route: engine.back,
        speed,
        // De retour : s'il n'y a plus rien, il se remet face à la destination.
        done: () => {
          if (tripsRef.current - engine.claimed <= 0) m.push({ kind: "turn", to: engine.face });
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
      const next: HaulerView = { carry: engine.carry, moving: engine.mover.moving, speed: engine.mover.speed };
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
  mover: Mover;
  /** Le camion est sur le site — il roule, recule ou attend à quai. */
  present: boolean;
  docked: boolean;
  leaving: boolean;
  /** Ce qu'il contient, et ce que le chargeur a déjà promis d'y mettre ou d'en tirer. */
  loaded: number;
  reserved: number;
  /** Le point du camion que suit son engin : l'arrière en marche arrière, l'avant en marche avant. */
  ref: "rear" | "front";
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
 *  Un camion apparaît à `entry`, roule jusque devant les places, les dépasse, puis recule en
 *  braquant jusqu'à s'aligner sur la sienne et vient mettre l'arrière de sa remorque au bout quai.
 *  Il ouvre ses portes et attend. Une place a toujours son camion : à quai, ou en train d'arriver.
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
    [-TRUCK_BAY_LENGTH / 2 - 16, -n * TRUCK_BAY_WIDTH - 12],
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
const REVERSE_SPEED = 1.5;
/** Le rayon du virage en marche arrière qui aligne un camion sur sa place. */
const SWING = 5;

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
  const key = JSON.stringify([bay.x, bay.y, bay.rotation, bays, mode, cap, size, staging.x, staging.y, entry?.x, entry?.y]);

  const engine = useMemo(() => {
    const L = TRUCK_BAY_LENGTH;
    const W = bays * TRUCK_BAY_WIDTH;
    const th = (bay.rotation * Math.PI) / 180;
    const c = Math.cos(th);
    const s = Math.sin(th);
    /** Du repère du parking au plan. */
    const world = (u: number, v: number): Pt => ({ x: bay.x + u * c - v * s, y: bay.y + u * s + v * c });
    const laneV = (i: number) => -W / 2 + TRUCK_BAY_WIDTH * (i + 0.5);
    const E = entry ?? world(-L / 2 - 14, 0);
    const parkedHeading = th + Math.PI;
    const len = TRUCK.length;

    const paths = Array.from({ length: bays }, (_, i) => {
      const v = laneV(i);
      // La marche arrière, suivie par l'arrière de la remorque : un quart de cercle qui l'aligne sur
      // la place, puis tout droit jusqu'au bout quai.
      const bu = -L / 2 + 1;
      const q0 = { u: bu - SWING, v: v - SWING };
      const reverse: P3[] = [];
      for (let k = 0; k <= 12; k += 1) {
        const a = Math.PI - (k / 12) * (Math.PI / 2);
        const p = world(bu + SWING * Math.cos(a), v - SWING + SWING * Math.sin(a));
        reverse.push([p.x, p.y, 0]);
      }
      const park = world(L / 2 - 0.15, v);
      reverse.push([park.x, park.y, 0]);
      // L'approche, suivie par l'avant de la cabine : elle longe l'entrée et s'arrête au-delà de la
      // place, la remorque déjà dans l'axe du départ de la marche arrière.
      const approach = groundPath([E, world(q0.u, v + 3), world(q0.u, q0.v - len)], 3);
      // Le départ, par l'avant : tout droit hors de la place, puis vers la sortie.
      const out0 = world(L / 2 - 0.15 - len, v);
      const depart = groundPath([out0, world(-L / 2 - 3.5, v), E], 3);
      // Le chargeur : du point de préparation à l'arrière de la remorque, par l'axe de la place.
      const dockPt = world(L / 2 + 0.9, v);
      const go = groundPath([staging, world(L / 2 + 2.6, v), dockPt], 0.8);
      const back = groundPath([dockPt, world(L / 2 + 2.6, v), staging], 0.8);
      return { reverse: makeRoute(reverse, false), approach, depart, park, go, back };
    });

    // Au montage : chaque place a son camion à quai.
    const slots: Slot[] = paths.map((p, i) => ({
      i,
      mover: new Mover(p.park.x, p.park.y, parkedHeading),
      present: true,
      docked: true,
      leaving: false,
      loaded: mode === "ship" ? 0 : cap,
      reserved: 0,
      ref: "rear",
    }));
    const firstGo = paths[0].go;
    const home = firstGo.length > 1e-3 ? sampleRoute(firstGo, Math.min(0.05, firstGo.length / 2)).heading : th;
    return { paths, slots, E, len, loader: new Mover(staging.x, staging.y, home), home, carry: 0, claimed: countRef.current, cursor: 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const [awake, setAwake] = useState(false);
  const [loaderView, setLoaderView] = useState<HaulerView>({ carry: 0, moving: false, speed: 0 });
  const loaderShown = useRef(loaderView);
  const truckViewOf = (sl: Slot): TruckView => ({
    present: sl.present,
    docked: sl.docked,
    cartons: Math.round((Math.max(0, Math.min(cap, sl.loaded)) / cap) * 20),
    rolling: sl.mover.moving ? sl.mover.speed : 0,
  });
  const [trucks, setTrucks] = useState<TruckView[]>(() => engine.slots.map(truckViewOf));
  const trucksShown = useRef(trucks);
  useEffect(() => setTrucks((trucksShown.current = engine.slots.map(truckViewOf))), [engine]); // eslint-disable-line react-hooks/exhaustive-deps
  const truckGroups = useRef<(Group | null)[]>([]);
  const truckBodies = useRef<(Group | null)[]>([]);
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

  /** Changer le point suivi d'un camion sans le déplacer : de l'arrière à l'avant, ou l'inverse. */
  const follow = (sl: Slot, ref: "rear" | "front") => {
    if (sl.ref === ref) return;
    const m = sl.mover;
    const k = ref === "front" ? engine.len : -engine.len;
    m.x += Math.cos(m.heading) * k;
    m.y += Math.sin(m.heading) * k;
    sl.ref = ref;
  };

  const depart = (sl: Slot) => {
    sl.docked = false;
    sl.leaving = true;
    onTruckRef.current?.({ kind: "depart", slot: sl.i });
    const p = engine.paths[sl.i];
    sl.mover.push(
      { kind: "wait", secs: 0.8, done: () => follow(sl, "front") },
      {
        kind: "drive",
        route: p.depart,
        speed: forward,
        turnFirst: false,
        done: () => {
          sl.present = false;
          sl.leaving = false;
        },
      }
    );
  };

  const spawn = (sl: Slot) => {
    const p = engine.paths[sl.i];
    sl.present = true;
    sl.docked = false;
    sl.loaded = mode === "ship" ? 0 : cap;
    sl.reserved = 0;
    sl.ref = "front";
    const start = sampleRoute(p.approach, Math.min(0.05, p.approach.length / 2));
    sl.mover.place(start.x, start.y, start.heading);
    sl.mover.push(
      { kind: "drive", route: p.approach, speed: forward, turnFirst: false, done: () => follow(sl, "rear") },
      { kind: "wait", secs: 0.5 },
      {
        kind: "drive",
        route: p.reverse,
        speed: backward,
        reverse: true,
        turnFirst: false,
        done: () => {
          sl.docked = true;
          onTruckRef.current?.({ kind: "arrive", slot: sl.i });
        },
      }
    );
  };

  const trip = (sl: Slot, q: number) => {
    const m = engine.loader;
    const p = engine.paths[sl.i];
    engine.claimed += q;
    sl.reserved += q;
    const tail: MoverTask = {
      kind: "drive",
      route: p.back,
      speed: 2.2,
      done: () => {
        if (countRef.current - engine.claimed <= 0) m.push({ kind: "turn", to: engine.home });
      },
    };
    if (mode === "ship") {
      engine.carry = q;
      m.push(
        { kind: "wait", secs: 1 },
        { kind: "drive", route: p.go, speed: 2.2 },
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
        { kind: "drive", route: p.go, speed: 2.2 },
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
            if (countRef.current - engine.claimed <= 0) m.push({ kind: "turn", to: engine.home });
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
      const g = truckGroups.current[i];
      if (g) {
        g.visible = sl.present;
        g.position.set(sl.mover.x, sl.mover.y, 0);
        g.rotation.set(0, 0, sl.mover.heading);
      }
      const body = truckBodies.current[i];
      if (body) body.position.x = sl.ref === "front" ? -engine.len : 0;
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
      const lv: HaulerView = { carry: engine.carry, moving: engine.loader.moving, speed: engine.loader.speed };
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

  return (
    <group>
      {engine.slots.map((sl, i) => {
        const v = trucks[i] ?? truckViewOf(sl);
        return (
          <group key={`${key}-${i}`} ref={(el) => (truckGroups.current[i] = el)}>
            <group ref={(el) => (truckBodies.current[i] = el)}>
              <SemiTruck origin={{ x: 0, y: -TRUCK.width / 2 }} rotation={0} doorsOpen={v.docked} load={Array.from({ length: v.cartons }, () => "carton" as const)} rolling={v.rolling} variant={electric ? "electric" : "diesel"} />
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
