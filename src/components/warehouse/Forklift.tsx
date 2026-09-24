import { useRef } from "react";
import { Matrix4, type Group } from "three";
import { Builder, roundedRect } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { useSimFrame } from "./three/time";
import { GOOD_SIZE, addGood } from "./three/goods";
import { addWorker } from "./Worker";
import type { RackItemKind } from "./rackItems";
import "./rackItems.css";
import "./Forklift.css";

/**
 * Chariot élévateur — un contrepoids, un poste de conduite sous son toit de protection, un mât, des
 * fourches.
 *
 * Même vocabulaire que l'étagère et le picker (`rackItems.tsx`) : des volumes alignés sur les axes,
 * trois faces, trois clartés d'une seule lumière, faces visibles choisies d'après la rotation, et les
 * **mêmes roues rondes** (`isoWheel`).
 *
 * ## Les pièces, et pourquoi chacune est là
 *
 * Le **contrepoids** à l'arrière : c'est lui qui fait qu'un chariot porte une palette en porte-à-faux
 * sans basculer, et c'est la masse qui le distingue d'un transpalette à main. Le **toit de
 * protection** sur ses quatre montants : ce qui tombe d'un rayonnage tombe sur lui. Le **mât** à
 * l'avant, deux montants et un vérin entre eux, et devant lui le **tablier** et ses deux fourches, qui
 * montent et descendent — c'est la seule chose que la machine fait sans rouler. Les roues avant sont
 * plus grandes que les arrière : ce sont elles qui portent la charge.
 *
 * ## L'ordre de peinture
 *
 * Le chariot se range en **tranches le long de sa longueur** qui ne se chevauchent jamais — le
 * contrepoids, le poste, le mât, les fourches — et leur ordre est celui où la caméra les voit le long
 * de cet axe, ce que `xFace` dit déjà. Dans une tranche, ce qui est à gauche et à droite se range
 * par `yFace` : la roue du fond avant la caisse, celle de devant après ; les montants du fond du toit
 * avant le siège, ceux de devant après, et le toit par-dessus tout. Lu sur les axes du chariot et non
 * sur des emprises au sol, cet ordre tient à tout cap — un chariot qui tourne n'a pas d'emprises
 * alignées sur les axes du monde.
 *
 * ## La levée
 *
 * Le tablier monte par une **translation**, qui reste une translation à l'écran sous cette caméra
 * affine : un seul `translate()` sur un groupe, et des `@keyframes` qui disent de combien. À
 * l'arrêt, les fourches sont à `lift` ; en marche, elles montent jusque-là et redescendent, avec un
 * palier en haut — le temps de poser ou de prendre.
 */

export interface ForkliftProps {
  /** Hauteur des fourches au-dessus du sol, en cases. En marche, le haut de leur course. */
  lift?: number;
  /** Hauteur du mât, en cases. */
  mastHeight?: number;
  /** Ce qu'il porte : une palette, chargée ou non. `null` : fourches vides. */
  load?: RackItemKind | null;
  /** Les fourches montent et descendent. */
  running?: boolean;
  /** Durée d'un aller-retour des fourches, en secondes. */
  cycle?: number;
  /** Rotation sur le sol, en degrés. À 0, les fourches regardent vers les `x` croissants. */
  rotation?: number;
  /** Poser l'ombre au sol. */
  shadows?: boolean;
  /** Où poser le chariot sur le sol, en cases. */
  origin?: { x: number; y: number };
  /** Le pavé du monde que la `viewBox` doit couvrir, en cases. Partagé avec les autres modules
   *  d'une scène, il leur donne exactement le même repère à l'écran. */
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  /** Ce qu'on dessine : tout, l'ombre seule, ou le chariot seul. */
  parts?: "all" | "shadow" | "machine";
  /** Vitesse au sol, en cases par seconde de simulation : les roues tournent d'autant. */
  rolling?: number;
  /** Un cariste au volant. */
  driver?: boolean;
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}


/** L'emprise du chariot, en cases : longueur fourches comprises, largeur. */
const LENGTH = 2.7;
const WIDTH = 1;

/** Le bas de la course des fourches : juste au-dessus du sol, pour glisser sous une palette. */
const FLOOR = 0.05;


export function Forklift(props: ForkliftProps) {
  const { mastHeight = 2.1, rotation = 0, origin = { x: 0, y: 0 }, frame, parts = "all", cellSize = 40, className } = props;
  if (parts === "shadow") return null;
  const { bounds } = placed(origin, rotation, { x0: 0, x1: LENGTH, y0: 0, y1: WIDTH, z0: 0, z1: Math.max(1.6, mastHeight) + 0.05 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={["lq-forklift", className].filter(Boolean).join(" ")} ariaLabel="Chariot élévateur">
      <ForkliftBody {...props} />
    </Solo>
  );
}

/**
 * La levée d'un vérin : un aller-retour par cycle, avec un palier en haut — le temps de poser ou de
 * prendre — et une accélération douce à chaque bout. `u` est la fraction du cycle, le résultat la
 * fraction de la course.
 */
function liftCurve(u: number): number {
  const ease = (x: number) => x * x * (3 - 2 * x);
  if (u < 0.4) return ease(u / 0.4);
  if (u < 0.6) return 1;
  return 1 - ease((u - 0.6) / 0.4);
}

function ForkliftBody({ lift = 1.2, mastHeight = 2.1, load = "carton", running = false, cycle = 5, rotation = 0, origin = { x: 0, y: 0 }, rolling = 0, driver = true }: ForkliftProps) {
  const mastTop = Math.max(1.2, mastHeight);
  const top = Math.max(FLOOR, Math.min(lift, mastTop - 0.55));
  const { pose } = placed(origin, rotation, { x0: 0, x1: LENGTH, y0: 0, y1: WIDTH, z0: 0, z1: 1 });
  const bodyY0 = 0.08;
  const bodyY1 = WIDTH - 0.08;
  const deck = 0.5;
  const roofZ = 1.55;
  const pillar = 0.06;
  const rearR = 0.17;
  const frontR = 0.22;
  const tyre = 0.14;

  // ---- Le châssis : tout ce qui ne lève pas ----
  const chassis = useBuilt(() => {
    const b = new Builder();
    // Le contrepoids, arrondi, avec son chapeau : c'est lui qui fait basculer l'œil vers l'arrière.
    b.prism("safety", roundedRect(0, 0.46, bodyY0, bodyY1, 0.1, 3), 0.1, 0.8);
    b.prism("safety", roundedRect(0.03, 0.46, bodyY0 + 0.03, bodyY1 - 0.03, 0.09, 3), 0.8, 0.86);
    // La caisse, le tableau de bord, la colonne de direction et son volant.
    b.prism("safety", roundedRect(0.45, 1.46, bodyY0, bodyY1, 0.12, 3), 0.12, deck);
    b.prism("safety", roundedRect(1.2, 1.45, 0.16, 0.84, 0.09, 3), deck, deck + 0.28);
    b.box("iron", 1.14, 1.2, 0.47, 0.53, deck + 0.26, deck + 0.46);
    b.cylinder("iron", 1.1, WIDTH / 2, deck + 0.5, 0.11, 0.025, "x", 16);
    // Le siège et son dossier.
    b.prism("iron", roundedRect(0.5, 0.6, 0.3, 0.7, 0.05, 2), deck + 0.16, deck + 0.54);
    b.prism("iron", roundedRect(0.58, 0.9, 0.3, 0.7, 0.07, 2), deck, deck + 0.16);
    // Le protège-conducteur : quatre montants, deux longerons, une grille de barreaux.
    for (const y0 of [bodyY0 + 0.02, bodyY1 - 0.02 - pillar]) for (const x0 of [0.47, 1.37]) b.box("iron", x0, x0 + pillar, y0, y0 + pillar, deck, roofZ);
    for (const y of [bodyY0, bodyY1 - 0.07]) b.box("iron", 0.44, 1.48, y, y + 0.07, roofZ, roofZ + 0.05);
    for (const x of [0.52, 0.76, 1.0, 1.24]) b.box("iron", x, x + 0.05, bodyY0 + 0.07, bodyY1 - 0.07, roofZ + 0.01, roofZ + 0.04);
    // Le mât : deux montants, le vérin entre eux, la traverse haute.
    b.box("iron", 1.48, 1.58, 0.14, 0.24, 0.1, mastTop);
    b.box("iron", 1.48, 1.58, 0.76, 0.86, 0.1, mastTop);
    b.cylinder("steel", 1.53, 0.5, 0.1 + (mastTop * 0.62 - 0.1) / 2, 0.035, mastTop * 0.62 - 0.1, "z", 12);
    b.box("iron", 1.48, 1.58, 0.14, 0.86, mastTop - 0.08, mastTop);
    // Le gyrophare, sur le toit : le signal que tout le monde cherche des yeux dans une allée.
    b.cylinder("safety", 0.52, bodyY0 + 0.1, roofZ + 0.1, 0.035, 0.07, "z", 10);
    // Le cariste, assis.
    if (driver) b.within(new Matrix4().makeTranslation(0.66, WIDTH / 2, deck + 0.16), () => addWorker(b, "sit"));
    return b.build();
  }, [mastTop, driver]);

  // ---- Les roues : à part, parce qu'elles tournent ----
  const rearWheel = useBuilt(() => {
    const b = new Builder();
    b.cylinder("rubber", 0, 0, 0, rearR, tyre, "y", 18);
    b.cylinder("chrome", 0, 0, 0, rearR * 0.5, tyre + 0.01, "y", 12);
    b.box("chrome", -rearR * 0.5, rearR * 0.5, -tyre / 2 - 0.006, tyre / 2 + 0.006, -0.012, 0.012, false);
    return b.build();
  }, []);
  const frontWheel = useBuilt(() => {
    const b = new Builder();
    b.cylinder("rubber", 0, 0, 0, frontR, tyre, "y", 18);
    b.cylinder("chrome", 0, 0, 0, frontR * 0.5, tyre + 0.01, "y", 12);
    b.box("chrome", -frontR * 0.5, frontR * 0.5, -tyre / 2 - 0.006, tyre / 2 + 0.006, -0.012, 0.012, false);
    return b.build();
  }, []);

  // ---- Ce qui lève : tablier, dosseret, fourches, et la charge dessus ----
  const tineTop = FLOOR + 0.05;
  const carriage = useBuilt(() => {
    const b = new Builder();
    b.box("iron", 1.6, 1.66, 0.1, 0.9, FLOOR, FLOOR + 0.5);
    for (const y of [0.14, 0.38, 0.62, 0.86]) b.box("iron", 1.6, 1.64, y, y + 0.05, FLOOR + 0.5, FLOOR + 1.05);
    b.box("iron", 1.6, 1.64, 0.1, 0.9, FLOOR + 1.0, FLOOR + 1.05);
    for (const y of [0.29, 0.71]) b.box("iron", 1.66, 2.65, y - 0.05, y + 0.05, FLOOR, tineTop);
    if (load) {
      // La palette sur les fourches, et la marchandise dessus : les mêmes objets que partout.
      const cx = 1.72 + 0.45;
      const pal = GOOD_SIZE.palette;
      addGood(b, "palette", cx, WIDTH / 2, tineTop, 0.42, pal.height);
      if (load !== "palette") {
        const g = GOOD_SIZE[load as RackItemKind];
        const k = 0.38 / g.half;
        addGood(b, load as RackItemKind, cx, WIDTH / 2, tineTop + pal.height, g.half * k, g.height * k);
      }
    }
    return b.build();
  }, [load]);

  const lifter = useRef<Group>(null);
  const spinners = useRef<(Group | null)[]>([]);
  useSimFrame((t) => {
    if (lifter.current) {
      const u = running ? ((t / Math.max(1, cycle)) % 1 + 1) % 1 : 0.5;
      lifter.current.position.z = (top - FLOOR) * liftCurve(u);
    }
    for (const [i, w] of spinners.current.entries()) if (w) w.rotation.y = -(t * rolling) / (i < 2 ? rearR : frontR);
  }, running || rolling !== 0);

  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={chassis} />
      {[0.07, WIDTH - 0.07].map((y, i) => (
        <group key={`r${i}`} position={[0.26, y, rearR]} ref={(el) => (spinners.current[i] = el)}>
          <Parts built={rearWheel} />
        </group>
      ))}
      {[0.07, WIDTH - 0.07].map((y, i) => (
        <group key={`f${i}`} position={[1.18, y, frontR]} ref={(el) => (spinners.current[2 + i] = el)}>
          <Parts built={frontWheel} />
        </group>
      ))}
      <group ref={lifter} position={[0, 0, running ? 0 : top - FLOOR]}>
        <Parts built={carriage} />
      </group>
    </group>
  );
}
