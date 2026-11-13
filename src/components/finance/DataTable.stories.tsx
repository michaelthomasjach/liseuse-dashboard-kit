import type { Meta, StoryObj } from "@storybook/react";
import { DataTable } from "./DataTable";
import { PriceChangeTag } from "./PriceChangeTag";
import { Sparkline } from "../charts/Sparkline";
import { useState } from "react";
import { Badge } from "./Badge";
import { SAMPLE_HOLDINGS, type SampleHolding } from "../../test-data/financeSampleData";
import { ORDERS, ORDERS_LONG, statutTone, type DemoOrder } from "../../test-data/storyDemoData";
import type { DataTableColumn } from "./DataTable";

const meta: Meta<typeof DataTable<SampleHolding>> = {
  title: "Finance/DataTable",
};
export default meta;
type Story = StoryObj<typeof DataTable<SampleHolding>>;

export const Holdings: Story = {
  render: () => (
    <DataTable<SampleHolding>
      rowKey={(row) => row.id}
      rows={SAMPLE_HOLDINGS}
      columns={[
        { id: "symbol", header: "Actif", accessor: (r) => `${r.symbol} · ${r.name}`, sortValue: (r) => r.symbol },
        { id: "qty", header: "Quantité", align: "right", accessor: (r) => r.quantity, sortValue: (r) => r.quantity },
        { id: "price", header: "Cours", align: "right", accessor: (r) => `${r.price.toFixed(2)} €`, sortValue: (r) => r.price },
        {
          id: "change",
          header: "Variation",
          align: "right",
          accessor: (r) => <PriceChangeTag value={r.change} />,
          sortValue: (r) => r.change,
        },
        {
          id: "trend",
          header: "Tendance",
          accessor: () => <Sparkline data={[10, 10.4, 10.1, 10.8, 11.2, 10.9, 11.5]} colorByTrend width={80} height={24} />,
        },
        { id: "value", header: "Valeur", align: "right", accessor: (r) => `${r.value.toLocaleString("fr-FR")} €`, sortValue: (r) => r.value },
      ]}
    />
  ),
};

/* ------------------------------------------------------------------ variantes */

const euros = (n: number) => `${n.toLocaleString("fr-FR")} €`;

const ORDER_COLUMNS: DataTableColumn<DemoOrder>[] = [
  { id: "id", header: "Commande", accessor: (r) => r.id, sortValue: (r) => r.id, hideable: false },
  { id: "client", header: "Client", accessor: (r) => r.client, sortValue: (r) => r.client },
  { id: "produit", header: "Produit", accessor: (r) => r.produit, sortValue: (r) => r.produit },
  { id: "quantite", header: "Qté", align: "right", accessor: (r) => r.quantite, sortValue: (r) => r.quantite },
  { id: "montant", header: "Montant", align: "right", accessor: (r) => euros(r.montant), sortValue: (r) => r.montant, textValue: (r) => String(r.montant) },
  { id: "statut", header: "Statut", accessor: (r) => <Badge tone={statutTone(r.statut)}>{r.statut}</Badge>, textValue: (r) => r.statut },
  { id: "date", header: "Date", accessor: (r) => r.date, sortValue: (r) => r.date },
];

const orderTable = { rowKey: (r: DemoOrder) => r.id, columns: ORDER_COLUMNS };

/** `density="condensed"` : les cellules resserrées, pour une liste longue ou un tableau d'appoint. */
export const Condensed: StoryObj = {
  name: "density — condensé",
  render: () => <DataTable<DemoOrder> {...orderTable} rows={ORDERS} density="condensed" />,
};

/** `striped` : une ligne sur deux teintée. La rayure suit les lignes de données, même dépliées. */
export const Striped: StoryObj = {
  name: "striped — rayé",
  render: () => <DataTable<DemoOrder> {...orderTable} rows={ORDERS} striped />,
};

/** `hover` : la ligne survolée se détache, sans la rendre cliquable. */
export const Hover: StoryObj = {
  name: "hover — survol",
  render: () => <DataTable<DemoOrder> {...orderTable} rows={ORDERS} hover />,
};

/** `bordered` : un cadre et des filets entre les colonnes. */
export const Bordered: StoryObj = {
  name: "bordered — bordé",
  render: () => <DataTable<DemoOrder> {...orderTable} rows={ORDERS} bordered />,
};

/** `pageSize` : pagination par paquets, avec l'intervalle affiché et des pages abrégées par une ellipse. */
export const Paginated: StoryObj = {
  name: "pageSize — pagination",
  render: () => <DataTable<DemoOrder> {...orderTable} rows={ORDERS_LONG} pageSize={10} hover />,
};

/** `searchable` : filtre sur le texte de chaque colonne visible. Essayez « attente » ou « Roux ». */
export const Searchable: StoryObj = {
  name: "searchable — recherche",
  render: () => <DataTable<DemoOrder> {...orderTable} rows={ORDERS_LONG} searchable pageSize={8} emptyMessage="Aucune commande ne correspond" />,
};

/** `selectable` : une case par ligne et une case tri-état en en-tête. Ici contrôlé, la sélection est lue dessous. */
export const Selectable: StoryObj = {
  name: "selectable — sélection de lignes",
  render: function Render() {
    const [keys, setKeys] = useState<string[]>(["C-4822"]);
    return (
      <div>
        <DataTable<DemoOrder> {...orderTable} rows={ORDERS} selectable selectedKeys={keys} onSelectionChange={setKeys} hover />
        <p style={{ marginTop: 12, fontSize: 13 }}>Sélection : {keys.length ? keys.join(", ") : "aucune"}</p>
      </div>
    );
  },
};

/** `renderExpanded` : un chevron en tête de ligne déplie un détail sur toute la largeur. `isExpandable` en exclut les annulées. */
export const Expandable: StoryObj = {
  name: "renderExpanded — lignes dépliables",
  render: () => (
    <DataTable<DemoOrder>
      {...orderTable}
      rows={ORDERS}
      defaultExpandedKeys={["C-4821"]}
      isExpandable={(r) => r.statut !== "annulée"}
      renderExpanded={(r) => (
        <span>
          {r.quantite} × {r.produit} pour {r.client}, commandé le {r.date} — prix unitaire {euros(Math.round(r.montant / r.quantite))}.
        </span>
      )}
    />
  ),
};

/** `maxHeight` : le corps défile, l'en-tête reste en place. */
export const StickyHeader: StoryObj = {
  name: "maxHeight — en-tête figé",
  render: () => <DataTable<DemoOrder> {...orderTable} rows={ORDERS_LONG} maxHeight={320} striped />,
};

/** `columnPicker` et `exportable` : masquer des colonnes, télécharger un CSV (séparateur « ; », lisible par Excel). */
export const ColumnsAndExport: StoryObj = {
  name: "columnPicker + exportable",
  render: () => (
    <DataTable<DemoOrder>
      rowKey={(r) => r.id}
      columns={ORDER_COLUMNS.map((c) => (c.id === "quantite" || c.id === "date" ? { ...c, defaultHidden: true } : c))}
      rows={ORDERS}
      columnPicker
      exportable={{ filename: "commandes.csv" }}
    />
  ),
};

/** Tout ensemble : barre d'outils, recherche, sélection, détail, pagination. */
export const Complete: StoryObj = {
  name: "Tout ensemble",
  render: () => (
    <DataTable<DemoOrder>
      {...orderTable}
      rows={ORDERS_LONG}
      toolbar={<strong>Commandes</strong>}
      searchable
      columnPicker
      exportable={{ filename: "commandes.csv" }}
      selectable
      hover
      density="condensed"
      pageSize={10}
      renderExpanded={(r) => <span>{r.quantite} × {r.produit} — {r.client}</span>}
    />
  ),
};

/** `onReorder` + `groups` : poignée en tête de ligne (souris, doigt, flèches du clavier) et sections ; une ligne passe
 *  d'une section à l'autre, ou en tête d'une section vide en la déposant sur son en-tête. */
export const Reorder: StoryObj = {
  name: "onReorder + groups — glisser-déposer et sections",
  render: function Render() {
    const [order, setOrder] = useState<{ id: string; group: string }[]>(ORDERS.map((o, i) => ({ id: o.id, group: i % 2 ? "b" : "a" })));
    const byId = new Map(ORDERS.map((o) => [o.id, o]));
    const rows = order.map((o) => byId.get(o.id) as DemoOrder);
    const groupOf = (r: DemoOrder) => order.find((o) => o.id === r.id)?.group ?? "a";
    return (
      <DataTable<DemoOrder>
        {...orderTable}
        rows={rows}
        groups={[
          { id: "a", header: "Section A" },
          { id: "b", header: "Section B" },
          { id: "c", header: "Section C (vide)" },
        ]}
        groupOf={groupOf}
        onReorder={({ key, group, index }) =>
          setOrder((prev) => {
            const moved = { id: key, group: group ?? "a" };
            const rest = prev.filter((o) => o.id !== key);
            const inGroup = rest.filter((o) => o.group === moved.group);
            const anchor = inGroup[index];
            const at = anchor ? rest.indexOf(anchor) : inGroup.length ? rest.indexOf(inGroup[inGroup.length - 1]!) + 1 : rest.length;
            return [...rest.slice(0, at), moved, ...rest.slice(at)];
          })
        }
      />
    );
  },
};
