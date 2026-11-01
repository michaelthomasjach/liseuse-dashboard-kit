import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { TreeView, moveTreeNode, type TreeNode } from "./TreeView";
import { FolderIcon, FileIcon } from "../icons";
import { Input } from "../forms/Input";

const meta: Meta<typeof TreeView> = {
  title: "Primitives/TreeView",
  component: TreeView,
};
export default meta;
type Story = StoryObj<typeof TreeView>;

const NODES = [
  {
    id: "portfolios",
    label: "Portefeuilles",
    icon: <FolderIcon size={16} />,
    children: [
      {
        id: "growth",
        label: "Croissance",
        icon: <FolderIcon size={16} />,
        children: [
          { id: "growth-report", label: "Rapport T2.pdf", icon: <FileIcon size={16} /> },
          { id: "growth-holdings", label: "Positions.csv", icon: <FileIcon size={16} /> },
        ],
      },
      {
        id: "income",
        label: "Revenu",
        icon: <FolderIcon size={16} />,
        children: [{ id: "income-report", label: "Rapport T2.pdf", icon: <FileIcon size={16} /> }],
      },
    ],
  },
  { id: "statements", label: "Relevés.zip", icon: <FileIcon size={16} /> },
];

/** The same documents without any icon, for the variants that draw their own. */
const FILES: TreeNode[] = [
  {
    id: "src",
    label: "src",
    children: [
      {
        id: "components",
        label: "components",
        children: [
          { id: "button", label: "Button.tsx" },
          { id: "card", label: "Card.tsx" },
          { id: "tree", label: "TreeView.tsx" },
        ],
      },
      { id: "theme", label: "theme", children: [{ id: "tokens", label: "tokens.css" }, { id: "provider", label: "ThemeProvider.tsx" }] },
      { id: "index", label: "index.ts" },
    ],
  },
  { id: "docs", label: "docs", children: [{ id: "readme", label: "README.md" }, { id: "changelog", label: "CHANGELOG.md", disabled: true }] },
  { id: "package", label: "package.json" },
];

const CATEGORIES: TreeNode[] = [
  {
    id: "logiciels",
    label: "Logiciels",
    children: [
      { id: "abonnements", label: "Abonnements", children: [{ id: "annuels", label: "Annuels" }, { id: "mensuels", label: "Mensuels" }] },
      { id: "licences", label: "Licences poste" },
    ],
  },
  { id: "services", label: "Services", children: [{ id: "formation", label: "Formation" }, { id: "support", label: "Support premium" }] },
];

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ maxWidth: 320, display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
);
const Note = ({ children }: { children: React.ReactNode }) => <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>{children}</p>;

export const Default: Story = {
  render: () => {
    const [selected, setSelected] = useState<string | null>("growth-report");
    return (
      <div style={{ maxWidth: 280 }}>
        <TreeView nodes={NODES} selectedId={selected} onSelect={setSelected} defaultExpandedIds={["portfolios", "growth"]} />
      </div>
    );
  },
};

export const Collapsed: Story = {
  name: "Replié",
  render: () => <TreeView nodes={NODES} />,
};

export const WithoutIcons: Story = {
  name: "Sans icônes",
  render: () => {
    const [selected, setSelected] = useState<string | null>("annuels");
    return (
      <div style={{ maxWidth: 280 }}>
        <TreeView nodes={CATEGORIES} selectedId={selected} onSelect={setSelected} defaultExpandedIds={["logiciels", "abonnements"]} />
      </div>
    );
  },
};

export const ControlledExpansion: Story = {
  name: "Dépliage contrôlé",
  render: () => {
    const [expanded, setExpanded] = useState<string[]>(["portfolios"]);
    return (
      <Frame>
        <TreeView nodes={NODES} expandedIds={expanded} onExpandedChange={setExpanded} />
        <Note>Dépliés : {expanded.length ? expanded.join(", ") : "aucun"}</Note>
      </Frame>
    );
  },
};

export const DragAndDrop: Story = {
  name: "Glisser-déposer pour réorganiser",
  render: () => {
    const [nodes, setNodes] = useState<TreeNode[]>(NODES);
    const [selected, setSelected] = useState<string | null>(null);
    return (
      <div style={{ maxWidth: 280 }}>
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
          Glisser un élément : haut/bas de la ligne cible pour le placer avant/après, centre pour le déplacer à
          l'intérieur.
        </p>
        <TreeView
          nodes={nodes}
          selectedId={selected}
          onSelect={setSelected}
          defaultExpandedIds={["portfolios", "growth", "income"]}
          onMove={(draggedId, targetId, position) => setNodes((prev) => moveTreeNode(prev, draggedId, targetId, position))}
        />
      </div>
    );
  },
};

export const Checkable: Story = {
  name: "Cases à cocher",
  render: () => {
    const [checked, setChecked] = useState<string[]>(["button", "card"]);
    return (
      <Frame>
        <TreeView nodes={FILES} checkable showIcons checkedIds={checked} onCheckedChange={setChecked} defaultExpandedIds={["src", "components", "docs"]} />
        <Note>Cochés : {checked.length ? checked.join(", ") : "aucun"}</Note>
      </Frame>
    );
  },
};

export const DefaultIcons: Story = {
  name: "Icônes de dossier et de fichier",
  render: () => {
    const [selected, setSelected] = useState<string | null>("tree");
    return (
      <Frame>
        <TreeView nodes={FILES} showIcons selectedId={selected} onSelect={setSelected} defaultExpandedIds={["src", "components"]} />
      </Frame>
    );
  },
};

export const WithContextMenu: Story = {
  name: "Menu contextuel",
  render: () => {
    const [nodes, setNodes] = useState<TreeNode[]>(FILES);
    const [log, setLog] = useState("Clic droit sur un nœud (ou touche Menu / Maj+F10)");
    const remove = (id: string) => {
      const prune = (list: TreeNode[]): TreeNode[] =>
        list.filter((n) => n.id !== id).map((n) => (n.children ? { ...n, children: prune(n.children) } : n));
      setNodes(prune);
    };
    return (
      <Frame>
        <TreeView
          nodes={nodes}
          showIcons
          defaultExpandedIds={["src", "components"]}
          contextMenu={(node) => [
            { label: "Ouvrir", hint: "Entrée", onSelect: () => setLog(`Ouvrir « ${node.label} »`) },
            { label: "Renommer", hint: "F2", onSelect: () => setLog(`Renommer « ${node.label} »`) },
            { label: "Dupliquer", onSelect: () => setLog(`Dupliquer « ${node.label} »`), disabled: Boolean(node.children) },
            { separator: true },
            { label: "Supprimer", onSelect: () => remove(node.id) },
          ]}
        />
        <Note>{log}</Note>
      </Frame>
    );
  },
};

export const Filter: Story = {
  name: "Filtre",
  render: () => {
    const [query, setQuery] = useState("tsx");
    return (
      <Frame>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrer…" aria-label="Filtrer l'arborescence" />
        <TreeView nodes={FILES} showIcons filter={query} />
      </Frame>
    );
  },
};

export const Guides: Story = {
  name: "Lignes de guidage",
  render: () => <TreeView nodes={FILES} showIcons showGuides defaultExpandedIds={["src", "components", "theme", "docs"]} />,
};

export const Compact: Story = {
  name: "Densité compacte",
  render: () => (
    <TreeView nodes={FILES} showIcons showGuides checkable density="compact" defaultExpandedIds={["src", "components", "theme", "docs"]} />
  ),
};

/** A fake server: every folder holds two sub-folders and two files, after 900 ms. "Archives" fails. */
function fetchChildren(node: TreeNode): Promise<TreeNode[]> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      if (node.id === "archives") reject(new Error("Serveur indisponible"));
      else
        resolve([
          { id: `${node.id}/a`, label: `${node.label} · dossier A`, hasChildren: true },
          { id: `${node.id}/b`, label: `${node.label} · dossier B`, hasChildren: true },
          { id: `${node.id}/1`, label: "note.txt" },
          { id: `${node.id}/2`, label: "budget.xlsx" },
        ]);
    }, 900),
  );
}

export const LazyLoading: Story = {
  name: "Chargement paresseux",
  render: () => (
    <Frame>
      <Note>Chaque dossier charge son contenu à la première ouverture ; « Archives » échoue.</Note>
      <TreeView
        nodes={[
          { id: "projets", label: "Projets", hasChildren: true },
          { id: "archives", label: "Archives", hasChildren: true },
          { id: "lisez-moi", label: "Lisez-moi.txt" },
        ]}
        showIcons
        checkable
        loadChildren={fetchChildren}
      />
    </Frame>
  ),
};

export const KeyboardNavigation: Story = {
  name: "Navigation au clavier",
  render: () => {
    const [selected, setSelected] = useState<string | null>(null);
    return (
      <Frame>
        <Note>
          Tab pour entrer dans l'arbre, ↑ ↓ pour parcourir, → ← pour déplier, replier ou monter au parent, Début / Fin, Entrée pour
          choisir, * pour déplier tous les frères, une lettre pour sauter au nœud suivant qui commence par elle.
        </Note>
        <TreeView nodes={FILES} showIcons selectedId={selected} onSelect={setSelected} ariaLabel="Fichiers du projet" />
        <Note>Sélection : {selected ?? "aucune"}</Note>
      </Frame>
    );
  },
};
