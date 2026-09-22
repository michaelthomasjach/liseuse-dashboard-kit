import { useId, type CSSProperties, type ReactNode } from "react";
import {
  ISO_POST_SIZE,
  arcRingVolume,
  boxFaces,
  castShadow,
  frameCorners,
  fitRackItem,
  rackItemIso,
  solidVolume,
  type Point,
  type Project,
  type RackItemKind,
} from "./rackItems";
import "./Conveyor.css";
import { useIsoCamera } from "./isoCamera";

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

const PAD = 2;

/** Part de la largeur occupée par la bande, le reste étant le bâti de chaque côté. */
const BELT_SHARE = 0.74;

/** Hauteur d'une barrière, en cases. Basse : elle retient un colis, elle ne le cache pas. */
const DEFAULT_GUARD = 0.14;

/** Points d'echantillonnage du parcours d'une charge, tous troncons confondus. Un arc en demande
 *  beaucoup ; une ligne droite s'en contenterait de deux. */
const LOAD_SAMPLES = 24;

/** Troncons d'arc sur lesquels une charge anguleuse est redessinee, dans un angle. Tourner un
 *  volume n'est pas une transformation d'ecran : la camera envoie un *plan* affinement, pas
 *  l'espace, et le deplacement d'un point sous une rotation du sol depend de sa hauteur. Une seule
 *  matrice cisaillerait donc le colis d'une vingtaine de pixels dans le virage. Il est redessine a
 *  chaque troncon, au cap qu'il y prend, et chaque exemplaire glisse sur sa part du parcours : la
 *  position ne saute jamais, seul le cap change — de moins de quatre degres a la fois, ce qui ne
 *  se voit plus. */
const TURN_STEPS = 24;

type Piece = { x: number; y: number; width: number; height: number; render: () => ReactNode };
/** Un point du parcours et la direction qu'y prend la bande. */
type Step = { x: number; y: number; hx: number; hy: number };

export function Conveyor({
  kind = "straight",
  flow = "split",
  branch = false,
  length = 6,
  width = 1.6,
  legHeight = 1,
  legSize = ISO_POST_SIZE,
  bedThickness = 0.22,
  rollers = true,
  guardHeight = DEFAULT_GUARD,
  rise = 0,
  shadows = false,
  load = null,
  loadCount = 1,
  reversed = false,
  running = true,
  speed = 1.1,
  rotation = 0,
  origin = { x: 0, y: 0 },
  frame,
  fadeIn = true,
  fadeOut = true,
  phase = 0,
  span,
  parts = "all",
  drop,
  cellSize = 34,
  className,
}: ConveyorProps) {
  const cam = useIsoCamera();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  // Un angle et un T sont carrés : ils tiennent dans leur propre encombrement, et une longueur
  // n'aurait aucun sens à leur donner.
  const spanX = kind === "straight" ? Math.max(width, length) : width;
  const spanY = width;

  const theta = (rotation * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const spin = (x: number, y: number) => {
    if (!rotation) return { x, y };
    const dx = x - spanX / 2;
    const dy = y - spanY / 2;
    return { x: spanX / 2 + dx * cosT - dy * sinT, y: spanY / 2 + dx * sinT + dy * cosT };
  };
  /** Un point du monde vers l'écran, sans passer par le module : le cadre partagé est déjà en
   *  coordonnées du monde. */
  const world: Project = (x, y, z) => cam.project(x * cellSize, y * cellSize, z * cellSize);
  const at: Project = (x, y, z) => {
    const p = spin(x, y);
    return world(p.x + origin.x, p.y + origin.y, z);
  };
  const facing = cam.facing(rotation);
  const ring = (points: Point[]) => points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  const footprint = (xs: number[], ys: number[]) => {
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  };

  const leg = Math.max(0.04, Math.min(legSize, Math.min(spanX, spanY) / 2));
  const bedZ = Math.max(0, legHeight);
  const slab = Math.max(0.02, bedThickness);
  // Un angle reste de niveau : une courbe qui monte est une hélice, et ce n'est pas le même objet.
  // Seule une ligne droite s'incline : une courbe qui monte est une hélice, et un T qui monte
  // devrait choisir laquelle de ses trois branches est de niveau.
  const slope = kind === "straight" ? rise : 0;
  /** Le dessous du bâti à l'abscisse `x`, puis son dessus. Tout ce qui repose sur le tapis se lit
   *  ici plutôt que sur une hauteur unique, faute de quoi seule la moitié du dessin s'inclinerait. */
  const under = (x: number) => bedZ + (slope * x) / Math.max(1e-6, spanX);
  const deck = (x: number) => under(x) + slab;
  const bedTop = deck(0);
  const beltHalf = (spanY * BELT_SHARE) / 2;
  const guard = Math.max(0, guardHeight);
  const guardThick = Math.max(0.03, spanY * 0.045);
  /** Ce que le bati deborde de part et d'autre de la bande : de quoi porter la barriere et un peu
   *  de rive au-dela. */
  const bedMargin = guardThick * 1.8;

  // ---- le parcours de la bande ----
  // Un angle est un quart de cercle centré sur le coin (0, largeur) : tangent à +x où il entre, à
  // +y où il sort, donc il se raccorde d'équerre à un tapis droit des deux côtés.
  const radius = spanY / 2;
  // Un tapis incliné est plus long que son ombre au sol : c'est la pente qu'on parcourt, pas
  // l'horizontale, et à vitesse égale il prend donc plus de temps.
  // Un T mesure une largeur quel que soit le chemin pris : tout droit c'est `W`, par la
  // dérivation c'est deux demies. C'est une coïncidence utile — les deux routes prennent le même
  // temps, ce qui est vrai d'un vrai transfert à angle droit.
  const run = kind === "corner" ? (Math.PI / 2) * radius : kind === "tee" ? spanX : Math.hypot(spanX, slope);
  const stepAt = (t: number): Step => {
    if (kind === "tee") {
      const half = spanY / 2;
      if (!branch) return { x: spanX * t, y: half, hx: 1, hy: 0 };
      const u = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
      // Une charge ne tourne pas sur un transfert à angle droit : elle est poussée de côté. Le cap
      // change donc d'un coup au milieu, et le colis garde le sien — ce qui est exactement ce que
      // fait un colis sur un transfert à rouleaux escamotables.
      if (flow === "merge") {
        return t < 0.5
          ? { x: half, y: spanY - half * u, hx: 0, hy: -1 }
          : { x: half + half * u, y: half, hx: 1, hy: 0 };
      }
      return t < 0.5 ? { x: half * u, y: half, hx: 1, hy: 0 } : { x: half, y: half + half * u, hx: 0, hy: 1 };
    }
    if (kind === "corner") {
      const a = -Math.PI / 2 + (Math.PI / 2) * t;
      return { x: radius * Math.cos(a), y: spanY + radius * Math.sin(a), hx: -Math.sin(a), hy: Math.cos(a) };
    }
    return { x: spanX * t, y: spanY / 2, hx: 1, hy: 0 };
  };
  /** Les trois faces visibles d'un pavé dont le dessus et le dessous suivent la pente. */
  const slopedFaces = (x0: number, x1: number, y0: number, y1: number, lift: number, thick: number) => {
    const zb = (x: number) => under(x) + lift;
    const zt = (x: number) => zb(x) + thick;
    const xs = facing.xFace > 0 ? x1 : x0;
    const ys = facing.yFace > 0 ? y1 : y0;
    const faceX = [at(xs, y0, zb(xs)), at(xs, y1, zb(xs)), at(xs, y1, zt(xs)), at(xs, y0, zt(xs))];
    const faceY = [at(x0, ys, zb(x0)), at(x1, ys, zb(x1)), at(x1, ys, zt(x1)), at(x0, ys, zt(x0))];
    return {
      top: [at(x0, y0, zt(x0)), at(x1, y0, zt(x1)), at(x1, y1, zt(x1)), at(x0, y1, zt(x0))],
      front: facing.xOnLeft ? faceX : faceY,
      side: facing.xOnLeft ? faceY : faceX,
    };
  };

  /** Un point de l'anneau d'un angle, par rayon et par angle. */
  const arcPoint = (r: number, a: number, z: number) => at(r * Math.cos(a), spanY + r * Math.sin(a), z);
  /** L'angle du parcours au tronçon `i` d'un découpage en `n`. */
  const arcAngle = (i: number, n: number) => -Math.PI / 2 + (Math.PI / 2) * (i / n);
  /** L'anneau d'un angle : son bâti, et ses deux barrières. La géométrie est dans `rackItems.tsx`,
   *  partagée avec le rail d'angle — un bâti est un anneau très épais, une file de rail un anneau
   *  très mince, et c'est le même dessin. */
  const arcRing = (material: string, rIn: number, rOut: number, z0: number, z1: number, key: string): ReactNode =>
    arcRingVolume(
      at,
      spin,
      { cx: 0, cy: spanY, rIn, rOut, z0, z1, a0: arcAngle(0, 1), a1: arcAngle(1, 1) },
      material,
      key, undefined, cam.view);

  /** La bande elle-même : le ruban balayé par le parcours, à plat sur le bâti. */
  const beltFace = (() => {
    if (kind === "corner") {
      const outer: Point[] = [];
      const inner: Point[] = [];
      for (let i = 0; i <= 48; i += 1) {
        const a = arcAngle(i, 48);
        outer.push(arcPoint(radius + beltHalf, a, bedTop));
        inner.push(arcPoint(radius - beltHalf, a, bedTop));
      }
      return [...outer, ...inner.reverse()];
    }
    if (kind === "tee") {
      const c = spanY / 2;
      const h = beltHalf;
      // Un seul polygone en T plutôt que deux rectangles : deux formes cernées laisseraient un
      // trait en travers du croisement, là où il n'y a rien.
      return [
        [0, c - h],
        [spanX, c - h],
        [spanX, c + h],
        [c + h, c + h],
        [c + h, spanY],
        [c - h, spanY],
        [c - h, c + h],
        [0, c + h],
      ].map(([x, y]) => at(x, y, bedTop));
    }
    return [
      at(0, spanY / 2 - beltHalf, deck(0)),
      at(spanX, spanY / 2 - beltHalf, deck(spanX)),
      at(spanX, spanY / 2 + beltHalf, deck(spanX)),
      at(0, spanY / 2 + beltHalf, deck(0)),
    ];
  })();

  /**
   * Les rouleaux : un trait en travers de la bande, tous les quarts de case.
   *
   * Un trait et non un volume, et c'est un choix : à l'échelle où ce kit dessine, un rouleau fait
   * trois pixels de diamètre. Modelé, il coûterait quarante volumes par tapis pour finir en une
   * ligne grise ; tracé, il donne exactement ce qu'on lui demande — la trame régulière qui dit
   * qu'un colis roule là-dessus. Ils suivent la bande partout : le long d'un droit, en rayons dans
   * un angle, et des deux côtés du croisement d'un T.
   */
  const rollerLines = (() => {
    if (!rollers) return [];
    const step = 0.26;
    const lines: string[] = [];
    const across = (x: number, c: number, half: number) =>
      lines.push(ring([at(x, c - half, deck(x)), at(x, c + half, deck(x))]));
    if (kind === "corner") {
      const count = Math.max(3, Math.round((Math.PI / 2) * radius / step));
      for (let i = 1; i < count; i += 1) {
        const a = arcAngle(i, count);
        lines.push(ring([arcPoint(radius - beltHalf, a, bedTop), arcPoint(radius + beltHalf, a, bedTop)]));
      }
      return lines;
    }
    const c = spanY / 2;
    for (let x = step; x < spanX - step / 2; x += step) across(x, c, beltHalf);
    if (kind === "tee") {
      // La dérivation a les siens, dans l'autre sens, et ils s'arrêtent au croisement.
      for (let y = c + beltHalf + step; y < spanY - step / 2; y += step) {
        lines.push(ring([at(c - beltHalf, y, bedTop), at(c + beltHalf, y, bedTop)]));
      }
    }
    return lines;
  })();

  /** Une flèche posée en un point, dans un cap. Elle ne bouge pas. */
  const arrowAt = (x: number, y: number, hx: number, hy: number) => {
    const reach = 0.09 * Math.max(1, spanX);
    const nx = -hy;
    const ny = hx;
    const armLen = beltHalf * 0.5;
    return ring([
      at(x - hx * reach + nx * armLen, y - hy * reach + ny * armLen, deck(x - hx * reach)),
      at(x + hx * reach, y + hy * reach, deck(x + hx * reach)),
      at(x - hx * reach - nx * armLen, y - hy * reach - ny * armLen, deck(x - hx * reach)),
    ]);
  };

  /** Les flèches. Un T en porte deux : sa ligne et sa dérivation, chacune disant son sens — c'est
   *  la seule chose qui distingue une bifurcation d'une jonction quand rien ne bouge. */
  const arrows = (() => {
    const way = reversed ? -1 : 1;
    if (kind === "tee") {
      const c = spanY / 2;
      const branchWay = flow === "merge" ? -1 : 1;
      return [
        arrowAt(spanX * 0.28, c, way, 0),
        arrowAt(c, c + (spanY - c) * 0.62, 0, branchWay * way),
      ];
    }
    const mid = stepAt(0.5);
    const tip = stepAt(0.5 + 0.09 * way);
    const tail = stepAt(0.5 - 0.09 * way);
    const hx = (tip.x - tail.x) / Math.max(1e-6, Math.hypot(tip.x - tail.x, tip.y - tail.y));
    const hy = (tip.y - tail.y) / Math.max(1e-6, Math.hypot(tip.x - tail.x, tip.y - tail.y));
    return [arrowAt(mid.x, mid.y, hx, hy)];
  })();

  // ---- ce qui se tient sur le bâti : les barrières, et la charge ----
  const pieces: Piece[] = [];

  // Les barrières d'un angle sont deux anneaux minces ; celles d'un droit, deux boîtes. Leur ordre
  // entre elles est sans objet : toute la largeur de la bande les sépare, donc elles ne se
  // recouvrent jamais à l'écran. Ce qui compte est qu'elles passent toutes deux *avant* ce qui
  // voyage sur la bande.
  const guards: ReactNode[] = [];
  if (guard > 0) {
    if (kind === "corner") {
      for (const r of [radius - beltHalf - guardThick / 2, radius + beltHalf + guardThick / 2]) {
        guards.push(arcRing("post", r - guardThick / 2, r + guardThick / 2, bedTop, bedTop + guard, `g${r.toFixed(3)}`));
      }
    } else if (kind === "tee") {
      const c = spanY / 2;
      const h = beltHalf;
      const gt = guardThick;
      // Cinq pans, et les trois ouvertures qu'ils laissent sont les trois ports du T.
      const rails: [number, number, number, number][] = [
        [0, spanX, c - h - gt, c - h],
        [0, c - h, c + h, c + h + gt],
        [c + h, spanX, c + h, c + h + gt],
        [c - h - gt, c - h, c + h, spanY],
        [c + h, c + h + gt, c + h, spanY],
      ];
      rails.forEach(([x0, x1, y0, y1], i) =>
        guards.push(solidVolume("post", `g${i}`, boxFaces(at, x0, x1, y0, y1, bedTop, bedTop + guard, facing)))
      );
    } else {
      for (const edge of [spanY / 2 - beltHalf - guardThick, spanY / 2 + beltHalf]) {
        guards.push(solidVolume("post", `g${edge.toFixed(3)}`, slopedFaces(0, spanX, edge, edge + guardThick, slab, guard)));
      }
    }
  }

  // ---- ce qui voyage dessus ----
  /** Le projecteur d'une charge qui a pris le cap `deg` autour de son propre centre. Tourner le
   *  projecteur plutot que la boite, c'est dessiner une boite tournee avec le code qui n'en sait
   *  dessiner que des droites. */
  /** L'angle de la pente : c'est de cet angle que penche ce qui repose sur la bande. */
  const tilt = Math.atan2(slope, spanX);
  const bearingAt = (deg: number, cx: number, cy: number, baseZ: number) => {
    const r = (deg * Math.PI) / 180;
    const c = Math.cos(r);
    const sn = Math.sin(r);
    const ca = Math.cos(tilt);
    const sa = Math.sin(tilt);
    const project: Project = (x, y, z) => {
      // D'abord la pente, autour de l'axe y passant par la base de la charge : un colis posé sur un
      // tapis incliné penche avec lui, il ne reste pas d'aplomb sur une surface qui ne l'est pas.
      const dz = z - baseZ;
      const xt = cx + (x - cx) * ca - dz * sa;
      const zt = baseZ + (x - cx) * sa + dz * ca;
      // Puis le cap, autour de la verticale : les deux ne commutent pas, et c'est bien la pente qui
      // est dans le repère du module et le cap qui l'oriente ensuite.
      const dx = xt - cx;
      const dy = y - cy;
      return at(cx + dx * c - dy * sn, cy + dx * sn + dy * c, zt);
    };
    return { project, facing: cam.facing(rotation + deg) };
  };

  // Le trajet d'une charge, c'est la bande *plus* la chute s'il y en a une. La vitesse
  // horizontale ne change pas en tombant, donc la chute se compte en cases comme le reste.
  const dropRun = drop ? Math.max(0, drop.run) : 0;
  const pathLength = run + dropRun;
  const beltShare = pathLength > 0 ? run / pathLength : 1;
  const travel = pathLength / Math.max(0.01, speed);
  const many = Math.max(1, Math.floor(loadCount));
  // Un colis rond a le meme dessin sous tous les caps : inutile de le redecouper. Un colis
  // anguleux dans un angle, si.
  const rounded = load ? fitRackItem(load, { x: 0, y: 0, width: 1, depth: 1 }, 0, Infinity).spec.round : false;
  // Un T ne fait pas tourner sa charge : elle est poussée de côté, pas virée.
  const turns = kind === "corner" && load && !rounded ? TURN_STEPS : 1;
  const perTurn = Math.max(2, Math.round(LOAD_SAMPLES / turns));
  const berth = beltHalf * 2;
  const along = (t: number) => stepAt(reversed ? 1 - t : t);
  /**
   * Où se trouve une charge à la fraction `m` de son trajet dans ce module — bande d'abord, chute
   * ensuite. La chute est une parabole : l'avance est linéaire, le creux est en `q²`.
   */
  const carriedAt = (m: number) => {
    if (m <= beltShare || !drop) {
      const p = along(beltShare > 0 ? Math.min(1, m / beltShare) : 1);
      return at(p.x, p.y, deck(p.x));
    }
    const q = (m - beltShare) / Math.max(1e-6, 1 - beltShare);
    const end = along(1);
    const way = reversed ? -1 : 1;
    return at(
      end.x + end.hx * way * dropRun * q,
      end.y + end.hy * way * dropRun * q,
      deck(end.x) - Math.max(0, drop.fall) * q * q
    );
  };
  const bearing = (t: number) => {
    const h = along(t);
    const way = reversed ? -1 : 1;
    return (Math.atan2(h.hy * way, h.hx * way) * 180) / Math.PI;
  };

  // Sans `span`, la traversée occupe tout le cycle. Avec, elle n'en occupe qu'une part, et le
  // cycle dure d'autant plus longtemps : c'est le tour de la boucle entière, et le module reste
  // vide le reste du temps.
  const s0 = span ? span.start : 0;
  const s1 = span ? span.end : 1;
  const share = Math.max(1e-6, s1 - s0);
  const cycleSeconds = travel / share;
  /** Du paramètre du module, entre 0 et 1, vers la part du cycle qui lui revient. */
  const onCycle = (u: number) => s0 + share * u;

  const rideFrames: string[] = [];
  const rides: ReactNode[] = [];
  for (let i = 0; i < turns; i += 1) {
    const u0 = (beltShare * i) / turns;
    // Le dernier exemplaire emmène la chute avec lui : c'est le même colis qui quitte la bande, et
    // il garde en tombant le cap qu'il avait en la quittant.
    const u1 = i === turns - 1 ? 1 : (beltShare * (i + 1)) / turns;
    const t0 = onCycle(u0);
    const t1 = onCycle(u1);
    const hereM = beltShare > 0 ? Math.min(1, u0 / beltShare) : 1;
    const here = along(hereM);
    const view = bearingAt(bearing(hereM), here.x, here.y, deck(here.x));
    const fit = fitRackItem(
      load ?? "carton",
      { x: here.x - berth / 2, y: here.y - berth / 2, width: berth, depth: berth },
      deck(here.x),
      Infinity
    );
    const base = at(here.x, here.y, deck(here.x));
    /** Le décalage, pour une part `t` du cycle : on repasse d'abord au trajet du module. */
    const shift = (t: number) => {
      const q = carriedAt((t - s0) / share);
      return `translate(${(q.x - base.x).toFixed(3)}px,${(q.y - base.y).toFixed(3)}px)`;
    };
    const pct = (t: number) => (t * 100).toFixed(3);
    // Hors de sa fenetre l'exemplaire est transparent ; le passage de relais est franc, les deux
    // exemplaires voisins etant au meme endroit a cet instant, seul leur cap differant.
    const easeIn = fadeIn && i === 0 ? 0.03 : 0;
    const easeOut = fadeOut && i === turns - 1 ? 0.03 : 0;
    const stops: string[] = [];
    // Deux arrets ne peuvent pas partager le meme pourcentage : le dernier ecrase le premier, et
    // l'opacite 0 qui devait tenir jusqu'a la fenetre disparaissait — chaque exemplaire fondait
    // alors en continu depuis le debut du cycle, et les douze se voyaient tous en meme temps, en
    // eventail. Le relais se fait donc sur un millieme de cycle, ce qui est franc a l'oeil.
    const BLINK = 0.0005;
    if (t0 > 0)
      stops.push(`0%{opacity:0;transform:${shift(t0)}}`, `${pct(t0 - BLINK)}%{opacity:0;transform:${shift(t0)}}`);
    stops.push(`${pct(t0)}%{opacity:${easeIn ? 0 : 1};transform:${shift(t0)}}`);
    if (easeIn) stops.push(`${pct(t0 + easeIn)}%{opacity:1;transform:${shift(t0 + easeIn)}}`);
    // La chute mérite ses propres points : c'est une parabole, pas un segment.
    const steps = i === turns - 1 && drop ? perTurn + 8 : perTurn;
    for (let k = 1; k < steps; k += 1) {
      const t = onCycle(u0 + ((u1 - u0) * k) / steps);
      if (t <= t0 + easeIn || t >= t1 - easeOut) continue;
      stops.push(`${pct(t)}%{opacity:1;transform:${shift(t)}}`);
    }
    if (easeOut) stops.push(`${pct(t1 - easeOut)}%{opacity:1;transform:${shift(t1 - easeOut)}}`);
    stops.push(`${pct(t1)}%{opacity:${easeOut ? 0 : 1};transform:${shift(t1)}}`);
    if (t1 < 1)
      stops.push(`${pct(t1 + BLINK)}%{opacity:0;transform:${shift(t1)}}`, `100%{opacity:0;transform:${shift(t1)}}`);
    rideFrames.push(`@keyframes lq-ride-${uid}-${i}{${stops.join("")}}`);

    if (!load) continue;
    for (let n = 0; n < many; n += 1) {
      rides.push(
        <g
          key={`load${i}-${n}`}
          className="lq-conveyor__ride"
          style={
            running
              ? {
                  animationName: `lq-ride-${uid}-${i}`,
                  animationDuration: `${cycleSeconds}s`,
                  animationDelay: `${-cycleSeconds * (phase + n / many)}s`,
                }
              : { opacity: i === 0 ? 1 : 0 }
          }
        >
          {rackItemIso(load, fit, view.project, view.facing, `load${i}-${n}`)}
        </g>
      );
    }
  }

  if (load) {
    // Triee a mi-parcours : c'est la position la plus representative d'une charge qui se deplace,
    // et elle reste de toute facon entre les deux barrieres d'un bout a l'autre.
    const mid = stepAt(0.5);
    pieces.push({
      x: mid.x - berth / 2,
      y: mid.y - berth / 2,
      width: berth,
      height: berth,
      render: () => <g key="loads">{rides}</g>,
    });
  }

  // ---- le bâti ----
  // Dans un angle, il suit la courbe : un plateau carré sous une bande qui tourne dit que la
  // machine est une caisse à laquelle on a peint un arc dessus, alors que c'est une courbe qui a
  // une largeur. C'est le même anneau que les barrières, en beaucoup plus épais.
  /** Une emprise du module, ramenée au monde : c'est là que l'ombre se calcule, le soleil étant
   *  une direction du monde et non du module. */
  const onGround = (x: number, y: number) => {
    const p = spin(x, y);
    return { x: p.x + origin.x, y: p.y + origin.y };
  };

  /** Les ombres : l'emprise du bâti. Elles sont au sol, donc elles passent avant tout le reste —
   *  rien ne peut se glisser dessous. */
  const shade: ReactNode[] = [];
  if (shadows) {
    const high = deck(spanX / 2);
    if (kind === "corner") {
      const rIn = radius - beltHalf - bedMargin;
      const rOut = radius + beltHalf + bedMargin;
      const band = (r: number) =>
        Array.from({ length: 33 }, (_, i) => {
          const a = arcAngle(i, 32);
          return onGround(r * Math.cos(a), spanY + r * Math.sin(a));
        });
      shade.push(castShadow(world, [...band(rOut), ...band(rIn).reverse()], high, "sh-bed", cam.sun));
    } else {
      shade.push(
        castShadow(
          world,
          [onGround(0, 0), onGround(spanX, 0), onGround(spanX, spanY), onGround(0, spanY)],
          high,
          "sh-bed", cam.sun)
      );
    }
  }

  const bed: ReactNode =
    kind === "corner" ? (
      arcRing("steel", radius - beltHalf - bedMargin, radius + beltHalf + bedMargin, bedZ, bedTop, "bed")
    ) : (
      solidVolume("steel", "bed", slopedFaces(0, spanX, 0, spanY, 0, slab))
    );

  // ---- les pieds ----
  // Un tapis long fait pousser des pieds intermédiaires : un bâti de neuf mètres sur quatre pieds
  // est un plongeoir.
  const legs: Piece[] = [];
  const legAt = (cx: number, cy: number, key: string, top = bedZ) =>
    legs.push({
      x: cx - leg / 2,
      y: cy - leg / 2,
      width: leg,
      height: leg,
      render: () =>
        solidVolume("post", key, boxFaces(at, cx - leg / 2, cx + leg / 2, cy - leg / 2, cy + leg / 2, 0, top, facing)),
    });
  if (kind !== "corner") {
    const rows = kind === "tee" ? 2 : Math.max(2, Math.round(spanX / 2.5) + 1);
    for (let r = 0; r < rows; r += 1) {
      const x0 = leg / 2 + ((spanX - leg) * r) / (rows - 1);
      for (const y0 of [leg / 2, spanY - leg / 2]) legAt(x0, y0, `l${r}-${y0}`, under(x0));
    }
  } else {
    // Un pied sous chaque coin de l'anneau : ce sont les quatre seuls endroits où le bâti a un
    // bout droit sur lequel poser quelque chose.
    // Un poteau affleure le bord du bâti, et un poteau est un carré : ce dont il déborde dans une
    // direction n'est donc pas la moitié de son côté mais `h·(|cos| + |sin|)` — la moitié à plat,
    // la demi-diagonale en biais. Posé en biais avec un retrait d'une demi-largeur, comme il
    // l'était, il sortait de l'anneau d'un cinquième de sa taille.
    const h = leg / 2;
    const reachAt = (ux: number, uy: number) => h * (Math.abs(ux) + Math.abs(uy));
    const stand = (a: number, outer: boolean, tangentSign: number, key: string) => {
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const edge = outer ? radius + beltHalf + bedMargin : radius - beltHalf - bedMargin;
      const r = outer ? edge - reachAt(ux, uy) : edge + reachAt(ux, uy);
      // Aux deux bouts, il affleure aussi le plan droit qui ferme l'anneau.
      const tx = -uy * tangentSign;
      const ty = ux * tangentSign;
      const slide = tangentSign === 0 ? 0 : reachAt(tx, ty);
      legAt(r * ux + tx * slide, spanY + r * uy + ty * slide, key);
    };
    stand(arcAngle(0, 1), false, 1, "l-in-start");
    stand(arcAngle(0, 1), true, 1, "l-out-start");
    stand(arcAngle(1, 1), false, -1, "l-in-end");
    stand(arcAngle(1, 1), true, -1, "l-out-end");
    // Et un cinquième au milieu de la courbe, sur la rive extérieure : c'est la portée la plus
    // longue du bâti, et la seule qui n'a rien sous elle entre les deux bouts.
    stand(arcAngle(1, 2), true, 0, "l-mid");
  }

  const sorted = (list: Piece[]) =>
    cam.order(
      list.map((piece) => {
        if (!rotation) return piece;
        const pts = [
          spin(piece.x, piece.y),
          spin(piece.x + piece.width, piece.y),
          spin(piece.x + piece.width, piece.y + piece.height),
          spin(piece.x, piece.y + piece.height),
        ];
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        return { ...footprint(xs, ys), render: piece.render };
      })
    );

  const corners = frame
    ? frameCorners(frame, world, cam.sun)
    : [
        at(0, 0, 0),
        at(spanX, 0, 0),
        at(spanX, spanY, 0),
        at(0, spanY, 0),
        at(0, 0, deck(0) + guard),
        at(spanX, 0, deck(spanX) + guard),
        at(spanX, spanY, deck(spanX) + guard),
        at(0, spanY, deck(0) + guard),
        at(0, 0, Math.max(deck(0), deck(spanX)) + guard),
      ];
  const minX = Math.min(...corners.map((p) => p.x)) - PAD;
  const minY = Math.min(...corners.map((p) => p.y)) - PAD;
  const boxWidth = Math.max(...corners.map((p) => p.x)) + PAD - minX;
  const boxHeight = Math.max(...corners.map((p) => p.y)) + PAD - minY;

  return (
    <svg
      className={["lq-conveyor", !running && "lq-conveyor--stopped", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={`${minX} ${minY} ${boxWidth} ${boxHeight}`}
      style={{ "--lq-conveyor-cycle": `${cycleSeconds}s` } as CSSProperties}
      role="img"
      aria-label={`Tapis roulant ${kind === "corner" ? "d'angle" : "droit"}${running ? ", en marche" : ", arrêté"}`}
    >
      {load && (
        <defs>
          <style>{rideFrames.join("")}</style>
        </defs>
      )}

      {(parts === "all" || parts === "shadow") && shade}
      {(parts === "all" || parts === "machine") && (
        <>
          {sorted(legs).map((piece) => piece.render())}
          {bed}
          {/* La bande et sa flèche sont à plat sur le bâti : rien ne peut passer dessous, donc elles
              sont posées avant tout ce qui se dresse dessus plutôt que triées avec. */}
          <polygon className="lq-conveyor__belt" points={ring(beltFace)} />
          {rollerLines.map((r, i) => (
            <polyline key={`roller${i}`} className="lq-conveyor__roller" points={r} />
          ))}
              {arrows.map((a, i) => (
            <polyline key={`arrow${i}`} className="lq-conveyor__arrow" points={a} />
          ))}
      {/* Les deux barrières avant tout ce qui voyage, jamais après. Une barrière fait cinq pixels
          de haut et un colis en fait cinquante : la rive qui lui passe devant ne se lit pas comme
          « le colis est derrière la rive », elle se lit comme un colis coupé. Les deux barrières
          entre elles n'ont pas d'ordre à avoir — toute la largeur de la bande les sépare, donc
          elles ne se recouvrent jamais à l'écran. */}
          {guards}
        </>
      )}
      {(parts === "all" || parts === "load") && sorted(pieces).map((piece) => piece.render())}
    </svg>
  );
}
