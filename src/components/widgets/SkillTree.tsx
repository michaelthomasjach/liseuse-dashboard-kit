import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { CheckIcon, CloseIcon, LockIcon, ZoomInIcon, ZoomOutIcon } from "../icons";
import { layoutTree, TREE_DOT_R, TREE_NODE_W } from "./skillTreeLayout";
import "./SkillTree.css";

/**
 * L'arbre de compétences d'un jeu de gestion — ce qu'on recherche, dans quel ordre, et ce que cela
 * rapporte.
 *
 * ## La lecture
 *
 * Une **colonne par branche** (logistique, énergie, commerce…), coiffée de son nom, de son icône et
 * de sa couleur ; dans chaque colonne, les nœuds **par rang** (`tier`), du plus accessible en haut au
 * plus lointain en bas. Des traits relient chaque prérequis à ce qu'il ouvre — droits dans une même
 * branche, en courbe quand ils passent d'une branche à l'autre — et **s'allument** quand le
 * prérequis est acquis : on voit d'un coup d'œil par où l'arbre s'ouvre.
 *
 * ## Les états
 *
 * - `locked` : hors de portée — grisé, un cadenas ;
 * - `available` : on peut le prendre — son bord bat doucement, c'est là que l'œil doit aller ;
 * - `researching` : en cours — une jauge dit où il en est (`progress`, de 0 à 1) ;
 * - `unlocked` : acquis — plein, coché.
 *
 * Un nœud choisi montre son détail : celui de l'application (`renderDetail`), ou, à défaut, sa
 * description et — s'il est disponible et que l'application sait débloquer (`onUnlock`) — un bouton
 * « Débloquer (2 pts) », que `canUnlock` peut griser (pas assez de points).
 *
 * Trop large pour son conteneur, l'arbre défile à l'horizontale, dans son cadre.
 *
 * ## Sur un téléphone
 *
 * Dans un cadre de 640 px ou moins (la largeur du composant, pas celle de l'écran), le cadre défile
 * dans les deux sens — au doigt, par le défilement natif du navigateur, sans rien intercepter — et sa
 * hauteur est bornée à l'écran, pour que la page reste accessible autour. Trois boutons s'ajoutent
 * au-dessus : « − », la taille courante (qui ramène à 100 %), « + ». C'est un zoom sans pincement :
 * l'arbre est mis à l'échelle d'un bloc (`transform: scale`), traits compris, et une scène autour
 * réserve la taille de l'arbre mis à l'échelle, de sorte que le défilement couvre exactement l'arbre.
 * Le point au centre du cadre reste au centre d'un zoom à l'autre. Au clavier, dans l'arbre, `+`,
 * `-` et `0` font la même chose ; les nœuds restent des boutons qu'on atteint par Tab.
 *
 * `zoomControls` force les boutons (`true`) ou les retire (`false`) ; par défaut (`"auto"`), ils
 * n'apparaissent que dans un cadre étroit.
 *
 * ## En arbre
 *
 * Avec `layout="tree"`, l'arbre cesse d'être un tableau pour devenir un arbre. Au pied, un **tronc**
 * épais et évasé porte les nœuds `trunk`, empilés sur l'axe du bas vers le haut ; un premier choix
 * — deux nœuds du même rang — s'écarte de part et d'autre du fût. De son sommet partent les
 * **branches**, chacune dans sa direction (`angle`, de −80° à gauche à +80° à droite, ou une part
 * égale de l'éventail), en membres courbes qui s'amincissent en montant ; leurs nœuds s'y posent par
 * rang, en pastilles rondes, et ceux d'un même rang s'écartent en rameaux. Une passe de poussée
 * évite qu'une branche ne recouvre sa voisine (voir `skillTreeLayout.ts` pour les règles exactes).
 *
 * Un prérequis pris dans une **autre branche** se dessine en **liane** : un trait courbe, pointillé,
 * semé de feuilles, qui court d'une branche à l'autre — c'est ainsi que se lisent les compétences
 * hybrides. Les nœuds d'un même `exclusiveGroup` sont des **carrefours** : un petit « ou » se pose
 * entre eux, et quand l'un est pris, l'application passe les autres à l'état `closed` — ils se
 * **fanent** (grisés, éteints) et leur membre meurt. Ce qui est acquis, au contraire, vit : son
 * membre prend la couleur de sa branche et sa pastille rayonne.
 *
 * L'arbre entier tient dans la largeur de son cadre, mis à l'échelle ; dans un cadre étroit, les
 * boutons de zoom l'agrandissent à partir de cette vue d'ensemble et le cadre défile. Le détail par
 * défaut, qui ne peut plus se glisser sous le nœud, se pose à côté de l'arbre. Au clavier, les nœuds
 * se suivent dans l'ordre du tronc, puis branche après branche ; les tracés sont cachés aux
 * technologies d'assistance.
 */

/**
 * `closed` : un choix écarté — son voisin d'un carrefour exclusif a été pris. Il reste fermé
 * jusqu'à ce que l'application remette l'arbre à zéro.
 */
export type SkillNodeState = "locked" | "available" | "researching" | "unlocked" | "closed";

export interface SkillTreeNode {
  id: string;
  label: string;
  /** La branche (colonne) du nœud : l'`id` d'une entrée de `branches`. */
  branch: string;
  /** Le rang du nœud dans sa branche, à partir de 0 — sa ligne. */
  tier: number;
  description?: string;
  icon?: ReactNode;
  /** Les nœuds à acquérir avant celui-ci — de sa branche ou d'une autre. */
  requires?: string[];
  state: SkillNodeState;
  /** L'avancement d'une recherche en cours, de 0 à 1. */
  progress?: number;
  /** Ce qu'il coûte, dit par l'application (un prix, une durée). */
  cost?: ReactNode;
  /** Ce qu'il coûte en points de compétence : montré en pastille, « 2 pts ». */
  points?: number;
  /** Ce qu'il rapporte, en quelques mots : « +25 % de demande ». */
  effect?: ReactNode;
  /**
   * Un carrefour exclusif : les nœuds qui partagent ce groupe sont des choix qui s'excluent —
   * prendre l'un ferme les autres (à l'application de les passer à `closed`). En arbre, un « ou »
   * se pose entre eux.
   */
  exclusiveGroup?: string;
  /** Le nœud fait partie du tronc : en arbre, il se pose sur l'axe central, au pied, par rang. */
  trunk?: boolean;
}

export interface SkillTreeBranch {
  id: string;
  label: string;
  icon?: ReactNode;
  /** La couleur de la branche : ses traits, son bandeau, ses nœuds acquis. */
  color?: string;
  /**
   * En arbre, la direction où pousse la branche, en degrés : de −80 (à gauche) à +80 (à droite),
   * 0 tout droit vers le haut. Absente : les branches se partagent l'éventail −70…+70 à parts
   * égales, dans leur ordre.
   */
  angle?: number;
}

/** `columns` : une colonne par branche (défaut). `tree` : un tronc, des branches, des lianes. */
export type SkillTreeLayoutMode = "columns" | "tree";

export interface SkillTreeProps {
  nodes: SkillTreeNode[];
  /** Les branches, dans l'ordre des colonnes. Absentes : celles des nœuds, dans leur ordre. */
  branches?: SkillTreeBranch[];
  /** Le nœud choisi. Contrôlé si donné ; sinon, l'arbre retient lui-même le dernier cliqué. */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Le détail du nœud choisi, à côté de l'arbre. */
  renderDetail?: (node: SkillTreeNode) => ReactNode;
  /** Au-dessus des colonnes : « Points disponibles : 3 ». */
  header?: ReactNode;
  /** Débloquer un nœud disponible — le bouton du détail par défaut. */
  onUnlock?: (id: string) => void;
  /** Le nœud peut-il être débloqué maintenant (assez de points…) ? Défaut : oui s'il est disponible. */
  canUnlock?: (node: SkillTreeNode) => boolean;
  /** Les boutons de zoom. `"auto"` (défaut) : seulement dans un cadre de 640 px ou moins. */
  zoomControls?: boolean | "auto";
  /** La disposition : en colonnes (défaut) ou en arbre. */
  layout?: SkillTreeLayoutMode;
  className?: string;
}

const STATE_LABEL: Record<SkillNodeState, string> = {
  locked: "verrouillé",
  available: "disponible",
  researching: "en cours",
  unlocked: "acquis",
  closed: "fermé",
};

const pts = (n: number) => `${n} pt${Math.abs(n) > 1 ? "s" : ""}`;

/** Les crans du zoom, de la vue d'ensemble au gros plan. */
const ZOOMS = [0.5, 0.625, 0.75, 0.875, 1, 1.25, 1.5];
/** En arbre, les crans sont relatifs à la vue d'ensemble (l'arbre entier dans la largeur du cadre) :
 *  on ne réduit pas en deçà, on agrandit jusqu'à huit fois (un arbre dense sur un téléphone part de 17 %) — sans dépasser 150 % de la taille réelle. */
const TREE_ZOOMS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
const TREE_MAX_SCALE = 1.5;
/** En deçà de cette largeur (celle du composant), l'arbre passe en mode compact : zoom et cadre borné. */
const COMPACT_PX = 640;

type Link = { id: string; d: string; lit: boolean; done: boolean; color?: string; cross: boolean };

export function SkillTree({
  nodes,
  branches: branchesProp,
  selectedId: selectedProp,
  onSelect,
  renderDetail,
  header,
  onUnlock,
  canUnlock,
  zoomControls = "auto",
  layout = "columns",
  className,
}: SkillTreeProps) {
  const isTree = layout === "tree";
  const [own, setOwn] = useState<string | null>(null);
  const selectedId = selectedProp !== undefined ? selectedProp : own;
  const select = (id: string) => {
    setOwn(id);
    onSelect?.(id);
  };

  const branches = useMemo<SkillTreeBranch[]>(() => {
    const out = [...(branchesProp ?? [])];
    // En arbre, les nœuds du tronc ne sont d'aucune branche : leur `branch` n'ouvre pas de membre.
    for (const n of nodes) if (!(isTree && n.trunk) && !out.some((b) => b.id === n.branch)) out.push({ id: n.branch, label: n.branch });
    return out;
  }, [branchesProp, nodes, isTree]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const rows = Math.max(1, ...nodes.map((n) => Math.max(0, Math.round(n.tier)) + 1));
  const cells = useMemo(() => {
    const m = new Map<string, SkillTreeNode[]>();
    for (const n of nodes) {
      const k = `${n.branch}|${Math.max(0, Math.round(n.tier))}`;
      m.set(k, [...(m.get(k) ?? []), n]);
    }
    return m;
  }, [nodes]);
  const colorOf = (branch: string) => branches.find((b) => b.id === branch)?.color;

  // Compact ou non : la largeur du composant ; et celle du cadre qui défile, sur laquelle l'arbre se
  // pose quand il est mis à l'échelle.
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [viewW, setViewW] = useState(0);
  const [viewH, setViewH] = useState(0);
  useLayoutEffect(() => {
    const r = root.current;
    const sc = scroller.current;
    if (!r || !sc) return;
    const measure = () => {
      const isCompact = r.getBoundingClientRect().width <= COMPACT_PX;
      setCompact(isCompact);
      // La largeur utile du cadre : sans ses marges internes, là où la scène se pose.
      const cs = getComputedStyle(sc);
      setViewW(sc.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0));
      // La hauteur qu'on s'autorise pour un arbre plus haut que large : celle du cadre borné en mode
      // compact (70 % de l'écran), sinon 85 % de l'écran — l'arbre entier reste visible d'un coup d'œil.
      const vh = typeof window !== "undefined" ? window.innerHeight : 0;
      setViewH(vh ? vh * (isCompact ? 0.7 : 0.85) - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0) : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    if (typeof ResizeObserver === "undefined") return () => window.removeEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    ro.observe(r);
    ro.observe(sc);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  const showZoom = zoomControls === "auto" ? compact : zoomControls;
  const [zoomState, setZoom] = useState(1);

  // En arbre : la disposition, calculée une fois pour toutes par nœuds et branches ; puis l'échelle
  // qui la fait tenir dans la largeur du cadre, que le zoom multiplie. Les crans permis dépendent de
  // cette vue d'ensemble : un arbre qui tient déjà à 100 % ne s'agrandit guère.
  const tree = useMemo(() => (isTree ? layoutTree(nodes, branches) : null), [isTree, nodes, branches]);
  // La vue d'ensemble tient dans la largeur du cadre et, pour un arbre plus haut que large, aussi dans
  // la hauteur qu'on lui accorde (jamais sous 240 px, pour qu'un écran bas ne l'écrase pas) : un arbre
  // étroit et haut ne se déploie pas sur trois écrans quand le cadre est large.
  const tall = !!tree && tree.height > tree.width && viewH > 0;
  const fit = tree && viewW > 0 ? Math.min(1, viewW / tree.width, tall ? Math.max(240, viewH) / tree.height : 1) : 1;
  const zooms = isTree ? TREE_ZOOMS.filter((z) => z === 1 || fit * z <= TREE_MAX_SCALE + 1e-6) : ZOOMS;
  // Sans les boutons, pas de zoom : on ne laisse pas un arbre réduit sans moyen de le remettre. Et un
  // cran devenu hors d'atteinte (le cadre s'est élargi) retombe sur le plus grand permis.
  const zoom = showZoom ? Math.max(zooms[0], Math.min(zooms[zooms.length - 1], zoomState)) : 1;
  const scale = isTree ? fit * zoom : zoom;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  /** Où en était le cadre juste avant un changement de zoom — pour garder son centre en place. */
  const anchor = useRef<{ left: number; top: number; from: number } | null>(null);

  /** Le cadre qui défile doit connaître la taille de l'arbre **après** mise à l'échelle : une
   *  transformation ne change pas la place qu'un élément occupe, c'est donc la scène autour qui la
   *  réserve. Posée directement sur le DOM, d'après la taille de mise en page de l'arbre — sans
   *  passer par un rendu, pour que la scène ait sa taille avant qu'on ajuste le défilement. */
  const fitStage = () => {
    const g = grid.current;
    const st = stage.current;
    if (!g || !st) return;
    const z = zoomRef.current;
    st.style.width = z === 1 ? "" : `${g.offsetWidth * z}px`;
    st.style.height = z === 1 ? "" : `${g.offsetHeight * z}px`;
  };

  // Les traits : mesurés sur les boutons une fois posés, et remesurés quand l'arbre change de taille.
  const grid = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<string, HTMLElement>());
  const [links, setLinks] = useState<Link[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  useLayoutEffect(() => {
    const g = grid.current;
    if (!g) return;
    const measure = () => {
      // Les boîtes mesurées sont celles de l'écran, donc à l'échelle ; les traits, eux, se dessinent
      // dans l'arbre avant sa mise à l'échelle : on divise.
      const z = zoomRef.current || 1;
      const base = g.getBoundingClientRect();
      const out: Link[] = [];
      for (const n of nodes)
        for (const req of n.requires ?? []) {
          const from = refs.current.get(req);
          const to = refs.current.get(n.id);
          const pre = byId.get(req);
          if (!from || !to || !pre) continue;
          const a = from.getBoundingClientRect();
          const b = to.getBoundingClientRect();
          const x0 = (a.left + a.width / 2 - base.left) / z;
          const y0 = (a.bottom - base.top) / z;
          const x1 = (b.left + b.width / 2 - base.left) / z;
          const y1 = (b.top - base.top) / z;
          const cross = pre.branch !== n.branch;
          const dy = Math.max(24, Math.abs(y1 - y0) * 0.5);
          const d = !cross && Math.abs(x1 - x0) < 1 ? `M${x0} ${y0} L${x1} ${y1}` : `M${x0} ${y0} C${x0} ${y0 + dy}, ${x1} ${y1 - dy}, ${x1} ${y1}`;
          out.push({ id: `${req}->${n.id}`, d, lit: pre.state === "unlocked", done: pre.state === "unlocked" && n.state === "unlocked", color: colorOf(pre.branch), cross });
        }
      setLinks(out);
      setSize({ w: g.scrollWidth, h: g.scrollHeight });
      fitStage();
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(g);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, branches, selectedId, layout]);

  // Un nouveau zoom : la scène prend sa nouvelle taille, puis le cadre défile pour que le point qui
  // était en son centre y reste.
  useLayoutEffect(() => {
    fitStage();
    const a = anchor.current;
    const sc = scroller.current;
    anchor.current = null;
    if (!a || !sc || a.from === zoom) return;
    const k = zoom / a.from;
    sc.scrollLeft = (a.left + sc.clientWidth / 2) * k - sc.clientWidth / 2;
    sc.scrollTop = (a.top + sc.clientHeight / 2) * k - sc.clientHeight / 2;
  }, [zoom, viewW]);

  const zoomTo = (next: number) => {
    const z = Math.min(zooms[zooms.length - 1], Math.max(zooms[0], next));
    if (z === zoom) return;
    const sc = scroller.current;
    anchor.current = sc ? { left: sc.scrollLeft, top: sc.scrollTop, from: zoom } : null;
    setZoom(z);
  };
  const zoomIn = () => zoomTo(zooms.find((z) => z > zoom + 1e-6) ?? zoom);
  const zoomOut = () => zoomTo([...zooms].reverse().find((z) => z < zoom - 1e-6) ?? zoom);
  const onZoomKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!showZoom || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "+" || e.key === "=") zoomIn();
    else if (e.key === "-" || e.key === "_") zoomOut();
    else if (e.key === "0") zoomTo(1);
    else return;
    e.preventDefault();
  };

  const unlockable = (n: SkillTreeNode) => n.state === "available" && (canUnlock ? canUnlock(n) : true);

  /** Le détail par défaut, sous le nœud choisi : sa description, ce qu'il demande, le bouton. */
  const inlineDetail = (n: SkillTreeNode) => {
    const missing = (n.requires ?? []).map((id) => byId.get(id)).filter((r): r is SkillTreeNode => !!r && r.state !== "unlocked");
    return (
      <div className="lq-skilltree__inline" role="region" aria-label={`Détail : ${n.label}`}>
        {isTree && <p className="lq-skilltree__inline-title">{n.label}</p>}
        {isTree && n.effect !== undefined && <p className="lq-skilltree__inline-effect">{n.effect}</p>}
        {n.description && <p className="lq-skilltree__desc">{n.description}</p>}
        {n.cost !== undefined && <p className="lq-skilltree__cost">Coût : {n.cost}</p>}
        {missing.length > 0 && <p className="lq-skilltree__needs">Demande d'abord : {missing.map((r) => r.label).join(", ")}</p>}
        {onUnlock && n.state === "available" && (
          <button type="button" className="lq-skilltree__unlock" disabled={!unlockable(n)} onClick={() => onUnlock(n.id)}>
            Débloquer{n.points !== undefined ? ` (${pts(n.points)})` : ""}
          </button>
        )}
        {n.state === "unlocked" && <p className="lq-skilltree__owned">Acquis.</p>}
        {n.state === "closed" && <p className="lq-skilltree__owned">Fermé : un autre choix a été pris.</p>}
      </div>
    );
  };

  const nodeButton = (n: SkillTreeNode) => {
    const color = colorOf(n.branch);
    const progress = Math.max(0, Math.min(1, n.progress ?? 0));
    const style = (color ? { "--lq-skill-color": color } : {}) as CSSProperties;
    return (
      <button
        key={n.id}
        ref={(el) => {
          if (el) refs.current.set(n.id, el);
          else refs.current.delete(n.id);
        }}
        type="button"
        className={["lq-skilltree__node", `lq-skilltree__node--${n.state}`, n.id === selectedId && "is-selected"].filter(Boolean).join(" ")}
        style={style}
        aria-pressed={n.id === selectedId}
        aria-label={`${n.label} — ${STATE_LABEL[n.state]}${n.state === "researching" ? ` ${Math.round(progress * 100)} %` : ""}${n.points !== undefined ? `, ${pts(n.points)}` : ""}`}
        onClick={() => select(n.id)}
      >
        <span className="lq-skilltree__icon" aria-hidden="true">
          {n.state === "locked" ? <LockIcon size={14} /> : n.state === "closed" ? <CloseIcon size={14} /> : n.state === "unlocked" ? <CheckIcon size={14} /> : n.icon ?? <span className="lq-skilltree__pip" />}
        </span>
        <span className="lq-skilltree__text">
          <span className="lq-skilltree__label">{n.label}</span>
          {n.effect !== undefined && <span className="lq-skilltree__effect">{n.effect}</span>}
        </span>
        {n.points !== undefined && n.state !== "unlocked" && <span className="lq-skilltree__points">{pts(n.points)}</span>}
        {n.state === "researching" && (
          <span className="lq-skilltree__progress" aria-hidden="true">
            <span style={{ width: `${progress * 100}%` }} />
          </span>
        )}
      </button>
    );
  };

  /** Un nœud de l'arbre : une pastille ronde posée sur son membre, l'étiquette pendue dessous. */
  const treeNode = (n: SkillTreeNode, at: { x: number; y: number }, peers: string[]) => {
    const color = colorOf(n.branch);
    const progress = Math.max(0, Math.min(1, n.progress ?? 0));
    const style = {
      left: at.x - TREE_NODE_W / 2,
      top: at.y - TREE_DOT_R,
      width: TREE_NODE_W,
      ...(color ? { "--lq-skill-color": color } : {}),
    } as CSSProperties;
    return (
      <button
        key={n.id}
        type="button"
        className={["lq-skilltree__leaf", `lq-skilltree__leaf--${n.state}`, n.trunk && "is-trunk", n.id === selectedId && "is-selected"].filter(Boolean).join(" ")}
        style={style}
        aria-pressed={n.id === selectedId}
        aria-label={`${n.label} — ${STATE_LABEL[n.state]}${n.state === "researching" ? ` ${Math.round(progress * 100)} %` : ""}${n.points !== undefined ? `, ${pts(n.points)}` : ""}${peers.length ? `, au choix avec ${peers.join(", ")}` : ""}`}
        onClick={() => select(n.id)}
      >
        <span className="lq-skilltree__dot" aria-hidden="true">
          {n.state === "locked" ? <LockIcon size={16} /> : n.state === "closed" ? <CloseIcon size={16} /> : n.state === "unlocked" ? <CheckIcon size={18} /> : n.icon ?? <span className="lq-skilltree__pip" />}
          {n.points !== undefined && n.state !== "unlocked" && n.state !== "closed" && <span className="lq-skilltree__leaf-points">{n.points}</span>}
        </span>
        <span className="lq-skilltree__leaf-label">{n.label}</span>
        {n.state === "researching" && (
          <span className="lq-skilltree__progress lq-skilltree__leaf-progress" aria-hidden="true">
            <span style={{ width: `${progress * 100}%` }} />
          </span>
        )}
      </button>
    );
  };

  /** Le plan de l'arbre : le tronc, les membres, les lianes et les carrefours en SVG, dessous ; les
   *  nœuds en boutons, dessus. Le tout est dessiné à sa taille propre puis mis à l'échelle d'un bloc ;
   *  le cadre qui l'entoure réserve la taille mise à l'échelle, pour que le défilement la couvre. */
  const treeCanvas = (t: NonNullable<typeof tree>) => {
    const branchOf = new Map(branches.map((b) => [b.id, b]));
    const tint = (branch?: string) => {
      const c = branch ? colorOf(branch) : undefined;
      return c ? ({ "--lq-skill-color": c } as CSSProperties) : undefined;
    };
    const peersOf = (n: SkillTreeNode) =>
      n.exclusiveGroup ? nodes.filter((m) => m.id !== n.id && m.exclusiveGroup === n.exclusiveGroup).map((m) => m.label) : [];
    return (
      <div className="lq-skilltree__canvas" style={{ width: Math.floor(t.width * scale), height: Math.ceil(t.height * scale) }}>
        <div className="lq-skilltree__world" style={{ width: t.width, height: t.height, transform: `scale(${scale})` }}>
          <svg className="lq-skilltree__tree" width={t.width} height={t.height} aria-hidden="true" focusable="false">
            <ellipse className="lq-skilltree__ground" cx={t.trunk.ground.cx} cy={t.trunk.ground.cy} rx={t.trunk.ground.rx} ry={12} />
            {t.limbs.map((l) => (
              <path key={l.id} d={l.d} className={`lq-skilltree__limb is-${l.state}`} style={{ ...tint(l.branch), strokeWidth: l.width }} />
            ))}
            <path className="lq-skilltree__trunk" d={t.trunk.body} />
            {t.trunk.grain.map((d, i) => (
              <path key={i} className="lq-skilltree__grain" d={d} />
            ))}
            {t.vines.map((v) => (
              <g key={v.id} className={`lq-skilltree__vine is-${v.state}`} style={tint(v.branch)}>
                <path d={v.d} />
                {v.leaves.map((q, i) => (
                  <ellipse key={i} className="lq-skilltree__vine-leaf" cx={0} cy={0} rx={6} ry={2.8} transform={`translate(${q.x} ${q.y}) rotate(${q.a}) translate(5 0)`} />
                ))}
              </g>
            ))}
            {t.forks.map((k) => (
              <path key={k.id} className="lq-skilltree__fork-line" d={k.d} />
            ))}
          </svg>
          {t.labels.map((l) => {
            const b = branchOf.get(l.branch);
            if (!b) return null;
            return (
              <div key={l.branch} className="lq-skilltree__tree-label" style={{ left: l.x, top: l.y, ...tint(b.id) }}>
                {b.icon && (
                  <span className="lq-skilltree__branch-icon" aria-hidden="true">
                    {b.icon}
                  </span>
                )}
                <span>{b.label}</span>
              </div>
            );
          })}
          {t.order.map((n) => treeNode(n, t.pos.get(n.id)!, peersOf(n)))}
          {t.forks.map((k) => (
            <span key={k.id} className="lq-skilltree__fork" style={{ left: k.x, top: k.y }} aria-hidden="true" title={`Au choix : ${k.labels[0]} ou ${k.labels[1]}`}>
              ou
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div ref={root} className={["lq-skilltree", isTree && "lq-skilltree--tree", compact && "lq-skilltree--compact", className].filter(Boolean).join(" ")}>
      {header !== undefined && <div className="lq-skilltree__header">{header}</div>}
      {showZoom && (
        <div className="lq-skilltree__zoom" role="toolbar" aria-label="Zoom de l'arbre">
          <button type="button" className="lq-skilltree__zoom-btn" onClick={zoomOut} disabled={zoom <= zooms[0]} aria-label="Dézoomer" title="Dézoomer (−)">
            <ZoomOutIcon size={18} />
          </button>
          <button
            type="button"
            className="lq-skilltree__zoom-btn lq-skilltree__zoom-reset"
            onClick={() => zoomTo(1)}
            disabled={zoom === 1}
            aria-label={isTree ? `Zoom ${Math.round(scale * 100)} % — revenir à la vue d'ensemble` : `Zoom ${Math.round(zoom * 100)} % — revenir à 100 %`}
            title={isTree ? "Vue d'ensemble (0)" : "Taille réelle (0)"}
          >
            {Math.round(scale * 100)} %
          </button>
          <button type="button" className="lq-skilltree__zoom-btn" onClick={zoomIn} disabled={zoom >= zooms[zooms.length - 1]} aria-label="Zoomer" title="Zoomer (+)">
            <ZoomInIcon size={18} />
          </button>
        </div>
      )}
      <div className="lq-skilltree__body">
        {/* Un cadre qui défile doit pouvoir être atteint au clavier (les flèches le font défiler) —
            seulement quand il est borné, c'est-à-dire en mode compact. */}
        <div
          ref={scroller}
          className="lq-skilltree__scroll"
          onKeyDown={onZoomKey}
          {...(compact ? { tabIndex: 0, role: "region", "aria-label": "Arbre de compétences" } : {})}
        >
          {tree ? (
            treeCanvas(tree)
          ) : (
            <div ref={stage} className="lq-skilltree__stage">
              <div
                ref={grid}
                className="lq-skilltree__grid"
                style={{
                  gridTemplateColumns: `repeat(${branches.length}, minmax(188px, 1fr))`,
                  gridTemplateRows: `auto repeat(${rows}, auto)`,
                  // Mis à l'échelle, l'arbre se pose sur la largeur du cadre divisée par le zoom : réduit,
                  // il se déploie comme dans un cadre plus large ; agrandi, il déborde et le cadre défile.
                  ...(zoom !== 1 ? { position: "absolute", top: 0, left: 0, boxSizing: "border-box", width: viewW ? viewW / zoom : undefined, transform: `scale(${zoom})`, transformOrigin: "0 0" } : {}),
                }}
              >
              <svg className="lq-skilltree__links" width={size.w} height={size.h} aria-hidden="true">
                {links.map((l) => (
                  <path
                    key={l.id}
                    d={l.d}
                    className={["lq-skilltree__link", l.lit && "is-lit", l.done && "is-done", l.cross && "is-cross"].filter(Boolean).join(" ")}
                    style={l.color ? ({ "--lq-skill-color": l.color } as CSSProperties) : undefined}
                  />
                ))}
              </svg>
              {branches.map((b, col) => (
                <div
                  key={b.id}
                  className="lq-skilltree__branch"
                  style={{ gridColumn: col + 1, gridRow: 1, ...(b.color ? ({ "--lq-skill-color": b.color } as CSSProperties) : {}) }}
                >
                  {b.icon && <span className="lq-skilltree__branch-icon">{b.icon}</span>}
                  <span>{b.label}</span>
                </div>
              ))}
              {branches.flatMap((b, col) =>
                Array.from({ length: rows }, (_, tier) => {
                  const list = cells.get(`${b.id}|${tier}`);
                  if (!list) return null;
                  return (
                    <div key={`${b.id}-${tier}`} className="lq-skilltree__cell" style={{ gridColumn: col + 1, gridRow: tier + 2 }}>
                      {list.map((n) => (
                        <div key={n.id} className="lq-skilltree__slot">
                          {nodeButton(n)}
                          {!renderDetail && n.id === selectedId && inlineDetail(n)}
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
              </div>
            </div>
          )}
        </div>
        {renderDetail && selected && <aside className="lq-skilltree__detail">{renderDetail(selected)}</aside>}
        {/* En arbre, le détail par défaut a toujours sa place, même vide : sans cela, choisir un nœud
            rétrécirait le cadre, et l'arbre entier changerait d'échelle sous le doigt. */}
        {isTree && !renderDetail && (
          <aside className="lq-skilltree__detail lq-skilltree__detail--inline">
            {selected ? inlineDetail(selected) : <p className="lq-skilltree__detail-empty">Choisissez une compétence pour voir son détail.</p>}
          </aside>
        )}
      </div>
    </div>
  );
}
