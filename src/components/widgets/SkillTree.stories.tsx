import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { SkillTree, type SkillTreeBranch, type SkillTreeNode } from "./SkillTree";
import { BatteryIcon, GaugeIcon, PieChartIcon, SolarPanelIcon } from "../icons";

/**
 * L'arbre de compétences d'un jeu de gestion d'entrepôt : trois branches, des nœuds par rang, des
 * points à dépenser. Un nœud devient disponible quand ses prérequis sont acquis ; « Débloquer »
 * dépense ses points. Un lien croise les branches, en pointillé.
 */
const meta: Meta<typeof SkillTree> = {
  title: "Widgets/SkillTree",
  component: SkillTree,
};
export default meta;
type Story = StoryObj<typeof SkillTree>;

const BRANCHES: SkillTreeBranch[] = [
  { id: "logistique", label: "Logistique", icon: <GaugeIcon size={16} />, color: "#6c87c9" },
  { id: "energie", label: "Énergie", icon: <SolarPanelIcon size={16} />, color: "#6faf82" },
  { id: "commerce", label: "Commerce", icon: <PieChartIcon size={16} />, color: "#d6a05c" },
];

type Base = Omit<SkillTreeNode, "state">;
const BASE: Base[] = [
  { id: "l1", label: "Transpalettes", branch: "logistique", tier: 0, points: 1, effect: "+10 % de débit au quai", description: "Des transpalettes pour vider les camions plus vite." },
  { id: "l2", label: "Chariots élévateurs", branch: "logistique", tier: 1, points: 2, requires: ["l1"], effect: "Racks à 4 niveaux" },
  { id: "l3", label: "Robots autonomes", branch: "logistique", tier: 2, points: 3, requires: ["l2"], effect: "−20 % de main-d'œuvre" },
  { id: "l4", label: "Tri automatisé", branch: "logistique", tier: 3, points: 4, requires: ["l3", "e2"], effect: "+40 % de colis par heure" },
  { id: "e1", label: "Panneaux solaires", branch: "energie", tier: 0, points: 1, effect: "−15 % de facture", icon: <SolarPanelIcon size={14} /> },
  { id: "e2", label: "Stockage batterie", branch: "energie", tier: 1, points: 2, requires: ["e1"], effect: "Nuit sans réseau", icon: <BatteryIcon size={14} /> },
  { id: "e3", label: "Chambre froide", branch: "energie", tier: 2, points: 3, requires: ["e2"], effect: "Produits frais" },
  { id: "c1", label: "Site vitrine", branch: "commerce", tier: 0, points: 1, effect: "+25 % de demande" },
  { id: "c2", label: "Livraison express", branch: "commerce", tier: 1, points: 2, requires: ["c1"], effect: "Commandes à 24 h" },
  { id: "c3", label: "Marketplace", branch: "commerce", tier: 2, points: 3, requires: ["c2"], effect: "+60 % de demande" },
];

export const Arbre: Story = {
  name: "Arbre de compétences",
  render: function Render() {
    const [owned, setOwned] = useState<string[]>(["l1", "e1"]);
    const [points, setPoints] = useState(4);
    const [selected, setSelected] = useState<string | null>("l2");
    const nodes = useMemo<SkillTreeNode[]>(
      () =>
        BASE.map((n) => ({
          ...n,
          state: owned.includes(n.id) ? "unlocked" : n.id === "c2" && owned.includes("c1") ? "researching" : (n.requires ?? []).every((r) => owned.includes(r)) ? "available" : "locked",
          progress: n.id === "c2" ? 0.4 : undefined,
        })),
      [owned]
    );
    return (
      <div style={{ maxWidth: 900 }}>
        <SkillTree
          nodes={nodes}
          branches={BRANCHES}
          selectedId={selected}
          onSelect={setSelected}
          header={
            <span>
              Points disponibles : <strong>{points}</strong>
            </span>
          }
          canUnlock={(n) => (n.points ?? 0) <= points}
          onUnlock={(id) => {
            const n = BASE.find((b) => b.id === id);
            setPoints((p) => p - (n?.points ?? 0));
            setOwned((o) => [...o, id]);
          }}
        />
      </div>
    );
  },
};

/** Avec le détail de l'application, à côté de l'arbre, et dans un cadre étroit : l'arbre défile. */
export const AvecDetail: Story = {
  name: "Détail de l'application, cadre étroit",
  render: function Render() {
    const [selected, setSelected] = useState<string | null>("e2");
    const nodes: SkillTreeNode[] = BASE.map((n, i) => ({ ...n, state: i % 3 === 0 ? "unlocked" : i % 3 === 1 ? "available" : "locked" }));
    return (
      <div style={{ maxWidth: 520 }}>
        <SkillTree
          nodes={nodes}
          branches={BRANCHES}
          selectedId={selected}
          onSelect={setSelected}
          renderDetail={(n) => (
            <div>
              <strong>{n.label}</strong>
              <p style={{ fontSize: 12 }}>{n.description ?? "Pas de description."}</p>
              <p style={{ fontSize: 12 }}>Effet : {n.effect}</p>
            </div>
          )}
        />
      </div>
    );
  },
};

/**
 * Sur un téléphone : l'arbre défile au doigt dans les deux sens, dans un cadre borné à l'écran, et
 * trois boutons le zooment sans pincement (−, 100 %, +). Au clavier, dans l'arbre : `+`, `-` et `0`.
 * La story s'ouvre dans le cadre « mobile » de Storybook, dans une colonne de 390 px au plus.
 */
export const Mobile: Story = {
  name: "Sur un téléphone",
  globals: { viewport: { value: "mobile2", isRotated: false } },
  render: function Render() {
    const [owned, setOwned] = useState<string[]>(["l1", "e1"]);
    const [points, setPoints] = useState(4);
    const [selected, setSelected] = useState<string | null>("l2");
    const nodes = useMemo<SkillTreeNode[]>(
      () =>
        BASE.map((n) => ({
          ...n,
          state: owned.includes(n.id) ? "unlocked" : (n.requires ?? []).every((r) => owned.includes(r)) ? "available" : "locked",
        })),
      [owned]
    );
    return (
      <div style={{ width: 390, maxWidth: "100%" }}>
        <SkillTree
          nodes={nodes}
          branches={BRANCHES}
          selectedId={selected}
          onSelect={setSelected}
          header={
            <span>
              Points disponibles : <strong>{points}</strong>
            </span>
          }
          canUnlock={(n) => (n.points ?? 0) <= points}
          onUnlock={(id) => {
            const n = BASE.find((b) => b.id === id);
            setPoints((p) => p - (n?.points ?? 0));
            setOwned((o) => [...o, id]);
          }}
        />
      </div>
    );
  },
};
