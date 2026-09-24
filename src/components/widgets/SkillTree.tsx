import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CheckIcon, LockIcon } from "../icons";
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
 */

export type SkillNodeState = "locked" | "available" | "researching" | "unlocked";

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
}

export interface SkillTreeBranch {
  id: string;
  label: string;
  icon?: ReactNode;
  /** La couleur de la branche : ses traits, son bandeau, ses nœuds acquis. */
  color?: string;
}

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
  className?: string;
}

const STATE_LABEL: Record<SkillNodeState, string> = {
  locked: "verrouillé",
  available: "disponible",
  researching: "en cours",
  unlocked: "acquis",
};

const pts = (n: number) => `${n} pt${Math.abs(n) > 1 ? "s" : ""}`;

type Link = { id: string; d: string; lit: boolean; done: boolean; color?: string; cross: boolean };

export function SkillTree({ nodes, branches: branchesProp, selectedId: selectedProp, onSelect, renderDetail, header, onUnlock, canUnlock, className }: SkillTreeProps) {
  const [own, setOwn] = useState<string | null>(null);
  const selectedId = selectedProp !== undefined ? selectedProp : own;
  const select = (id: string) => {
    setOwn(id);
    onSelect?.(id);
  };

  const branches = useMemo<SkillTreeBranch[]>(() => {
    const out = [...(branchesProp ?? [])];
    for (const n of nodes) if (!out.some((b) => b.id === n.branch)) out.push({ id: n.branch, label: n.branch });
    return out;
  }, [branchesProp, nodes]);
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
          const x0 = a.left + a.width / 2 - base.left;
          const y0 = a.bottom - base.top;
          const x1 = b.left + b.width / 2 - base.left;
          const y1 = b.top - base.top;
          const cross = pre.branch !== n.branch;
          const dy = Math.max(24, Math.abs(y1 - y0) * 0.5);
          const d = !cross && Math.abs(x1 - x0) < 1 ? `M${x0} ${y0} L${x1} ${y1}` : `M${x0} ${y0} C${x0} ${y0 + dy}, ${x1} ${y1 - dy}, ${x1} ${y1}`;
          out.push({ id: `${req}->${n.id}`, d, lit: pre.state === "unlocked", done: pre.state === "unlocked" && n.state === "unlocked", color: colorOf(pre.branch), cross });
        }
      setLinks(out);
      setSize({ w: g.scrollWidth, h: g.scrollHeight });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(g);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, branches, selectedId]);

  const unlockable = (n: SkillTreeNode) => n.state === "available" && (canUnlock ? canUnlock(n) : true);

  /** Le détail par défaut, sous le nœud choisi : sa description, ce qu'il demande, le bouton. */
  const inlineDetail = (n: SkillTreeNode) => {
    const missing = (n.requires ?? []).map((id) => byId.get(id)).filter((r): r is SkillTreeNode => !!r && r.state !== "unlocked");
    return (
      <div className="lq-skilltree__inline" role="region" aria-label={`Détail : ${n.label}`}>
        {n.description && <p className="lq-skilltree__desc">{n.description}</p>}
        {n.cost !== undefined && <p className="lq-skilltree__cost">Coût : {n.cost}</p>}
        {missing.length > 0 && <p className="lq-skilltree__needs">Demande d'abord : {missing.map((r) => r.label).join(", ")}</p>}
        {onUnlock && n.state === "available" && (
          <button type="button" className="lq-skilltree__unlock" disabled={!unlockable(n)} onClick={() => onUnlock(n.id)}>
            Débloquer{n.points !== undefined ? ` (${pts(n.points)})` : ""}
          </button>
        )}
        {n.state === "unlocked" && <p className="lq-skilltree__owned">Acquis.</p>}
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
          {n.state === "locked" ? <LockIcon size={14} /> : n.state === "unlocked" ? <CheckIcon size={14} /> : n.icon ?? <span className="lq-skilltree__pip" />}
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

  return (
    <div className={["lq-skilltree", className].filter(Boolean).join(" ")}>
      {header !== undefined && <div className="lq-skilltree__header">{header}</div>}
      <div className="lq-skilltree__body">
        <div className="lq-skilltree__scroll">
          <div ref={grid} className="lq-skilltree__grid" style={{ gridTemplateColumns: `repeat(${branches.length}, minmax(188px, 1fr))`, gridTemplateRows: `auto repeat(${rows}, auto)` }}>
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
        {renderDetail && selected && <aside className="lq-skilltree__detail">{renderDetail(selected)}</aside>}
      </div>
    </div>
  );
}
