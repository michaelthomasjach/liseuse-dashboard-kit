/**
 * La conduite : **le chemin qu'un engin prend vraiment**, et l'allure à laquelle il le prend.
 *
 * ## Pourquoi pas une ligne brisée
 *
 * Un engin qu'on fait suivre une ligne brisée pivote d'un coup à chaque sommet — même adouci, un
 * virage de rayon nul se lit comme un robot sur un rail, et un demi-tour comme une toupie. Un vrai
 * véhicule a un **rayon de braquage** : il ne sait pas tourner plus court, et il ne passe pas d'une
 * ligne droite à un virage en un instant — le volant se tourne progressivement. Ce module fabrique
 * donc des chemins qui respectent les deux : des **arcs** d'un rayon minimal à la place des angles,
 * puis un **lissage** qui étale le début et la fin de chaque arc, comme le ferait une clothoïde — la
 * courbure monte et redescend au lieu de sauter. Le chemin est enfin **rééchantillonné à pas
 * constant** le long de sa longueur, et le cap de l'engin est **la tangente** du chemin, toujours.
 *
 * ## Le départ compte
 *
 * Un engin qui repart n'est pas face à sa destination : il regarde où son dernier trajet l'a
 * laissé. `planPath` part donc de sa **pose** — position et cap — et commence par un arc qui
 * l'oriente vers le premier point, dans le sens où il a le moins à tourner. Un demi-tour est ainsi
 * un vrai demi-cercle, du rayon de l'engin, et jamais une rotation sur place.
 *
 * ## L'allure
 *
 * Sur ce chemin, `speedProfile` tire une vitesse en chaque point : jamais plus que la vitesse de
 * croisière, moins dans les courbes serrées (l'accélération latérale et la vitesse de rotation sont
 * bornées), et raccordée par des rampes d'accélération et de freinage — adoucies à leurs deux bouts,
 * pour que l'engin démarre et s'arrête en douceur. Le profil est calculé **une fois**, au départ du
 * trajet : l'engin ne fait ensuite que le lire, au rythme de l'horloge de la simulation. Tout est donc
 * déterministe — la même partie, rejouée, roule exactement pareil — et ne coûte rien par image.
 *
 * ## Les semi-remorques
 *
 * Un semi est deux corps : le tracteur, et la remorque qui pivote sur la sellette. `forwardTruck`
 * fait rouler le tracteur sur un chemin et laisse la remorque le suivre selon la cinématique d'une
 * vraie remorque — son cap se rapproche de la direction de l'attelage à mesure qu'on avance,
 * `dθr/ds = sin(θt − θr) / L`. `reverseTruck` fait l'inverse, comme un chauffeur qui recule à quai :
 * c'est l'**essieu de la remorque** qui suit un chemin lisse jusqu'au quai, la sellette s'en déduit,
 * et le tracteur prend le cap que lui impose le chemin de la sellette.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface Pose extends Pt {
  /** Le cap, en radians. */
  heading: number;
}

/**
 * Un trajet prêt à être parcouru : des échantillons à pas constant du point de référence de
 * l'engin, et ce qu'il faut pour le poser à chaque instant.
 */
export interface Track {
  /** L'abscisse de chaque échantillon le long du chemin qui règle l'allure, en cases. */
  s: number[];
  x: number[];
  y: number[];
  /** Le cap du corps de l'engin (ou du tracteur), en radians, continu (sans saut de 2π). */
  heading: number[];
  /** Le cap de la remorque, pour un semi. */
  trailer?: number[];
  /** Ce que tourne le corps qui tourne le plus, par case parcourue : ce qui borne la vitesse. */
  turn: number[];
  /** En marche arrière. */
  reverse: boolean;
  length: number;
}

const TAU = Math.PI * 2;

/** L'écart d'angle le plus court de `a` vers `b`, dans ]−π, π]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

/** Une ligne brisée, rééchantillonnée à pas constant le long de sa longueur. Les deux bouts sont gardés. */
export function resample(pts: Pt[], step: number): Pt[] {
  const clean = pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]) > 1e-6);
  if (clean.length < 2) return clean.slice();
  const cum = [0];
  for (let i = 1; i < clean.length; i += 1) cum.push(cum[i - 1] + dist(clean[i - 1], clean[i]));
  const total = cum[cum.length - 1];
  const n = Math.max(1, Math.round(total / step));
  const out: Pt[] = [];
  let j = 0;
  for (let k = 0; k <= n; k += 1) {
    const s = (total * k) / n;
    while (j < cum.length - 2 && cum[j + 1] < s) j += 1;
    const seg = cum[j + 1] - cum[j] || 1;
    const u = Math.max(0, Math.min(1, (s - cum[j]) / seg));
    out.push({ x: clean[j].x + (clean[j + 1].x - clean[j].x) * u, y: clean[j].y + (clean[j + 1].y - clean[j].y) * u });
  }
  return out;
}

/**
 * Remplacer chaque angle d'une ligne brisée par un **arc de cercle** de rayon `radius` — ou moins,
 * si les côtés qui s'y rejoignent sont trop courts pour le loger (l'arc s'arrête à leur milieu).
 */
export function filletPolyline(pts: Pt[], radius: number): Pt[] {
  const p = pts.filter((q, i) => i === 0 || dist(q, pts[i - 1]) > 1e-6);
  if (p.length < 3 || radius <= 0) return p.slice();
  const out: Pt[] = [p[0]];
  for (let i = 1; i < p.length - 1; i += 1) {
    const a = p[i - 1];
    const b = p[i];
    const c = p[i + 1];
    const l0 = dist(a, b);
    const l1 = dist(b, c);
    const h0 = Math.atan2(b.y - a.y, b.x - a.x);
    const h1 = Math.atan2(c.y - b.y, c.x - b.x);
    const turn = angleDelta(h0, h1);
    if (Math.abs(turn) < 1e-3) continue;
    // La distance du sommet où l'arc touche chaque côté : r·tan(α/2), bornée à la moitié des côtés
    // — sauf pour le dernier côté, qu'on peut consommer davantage puisque rien ne le suit.
    const t = Math.tan(Math.abs(turn) / 2);
    const cap = Math.min(i === 1 ? l0 : l0 / 2, i === p.length - 2 ? l1 : l1 / 2) * 0.98;
    const d = Math.min(radius * t, cap);
    const r = d / t;
    const p0 = { x: b.x - Math.cos(h0) * d, y: b.y - Math.sin(h0) * d };
    const side = Math.sign(turn);
    const cx = p0.x - Math.sin(h0) * r * side;
    const cy = p0.y + Math.cos(h0) * r * side;
    const a0 = Math.atan2(p0.y - cy, p0.x - cx);
    const n = Math.max(2, Math.ceil((Math.abs(turn) * r) / 0.15));
    for (let k = 0; k <= n; k += 1) {
      const a1 = a0 + (turn * k) / n;
      out.push({ x: cx + Math.cos(a1) * r, y: cy + Math.sin(a1) * r });
    }
  }
  out.push(p[p.length - 1]);
  return out;
}

/**
 * Lisser un chemin échantillonné : chaque point est remplacé par la moyenne de ses voisins, sur une
 * fenêtre de `half` échantillons de part et d'autre — **symétrique et rétrécie aux bouts**, si bien
 * que les deux extrémités ne bougent pas et qu'une ligne droite reste droite. Passé sur un arc
 * raccordé à des droites, ce lissage étale le saut de courbure : c'est l'entrée en clothoïde.
 */
export function smoothLine(pts: Pt[], half: number, passes = 2): Pt[] {
  let cur = pts.slice();
  const n = cur.length;
  if (n < 3 || half < 1) return cur;
  for (let pass = 0; pass < passes; pass += 1) {
    // Des sommes cumulées : la moyenne de chaque fenêtre coûte deux soustractions.
    const sx = [0];
    const sy = [0];
    for (const q of cur) {
      sx.push(sx[sx.length - 1] + q.x);
      sy.push(sy[sy.length - 1] + q.y);
    }
    const next: Pt[] = [];
    for (let i = 0; i < n; i += 1) {
      const w = Math.min(half, i, n - 1 - i);
      const k = 2 * w + 1;
      next.push({ x: (sx[i + w + 1] - sx[i - w]) / k, y: (sy[i + w + 1] - sy[i - w]) / k });
    }
    cur = next;
  }
  return cur;
}

/**
 * Le cap de chaque échantillon : la tangente, par différences centrées sur `reach` échantillons de
 * part et d'autre, rendue continue.
 */
export function tangentHeadings(pts: Pt[], fallback = 0, reach = 1): number[] {
  const n = pts.length;
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = pts[Math.max(0, i - reach)];
    const b = pts[Math.min(n - 1, i + reach)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    out.push(Math.hypot(dx, dy) > 1e-9 ? Math.atan2(dy, dx) : i > 0 ? out[i - 1] : fallback);
  }
  return unwrap(out);
}

/** Lisser une suite d'angles continus : une moyenne glissante, rétrécie aux bouts. */
export function smoothAngles(a: number[], half: number, passes = 2): number[] {
  let cur = a.slice();
  const n = cur.length;
  if (n < 3 || half < 1) return cur;
  for (let pass = 0; pass < passes; pass += 1) {
    const c = [0];
    for (const x of cur) c.push(c[c.length - 1] + x);
    cur = cur.map((_, i) => {
      const w = Math.min(half, i, n - 1 - i);
      return (c[i + w + 1] - c[i - w]) / (2 * w + 1);
    });
  }
  return cur;
}

/** Ôter les sauts de 2π d'une suite d'angles. */
export function unwrap(a: number[]): number[] {
  const out = a.slice();
  for (let i = 1; i < out.length; i += 1) out[i] = out[i - 1] + angleDelta(out[i - 1], out[i]);
  return out;
}

function cumulative(pts: Pt[]): number[] {
  const s = [0];
  for (let i = 1; i < pts.length; i += 1) s.push(s[i - 1] + dist(pts[i - 1], pts[i]));
  return s;
}

/** Ce que tournent les corps, par case parcourue, en chaque échantillon. */
function turnRate(s: number[], ...headings: number[][]): number[] {
  const n = s.length;
  return s.map((_, i) => {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    const ds = s[b] - s[a];
    if (ds < 1e-9) return 0;
    let k = 0;
    for (const h of headings) k = Math.max(k, Math.abs(h[b] - h[a]) / ds);
    return k;
  });
}

/**
 * L'arc qui oriente un engin, depuis sa pose, vers `target` : il tourne du côté où la cible se
 * trouve, du rayon `radius`, jusqu'à lui faire face — c'est le début d'un chemin de Dubins. Une
 * cible droit derrière se prend par la gauche. Rend les points de l'arc, départ compris.
 */
export function turnToward(pose: Pose, target: Pt, radius: number): Pt[] {
  const dx = target.x - pose.x;
  const dy = target.y - pose.y;
  const d = Math.hypot(dx, dy);
  const hx = Math.cos(pose.heading);
  const hy = Math.sin(pose.heading);
  const cross = hx * dy - hy * dx;
  const dot = hx * dx + hy * dy;
  if (d < 1e-6 || (Math.abs(cross) < 1e-6 * d && dot > 0)) return [{ x: pose.x, y: pose.y }];
  // Une cible toute proche ne tient pas hors du cercle de braquage : on serre le rayon.
  const r = Math.max(0.05, Math.min(radius, d * 0.45));
  const left = cross >= 0 ? 1 : -1;
  const nx = -hy * left;
  const ny = hx * left;
  const cx = pose.x + nx * r;
  const cy = pose.y + ny * r;
  const tc = Math.hypot(target.x - cx, target.y - cy);
  const beta = Math.atan2(target.y - cy, target.x - cx);
  const alpha = beta - left * Math.acos(Math.min(1, r / Math.max(r, tc)));
  const a0 = Math.atan2(pose.y - cy, pose.x - cx);
  let sweep = left > 0 ? (alpha - a0) % TAU : (a0 - alpha) % TAU;
  if (sweep < 0) sweep += TAU;
  if (sweep > TAU - 1e-3) sweep = 0;
  const n = Math.max(1, Math.ceil((sweep * r) / 0.12));
  const out: Pt[] = [];
  for (let k = 0; k <= n; k += 1) {
    const a = a0 + left * (sweep * k) / n;
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
}

export interface PlanOptions {
  /** Le rayon de braquage, en cases. */
  radius: number;
  /** Le pas d'échantillonnage. Défaut : 0,08 case. */
  step?: number;
  /** La longueur de lissage, en cases, de part et d'autre : l'étendue de l'entrée en courbe.
   *  Défaut : la moitié du rayon. */
  ease?: number;
}

/**
 * Le chemin d'un engin **depuis sa pose** jusqu'au dernier point de `targets`, par les autres :
 * un arc pour s'orienter vers le premier, des arcs de rayon `radius` à chaque angle, un lissage
 * pour raccorder les courbures, puis des échantillons à pas constant.
 */
export function planPath(pose: Pose, targets: Pt[], opts: PlanOptions): Pt[] {
  const step = opts.step ?? 0.08;
  const pts = targets.filter((p, i) => dist(p, i === 0 ? pose : targets[i - 1]) > 1e-4);
  if (pts.length === 0) return [{ x: pose.x, y: pose.y }];
  const arc = turnToward(pose, pts[0], opts.radius);
  const line = filletPolyline([arc[arc.length - 1], ...pts], opts.radius);
  const raw = resample([...arc.slice(0, -1), ...line], step);
  return smoothLine(raw, Math.round((opts.ease ?? opts.radius * 0.5) / step), 2);
}

/** Un chemin qui passe par des points, **sans pose de départ** : des arcs à chaque angle, lissés. */
export function smoothPath(points: Pt[], radius: number, step = 0.08, ease = radius * 0.5): Pt[] {
  const raw = resample(filletPolyline(points, radius), step);
  return smoothLine(raw, Math.round(ease / step), 2);
}

/** Un trajet où l'engin regarde dans le sens de la marche (ou à l'opposé, en marche arrière). */
export function trackOf(pts: Pt[], reverse = false, fallbackHeading = 0): Track {
  const s = cumulative(pts);
  const tangent = tangentHeadings(pts, reverse ? fallbackHeading + Math.PI : fallbackHeading);
  const heading = reverse ? tangent.map((h) => h + Math.PI) : tangent;
  return { s, x: pts.map((p) => p.x), y: pts.map((p) => p.y), heading, turn: turnRate(s, heading), reverse, length: s[s.length - 1] ?? 0 };
}

/** Une pose immobile : le trajet nul, pour qu'un engin reste où il est. */
export function stillTrack(pose: Pose): Track {
  return { s: [0], x: [pose.x], y: [pose.y], heading: [pose.heading], turn: [0], reverse: false, length: 0 };
}

// --- Les semi-remorques -----------------------------------------------------------------------------

/** L'angle d'articulation au-delà duquel une remorque se mettrait en portefeuille : on n'y va pas. */
const JACKKNIFE = (65 * Math.PI) / 180;

/**
 * Un semi **en marche avant** : la sellette suit `pts`, le tracteur regarde le long du chemin, et la
 * remorque suit — son cap se rapproche de celui du tracteur de `sin(θt − θr) / L` par case, intégré
 * à pas fin le long du chemin. `trailer0` est le cap de la remorque au départ ; `L`, la distance de
 * la sellette à l'essieu (au milieu du tridem) de la remorque.
 */
export function forwardTruck(pts: Pt[], trailer0: number, L: number, fallbackHeading = trailer0): Track {
  const base = trackOf(pts, false, fallbackHeading);
  const n = base.s.length;
  const trailer: number[] = [];
  let th = base.heading[0] + angleDelta(base.heading[0], trailer0);
  trailer.push(th);
  for (let i = 1; i < n; i += 1) {
    const ds = base.s[i] - base.s[i - 1];
    const sub = Math.max(1, Math.ceil(ds / 0.02));
    for (let k = 1; k <= sub; k += 1) {
      const hc = base.heading[i - 1] + ((base.heading[i] - base.heading[i - 1]) * k) / sub;
      th += (Math.sin(hc - th) / L) * (ds / sub);
    }
    // Une remorque ne dépasse jamais l'angle de portefeuille.
    const phi = angleDelta(base.heading[i], th);
    if (Math.abs(phi) > JACKKNIFE) th = base.heading[i] + Math.sign(phi) * JACKKNIFE;
    trailer.push(th);
  }
  return { ...base, trailer, turn: turnRate(base.s, base.heading, trailer) };
}

/**
 * Un semi **en marche arrière**, piloté par l'arrière comme un chauffeur à quai : `axle` est le
 * chemin de l'essieu de la remorque, du départ jusqu'au quai (dans le sens du mouvement). La
 * remorque regarde à l'opposé de son mouvement ; la sellette est à `L` devant l'essieu, dans l'axe
 * de la remorque ; et le tracteur prend le cap que dessine la sellette en reculant.
 *
 *  Le tracteur ne part pas forcément aligné : `tractor0` est son cap réel au départ. L'écart avec
 *  le cap que le chemin voudrait se résorbe sur les premières cases — le chauffeur redresse en
 *  reculant — au lieu de sauter. L'abscisse du trajet est celle de l'essieu : c'est elle qui règle
 *  l'allure.
 */
export function reverseTruck(axle: Pt[], L: number, tractor0?: number): Track {
  const sA = cumulative(axle);
  // Les caps se prennent sur une fenêtre d'une demi-case et se lissent : la sellette est à `L` de
  // l'essieu, et le moindre frémissement du cap de la remorque s'y amplifie d'autant.
  const step = sA.length > 1 ? sA[sA.length - 1] / (sA.length - 1) : 0.1;
  const reach = Math.max(1, Math.round(0.25 / Math.max(1e-3, step)));
  const half = Math.max(1, Math.round(0.4 / Math.max(1e-3, step)));
  const motion = smoothAngles(tangentHeadings(axle, 0, reach), half);
  const trailer = motion.map((h) => h + Math.PI);
  const hitch = axle.map((p, i) => ({ x: p.x + Math.cos(trailer[i]) * L, y: p.y + Math.sin(trailer[i]) * L }));
  // Le tracteur fait face à l'opposé du mouvement de la sellette.
  let tractor = smoothAngles(tangentHeadings(hitch, motion[0], reach), half).map((h) => h + Math.PI);
  // Aligner le cap du tracteur sur celui de la remorque au même point (à 2π près), puis résorber
  // l'écart de départ.
  tractor = tractor.map((h, i) => trailer[i] + angleDelta(trailer[i], h));
  tractor = unwrap(tractor);
  if (tractor0 !== undefined && tractor.length > 0) {
    const phi0 = angleDelta(tractor[0], tractor0);
    const span = Math.max(1, Math.min(3.5, sA[sA.length - 1] * 0.4));
    tractor = tractor.map((h, i) => {
      const u = Math.min(1, sA[i] / span);
      return h + phi0 * (1 - u * u * (3 - 2 * u));
    });
  }
  // La même garde qu'en marche avant : jamais au-delà de l'angle de portefeuille.
  tractor = tractor.map((h, i) => {
    const phi = angleDelta(h, trailer[i]);
    return Math.abs(phi) > JACKKNIFE ? trailer[i] - Math.sign(phi) * JACKKNIFE : h;
  });
  return {
    s: sA,
    x: hitch.map((p) => p.x),
    y: hitch.map((p) => p.y),
    heading: unwrap(tractor),
    trailer: unwrap(trailer),
    turn: turnRate(sA, unwrap(tractor), unwrap(trailer)),
    reverse: true,
    length: sA[sA.length - 1] ?? 0,
  };
}

// --- L'allure ----------------------------------------------------------------------------------------

export interface SpeedOptions {
  /** La vitesse de croisière, en cases par seconde. */
  speed: number;
  /** L'accélération et le freinage, en cases par seconde². Défaut : 1,2. */
  accel?: number;
  /** L'accélération latérale admise en courbe, en cases par seconde². Défaut : 1,5. */
  lateral?: number;
  /** La vitesse de rotation admise, en radians par seconde. Défaut : 1,8. */
  yawRate?: number;
  /** La vitesse au départ et à l'arrivée. Défaut : 0 — l'engin démarre et s'arrête. */
  startSpeed?: number;
  endSpeed?: number;
}

/**
 * Le temps de passage à chaque échantillon d'un trajet : la vitesse bornée par la croisière, par
 * la courbure (accélération latérale et rotation), raccordée par des rampes d'accélération et de
 * freinage, puis adoucie — les bouts des rampes s'arrondissent, et l'engin démarre et s'arrête sans
 * à-coup.
 */
export function speedProfile(track: Track, o: SpeedOptions): number[] {
  const n = track.s.length;
  if (n < 2) return [0];
  const vmax = Math.max(0.05, o.speed);
  const a = o.accel ?? 1.2;
  const lat = o.lateral ?? 1.5;
  const yaw = o.yawRate ?? 1.8;
  const v = track.turn.map((k) => (k < 1e-6 ? vmax : Math.min(vmax, Math.sqrt(lat / k), yaw / k)));
  v[0] = Math.min(v[0], o.startSpeed ?? 0);
  v[n - 1] = Math.min(v[n - 1], o.endSpeed ?? 0);
  const ramp = () => {
    for (let i = 1; i < n; i += 1) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] * v[i - 1] + 2 * a * (track.s[i] - track.s[i - 1])));
    for (let i = n - 2; i >= 0; i -= 1) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * a * (track.s[i + 1] - track.s[i])));
  };
  ramp();
  // Adoucir : une moyenne glissante, dont on ne garde que ce qui ralentit — les bornes restent
  // tenues, et les coins des rampes s'arrondissent.
  const half = Math.max(1, Math.round(0.35 / Math.max(1e-3, track.s[1] - track.s[0])));
  for (let pass = 0; pass < 2; pass += 1) {
    const c = [0];
    for (const x of v) c.push(c[c.length - 1] + x);
    for (let i = 1; i < n - 1; i += 1) {
      const w = Math.min(half, i, n - 1 - i);
      v[i] = Math.min(v[i], (c[i + w + 1] - c[i - w]) / (2 * w + 1));
    }
  }
  // Un plancher, pour ne jamais rester planté : un rien au-dessus de zéro, sauf aux deux bouts.
  const floor = Math.min(0.08, vmax * 0.1);
  const t = [0];
  for (let i = 1; i < n; i += 1) {
    const ds = track.s[i] - track.s[i - 1];
    const vm = Math.max(floor, (v[i - 1] + v[i]) / 2);
    t.push(t[i - 1] + ds / vm);
  }
  return t;
}

/** La pose sur un trajet à l'abscisse `s`, interpolée entre deux échantillons. */
export function sampleTrack(track: Track, s: number): { x: number; y: number; heading: number; trailer?: number } {
  const n = track.s.length;
  if (n === 1 || s <= 0) return { x: track.x[0], y: track.y[0], heading: track.heading[0], trailer: track.trailer?.[0] };
  if (s >= track.length) return { x: track.x[n - 1], y: track.y[n - 1], heading: track.heading[n - 1], trailer: track.trailer?.[n - 1] };
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (track.s[mid] <= s) lo = mid;
    else hi = mid;
  }
  const u = (s - track.s[lo]) / (track.s[hi] - track.s[lo] || 1);
  const lerp = (arr: number[]) => arr[lo] + (arr[hi] - arr[lo]) * u;
  return { x: lerp(track.x), y: lerp(track.y), heading: lerp(track.heading), trailer: track.trailer ? lerp(track.trailer) : undefined };
}

/** L'abscisse atteinte au temps `t` d'un profil (`speedProfile`). */
export function distanceAt(track: Track, times: number[], t: number): number {
  const n = times.length;
  if (n < 2 || t <= 0) return 0;
  if (t >= times[n - 1]) return track.length;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid;
  }
  const u = (t - times[lo]) / (times[hi] - times[lo] || 1);
  return track.s[lo] + (track.s[hi] - track.s[lo]) * u;
}
