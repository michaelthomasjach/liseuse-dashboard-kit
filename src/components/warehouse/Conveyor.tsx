import { useRef } from "react";
import type { Group } from "three";
import { Builder, annulus, type P2, type P3 } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { useSimFrame } from "./three/time";
import { transformTrack } from "./three/transport";
import { ISO_POST_SIZE, type RackItemKind } from "./rackItems";
import { Cargo } from "./Cargo";
import "./rackItems.css";
import "./Conveyor.css";

/**
 * Tapis roulant — droit, ou à angle droit.
 *
 * Built out of the same vocabulary as the rack (`rackItems.tsx`): axis-aligned volumes showing the
 * three faces the camera can see, at three lightnesses of one colour under one light, opaque, with
 * the visible faces chosen from the rotation rather than assumed. A conveyor standing next to a
 * rack has to be made of the same stuff, or the picture reads as two drawings side by side.
 *
 * ## Les trois sortes
 *
 * Un **T** est le module de bifurcation ou de jonction : la ligne le traverse tout droit et une
 * dérivation part du milieu, à angle droit. `flow` dit si elle sort de la ligne ou y entre — c'est
 * la seule chose qui distingue une bifurcation d'une jonction quand rien ne bouge, d'où ses deux
 * flèches — et `branch` dit si la charge l'emprunte. Une charge n'y **tourne pas** : sur un vrai
 * transfert à angle droit elle est poussée de côté, donc son cap change d'un coup au milieu et le
 * colis garde le sien. Les deux routes mesurent la même longueur, une largeur, ce qui fait qu'elles
 * prennent le même temps.
 *
 * A **straight** run is a bed of `length` × `width` on legs. A **corner** is the square transfer
 * module a real floor uses to turn a line: the same bed over a `width` × `width` footprint, with
 * the belt arcing across it from the middle of one edge to the middle of the next. It is a quarter
 * of a circle centred on the module's far corner, tangent to `+x` where it comes in and to `+y`
 * where it leaves, so the two ends meet a straight run square-on and nothing has to be nudged into
 * place.
 *
 * ## Guards
 *
 * A low rail runs down both edges of the belt, because that is what stops a parcel walking off the
 * side and it is the part that tells you which way the goods are contained. On a straight run each
 * is one box. On a corner each is **a chain of short boxes following the arc**, and they are not a
 * decoration laid on top: every segment is a volume like any other, so it takes its place in the
 * depth order with everything else. That matters here — the outer rail is in front of the inner one
 * over the second half of the bend and **behind it over the first**, since the camera looks from the
 * corner the arc is centred on, and a blanket "outer last" would be wrong for half the turn.
 *
 * ## Direction, and what moves
 *
 * One arrow on the belt says which way it runs, and it does not move: a mark that has to animate to
 * be read is a mark half the readers never read — `prefers-reduced-motion`, a paused tab, a
 * screenshot. What moves is the **load**, which is the honest thing to animate, since a conveyor is
 * only interesting because something is going somewhere on it.
 *
 * A load **takes the bend with the belt**, and that is the one thing here a transform cannot do.
 * This camera maps a *plane* affinely, not space: the screen displacement of a point under a floor
 * rotation depends on its height, so one matrix would shear a carton by some twenty pixels through
 * the turn. So a load on a corner is **redrawn** at each of twelve arc segments, at the bearing it
 * takes there — by turning the *projector* about the load's own centre, which draws a turned box
 * with the code that only knows how to draw square ones — and each copy slides across its own
 * segment before handing over to the next. The position never jumps; only the bearing steps, by
 * under four degrees at a time, which does not read as stepping at all. A round load is exempt: a drum looks the same at every bearing, so it is
 * drawn once and carried. It fades in where it arrives and out where it leaves, a module drawn on
 * its own having no upstream to show.
 *
 * ## Composer plusieurs modules
 *
 * `origin` pose le module sur le sol et `frame` fixe le pavé du monde que la `viewBox` couvre.
 * Deux modules qui partagent un cadre ont exactement la même `viewBox` et la même taille, donc les
 * superposer suffit à les raccorder — il n'y a rien à aligner, puisqu'ils sont déjà dans le même
 * repère. Sans cadre, chacun se cadre sur lui-même, ce qu'un module seul veut.
 *
 * Pour qu'un colis *passe* une jonction au lieu d'y disparaître, il faut encore couper le fondu du
 * côté de la jonction (`fadeIn`, `fadeOut`, séparés parce qu'un module au milieu d'une ligne reçoit
 * d'un voisin et rend à un autre, quand le premier de la ligne ne reçoit de personne), puis l'une de deux choses selon ce qu'on veut voir.
 * `phase` avance la charge d'une fraction de tour du module, et chaque module porte alors sa propre
 * charge en permanence : une ligne pleine. `span` dit au contraire quelle part d'un cycle *plus
 * grand* la traversée de ce module occupe, le module restant vide le reste du temps — ce qui fait
 * circuler **un seul colis** sur toute la ligne. Un module rendant sa charge à l'entrée à chaque tour, il suffit
 * que sa phase vaille la distance parcourue avant lui rapportée à sa propre longueur pour qu'un
 * colis quitte le module précédent à l'instant même où celui-ci en accueille un, au même point et
 * au même cap. C'est pour ça que la vitesse est en cases par seconde : tous les modules d'une
 * boucle avancent alors du même pas, et il suffit que leurs longueurs soient commensurables.
 *
 * ## Monter et descendre
 *
 * Ce qui repose sur la bande **penche avec elle** : un colis posé sur un tapis incliné n'est pas
 * d'aplomb, puisque la surface qui le porte ne l'est pas. Là encore ce n'est pas la boîte qu'on
 * incline mais le **projecteur**, comme pour le cap dans un virage — la pente d'abord, autour de
 * l'axe transversal passant par la base de la charge, puis le cap autour de la verticale, les deux
 * ne commutant pas.
 *
 * `rise` dit ce que le tapis gagne en hauteur sur toute sa longueur : positif il grimpe, négatif il
 * descend. Ce n'est pas un effet appliqué après coup — le bâti devient un prisme dont le dessus et
 * le dessous suivent la pente, les pieds s'allongent à mesure, les barrières montent avec, et la
 * charge aussi. Tout ce qui repose sur le tapis lit sa hauteur à l'abscisse où il se trouve et non
 * sur une valeur unique, faute de quoi la moitié du dessin resterait de niveau.
 *
 * Un tapis incliné est aussi plus **long** que son ombre au sol, et c'est la pente qu'on parcourt :
 * à vitesse égale il prend donc plus de temps, ce qui est la seule réponse juste quand plusieurs
 * modules se partagent un même cycle. Un angle, lui, reste à plat : une courbe qui monte est une
 * hélice, et ce n'est pas le même objet.
 *
 * ## Passer d'un tapis à un autre, plus bas
 *
 * `drop` fait quitter la bande à la charge au lieu de l'arrêter au bout : elle tombe de `fall`
 * cases en parcourant encore `run` cases dans son cap de sortie. La trajectoire est une **parabole**
 * et non une droite, parce qu'un colis qui quitte un tapis garde sa vitesse horizontale et
 * n'acquiert la verticale qu'en tombant — l'avance est linéaire, le creux est en `q²`. La chute
 * compte dans le trajet du module au même titre que la bande, donc dans sa part du cycle, et le
 * colis y garde le cap qu'il avait en quittant la bande, ce qui est ce que fait un colis qui tombe.
 *
 * ## Ombres
 *
 * `shadows` pose l'ombre du module au sol. Elle n'est pas dessinée sous chaque pièce mais sous le
 * **bâti**, poussée dans la direction opposée à la lumière du kit — le modèle d'éclairage dit que
 * la face `+y` est à demi-éclairée et la face `+x` dans l'ombre, donc la lumière vient du côté
 * `+y`, et l'ombre part à l'opposé, d'autant plus loin que la pièce est haute. La constante est
 * partagée avec l'étagère : deux ombres qui tomberaient de deux côtés différents dans la même
 * image sont pires que pas d'ombre du tout.
 *
 * ## Legs
 *
 * `legHeight` sets how high the bed stands, and the legs have the **rack's own post section** —
 * not a copy of the number but the same constant, since it is the same steel profile and two equal
 * constants eventually stop being equal. A long run grows intermediate legs rather than stretching
 * two: a nine-metre bed on four legs is a diving board.
 */

export type ConveyorKind = "straight" | "corner" | "tee";

export interface ConveyorProps {
  /** Droit, à angle droit, ou en T. */
  kind?: ConveyorKind;
  /** Sur un T : la dérivation **sort** de la ligne (`"split"`) ou y **entre** (`"merge"`). C'est ce
   *  qui décide du sens de sa flèche, et d'où vient la charge quand elle l'emprunte. */
  flow?: "split" | "merge";
  /** Sur un T : la charge emprunte la dérivation au lieu de suivre la ligne principale. */
  branch?: boolean;
  /** Longueur du tapis, en cases. Un angle est carré : il prend sa largeur. */
  length?: number;
  /** Largeur du tapis, en cases. */
  width?: number;
  /** Hauteur sous le bâti, en cases. */
  legHeight?: number;
  /** Section d'un pied, en cases. Par défaut celle d'un montant d'étagère — le même profilé. */
  legSize?: number;
  /** Épaisseur du bâti qui porte la bande. */
  bedThickness?: number;
  /** Les **rouleaux** en travers de la bande. Un convoyeur à rouleaux est ce qu'on trouve le plus
   *  souvent dans un entrepôt — un colis y roule sans que rien ne l'entraîne — et c'est ce qui
   *  distingue un tapis d'une planche posée sur des pieds. Faux pour une bande lisse. */
  rollers?: boolean;
  /** Hauteur des barrières de rive, en cases. Zéro pour un tapis sans joues. */
  guardHeight?: number;
  /** Poser les ombres du module sur le sol. */
  shadows?: boolean;
  /** Ce que le tapis **monte** sur toute sa longueur, en cases : positif il grimpe, négatif il
   *  descend, zéro il est de niveau. Sans effet sur un angle, qui reste à plat. */
  rise?: number;
  /** Ce qui voyage sur la bande. `null` pour un tapis à vide. */
  load?: RackItemKind | null;
  /** Combien de charges à la fois, réparties le long du parcours. */
  loadCount?: number;
  /** Le tapis va en arrière. */
  reversed?: boolean;
  /** Le tapis tourne. À faux, la flèche dit encore le sens. */
  running?: boolean;
  /** Vitesse de la bande, en cases par seconde. La même vitesse donne le meme deplacement sur un
   *  tapis long comme sur un angle — une duree, elle, les ferait aller a des allures differentes. */
  speed?: number;
  /** Rotation du tapis sur le sol, en degrés. */
  rotation?: number;
  /** Où poser le module sur le sol, en cases. Sert à composer une ligne de plusieurs modules. */
  origin?: { x: number; y: number };
  /** Le pavé du monde que la `viewBox` doit couvrir, en cases. Donné, il remplace le cadrage sur le
   *  module lui-même : plusieurs modules qui partagent un cadre partagent alors exactement le même
   *  repère à l'écran, et se superposent sans rien avoir à aligner. */
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  /** Fondre la charge à son arrivée, et à son départ. Les deux se règlent séparément parce qu'un
   *  module au milieu d'une ligne n'est pas dans la même situation aux deux bouts : il reçoit d'un
   *  voisin et rend à un autre, alors que le premier de la ligne reçoit de nulle part. Un colis ne
   *  doit pas s'effacer à une jonction, il doit y passer. */
  fadeIn?: boolean;
  fadeOut?: boolean;
  /** Avance de la charge au premier rendu, en tours de ce module. C'est ce qui fait qu'un colis
   *  quitte un module à l'instant même où le suivant en accueille un. */
  phase?: number;
  /** Ce que devient la charge une fois au bout : elle quitte la bande et **tombe**, de `fall`
   *  cases, en parcourant encore `run` cases dans son cap de sortie. La trajectoire est une
   *  parabole et non une droite, parce qu'un colis qui quitte un tapis garde sa vitesse
   *  horizontale et n'acquiert la verticale qu'en tombant. Sert à passer d'un tapis à un autre,
   *  plus bas. */
  drop?: { fall: number; run: number };
  /** Ce qu'on dessine : tout, la machine seule, ou ce qui voyage dessus seul. Une ligne composée
   *  de plusieurs modules a besoin de la séparation : la charge appartient au module qu'elle
   *  traverse, donc elle hérite de sa place dans la pile, et le module suivant — dessiné après, car
   *  plus proche — la recouvre juste au moment où elle arrive à la jonction. Dessiner toutes les
   *  machines, puis toutes les charges, remet chaque chose là où on la cherche. L'ombre se sépare
   *  pour la même raison, d'un cran plus bas : elle est au sol, donc elle doit passer sous *tous*
   *  les modules et pas seulement sous le sien, sans quoi l'ombre d'un tapis proche se poserait
   *  par-dessus le tapis lointain qu'elle traverse. */
  parts?: "all" | "shadow" | "machine" | "load";
  /** La part du cycle pendant laquelle une charge traverse ce module, quand le cycle appartient à
   *  quelque chose de plus grand — une boucle, par exemple. Hors de cette part, le module est vide.
   *  C'est ce qui permet de ne faire circuler **qu'un seul colis** sur toute une ligne : chaque
   *  module ne le montre que pendant qu'il y est, au lieu d'en avoir un en permanence. */
  span?: { start: number; end: number };
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}


/** Part de la largeur occupée par la bande, le reste étant le bâti de chaque côté. */
const BELT_SHARE = 0.74;

/** Hauteur d'une barrière, en cases. Basse : elle retient un colis, elle ne le cache pas. */
const DEFAULT_GUARD = 0.14;



/** Un point du parcours et la direction qu'y prend la bande. */

/** Les cotes dérivées d'un tapis, communes au dessin et à sa piste. */
function conveyorLayout(p: ConveyorProps) {
  const { kind = "straight", flow = "split", branch = false, length = 6, width = 1.6, legHeight = 1, legSize = ISO_POST_SIZE, bedThickness = 0.22, guardHeight = DEFAULT_GUARD, rise = 0, reversed = false, drop } = p;
  const spanX = kind === "straight" ? Math.max(width, length) : width;
  const spanY = width;
  const leg = Math.max(0.04, Math.min(legSize, Math.min(spanX, spanY) / 2));
  const bedZ = Math.max(0, legHeight);
  const slab = Math.max(0.02, bedThickness);
  const slope = kind === "straight" ? rise : 0;
  const under = (x: number) => bedZ + (slope * x) / Math.max(1e-6, spanX);
  const deck = (x: number) => under(x) + slab;
  const bedTop = deck(0);
  const beltHalf = (spanY * BELT_SHARE) / 2;
  const guard = Math.max(0, guardHeight);
  const guardThick = Math.max(0.03, spanY * 0.045);
  const bedMargin = guardThick * 1.8;
  const radius = spanY / 2;
  const run = kind === "corner" ? (Math.PI / 2) * radius : kind === "tee" ? spanX : Math.hypot(spanX, slope);
  /** Un point de la ligne de charge, à la fraction `t` du parcours, et le sens du mouvement. */
  const stepAt = (t: number): { x: number; y: number; hx: number; hy: number } => {
    if (kind === "tee") {
      const half = spanY / 2;
      if (!branch) return { x: spanX * t, y: half, hx: 1, hy: 0 };
      const u = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
      if (flow === "merge") return t < 0.5 ? { x: half, y: spanY - half * u, hx: 0, hy: -1 } : { x: half + half * u, y: half, hx: 1, hy: 0 };
      return t < 0.5 ? { x: half * u, y: half, hx: 1, hy: 0 } : { x: half, y: half + half * u, hx: 0, hy: 1 };
    }
    if (kind === "corner") {
      const a = -Math.PI / 2 + (Math.PI / 2) * t;
      return { x: radius * Math.cos(a), y: spanY + radius * Math.sin(a), hx: -Math.sin(a), hy: Math.cos(a) };
    }
    return { x: spanX * t, y: spanY / 2, hx: 1, hy: 0 };
  };
  return { kind, spanX, spanY, leg, bedZ, slab, slope, under, deck, bedTop, beltHalf, guard, guardThick, bedMargin, radius, run, stepAt, reversed, drop };
}

/**
 * La piste d'un tapis : la ligne que suit une charge posée dessus, **en coordonnées monde**.
 *
 *  C'est ce qu'une scène met bout à bout avec les pistes des modules voisins pour faire un seul
 *  itinéraire (voir `Cargo`). Elle suit le sens de marche (`reversed`), la pente, le virage d'un
 *  tapis d'angle ou la dérivation d'un tapis en T, et se prolonge par la chute (`drop`) quand le
 *  tapis en a une.
 */
export function conveyorTrack(p: ConveyorProps): P3[] {
  const L = conveyorLayout(p);
  const n = L.kind === "corner" ? 24 : L.kind === "tee" ? 12 : 2;
  const local: P3[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const q = L.stepAt(L.reversed ? 1 - t : t);
    local.push([q.x, q.y, L.kind === "straight" ? L.deck(q.x) : L.bedTop]);
  }
  if (L.drop) {
    const end = L.stepAt(L.reversed ? 0 : 1);
    const way = L.reversed ? -1 : 1;
    const z0 = local[local.length - 1][2];
    const fall = Math.max(0, L.drop.fall);
    const runOut = Math.max(0, L.drop.run);
    for (let i = 1; i <= 8; i += 1) {
      const q = i / 8;
      local.push([end.x + end.hx * way * runOut * q, end.y + end.hy * way * runOut * q, z0 - fall * q * q]);
    }
  }
  const { origin = { x: 0, y: 0 }, rotation = 0 } = p;
  const { pose } = placed(origin, rotation, { x0: 0, x1: L.spanX, y0: 0, y1: L.spanY, z0: 0, z1: 1 });
  return transformTrack(local, pose);
}

export function Conveyor(props: ConveyorProps) {
  const { rotation = 0, origin = { x: 0, y: 0 }, frame, parts = "all", cellSize = 34, className, running = true, kind = "straight" } = props;
  if (parts === "shadow") return null;
  const L = conveyorLayout(props);
  const top = Math.max(L.deck(0), L.deck(L.spanX)) + L.guard + 0.4;
  const { bounds } = placed(origin, rotation, { x0: 0, x1: L.spanX, y0: 0, y1: L.spanY, z0: 0, z1: top });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={["lq-conveyor", !running && "lq-conveyor--stopped", className].filter(Boolean).join(" ")} ariaLabel={`Tapis roulant ${kind === "corner" ? "d'angle" : "droit"}${running ? ", en marche" : ", arrêté"}`}>
      <ConveyorBody {...props} />
    </Solo>
  );
}

function ConveyorBody(props: ConveyorProps) {
  const { rotation = 0, origin = { x: 0, y: 0 }, parts = "all", rollers = true, running = true, speed = 1.1, load = null, loadCount = 1, phase = 0, flow = "split", reversed = false } = props;
  const L = conveyorLayout(props);
  const { spanX, spanY, leg, bedZ, slab, under, deck, bedTop, beltHalf, guard, guardThick, bedMargin, radius, kind } = L;
  const { pose } = placed(origin, rotation, { x0: 0, x1: spanX, y0: 0, y1: spanY, z0: 0, z1: 1 });
  const key = JSON.stringify([kind, spanX, spanY, leg, bedZ, slab, L.slope, guard, rollers, flow, props.branch, reversed]);

  // ---- La machine : pieds, lit, bande, rives ----
  const built = useBuilt(() => {
    const b = new Builder();
    const c = spanY / 2;
    // Les pieds, à la hauteur du lit au-dessus d'eux.
    const legAt = (x: number, y: number, h: number) => b.box("post", x - leg / 2, x + leg / 2, y - leg / 2, y + leg / 2, 0, h);
    if (kind !== "corner") {
      const rows = kind === "tee" ? 2 : Math.max(2, Math.round(spanX / 2.5) + 1);
      for (let r = 0; r < rows; r += 1) {
        const x0 = leg / 2 + ((spanX - leg) * r) / (rows - 1);
        for (const y0 of [leg / 2, spanY - leg / 2]) legAt(x0, y0, under(x0));
      }
    } else {
      for (const a of [-Math.PI / 2 + 0.08, -Math.PI / 4, -0.08])
        for (const r of [radius - beltHalf - bedMargin + leg * 0.7, radius + beltHalf + bedMargin - leg * 0.7]) legAt(r * Math.cos(a), spanY + r * Math.sin(a), bedZ);
    }
    // Le lit et la bande.
    if (kind === "corner") {
      const ring = annulus(0, spanY, radius - beltHalf - bedMargin, radius + beltHalf + bedMargin, -Math.PI / 2, 0, 24);
      b.prism("steel", ring, bedZ, bedTop);
      b.decal("lq-conveyor__belt", annulus(0, spanY, radius - beltHalf, radius + beltHalf, -Math.PI / 2, 0, 24).map((q) => [q.x, q.y, bedTop + 0.004] as P3));
    } else {
      b.hexa("steel", [
        [0, 0, under(0)],
        [spanX, 0, under(spanX)],
        [spanX, spanY, under(spanX)],
        [0, spanY, under(0)],
        [0, 0, deck(0)],
        [spanX, 0, deck(spanX)],
        [spanX, spanY, deck(spanX)],
        [0, spanY, deck(0)],
      ]);
      const belt: P2[] =
        kind === "tee"
          ? [
              { x: 0, y: c - beltHalf },
              { x: spanX, y: c - beltHalf },
              { x: spanX, y: c + beltHalf },
              { x: c + beltHalf, y: c + beltHalf },
              { x: c + beltHalf, y: spanY },
              { x: c - beltHalf, y: spanY },
              { x: c - beltHalf, y: c + beltHalf },
              { x: 0, y: c + beltHalf },
            ]
          : [
              { x: 0, y: c - beltHalf },
              { x: spanX, y: c - beltHalf },
              { x: spanX, y: c + beltHalf },
              { x: 0, y: c + beltHalf },
            ];
      // Un T n'est pas convexe : on le pose en deux rectangles.
      if (kind === "tee") {
        b.faceZ("lq-conveyor__belt", bedTop + 0.004, 0, spanX, c - beltHalf, c + beltHalf);
        b.faceZ("lq-conveyor__belt", bedTop + 0.004, c - beltHalf, c + beltHalf, c + beltHalf, spanY);
      } else b.decal("lq-conveyor__belt", belt.map((q) => [q.x, q.y, deck(q.x) + 0.004] as P3));
    }
    // Les rives : ce qui retient la charge sur la bande.
    if (guard > 0) {
      if (kind === "corner") {
        for (const r of [radius - beltHalf - guardThick / 2, radius + beltHalf + guardThick / 2]) b.prism("post", annulus(0, spanY, r - guardThick / 2, r + guardThick / 2, -Math.PI / 2, 0, 24), bedTop, bedTop + guard);
      } else if (kind === "tee") {
        const h = beltHalf;
        const gt = guardThick;
        for (const [x0, x1, y0, y1] of [
          [0, spanX, c - h - gt, c - h],
          [0, c - h, c + h, c + h + gt],
          [c + h, spanX, c + h, c + h + gt],
          [c - h - gt, c - h, c + h, spanY],
          [c + h, c + h + gt, c + h, spanY],
        ])
          b.box("post", x0, x1, y0, y1, bedTop, bedTop + guard);
      } else {
        for (const e of [c - beltHalf - guardThick, c + beltHalf])
          b.hexa("post", [
            [0, e, deck(0)],
            [spanX, e, deck(spanX)],
            [spanX, e + guardThick, deck(spanX)],
            [0, e + guardThick, deck(0)],
            [0, e, deck(0) + guard],
            [spanX, e, deck(spanX) + guard],
            [spanX, e + guardThick, deck(spanX) + guard],
            [0, e + guardThick, deck(0) + guard],
          ]);
      }
    }
    return b.build();
  }, [key]);

  // ---- Les rouleaux : ils défilent dans le sens du flux ----
  const STEP = 0.26;
  const rollerParts = useBuilt(() => {
    const b = new Builder();
    if (!rollers) return b.build();
    const c = spanY / 2;
    const segs: [P3, P3][] = [];
    if (kind === "corner") {
      // Dans un virage, les rouleaux sont des rayons : on les fait tourner autour du centre.
      const count = Math.max(3, Math.round(((Math.PI / 2) * radius) / STEP));
      for (let i = 0; i < count; i += 1) {
        const a = -Math.PI / 2 + ((Math.PI / 2) * i) / count;
        segs.push([
          [(radius - beltHalf) * Math.cos(a), spanY + (radius - beltHalf) * Math.sin(a), bedTop + 0.008],
          [(radius + beltHalf) * Math.cos(a), spanY + (radius + beltHalf) * Math.sin(a), bedTop + 0.008],
        ]);
      }
    } else {
      // Une rangée de rouleaux d'un pas de plus que le tapis, pour qu'en glissant elle le couvre
      // toujours en entier.
      // Une rangée qui glisse d'au plus un pas : elle reste sur la bande à tout instant.
      for (let x = 0; x <= spanX - STEP; x += STEP) segs.push([[x, c - beltHalf, 0.008], [x, c + beltHalf, 0.008]]);
    }
    b.lines("lq-conveyor__roller", segs);
    return b.build();
  }, [key]);
  const slide = useRef<Group>(null);
  const way = reversed ? -1 : 1;
  useSimFrame((t) => {
    const g = slide.current;
    if (!g) return;
    if (kind === "corner") {
      // Dans un virage, la rangée tourne autour du centre de l'arc, d'au plus un pas angulaire.
      const count = Math.max(3, Math.round(((Math.PI / 2) * radius) / STEP));
      const da = Math.PI / 2 / count;
      g.rotation.z = ((((t * speed * way) / radius) % da) + da) % da;
    } else {
      const off = (((t * speed * way) % STEP) + STEP) % STEP;
      g.position.x = off;
    }
  }, running && rollers && kind !== "tee");

  const track = conveyorTrack({ ...props, origin: { x: 0, y: 0 }, rotation: 0 });
  // Le repère du tapis est celui où sa piste a été calculée : on la ramène dans le groupe posé.
  const localTrack = track;

  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      {(parts === "all" || parts === "machine") && (
        <>
          <Parts built={built} />
          {kind === "corner" ? (
            <group ref={slide} position={[0, spanY, 0]}>
              <group position={[0, -spanY, 0]}>
                <Parts built={rollerParts} shadows={false} />
              </group>
            </group>
          ) : (
            // Les rouleaux d'un tapis incliné suivent sa pente, et c'est le long d'elle qu'ils
            // glissent.
            <group rotation={[0, -Math.atan2(L.slope, spanX), 0]} position={[0, 0, deck(0)]}>
              <group ref={slide}>
                <Parts built={rollerParts} shadows={false} />
              </group>
            </group>
          )}
        </>
      )}
      {(parts === "all" || parts === "load") && load && (
        <Cargo route={localTrack} kind={load as RackItemKind} spacing={L.run / Math.max(1, Math.floor(loadCount))} speed={speed} phase={phase * L.run} running={running} />
      )}
    </group>
  );
}
