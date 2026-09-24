import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { PlannerItem3D } from "./PlannerItem3D";
import { SnapshotStudio, cachedSnapshot, type SnapshotJob } from "./three/snapshot";
import { PLANNER_LABEL, TIERS, cornersOf, footprintOf, type PlannerItem, type PlannerKind } from "./plannerModel";

/**
 * Toutes les évolutions : chaque élément du plan d'entrepôt, décliné dans chacun de ses niveaux,
 * du plus simple au plus abouti. C'est le catalogue d'un jeu de gestion — ce qu'on pose d'abord, et
 * ce en quoi on peut le transformer ensuite.
 *
 * Les vignettes sont photographiées une à une, dans une seule toile hors écran (voir `Snapshot`) :
 * elles apparaissent l'une après l'autre au premier affichage, puis restent en mémoire.
 */
const meta: Meta = {
  title: "Warehouse/Évolutions",
  parameters: { isoCamera: false },
};
export default meta;
type Story = StoryObj;

/** La longueur d'un élément linéaire dans la galerie, en cases. */
const LENGTH: Partial<Record<PlannerKind, number>> = { wall: 8, dock: 10, fence: 6, conveyor: 5, palletRack: 5.5, rail: 6, picker: 8, powerLine: 20 };
/** La hauteur à cadrer, par niveau. */
const HEIGHT: Partial<Record<PlannerKind, number[]>> = {
  wall: [3, 3.3, 3.3],
  dock: [3.2, 3.2, 3.2],
  fence: [1.2, 1.2, 1.2],
  conveyor: [1.4, 1.4, 2],
  conveyorCorner: [1.4, 1.4],
  conveyorTee: [1.4, 1.4],
  palletRack: [3, 3.8, 4.6],
  rail: [0.6, 0.6],
  railCorner: [0.6, 0.6],
  picker: [4.2, 4.2],
  shelf: [2.6, 3, 4],
  zone: [0.6, 1, 2],
  arm: [2.5, 2.5],
  forklift: [1.8, 1.8],
  amr: [0.6, 1.2],
  truck: [1.4, 2.2],
  container: [1.4, 1.4, 2.8],
  tree: [1, 3.2, 4.8],
  light: [0.7, 4.4, 6.2],
  parking: [0.9, 1.5, 1.5],
  solar: [1.2, 1.2, 1.6],
  powerLine: [4.3, 6, 11.8],
};

const ORDER: { title: string; kinds: PlannerKind[] }[] = [
  { title: "Bâtiment", kinds: ["wall", "dock", "fence"] },
  { title: "Stockage", kinds: ["palletRack", "shelf", "zone"] },
  { title: "Convoyage", kinds: ["conveyor", "conveyorCorner", "conveyorTee", "rail", "railCorner", "picker", "arm"] },
  { title: "Véhicules", kinds: ["forklift", "amr", "truck"] },
  { title: "Extérieur", kinds: ["container", "light", "tree", "parking"] },
  { title: "Énergie", kinds: ["solar", "powerLine"] },
];

function sample(kind: PlannerKind, level: number): PlannerItem {
  const L = LENGTH[kind];
  if (L !== undefined) return { id: `evo-${kind}-${level}`, kind, level, x0: 0, y0: 0, x1: L, y1: 0 } as PlannerItem;
  return { id: `evo-${kind}-${level}`, kind, level, x: 0, y: 0, rotation: 0 } as PlannerItem;
}

function job(kind: PlannerKind, level: number): SnapshotJob {
  const item = sample(kind, level);
  const pts = cornersOf(footprintOf(item));
  const pad = kind === "tree" || kind === "light" ? 0.8 : 0.4;
  const bounds = {
    x0: Math.min(...pts.map((p) => p.x)) - pad,
    x1: Math.max(...pts.map((p) => p.x)) + pad,
    // Un quai porte sa cour devant lui, dehors : on la cadre aussi.
    y0: Math.min(...pts.map((p) => p.y)) - pad - (kind === "dock" && level > 1 ? 4.8 : 0),
    y1: Math.max(...pts.map((p) => p.y)) + pad,
    z0: 0,
    z1: HEIGHT[kind]?.[level - 1] ?? 2,
  };
  return { id: `evolution-${kind}-${level}`, bounds, node: <PlannerItem3D item={item} /> };
}

export const Catalogue: Story = {
  name: "Tous les éléments, niveau par niveau",
  render: function Render() {
    const jobs = useMemo(() => ORDER.flatMap((g) => g.kinds.flatMap((k) => TIERS[k].map((_, i) => job(k, i + 1)))), []);
    const [shots, setShots] = useState<Record<string, string>>(() => Object.fromEntries(jobs.map((j) => [j.id, cachedSnapshot(j.id)]).filter(([, u]) => u)));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 28, padding: 8 }}>
        <SnapshotStudio jobs={jobs} width={220} height={150} onShot={(id, url) => setShots((s) => ({ ...s, [id]: url }))} />
        {ORDER.map((group) => (
          <section key={group.title} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: "0.8rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--lq-color-text-muted)" }}>{group.title}</h2>
            {group.kinds.map((kind) => (
              <div key={kind} style={{ display: "grid", gridTemplateColumns: "150px repeat(3, 240px)", alignItems: "center", gap: 12 }}>
                <strong style={{ fontSize: "0.82rem" }}>{PLANNER_LABEL[kind]}</strong>
                {TIERS[kind].map((label, i) => {
                  const url = shots[`evolution-${kind}-${i + 1}`];
                  return (
                    <figure key={label} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, position: "relative" }}>
                      {url ? (
                        <img src={url} width={220} height={150} alt={label} style={{ objectFit: "contain" }} />
                      ) : (
                        <span style={{ width: 220, height: 150, borderRadius: 6, background: "color-mix(in srgb, var(--lq-color-text) 5%, transparent)" }} />
                      )}
                      <figcaption style={{ fontSize: "0.72rem", fontWeight: 600, textAlign: "center" }}>
                        <span style={{ color: "var(--lq-color-text-muted)", fontWeight: 500 }}>Niveau {i + 1} · </span>
                        {label}
                      </figcaption>
                      {i > 0 && <span style={{ position: "absolute", left: -16, top: 64, fontSize: "1rem", color: "var(--lq-color-text-muted)" }}>→</span>}
                    </figure>
                  );
                })}
              </div>
            ))}
          </section>
        ))}
      </div>
    );
  },
};
