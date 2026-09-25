import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Color, MeshBasicMaterial, Vector3, type Group } from "three";
import { Builder } from "./three/builder";
import { Parts, Solo, useBuilt, type Bounds } from "./three/scene";
import { useSimFrame } from "./three/time";
import { Mover, type MoverStyle, type MoverTask } from "./three/mover";
import { planDock, sweptZone, type DockYardProblem, type YardOpening, type YardRect } from "./dockManeuver";
import { sliceTrack, type Track } from "./three/drive";
import { addGood } from "./three/goods";
import { PALLET_JACK_LENGTH, PALLET_JACK_WIDTH, PalletJackBody, addHaul, type HaulLoad } from "./PalletJack";
import { Forklift } from "./Forklift";
import { Worker } from "./Worker";
import { Amr } from "./Amr";
import { SemiTruck, semiTruckGeometry } from "./SemiTruck";
import { TRUCK_BAY_LENGTH, TRUCK_BAY_WIDTH } from "./plannerModel";
import { parseCss } from "./three/palette";
import { insideObstacle, planAisleRoute, VEHICLE_CLEARANCE, type AisleObstacle } from "./aisleRoute";
import { makeZone, throttleFor, useTraffic, yieldsBefore, type OrientedBox, type TrafficAgent, type TrafficRegistry, type TrafficZone } from "./three/traffic";

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
  /**
   * Ce qui barre le passage : les emprises des racks, étagères, murs… (centre, `width` le long de
   * l'axe, `depth` en travers, `rotation` en degrés — voir `plannerObstacles`). Donnés, l'engin
   * **contourne** par les allées (`planAisleRoute`), au milieu, en gardant sa droite si l'allée le
   * permet ; sans eux, il va tout droit comme avant.
   */
  obstacles?: AisleObstacle[];
  /** Garder sa droite de tant de cases dans les allées assez larges. Défaut : la demi-largeur de l'engin. */
  lane?: number;
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

/**
 * Le trajet d'un point à l'autre par une suite de points de passage : par les allées si l'on connaît
 * les obstacles, tout droit sinon. Rendu sans le point de départ, comme `MoverTask.go` l'attend.
 */
export function shuttleLegs(points: Pt[], obstacles: AisleObstacle[] | undefined, clearance: number, lane: number): Pt[] {
  if (!obstacles || !obstacles.length) return points.slice(1);
  const out: Pt[] = [];
  for (let i = 0; i + 1 < points.length; i += 1) out.push(...planAisleRoute(points[i], points[i + 1], obstacles, { clearance, lane }).slice(1));
  return out;
}

/** La forme d'un engin pour la circulation : des disques le long de son axe (voir `traffic.ts`). */
const BODY: Record<ShuttleVehicle, { at: number[]; radius: number }> = {
  palletJack: { at: [-0.45, 0.45], radius: 0.45 },
  forklift: { at: [-0.8, 0, 0.8], radius: 0.6 },
  worker: { at: [0], radius: 0.35 },
  amr: { at: [-0.3, 0.3], radius: 0.6 },
};

/** Inscrire un engin dans la circulation de la scène, et le tenir à jour. */
function useTrafficAgent(id: string, vehicle: ShuttleVehicle) {
  const traffic = useTraffic();
  const agent = useMemo<TrafficAgent>(() => ({ id, kind: "vehicle", body: { discs: BODY[vehicle].at.map(() => ({ x: 0, y: 0 })), radius: BODY[vehicle].radius }, motion: 0, priority: 0, waiting: false, waited: 0 }), [id, vehicle]);
  useEffect(() => traffic.add(agent), [traffic, agent]);
  return { traffic, agent };
}

/**
 * Un pas de circulation pour un engin : relire sa place dans la scène, puis combien il peut
 * avancer, et le freiner d'autant — avant qu'il ne bouge. `loaded` : il porte (il passe avant).
 */
export function trafficStep(traffic: TrafficRegistry, agent: TrafficAgent, m: Mover, vehicle: ShuttleVehicle, loaded: boolean, dt: number, obstacles?: AisleObstacle[]) {
  const b = BODY[vehicle];
  agent.motion = m.heading + (m.reversing ? Math.PI : 0);
  agent.priority = loaded ? 1 : 0;
  // Croiser : quelqu'un vient en face dans notre couloir — on serre sa droite de la moitié de ce
  // qu'il manque, si la place le permet (jamais dans un obstacle) ; sinon on reste, et la priorité
  // décidera qui attend.
  if (dt > 0) {
    const meet = m.moving || m.busy ? traffic.oncoming(agent, 4) : null;
    // Tant que l'autre est à notre hauteur, on garde l'écart pris ; on ne se rabat qu'une fois passé.
    let want = meet ? Math.max(-0.9, Math.min(0.9, m.side + meet.need / 2)) : 0;
    if (want !== 0 && obstacles?.length && sideBlocked(m, b, want, obstacles)) want = m.side;
    m.side += (want - m.side) * Math.min(1, dt * 2.5);
    if (Math.abs(m.side) < 1e-3 && !meet) m.side = 0;
  }
  const c = Math.cos(m.heading);
  const s = Math.sin(m.heading);
  const x = m.shownX;
  const y = m.shownY;
  b.at.forEach((u, i) => {
    agent.body.discs[i].x = x + u * c;
    agent.body.discs[i].y = y + u * s;
  });
  // Il cède le passage à un autre, dans une impasse : il recule sur son chemin tant qu'il le gêne
  // (et que rien n'est derrière lui), puis attend que l'autre soit passé.
  const yieldTo = agent.yieldTo;
  if (yieldTo) {
    agent.yielded = (agent.yielded ?? 0) + dt;
    const inWay = traffic.agents.has(yieldTo) && !yieldTo.ghost && traffic.hitDistance(yieldTo, agent, 4) < 1.2;
    if (!inWay || (agent.yielded ?? 0) > 12) {
      agent.yieldTo = null;
      agent.backing = 0;
    } else {
      const backing = (agent.backing ?? 0) < 6;
      agent.backing = (agent.backing ?? 0) + dt;
      // Il regarde derrière lui : à l'opposé du sens où son trajet le mène.
      agent.motion = m.heading + (m.reversingTrack ? 0 : Math.PI);
      const behind = traffic.freeAhead(agent, 2);
      m.throttle = backing && behind > 0.3 ? -0.45 : 0;
      agent.waiting = false;
      agent.waited = 0;
      return;
    }
  }
  const free = traffic.freeAhead(agent, 3);
  const target = throttleFor(free, 0.2, 1.4);
  // On freine franchement, on repart doucement.
  m.throttle = target < m.throttle ? target : m.throttle + (target - m.throttle) * Math.min(1, dt * 3);
  const stuck = m.busy && m.throttle < 0.05 && free !== Infinity;
  agent.waiting = stuck;
  agent.waited = stuck ? agent.waited + dt : 0;
  // Une impasse : lui et celui qui le bloque s'attendent l'un l'autre. Le moins prioritaire recule
  // un peu sur son chemin ; l'autre passe.
  const bl = agent.blocker;
  if (stuck && agent.waited > 2 && bl && bl.waiting && bl.blocker === agent && yieldsBefore(agent, bl)) {
    agent.yieldTo = bl;
    agent.yielded = 0;
    agent.backing = 0;
  }
}

/** L'engin décalé de `side` toucherait-il un obstacle ? */
function sideBlocked(m: Mover, b: { at: number[]; radius: number }, side: number, obstacles: AisleObstacle[]): boolean {
  const c = Math.cos(m.heading);
  const s = Math.sin(m.heading);
  const x = m.x + s * side;
  const y = m.y - c * side;
  return b.at.some((u) => insideObstacle({ x: x + u * c, y: y + u * s }, obstacles, b.radius * 0.7));
}

let shuttleSeq = 0;

function ShuttleBody({ vehicle = "palletJack", from, to, via, trips, batch = 6, speed = 2.2, dwell = 1, load = "carton", paused = false, label, obstacles, lane }: PlannerShuttleProps) {
  const size = Math.max(1, Math.round(batch));
  const clearance = VEHICLE_CLEARANCE[vehicle];
  const laneOffset = lane ?? BODY[vehicle].radius + 0.08;
  const obstacleKey = JSON.stringify(obstacles ?? []);
  const key = JSON.stringify([vehicle, from.x, from.y, to.x, to.y, (via ?? []).map((p) => [p.x, p.y]), obstacleKey, laneOffset]);
  const tripsRef = useRef(trips);
  tripsRef.current = trips;
  const [id] = useState(() => `${label ?? vehicle}#${++shuttleSeq}`);
  const { traffic, agent } = useTrafficAgent(id, vehicle);
  const engine = useMemo(() => {
    // L'aller et le retour, chacun par les allées et sur sa droite : ils ne se croisent pas de face.
    const go = shuttleLegs([from, ...(via ?? []), to], obstacles, clearance, laneOffset);
    const back = shuttleLegs([to, ...[...(via ?? [])].reverse(), from], obstacles, clearance, laneOffset);
    const first = go[0] ?? to;
    const face = Math.atan2(first.y - from.y, first.x - from.x);
    // Ce que le compteur dit au montage est déjà fait : on ne rejoue pas l'histoire.
    return { mover: new Mover(from.x, from.y, face, STYLES[vehicle]), go, back, face, claimed: tripsRef.current, carry: 0 };
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
    g.position.set(engine.mover.shownX, engine.mover.shownY, 0);
    g.rotation.set(0, 0, engine.mover.heading);
  };
  useLayoutEffect(sync);
  // Au montage, l'engin est déjà quelque part : les autres doivent le voir, même s'il dort.
  useLayoutEffect(() => trafficStep(traffic, agent, engine.mover, vehicle, false, 0), [traffic, agent, engine, vehicle]);

  useSimFrame(
    (t) => {
      const dt = clock.tick(t);
      schedule();
      trafficStep(traffic, agent, engine.mover, vehicle, engine.carry > 0, dt, obstacles);
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
  /**
   * Où les camions apparaissent et disparaissent. Défaut : 14 cases au-delà de l'entrée. Pour les
   * faire venir de la rue par une voie d'accès ou un portail : `accessRoadEntry`, `gateEntry`.
   */
  entry?: Pt;
  /**
   * Des points de passage entre `entry` et les places, suivis à l'aller et, à rebours, au départ :
   * le long d'une voie d'accès (`accessRoadRoute(road, plot).slice(1)`), à travers un portail
   * (`[gateEntry(gate, plot).inside]`). Le trajet part aligné sur le premier tronçon.
   */
  via?: Pt[];
  /** L'engin du chargeur. Défaut : transpalette en expédition, chariot en réception. */
  /**
   * `"none"` : pas de chargeur dessiné. La caisse se remplit (ou se vide) quand même au rythme de
   * `count` — c'est alors un transporteur de flotte (`PlannerTransporter`) qui amène les palettes
   * à la porte (voir `dockLoadingPoints`).
   */
  loader?: "palletJack" | "forklift" | "worker" | "none";
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
  /**
   * La route **avant** `entry` : par les rues, depuis le bord de la carte (`streetRoute(plot, gate)`).
   * Chaque nouveau camion y apparaît, roule dans sa voie, tourne aux carrefours, passe le portail et
   * vient à quai. Les camions déjà à quai au montage y restent.
   */
  approach?: Pt[];
  /** La route **après** la sortie, jusqu'au bord de la carte (`streetRoute(plot, gate, { direction: "out" })`), où le camion disparaît. */
  leave?: Pt[];
  /** Une sortie à part (cour à sens unique) : le point de la rue où l'on sort. Défaut : `entry`. */
  exit?: Pt;
  /** Les points de passage vers la sortie, dans l'ordre de la marche. Défaut : `via` à rebours. */
  exitVia?: Pt[];
  /**
   * Le terrain clos (un ou plusieurs rectangles) : les camions n'en sortent **que par les ouvertures**
   * (`openings`) ; la manœuvre prend la variante qui tient dedans. Une place où rien ne tient ne reçoit
   * pas de camion, et `onYardProblem` le dit (voir `dockYardProblem`).
   */
  bounds?: YardRect[];
  /** Les portails de la clôture : leur milieu, leur largeur, leur côté. */
  openings?: YardOpening[];
  /** Une place ne peut pas recevoir de camion : pourquoi, en français. */
  onYardProblem?: (e: { slot: number; problem: DockYardProblem }) => void;
  /**
   * La place dont le camion est choisi, sur ce quai. Contrôlé si donné (`null` : aucun) ; sinon, le
   * quai retient lui-même le dernier camion touché.
   */
  selectedSlot?: number | null;
  /**
   * Un camion a été touché — cliqué, tapoté, tracteur ou remorque : ce qu'il contient. Toucher le
   * camion déjà choisi le relâche (`null`), et un camion choisi qui quitte le site aussi.
   */
  onTruckSelect?: (truck: DockTruckInfo | null) => void;
  /** Le camion choisi a changé de charge ou de phase — seulement quand cela change, pas à chaque image. */
  onSelectedTruckChange?: (truck: DockTruckInfo) => void;
  /** L'unité de la jauge : « 18 / 24 colis ». Défaut : `"colis"`. */
  unit?: string;
  /**
   * La jauge de remplissage, posée au-dessus du camion et qui le suit : pour le camion choisi
   * (`"selected"`, défaut), pour tout camion à quai en plus, en petit (`"always"`), ou jamais (`"none"`).
   */
  fillLabel?: "selected" | "always" | "none";
}

/** Où en est un camion : il arrive, recule à quai, y attend, ou s'en va. */
export type DockTruckPhase = "arriving" | "docking" | "docked" | "departing";

/** Ce qu'on sait d'un camion du quai, pour la jauge et pour l'application. */
export interface DockTruckInfo {
  /** Sa place sur le parking, à partir de 0. */
  slot: number;
  mode: "ship" | "receive";
  /** Ce qu'il contient, en colis (ou dans l'unité de l'application). */
  load: number;
  capacity: number;
  /** Son remplissage, de 0 à 1. Un camion qui part plein (expédition) : 1 ; vide (réception) : 0. */
  fill: number;
  phase: DockTruckPhase;
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
  phase: DockTruckPhase;
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
  const bounds = boundsOf([...corners, props.staging, ...(props.entry ? [props.entry] : []), ...(props.via ?? [])], 2, 3);
  return (
    <Solo bounds={bounds} cellSize={16} ariaLabel="Trafic du quai">
      <DockBody {...props} />
    </Solo>
  );
}

const TRUCK = semiTruckGeometry();
/** Un semi pour la circulation : des disques le long du tracteur et de la remorque. */
const TRUCK_DISC_R = TRUCK.width / 2 + 0.06;
const TRAILER_DISCS = Array.from({ length: 6 }, (_, k) => -TRUCK.kingpin + TRUCK_DISC_R * 0.6 + (k * (TRUCK.trailer - TRUCK_DISC_R * 1.2)) / 5);
const TRACTOR_DISCS = [TRUCK.tractor0 - TRUCK.kingpin + TRUCK_DISC_R * 0.6, TRUCK.cab1 - TRUCK.kingpin - TRUCK_DISC_R * 0.6];
const FORWARD_SPEED = 3.2;
/** Où l'on demande un carrefour avant son sommet, et où on le rend après, en cases le long du trajet. */
const CORNER_IN = 11;
const CORNER_OUT = 9;
/** La zone d'un carrefour : un carré autour de son sommet. */
const CORNER_HALF = 5;

/**
 * Les carrefours d'une route (là où elle tourne franchement), repérés sur un trajet de camion.
 * Deux virages proches — un coin de rue suivi d'un autre — ne font **qu'une** zone : un camion qui
 * tiendrait l'un en demandant l'autre croiserait un camion qui fait l'inverse, et aucun ne passerait.
 */
function cornersOf(track: Track, road: Pt[]): Corner[] {
  const tips: { s: number; p: Pt }[] = [];
  for (let i = 1; i + 1 < road.length; i += 1) {
    const a = road[i - 1];
    const b = road[i];
    const c = road[i + 1];
    const t0 = Math.atan2(b.y - a.y, b.x - a.x);
    const t1 = Math.atan2(c.y - b.y, c.x - b.x);
    if (Math.abs(Math.atan2(Math.sin(t1 - t0), Math.cos(t1 - t0))) < 0.45) continue;
    let best = 0;
    let bd = Infinity;
    for (let k = 0; k < track.s.length; k += 1) {
      const d = (track.x[k] - b.x) ** 2 + (track.y[k] - b.y) ** 2;
      if (d < bd) {
        bd = d;
        best = track.s[k];
      }
    }
    tips.push({ s: best, p: b });
  }
  tips.sort((x, y) => x.s - y.s);
  const out: Corner[] = [];
  for (const t of tips) {
    const box = { cx: t.p.x, cy: t.p.y, hl: CORNER_HALF, hw: CORNER_HALF, angle: 0 };
    const last = out[out.length - 1];
    if (last && t.s - last.sOut < CORNER_IN + CORNER_OUT + 6) {
      last.sOut = t.s;
      last.boxes.push(box);
      last.zone = makeZone(last.boxes);
    } else out.push({ sIn: t.s, sOut: t.s, boxes: [box], zone: makeZone([box]) });
  }
  return out;
}

interface Corner {
  /** Le premier et le dernier sommet du groupe, le long du trajet. */
  sIn: number;
  sOut: number;
  boxes: OrientedBox[];
  zone: TrafficZone;
}

const REVERSE_SPEED = 1.3;
/** La conduite d'un semi : un grand rayon, des départs posés, et un tracteur qui ne pivote pas vite. */
const TRUCK_STYLE: Partial<MoverStyle> = { radius: 4.5, accel: 0.6, lateral: 0.8, yawRate: 0.45, spin: 0.3 };

/** La marge autour d'un camion où le toucher le choisit encore : large au doigt, juste à la souris. */
const HIT_PAD_FINE = 0.6;
const HIT_PAD_COARSE = 2.2;
/** Un volume qu'on ne voit pas mais qu'on touche : la zone de prise d'un camion. */
const HIT_MATERIAL = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

let dockSeq = 0;

function DockBody({
  bay,
  mode,
  count,
  capacity = 24,
  staging,
  entry,
  via,
  loader,
  batch = 6,
  paused = false,
  roadSpeed = 1,
  electric = false,
  onTruck,
  selectedSlot,
  onTruckSelect,
  onSelectedTruckChange,
  unit = "colis",
  fillLabel = "selected",
  approach,
  leave,
  exit,
  exitVia,
  bounds,
  openings,
  onYardProblem,
}: PlannerDockTrafficProps) {
  const traffic = useTraffic();
  const [dockId] = useState(() => `dock${++dockSeq}`);
  const roadRef = useRef(roadSpeed);
  roadRef.current = Math.max(0.05, roadSpeed);
  const forward = () => FORWARD_SPEED * roadRef.current;
  const backward = () => REVERSE_SPEED * roadRef.current;
  const bays = Math.max(1, Math.round(bay.bays ?? 1));
  const cap = Math.max(1, Math.round(capacity));
  const size = Math.max(1, Math.round(batch));
  const noLoader = loader === "none";
  const vehicle: ShuttleVehicle = loader && loader !== "none" ? loader : mode === "ship" ? "palletJack" : "forklift";
  const countRef = useRef(count);
  countRef.current = count;
  const onTruckRef = useRef(onTruck);
  onTruckRef.current = onTruck;
  const key = JSON.stringify([bay.x, bay.y, bay.rotation, bays, mode, cap, size, staging.x, staging.y, entry?.x, entry?.y, via ?? [], vehicle, approach ?? [], leave ?? [], exit ?? null, exitVia ?? null, bounds ?? null, openings ?? null]);
  const yardRef = useRef(onYardProblem);
  yardRef.current = onYardProblem;

  const engine = useMemo(() => {
    const plan = planDock({ ...bay, bays }, entry, via, { approach, leave, exit, exitVia, bounds, openings });
    // Au montage : chaque place a son camion à quai.
    const slots: Slot[] = plan.lanes.map((lane, i) => ({
      i,
      mover: new Mover(lane.park.x, lane.park.y, lane.park.heading, TRUCK_STYLE),
      present: true,
      docked: true,
      leaving: false,
      loaded: mode === "ship" ? 0 : cap,
      reserved: 0,
      phase: "docked" as DockTruckPhase,
    }));
    const first = plan.lanes[0].apron;
    const home = Math.atan2(first.y - staging.y, first.x - staging.x);
    // Les zones que balaie chaque place : l'arrivée (de l'attente au quai) et le départ (du quai à la
    // sortie). Un seul camion à la fois là où elles se recouvrent — voir `traffic.ts`.
    const corners = plan.lanes.map((lane) => ({ approach: cornersOf(lane.approach, approach ?? []), depart: cornersOf(lane.depart, leave ?? []) }));
    const holds = plan.lanes.map((lane, i) => {
      let h = lane.hold;
      for (const c of [...corners[i].approach].reverse()) if (h > c.sIn - CORNER_IN - 1 && h < c.sOut + CORNER_OUT) h = Math.max(0, c.sIn - CORNER_IN - 1);
      return h;
    });
    const clears = plan.lanes.map((lane, i) => {
      let c0 = lane.clear;
      for (const c of corners[i].depart) if (c0 > c.sIn - CORNER_IN && c0 < c.sOut + CORNER_OUT + 1) c0 = Math.min(lane.depart.length, c.sOut + CORNER_OUT + 1);
      return c0;
    });
    const zones = plan.lanes.map((lane, i) => ({
      arrive: sweptZone(lane.approach, holds[i], lane.approach.length),
      reverse: sweptZone(lane.reverse, 0, lane.reverse.length),
      depart: sweptZone(lane.depart, 0, clears[i]),
    }));
    const arriveZones = zones.map((z) => ({ boxes: [...z.arrive.boxes, ...z.reverse.boxes], aabb: { x0: Math.min(z.arrive.aabb.x0, z.reverse.aabb.x0), y0: Math.min(z.arrive.aabb.y0, z.reverse.aabb.y0), x1: Math.max(z.arrive.aabb.x1, z.reverse.aabb.x1), y1: Math.max(z.arrive.aabb.y1, z.reverse.aabb.y1) } }));
    // Chaque camion dans la circulation de la scène.
    const agents: TrafficAgent[] = slots.map((sl) => ({
      id: `${dockId}:${sl.i}`,
      kind: "truck",
      body: { discs: [...TRACTOR_DISCS, ...TRAILER_DISCS].map(() => ({ x: 0, y: 0 })), radius: TRUCK_DISC_R },
      motion: 0,
      priority: 2,
      waiting: false,
      waited: 0,
      group: dockId,
    }));
    const loaderAgent: TrafficAgent = { id: `${dockId}:loader`, group: dockId, kind: "vehicle", body: { discs: BODY[vehicle].at.map(() => ({ x: 0, y: 0 })), radius: BODY[vehicle].radius }, motion: 0, priority: 0, waiting: false, waited: 0 };
    return { plan, slots, loader: new Mover(staging.x, staging.y, home, STYLES[vehicle]), home, carry: 0, claimed: countRef.current, cursor: 0, zones, arriveZones, agents, loaderAgent, corners, holds, clears, now: 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    const off = [...engine.agents.map((a) => traffic.add(a)), ...(noLoader ? [] : [traffic.add(engine.loaderAgent)])];
    engine.slots.forEach((sl) => truckStep(sl, 0));
    trafficStep(traffic, engine.loaderAgent, engine.loader, vehicle, false, 0);
    return () => off.forEach((f) => f());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, traffic]);
  // Une place où la manœuvre ne tient pas : on le dit, une fois.
  useEffect(() => {
    engine.plan.lanes.forEach((lane, i) => {
      if (lane.blocked) yardRef.current?.({ slot: i, problem: lane.blocked });
    });
  }, [engine]);

  const [awake, setAwake] = useState(false);
  const [loaderView, setLoaderView] = useState<HaulerView>({ carry: 0, moving: false, speed: 0 });
  const loaderShown = useRef(loaderView);
  const cartonsOf = (sl: Slot) => Math.round((Math.max(0, Math.min(cap, sl.loaded)) / cap) * 20);
  const truckViewOf = (sl: Slot): TruckView => ({
    present: sl.present,
    docked: sl.docked,
    cartons: cartonsOf(sl),
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

  // --- Le camion choisi -----------------------------------------------------------------------------
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const [ownSelected, setOwnSelected] = useState<number | null>(null);
  const selected = selectedSlot !== undefined ? selectedSlot : ownSelected;
  const selRef = useRef(selected);
  selRef.current = selected;
  const selectRef = useRef(onTruckSelect);
  selectRef.current = onTruckSelect;
  const changeRef = useRef(onSelectedTruckChange);
  changeRef.current = onSelectedTruckChange;
  /** Ce qu'on dit d'un camion : sa charge, son remplissage, sa phase. */
  const infoOf = (sl: Slot): DockTruckInfo => {
    const departing = sl.phase === "departing";
    const load = departing ? (mode === "ship" ? cap : 0) : Math.max(0, Math.min(cap, Math.round(sl.loaded)));
    return { slot: sl.i, mode, load, capacity: cap, fill: departing ? (mode === "ship" ? 1 : 0) : load / cap, phase: sl.phase };
  };
  const infoKey = (sl: Slot) => {
    const i = infoOf(sl);
    return `${i.load}|${i.phase}`;
  };
  /** La dernière charge et la dernière phase annoncées du camion choisi — on n'annonce que ce qui change. */
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    const sl = selected !== null ? engine.slots[selected] : undefined;
    lastKey.current = sl ? infoKey(sl) : null;
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, engine]);
  const release = () => {
    setOwnSelected(null);
    selectRef.current?.(null);
  };
  const pick = (i: number) => {
    const sl = engine.slots[i];
    if (!sl || !sl.present) return;
    if (selRef.current === i) {
      release();
      return;
    }
    setOwnSelected(i);
    selectRef.current?.(infoOf(sl));
  };
  const coarse = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const pad = coarse ? HIT_PAD_COARSE : HIT_PAD_FINE;
  /** Les gestes sur un camion ne regardent que lui : le plan autour ne doit ni relâcher sa propre
   *  sélection, ni commencer un glisser. On arrête donc l'événement du navigateur lui-même, avant
   *  qu'il n'atteigne les gestionnaires de `WarehousePlanner`. */
  const hitHandlers = (i: number) => ({
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      e.nativeEvent.stopPropagation();
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      e.nativeEvent.stopPropagation();
      pick(i);
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      gl.domElement.style.cursor = "pointer";
    },
    onPointerOut: () => {
      gl.domElement.style.cursor = "";
    },
  });
  useEffect(() => () => void (gl.domElement.style.cursor = ""), [gl]);
  // La couleur du liseré au sol : l'accent du thème, lu dans le conteneur de la toile.
  const accent = useMemo(() => {
    const host = gl.domElement.parentElement ?? document.body;
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;color:var(--lq-color-accent, #6c87c9)";
    host.appendChild(probe);
    const c = parseCss(getComputedStyle(probe).color)?.color ?? new Color("#6c87c9");
    probe.remove();
    return c;
  }, [gl]);
  const ringMaterial = useMemo(
    () => new MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    [accent]
  );
  useEffect(() => () => ringMaterial.dispose(), [ringMaterial]);

  /**
   * Un trajet découpé en morceaux : à chaque coupure, on peut attendre (une zone qu'on demande) ou
   * faire quelque chose (rendre une zone). Entre deux coupures, le camion roule sans s'arrêter ; il
   * ne freine devant une coupure que pour y attendre.
   */
  const segmented = (track: Track, cuts: { s: number; wait?: () => boolean; then?: () => void; stop?: boolean }[], startSpeed: number, endSpeed: number, done?: () => void): MoverTask[] => {
    const list = cuts.filter((c) => c.s > 0.5 && c.s < track.length - 0.5).sort((x, y) => x.s - y.s);
    const out: MoverTask[] = [];
    let from = 0;
    let v0 = startSpeed;
    for (const c of list) {
      // On n'arrête un camion que pour une attente franche (la cour) ; aux carrefours, il ralentit
      // et ne s'arrête que si l'autre est là.
      const v1 = c.wait ? (c.stop ? 0 : FORWARD_SPEED * 0.35) : FORWARD_SPEED;
      out.push({ kind: "track", track: sliceTrack(track, from, c.s), speed: forward, startSpeed: v0, endSpeed: v1 });
      if (c.wait) out.push({ kind: "until", test: c.wait });
      if (c.then) out.push({ kind: "wait", secs: 0, done: c.then });
      from = c.s;
      v0 = c.wait && c.stop ? 0 : v1;
    }
    out.push({ kind: "track", track: from > 0 ? sliceTrack(track, from, track.length) : track, speed: forward, startSpeed: v0, endSpeed, done });
    return out;
  };

  /** Les carrefours d'un trajet : on les demande avant d'y entrer, on les rend une fois passés. */
  const cornerCuts = (track: Track, owner: string, corners: Corner[], s0 = 0, s1 = Infinity) =>
    corners
      .filter((c) => c.sIn - CORNER_IN >= s0 && c.sOut + CORNER_OUT <= s1)
      .flatMap((c) => [
        { s: Math.max(s0 + 0.6, c.sIn - CORNER_IN), wait: () => traffic.reserve(`${owner}#c`, c.zone, engine.now) },
        { s: Math.min(track.length - 0.6, c.sOut + CORNER_OUT), then: () => traffic.release(`${owner}#c`) },
      ]);

  const depart = (sl: Slot) => {
    sl.docked = false;
    sl.leaving = true;
    sl.phase = "departing";
    onTruckRef.current?.({ kind: "depart", slot: sl.i });
    const lane = engine.plan.lanes[sl.i];
    const owner = engine.agents[sl.i].id;
    const gone = () => {
      sl.present = false;
      sl.leaving = false;
      traffic.release(owner);
      traffic.release(`${owner}#c`);
      // Le camion choisi a quitté le site : il n'y a plus rien à montrer.
      if (selRef.current === sl.i) release();
    };
    sl.mover.push(
      // Il ne quitte le quai que la cour libre : un camion qui manœuvre devant lui passe d'abord.
      { kind: "until", test: () => traffic.reserve(owner, engine.zones[sl.i].depart, engine.now) },
      { kind: "wait", secs: 0.8 },
      // Puis il rend la cour une fois sorti, et prend les carrefours de la rue un à un.
      ...segmented(lane.depart, [{ s: engine.clears[sl.i], then: () => traffic.release(owner) }, ...cornerCuts(lane.depart, owner, engine.corners[sl.i].depart, engine.clears[sl.i])], 0, FORWARD_SPEED, gone)
    );
  };

  /** Peut-on faire apparaître un camion au début de l'approche : personne dessus, aucune cour tenue ? */
  const spawnFree = (i: number) => {
    const a = engine.plan.lanes[i].approach;
    const here = { x: a.x[0], y: a.y[0] };
    for (const other of traffic.agents) {
      if (other.ghost || other === engine.agents[i]) continue;
      for (const d of other.body.discs) if (Math.hypot(d.x - here.x, d.y - here.y) < TRUCK.length + 3) return false;
    }
    return traffic.zoneFree(sweptZone(a, 0, Math.min(a.length, TRUCK.length + 2)), engine.agents[i].id);
  };

  const spawn = (sl: Slot) => {
    const lane = engine.plan.lanes[sl.i];
    // Une place où la manœuvre ne tient pas ne reçoit pas de camion.
    if (lane.blocked) return;
    if (!spawnFree(sl.i)) return;
    sl.present = true;
    sl.docked = false;
    sl.loaded = mode === "ship" ? 0 : cap;
    sl.reserved = 0;
    sl.phase = "arriving";
    const a = lane.approach;
    const owner = engine.agents[sl.i].id;
    sl.mover.place(a.x[0], a.y[0], a.heading[0], a.trailer?.[0] ?? a.heading[0]);
    const hold = engine.holds[sl.i];
    const toYard = () => traffic.reserve(owner, engine.arriveZones[sl.i], engine.now);
    sl.mover.push(
      // Il arrive de la rue déjà lancé, prend les carrefours un à un, et s'arrête avant la cour
      // s'il le faut : un camion qui y manœuvre, ou un autre qui attendait avant lui, passe d'abord.
      ...(hold > 0.5 ? [] : [{ kind: "until" as const, test: toYard }]),
      ...segmented(a, [...(hold > 0.5 ? [{ s: hold, wait: toYard, stop: true }] : []), ...cornerCuts(a, owner, engine.corners[sl.i].approach, 0, hold > 0.5 ? hold : Infinity)], FORWARD_SPEED, 0, () => {
        sl.phase = "docking";
      }),
      { kind: "wait", secs: 0.8 },
      {
        kind: "track",
        track: lane.reverse,
        speed: backward,
        done: () => {
          sl.docked = true;
          sl.phase = "docked";
          traffic.release(owner);
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
    if (noLoader) {
      // Sans chargeur : ce que le compteur dit entre (ou sort) directement du camion à quai.
      let pending = countRef.current - engine.claimed;
      const n = engine.slots.length;
      for (let k = 0; k < n && pending > 0; k += 1) {
        const sl = engine.slots[(engine.cursor + k) % n];
        if (!sl.docked || sl.leaving) continue;
        const room = mode === "ship" ? cap - sl.loaded : sl.loaded;
        const q = Math.min(pending, room);
        if (q <= 0) continue;
        engine.cursor = sl.i;
        engine.claimed += q;
        pending -= q;
        sl.loaded += mode === "ship" ? q : -q;
        if (mode === "ship" ? sl.loaded >= cap : sl.loaded <= 0) depart(sl);
      }
      return;
    }
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
        tg.position.set(m.shownX, m.shownY, 0);
        tg.rotation.set(0, 0, m.heading);
      }
      const rg = trailerGroups.current[i];
      if (rg) {
        rg.visible = sl.present;
        rg.position.set(m.shownX, m.shownY, 0);
        rg.rotation.set(0, 0, m.trailer);
      }
    });
    const lg = loaderGroup.current;
    if (lg) {
      lg.position.set(engine.loader.shownX, engine.loader.shownY, 0);
      lg.rotation.set(0, 0, engine.loader.heading);
    }
  };
  useLayoutEffect(sync);

  /** Un camion dans la circulation : sa chenille de disques, où il va, ce qu'il a devant lui. */
  function truckStep(sl: Slot, dt: number) {
    const ag = engine.agents[sl.i];
    const m = sl.mover;
    ag.ghost = !sl.present;
    ag.docked = sl.docked;
    if (!sl.present) return;
    // Sur la route, deux camions qui se croisent serrent chacun leur droite (hors de la cour).
    if (dt > 0 && !m.reversingTrack && !sl.docked) {
      const meet = m.busy ? traffic.oncoming(ag, 10) : null;
      const want = meet ? Math.max(0, Math.min(0.7, m.side + meet.need / 2)) : 0;
      m.side += (want - m.side) * Math.min(1, dt * 1.5);
      if (Math.abs(m.side) < 1e-3 && !meet) m.side = 0;
    } else if (sl.docked) m.side = 0;
    const ct = Math.cos(m.heading);
    const st = Math.sin(m.heading);
    const cr = Math.cos(m.trailer);
    const sr = Math.sin(m.trailer);
    const hx = m.shownX;
    const hy = m.shownY;
    TRACTOR_DISCS.forEach((u, k) => {
      ag.body.discs[k].x = hx + u * ct;
      ag.body.discs[k].y = hy + u * st;
    });
    TRAILER_DISCS.forEach((u, k) => {
      ag.body.discs[TRACTOR_DISCS.length + k].x = hx + u * cr;
      ag.body.discs[TRACTOR_DISCS.length + k].y = hy + u * sr;
    });
    // En marche arrière, c'est derrière la remorque qu'il faut regarder ; dans la cour qu'il tient,
    // il manœuvre sans attendre (la zone est à lui seul).
    ag.motion = m.reversing ? m.trailer + Math.PI : m.heading;
    if (dt > 0 && m.busy && !m.reversing) {
      const free = traffic.freeAhead(ag, 12);
      const target = throttleFor(free, 1.2, 6);
      m.throttle = target < m.throttle ? target : m.throttle + (target - m.throttle) * Math.min(1, dt * 1.5);
      ag.waiting = m.throttle < 0.05 && free !== Infinity;
      ag.waited = ag.waiting ? ag.waited + dt : 0;
    } else m.throttle = 1;
    traffic.sense(ag.id, m.x, m.y);
  }

  useSimFrame(
    (t) => {
      const dt = clock.tick(t);
      engine.now = t;
      schedule();
      for (const sl of engine.slots) truckStep(sl, dt);
      if (!noLoader) trafficStep(traffic, engine.loaderAgent, engine.loader, vehicle, engine.carry > 0, dt);
      for (const sl of engine.slots) sl.mover.step(dt);
      engine.loader.step(dt);
      schedule();
      sync();
      // Relire l'état montré sans rien allouer tant qu'il n'a pas changé : c'est le cas de presque
      // toutes les images.
      const ls = loaderShown.current;
      const lSpeed = shownSpeed(engine.loader.speed);
      if (ls.carry !== engine.carry || ls.moving !== engine.loader.moving || Math.abs(ls.speed - lSpeed) >= 1e-3) setLoaderView((loaderShown.current = { carry: engine.carry, moving: engine.loader.moving, speed: lSpeed }));
      const prev = trucksShown.current;
      let same = prev.length === engine.slots.length;
      for (let i = 0; same && i < engine.slots.length; i += 1) {
        const sl = engine.slots[i];
        const p = prev[i];
        same = p.present === sl.present && p.docked === sl.docked && p.cartons === cartonsOf(sl) && p.rolling === (sl.mover.moving ? shownSpeed(sl.mover.speed) : 0);
      }
      if (!same) setTrucks((trucksShown.current = engine.slots.map(truckViewOf)));
      // Le camion choisi : sa charge ou sa phase a-t-elle changé depuis la dernière annonce ?
      const sel = selRef.current;
      const chosen = sel !== null ? engine.slots[sel] : undefined;
      if (chosen && chosen.present) {
        const k = infoKey(chosen);
        if (k !== lastKey.current) {
          lastKey.current = k;
          changeRef.current?.(infoOf(chosen));
        }
      }
      // Une place sans manœuvre possible n'attend pas de camion : elle ne tient pas la scène éveillée.
      const busy = engine.loader.busy || engine.slots.some((sl) => sl.mover.busy || (!sl.present && !engine.plan.lanes[sl.i].blocked));
      if (!busy) {
        clock.reset();
        setAwake(false);
      }
    },
    awake && !paused
  );

  // --- La jauge de remplissage ---------------------------------------------------------------------
  // Des étiquettes du document, posées par-dessus la toile et recalées à chaque image dessinée sur
  // le point au-dessus de la remorque : aucun rendu React pendant que le camion roule, seulement une
  // transformation CSS. Leur contenu n'est réécrit que quand la charge change.
  const labelHost = useRef<HTMLDivElement | null>(null);
  const labels = useRef<{ el: HTMLDivElement; fill: HTMLSpanElement; pct: HTMLSpanElement; count: HTMLSpanElement; key: string }[]>([]);
  useEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;
    const host = document.createElement("div");
    host.className = "lq-dock-gauges";
    host.setAttribute("aria-live", "polite");
    parent.appendChild(host);
    labelHost.current = host;
    return () => {
      host.remove();
      labelHost.current = null;
      labels.current = [];
    };
  }, [gl]);
  const labelFor = (i: number) => {
    const have = labels.current[i];
    if (have) return have;
    const host = labelHost.current;
    if (!host) return null;
    const el = document.createElement("div");
    el.className = "lq-dock-gauge";
    const head = document.createElement("div");
    head.className = "lq-dock-gauge__head";
    const pct = document.createElement("span");
    pct.className = "lq-dock-gauge__pct";
    const cnt = document.createElement("span");
    cnt.className = "lq-dock-gauge__count";
    head.append(pct, cnt);
    const bar = document.createElement("div");
    bar.className = "lq-dock-gauge__bar";
    const fill = document.createElement("span");
    bar.append(fill);
    el.append(head, bar);
    host.append(el);
    return (labels.current[i] = { el, fill, pct, count: cnt, key: "" });
  };
  const anchor = useMemo(() => new Vector3(), []);
  useFrame((state) => {
    if (!labelHost.current) return;
    const sel = selRef.current;
    const { width, height } = state.size;
    engine.slots.forEach((sl, i) => {
      const isSel = sel === i;
      const show = sl.present && fillLabel !== "none" && (isSel || (fillLabel === "always" && sl.docked));
      const existing = labels.current[i];
      if (!show) {
        if (existing) existing.el.style.display = "none";
        return;
      }
      const lab = labelFor(i);
      const rg = trailerGroups.current[i];
      if (!lab || !rg) return;
      const info = infoOf(sl);
      const key = `${info.load}|${info.phase}|${isSel ? 1 : 0}|${unit}`;
      if (key !== lab.key) {
        lab.key = key;
        const level = info.fill >= 0.999 ? "full" : info.fill >= 0.75 ? "high" : info.fill >= 0.34 ? "mid" : "low";
        lab.el.className = ["lq-dock-gauge", isSel ? "is-selected" : "is-compact", `lq-dock-gauge--${mode}`].join(" ");
        lab.el.dataset.level = level;
        lab.fill.style.width = `${Math.round(info.fill * 100)}%`;
        lab.pct.textContent = `${Math.round(info.fill * 100)} %`;
        lab.count.textContent = isSel ? `${info.load} / ${info.capacity} ${unit}` : "";
        lab.el.setAttribute("aria-label", `Camion place ${i + 1} : ${info.load} sur ${info.capacity} ${unit}, ${Math.round(info.fill * 100)} %`);
      }
      // Le point de la jauge : au-dessus du milieu de la remorque, dans le repère de la sellette.
      rg.updateWorldMatrix(true, false);
      anchor.set(TRUCK.trailer / 2 - TRUCK.kingpin, 0, TRUCK.trailerTop + 0.6);
      rg.localToWorld(anchor);
      anchor.project(state.camera);
      const behind = anchor.z > 1;
      lab.el.style.display = behind ? "none" : "";
      lab.el.style.transform = `translate(${((anchor.x + 1) / 2) * width}px, ${((1 - anchor.y) / 2) * height}px) translate(-50%, -100%)`;
    });
  });

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
              <mesh material={HIT_MATERIAL} position={[(TRUCK.tractor0 + TRUCK.cab1) / 2 - TRUCK.kingpin, 0, TRUCK.cabTop / 2]} {...hitHandlers(i)}>
                <boxGeometry args={[TRUCK.cab1 - TRUCK.tractor0 + pad, TRUCK.width + pad, TRUCK.cabTop + pad]} />
              </mesh>
              {selected === i && <GroundRing x0={TRUCK.tractor0 - TRUCK.kingpin} x1={TRUCK.cab1 - TRUCK.kingpin} half={TRUCK.width / 2} material={ringMaterial} />}
            </group>
            <group ref={(el) => (trailerGroups.current[i] = el)}>
              <SemiTruck vehicle="trailer" origin={hitch} rotation={0} doorsOpen={v.docked} load={Array.from({ length: v.cartons }, () => "carton" as const)} rolling={v.rolling} variant={variant} />
              <mesh material={HIT_MATERIAL} position={[TRUCK.trailer / 2 - TRUCK.kingpin, 0, TRUCK.trailerTop / 2]} {...hitHandlers(i)}>
                <boxGeometry args={[TRUCK.trailer + pad, TRUCK.width + pad, TRUCK.trailerTop + pad]} />
              </mesh>
              {selected === i && <GroundRing x0={-TRUCK.kingpin} x1={TRUCK.trailer - TRUCK.kingpin} half={TRUCK.width / 2} material={ringMaterial} />}
            </group>
          </group>
        );
      })}
      {!noLoader && (
        <group ref={loaderGroup}>
          <Hauler vehicle={vehicle} load="carton" batch={size} view={loaderView} />
        </group>
      )}
    </group>
  );
}

/** Le liseré au sol d'un camion choisi : un cadre plat, un peu plus large que le véhicule, dans la
 *  couleur d'accent — il se voit de jour comme de nuit (une matière qui ne prend pas la lumière). */
function GroundRing({ x0, x1, half, material }: { x0: number; x1: number; half: number; material: MeshBasicMaterial }) {
  const m = 0.45;
  const t = 0.22;
  const a = x0 - m;
  const b = x1 + m;
  const h = half + m;
  const z = 0.03;
  const bars: [number, number, number, number][] = [
    [(a + b) / 2, h, b - a + t, t],
    [(a + b) / 2, -h, b - a + t, t],
    [a, 0, t, 2 * h],
    [b, 0, t, 2 * h],
  ];
  return (
    <group>
      {bars.map(([x, y, w, d], k) => (
        <mesh key={k} position={[x, y, z]} material={material} renderOrder={2}>
          <planeGeometry args={[w, d]} />
        </mesh>
      ))}
    </group>
  );
}

// --- La flotte : un transporteur, plusieurs tâches ---------------------------------------------------

/** Une tâche d'un transporteur : un flux, sa part du temps, son compteur. */
export interface TransporterTask {
  id: string;
  /** Où il charge, et où il décharge. En cases. */
  from: Pt;
  to: Pt;
  /** La part de son temps qu'on lui donne, de 0 à 1 (les parts se comparent entre elles). */
  share: number;
  /** Le nombre **cumulé** d'unités à porter, comme `PlannerShuttle.trips`. */
  trips: number;
  /** Ce qu'il porte pour cette tâche. Défaut : une palette. */
  load?: HaulLoad;
  /** Ce qu'un voyage emporte au plus. Défaut : 1. */
  batch?: number;
  /** Un nom, pour les routes montrées (`showTasks`). */
  label?: string;
}

export interface PlannerTransporterProps {
  id: string;
  /** L'engin : chariot, transpalette, opérateur à pied, robot. */
  vehicle: ShuttleVehicle;
  tasks: TransporterTask[];
  /** Où il se gare quand il n'a rien à faire. Défaut : le départ de sa première tâche. */
  home?: Pt;
  /** Les emprises qui barrent le passage, comme `PlannerShuttle.obstacles`. */
  obstacles?: AisleObstacle[];
  paused?: boolean;
  /** En cases par seconde. Défaut : 2,2. */
  speed?: number;
  /** Le temps de charger ou de décharger, en secondes. Défaut : 1,2. */
  dwell?: number;
  /** Choisi : un liseré au sol, son nom (`label`) au-dessus de lui, et ses routes si `showTasks`. */
  selected?: boolean;
  /** Touché (clic, tapotement) — la zone de prise est large au doigt ; le plan n'en voit rien. */
  onSelect?: (id: string) => void;
  label?: string;
  /** Choisi, montrer les routes de ses tâches, en léger, avec leur part. */
  showTasks?: boolean;
  /** Ce qu'il fait : la tâche en cours, ou `null` (il rentre, il attend). Seulement quand cela change. */
  onActivity?: (e: { taskId: string | null }) => void;
  /** Un voyage est fini : `units` posées à destination pour la tâche `taskId`. */
  onTripDone?: (e: { taskId: string; units: number }) => void;
}

/** La demi-vie de la mémoire du temps passé : au-delà, les parts se jugent sur le présent. */
const SHARE_HALF_LIFE = 60;

/**
 * Un transporteur de **flotte** : un seul engin, plusieurs tâches, comme dans un vrai entrepôt — le
 * même chariot décharge les camions, range en rack et approvisionne le tapis.
 *
 * ## Le partage du temps
 *
 *  Chaque tâche a sa part (`share`) et son compteur cumulé (`trips`). Quand il a fini un voyage,
 *  l'engin choisit parmi les tâches qui ont du travail **celle qui est le plus en retard sur sa
 *  part** : l'écart entre le temps qu'elle aurait dû recevoir et celui qu'elle a reçu, sur une
 *  mémoire glissante (demi-vie d'une minute). Tant que toutes ont du travail, le temps passé sur
 *  chacune converge vers sa part ; une tâche sans travail cède le sien aux autres. Tout le voyage
 *  compte pour la tâche : aller à vide, charger, porter, décharger.
 *
 *  Il roule par les allées (`obstacles`) et dans la circulation de la scène (voir `traffic.ts`) ;
 *  sans rien à faire, il rentre à `home` et y attend.
 */
export function PlannerTransporter(props: PlannerTransporterProps) {
  const pts = props.tasks.flatMap((t) => [t.from, t.to]);
  const bounds = boundsOf([...(props.home ? [props.home] : []), ...(pts.length ? pts : [{ x: 0, y: 0 }])]);
  return (
    <Solo bounds={bounds} cellSize={30} ariaLabel={props.label ?? "Transporteur"}>
      <TransporterBody {...props} />
    </Solo>
  );
}

function TransporterBody({ id, vehicle, tasks, home, obstacles, paused = false, speed = 2.2, dwell = 1.2, selected = false, onSelect, label, showTasks = false, onActivity, onTripDone }: PlannerTransporterProps) {
  const tripRef = useRef(onTripDone);
  tripRef.current = onTripDone;
  const clearance = VEHICLE_CLEARANCE[vehicle];
  const lane = BODY[vehicle].radius + 0.08;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const obstaclesRef = useRef(obstacles);
  obstaclesRef.current = obstacles;
  const activityRef = useRef(onActivity);
  activityRef.current = onActivity;
  const base = home ?? tasks[0]?.from ?? { x: 0, y: 0 };
  const { traffic, agent } = useTrafficAgent(`transporteur:${id}`, vehicle);
  const engine = useMemo(() => {
    // Au montage, ce que chaque compteur dit est déjà fait.
    const claimed = new Map<string, number>();
    for (const t of tasksRef.current) claimed.set(t.id, t.trips);
    return { mover: new Mover(base.x, base.y, 0, STYLES[vehicle]), claimed, spent: new Map<string, number>(), current: null as string | null, carry: 0, load: "palette" as HaulLoad, batch: 1, home: base, told: undefined as string | null | undefined };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, vehicle, base.x, base.y]);
  const [view, setView] = useState<HaulerView>({ carry: 0, moving: false, speed: 0 });
  const [shownLoad, setShownLoad] = useState<{ load: HaulLoad; batch: number }>({ load: "palette", batch: 1 });
  const shown = useRef(view);
  const [awake, setAwake] = useState(false);
  const group = useRef<Group>(null);
  const clock = useLocalClock();

  const pending = (t: TransporterTask) => {
    if (!engine.claimed.has(t.id)) engine.claimed.set(t.id, t.trips);
    const c = engine.claimed.get(t.id) ?? 0;
    if (t.trips < c) engine.claimed.set(t.id, t.trips);
    return Math.max(0, t.trips - (engine.claimed.get(t.id) ?? 0));
  };
  // Un compteur qui monte réveille l'engin.
  useEffect(() => {
    if (tasks.some((t) => t.share > 0 && pending(t) > 0)) setAwake(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, engine]);
  useEffect(() => {
    clock.reset();
    if (!paused) setAwake(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, engine]);

  const tell = (taskId: string | null) => {
    if (engine.told === taskId) return;
    engine.told = taskId;
    activityRef.current?.({ taskId });
  };

  /** La tâche la plus en retard sur sa part, parmi celles qui ont du travail. */
  const pick = (): TransporterTask | null => {
    const ready = tasksRef.current.filter((t) => t.share > 0 && pending(t) > 0);
    if (!ready.length) return null;
    const sumShare = ready.reduce((s, t) => s + t.share, 0);
    let total = 0;
    for (const v of engine.spent.values()) total += v;
    let best: TransporterTask | null = null;
    let bestDeficit = -Infinity;
    for (const t of ready) {
      const deficit = (t.share / sumShare) * total - (engine.spent.get(t.id) ?? 0);
      if (deficit > bestDeficit + 1e-9) {
        bestDeficit = deficit;
        best = t;
      }
    }
    return best;
  };

  const schedule = () => {
    const m = engine.mover;
    if (m.busy) return;
    const t = pick();
    const here = { x: m.x, y: m.y };
    if (!t) {
      engine.current = null;
      tell(null);
      if (Math.hypot(here.x - engine.home.x, here.y - engine.home.y) > 0.3) m.push({ kind: "go", to: shuttleLegs([here, engine.home], obstaclesRef.current, clearance, lane), speed });
      return;
    }
    const k = Math.min(pending(t), Math.max(1, Math.round(t.batch ?? 1)));
    engine.claimed.set(t.id, (engine.claimed.get(t.id) ?? 0) + k);
    engine.current = t.id;
    engine.load = t.load ?? "palette";
    engine.batch = Math.max(1, Math.round(t.batch ?? 1));
    tell(t.id);
    const obs = obstaclesRef.current;
    m.push(
      ...(Math.hypot(here.x - t.from.x, here.y - t.from.y) > 0.3 ? [{ kind: "go" as const, to: shuttleLegs([here, t.from], obs, clearance, lane), speed }] : []),
      {
        kind: "wait",
        secs: dwell,
        done: () => {
          engine.carry = k;
        },
      },
      { kind: "go", to: shuttleLegs([t.from, t.to], obs, clearance, lane), speed },
      {
        kind: "wait",
        secs: dwell,
        done: () => {
          engine.carry = 0;
          tripRef.current?.({ taskId: t.id, units: k });
        },
      }
    );
  };

  const sync = () => {
    const g = group.current;
    if (!g) return;
    g.position.set(engine.mover.shownX, engine.mover.shownY, 0);
    g.rotation.set(0, 0, engine.mover.heading);
  };
  useLayoutEffect(sync);
  useLayoutEffect(() => trafficStep(traffic, agent, engine.mover, vehicle, false, 0), [traffic, agent, engine, vehicle]);

  useSimFrame(
    (t) => {
      const dt = clock.tick(t);
      // Le temps passé : la mémoire s'efface, et le présent s'ajoute à la tâche en cours.
      const fade = Math.pow(0.5, dt / SHARE_HALF_LIFE);
      for (const [k, v] of engine.spent) engine.spent.set(k, v * fade);
      if (engine.current) engine.spent.set(engine.current, (engine.spent.get(engine.current) ?? 0) + dt);
      schedule();
      trafficStep(traffic, agent, engine.mover, vehicle, engine.carry > 0, dt, obstaclesRef.current);
      engine.mover.step(dt);
      schedule();
      sync();
      const next: HaulerView = { carry: engine.carry, moving: engine.mover.moving, speed: shownSpeed(engine.mover.speed) };
      if (!sameView(shown.current, next)) setView((shown.current = next));
      if (shownLoad.load !== engine.load || shownLoad.batch !== engine.batch) setShownLoad({ load: engine.load, batch: engine.batch });
      if (!engine.mover.busy && !tasksRef.current.some((x) => x.share > 0 && pending(x) > 0)) {
        clock.reset();
        setAwake(false);
      }
    },
    awake && !paused
  );

  // --- Le choix et ce qu'on montre quand il est choisi ---------------------------------------------
  const gl = useThree((s) => s.gl);
  const accentMat = useAccentMaterial();
  const coarse = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const pad = coarse ? HIT_PAD_COARSE : HIT_PAD_FINE;
  const size = VEHICLE_SIZE[vehicle];
  const routes = useMemo(
    () => (selected && showTasks ? tasks.map((t) => ({ id: t.id, label: t.label ?? t.id, share: t.share, pts: [t.from, ...shuttleLegs([t.from, t.to], obstacles, clearance, lane)] })) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, showTasks, JSON.stringify(tasks.map((t) => [t.id, t.from, t.to, t.share, t.label])), obstacles]
  );
  const sumShare = tasks.reduce((s, t) => s + Math.max(0, t.share), 0) || 1;
  const tags = useSceneTags(
    [
      ...(selected && label ? [{ key: "name", text: label, at: () => ({ x: engine.mover.shownX, y: engine.mover.shownY, z: 3.4 }), strong: true }] : []),
      ...routes.map((r) => {
        const mid = r.pts[Math.floor(r.pts.length / 2)];
        return { key: `task-${r.id}`, text: `${r.label} · ${Math.round((Math.max(0, r.share) / sumShare) * 100)} %`, at: () => ({ x: mid.x, y: mid.y, z: 0.6 }), strong: false };
      }),
    ],
    [selected, label, routes.length]
  );
  void tags;

  return (
    <group>
      <group ref={group} name={label ?? id}>
        <Hauler vehicle={vehicle} load={shownLoad.load} batch={shownLoad.batch} view={view} />
        {onSelect && (
          <mesh
            material={HIT_MATERIAL}
            position={[0, 0, 1]}
            onPointerDown={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              e.nativeEvent.stopPropagation();
            }}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              e.nativeEvent.stopPropagation();
              onSelect(id);
            }}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              gl.domElement.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              gl.domElement.style.cursor = "";
            }}
          >
            <boxGeometry args={[size.length + pad, size.width + pad, 2 + pad]} />
          </mesh>
        )}
        {selected && <GroundRing x0={-size.length / 2} x1={size.length / 2} half={size.width / 2} material={accentMat} />}
      </group>
      {routes.map((r) => (
        <RouteLine key={r.id} pts={r.pts} material={accentMat} />
      ))}
    </group>
  );
}

/** L'emprise de chaque engin, pour sa zone de prise et son liseré. */
const VEHICLE_SIZE: Record<ShuttleVehicle, { length: number; width: number }> = {
  palletJack: { length: 1.9, width: 0.8 },
  forklift: { length: 2.7, width: 1.1 },
  worker: { length: 0.6, width: 0.6 },
  amr: { length: 1.6, width: 1.15 },
};

/** Une route montrée au sol : un ruban fin dans la couleur d'accent, à peine posé. */
function RouteLine({ pts, material }: { pts: Pt[]; material: MeshBasicMaterial }) {
  const segs = pts.slice(1).map((p, i) => {
    const a = pts[i];
    const len = Math.hypot(p.x - a.x, p.y - a.y);
    return { x: (a.x + p.x) / 2, y: (a.y + p.y) / 2, len, angle: Math.atan2(p.y - a.y, p.x - a.x) };
  });
  return (
    <group>
      {segs.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, 0.025]} rotation={[0, 0, s.angle]} material={material} renderOrder={2}>
          <planeGeometry args={[s.len + 0.12, 0.12]} />
        </mesh>
      ))}
    </group>
  );
}

/** La matière de l'accent du thème, lue dans le conteneur de la toile, pour les liserés et les routes. */
function useAccentMaterial(opacity = 0.9) {
  const gl = useThree((s) => s.gl);
  const mat = useMemo(() => {
    const host = gl.domElement.parentElement ?? document.body;
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;color:var(--lq-color-accent, #6c87c9)";
    host.appendChild(probe);
    const c = parseCss(getComputedStyle(probe).color)?.color ?? new Color("#6c87c9");
    probe.remove();
    return new MeshBasicMaterial({ color: c, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  }, [gl, opacity]);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

/**
 * Des étiquettes du document posées sur des points de la scène, recalées à chaque image dessinée
 * (une transformation CSS, pas un rendu React) : le nom d'un engin choisi, la part d'une route.
 */
function useSceneTags(tags: { key: string; text: string; at: () => { x: number; y: number; z: number }; strong: boolean }[], deps: unknown[]) {
  const gl = useThree((s) => s.gl);
  const els = useRef(new Map<string, HTMLDivElement>());
  const list = useRef(tags);
  list.current = tags;
  const v = useMemo(() => new Vector3(), []);
  useEffect(() => {
    const parent = gl.domElement.parentElement;
    if (!parent) return;
    const host = document.createElement("div");
    host.className = "lq-dock-gauges";
    parent.appendChild(host);
    for (const t of list.current) {
      const el = document.createElement("div");
      el.className = ["lq-scene-tag", t.strong && "is-strong"].filter(Boolean).join(" ");
      el.textContent = t.text;
      host.appendChild(el);
      els.current.set(t.key, el);
    }
    return () => {
      host.remove();
      els.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, ...deps]);
  useFrame((state) => {
    const { width, height } = state.size;
    for (const t of list.current) {
      const el = els.current.get(t.key);
      if (!el) continue;
      if (el.textContent !== t.text) el.textContent = t.text;
      const p = t.at();
      // Le plan est posé sous la matrice qui échange x et y (voir `scene.tsx`).
      v.set(p.y, p.x, p.z).project(state.camera);
      el.style.transform = `translate(${((v.x + 1) / 2) * width}px, ${((1 - v.y) / 2) * height}px) translate(-50%, -100%)`;
    }
  });
  return els;
}
