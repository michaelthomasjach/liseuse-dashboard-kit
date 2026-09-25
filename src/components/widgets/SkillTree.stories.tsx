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

/* --- En arbre -------------------------------------------------------------------------------- */

const TREE_BRANCHES: SkillTreeBranch[] = [
  { id: "logistique", label: "Logistique", icon: <GaugeIcon size={16} />, color: "#6c87c9", angle: -64 },
  { id: "energie", label: "Énergie", icon: <SolarPanelIcon size={16} />, color: "#6faf82", angle: -30 },
  { id: "catalogue", label: "Catalogue", icon: <PieChartIcon size={16} />, color: "#d6a05c", angle: 0 },
  { id: "marketing", label: "Marketing", color: "#c98bb9", angle: 30 },
  { id: "finance", label: "Finance", color: "#5fa8b5", angle: 64 },
];

type TreeBase = Omit<SkillTreeNode, "state">;
const TREE_BASE: TreeBase[] = [
  // Le tronc : un site, puis le premier grand choix — à qui vend-on ?
  { id: "t-site", label: "Site internet", branch: "tronc", trunk: true, tier: 0, points: 1, effect: "Les premières commandes", description: "Tout commence ici : une boutique en ligne." },
  { id: "t-b2c", label: "Vendre aux particuliers (B2C)", branch: "tronc", trunk: true, tier: 1, points: 1, requires: ["t-site"], exclusiveGroup: "clientele", effect: "Beaucoup de petites commandes" },
  { id: "t-b2b", label: "Vendre aux entreprises (B2B)", branch: "tronc", trunk: true, tier: 1, points: 1, requires: ["t-site"], exclusiveGroup: "clientele", effect: "Peu de grosses commandes" },
  // Logistique, avec un carrefour : stocker en hauteur ou au sol.
  { id: "l-transpal", label: "Transpalettes", branch: "logistique", tier: 0, points: 1, requires: ["t-site"], effect: "+10 % de débit au quai" },
  { id: "l-chariot", label: "Chariots élévateurs", branch: "logistique", tier: 1, points: 2, requires: ["l-transpal"], effect: "Racks à 4 niveaux" },
  { id: "l-racks", label: "Racks hauts", branch: "logistique", tier: 2, points: 2, requires: ["l-chariot"], exclusiveGroup: "stockage", effect: "+50 % de places" },
  { id: "l-sol", label: "Stockage au sol dense", branch: "logistique", tier: 2, points: 2, requires: ["l-chariot"], exclusiveGroup: "stockage", effect: "Palettes en masse" },
  { id: "l-robots", label: "Robots autonomes", branch: "logistique", tier: 3, points: 3, requires: ["l-racks"], effect: "−20 % de main-d'œuvre" },
  // Énergie, et une compétence hybride qui demande la logistique.
  { id: "e-solaire", label: "Panneaux solaires", branch: "energie", tier: 0, points: 1, requires: ["t-site"], effect: "−15 % de facture", icon: <SolarPanelIcon size={16} /> },
  { id: "e-batterie", label: "Stockage batterie", branch: "energie", tier: 1, points: 2, requires: ["e-solaire"], effect: "Nuit sans réseau", icon: <BatteryIcon size={16} /> },
  { id: "e-froid", label: "Chambre froide", branch: "energie", tier: 2, points: 3, requires: ["e-batterie"], effect: "Produits frais" },
  { id: "e-reseau", label: "Micro-réseau", branch: "energie", tier: 3, points: 3, requires: ["e-froid"], effect: "Revente d'électricité" },
  { id: "h-flotte", label: "Flotte électrique", branch: "energie", tier: 3, points: 3, requires: ["e-batterie", "l-chariot"], effect: "Livraisons sans carburant", description: "Hybride : demande la batterie et les chariots." },
  // Catalogue.
  { id: "c-fiches", label: "Fiches produits", branch: "catalogue", tier: 0, points: 1, requires: ["t-site"], effect: "+10 % de conversion" },
  { id: "c-photos", label: "Photos studio", branch: "catalogue", tier: 1, points: 1, requires: ["c-fiches"], effect: "+15 % de conversion" },
  { id: "c-reco", label: "Recommandations", branch: "catalogue", tier: 2, points: 2, requires: ["c-photos"], effect: "+20 % de panier moyen" },
  { id: "c-perso", label: "Personnalisation", branch: "catalogue", tier: 3, points: 3, requires: ["c-reco"], effect: "Produits sur mesure" },
  { id: "c-abonnement", label: "Abonnements", branch: "catalogue", tier: 4, points: 4, requires: ["c-perso"], effect: "Revenu récurrent" },
  // Marketing, avec un carrefour : les influenceurs ou les salons — ceux-ci demandent le B2B.
  { id: "m-seo", label: "Référencement", branch: "marketing", tier: 0, points: 1, requires: ["t-site"], effect: "+20 % de visites" },
  { id: "m-pub", label: "Publicité ciblée", branch: "marketing", tier: 1, points: 2, requires: ["m-seo"], effect: "+30 % de visites" },
  { id: "m-influence", label: "Influenceurs", branch: "marketing", tier: 2, points: 2, requires: ["m-pub"], exclusiveGroup: "canal", effect: "Pics de demande" },
  { id: "m-salons", label: "Salons professionnels", branch: "marketing", tier: 2, points: 2, requires: ["m-pub", "t-b2b"], exclusiveGroup: "canal", effect: "Grands comptes" },
  { id: "h-vitrine", label: "Vitrine sponsorisée", branch: "marketing", tier: 3, points: 3, requires: ["m-pub", "c-reco"], effect: "+40 % de visibilité", description: "Hybride : demande la publicité et les recommandations." },
  // Finance.
  { id: "f-compta", label: "Comptabilité", branch: "finance", tier: 0, points: 1, requires: ["t-site"], effect: "Marges lisibles" },
  { id: "f-fractionne", label: "Paiement fractionné", branch: "finance", tier: 1, points: 2, requires: ["f-compta"], effect: "+10 % de panier moyen" },
  { id: "f-affacturage", label: "Affacturage", branch: "finance", tier: 2, points: 2, requires: ["f-fractionne"], effect: "Trésorerie immédiate" },
  { id: "f-levee", label: "Levée de fonds", branch: "finance", tier: 3, points: 4, requires: ["f-affacturage"], effect: "+100 000 € de capital" },
  { id: "h-tarifs", label: "Tarifs dynamiques", branch: "finance", tier: 4, points: 4, requires: ["f-levee", "c-perso"], effect: "Prix au plus juste", description: "Hybride : demande la levée de fonds et la personnalisation." },
];

const TREE_OWNED = ["t-site", "t-b2c", "l-transpal", "l-chariot", "l-racks", "e-solaire", "c-fiches", "c-photos", "m-seo"];

/** L'état de chaque nœud, déduit de ce qui est acquis : un choix exclusif pris ferme ses voisins, et
 *  ce qui dépend d'un nœud fermé se ferme à son tour — la branche se fane. */
function treeStates(owned: string[], researching: string | null, progress: number): SkillTreeNode[] {
  const closed = new Set<string>();
  for (const n of TREE_BASE)
    if (n.exclusiveGroup && !owned.includes(n.id) && TREE_BASE.some((m) => m.exclusiveGroup === n.exclusiveGroup && owned.includes(m.id))) closed.add(n.id);
  for (let changed = true; changed; ) {
    changed = false;
    for (const n of TREE_BASE)
      if (!closed.has(n.id) && !owned.includes(n.id) && (n.requires ?? []).some((r) => closed.has(r))) {
        closed.add(n.id);
        changed = true;
      }
  }
  return TREE_BASE.map((n) => ({
    ...n,
    state: owned.includes(n.id)
      ? "unlocked"
      : closed.has(n.id)
        ? "closed"
        : n.id === researching
          ? "researching"
          : (n.requires ?? []).every((r) => owned.includes(r))
            ? "available"
            : "locked",
    progress: n.id === researching ? progress : undefined,
  }));
}

/**
 * En arbre : un tronc (le site, puis le choix B2C / B2B), cinq branches qui s'en écartent, trois
 * compétences hybrides reliées par des lianes, et deux carrefours exclusifs dans les branches
 * (stocker en hauteur ou au sol ; influenceurs ou salons). Le joueur a choisi le B2C : le B2B s'est
 * fané, et avec lui les salons professionnels qui en dépendaient. « Débloquer » dépense les points ;
 * « Tout réinitialiser » rend l'arbre à sa graine.
 */
export const EnArbre: Story = {
  name: "Arbre (tronc et branches)",
  render: function Render() {
    const [owned, setOwned] = useState<string[]>(TREE_OWNED);
    const [points, setPoints] = useState(6);
    const [selected, setSelected] = useState<string | null>("e-batterie");
    const nodes = useMemo(() => treeStates(owned, owned.includes("l-robots") ? null : "l-robots", 0.6), [owned]);
    return (
      <div style={{ maxWidth: 1100 }}>
        <SkillTree
          layout="tree"
          nodes={nodes}
          branches={TREE_BRANCHES}
          selectedId={selected}
          onSelect={setSelected}
          header={
            <span style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <span>
                Points disponibles : <strong>{points}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setOwned(["t-site"]);
                  setPoints(14);
                }}
              >
                Tout réinitialiser
              </button>
            </span>
          }
          canUnlock={(n) => (n.points ?? 0) <= points}
          onUnlock={(id) => {
            const n = TREE_BASE.find((b) => b.id === id);
            setPoints((p) => p - (n?.points ?? 0));
            setOwned((o) => [...o, id]);
          }}
        />
      </div>
    );
  },
};

/** Le même arbre dans une colonne de téléphone : il tient en entier dans la largeur, et les boutons
 *  de zoom l'agrandissent à partir de cette vue d'ensemble. */
export const EnArbreMobile: Story = {
  name: "Arbre sur un téléphone",
  globals: { viewport: { value: "mobile2", isRotated: false } },
  render: function Render() {
    const [selected, setSelected] = useState<string | null>("t-b2c");
    const nodes = useMemo(() => treeStates(TREE_OWNED, "l-robots", 0.6), []);
    return (
      <div style={{ width: "100%", maxWidth: 390 }}>
        <SkillTree layout="tree" nodes={nodes} branches={TREE_BRANCHES} selectedId={selected} onSelect={setSelected} />
      </div>
    );
  },
};
