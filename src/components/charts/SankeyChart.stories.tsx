import type { Meta, StoryObj } from "@storybook/react";
import { SankeyChart } from "./SankeyChart";
import { Card } from "../primitives/Card";
import {
  SANKEY_BUDGET_LINKS,
  SANKEY_BUDGET_NODES,
  SANKEY_REVENUE_LINKS,
  SANKEY_REVENUE_NODES,
} from "../../test-data/sankeySampleData";

const euros = (v: number) => `${v.toLocaleString("fr-FR")} €`;

const meta: Meta<typeof SankeyChart> = {
  title: "Charts/SankeyChart",
  component: SankeyChart,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof SankeyChart>;

export const Default: Story = {
  name: "Budget mensuel",
  render: () => (
    <div style={{ maxWidth: 980 }}>
      <SankeyChart nodes={SANKEY_BUDGET_NODES} links={SANKEY_BUDGET_LINKS} formatValue={euros} height={520} />
      <p style={{ fontSize: 13, opacity: 0.7, marginTop: 12, lineHeight: 1.5 }}>
        Molette pour zoomer : les libellés apparaissent au fur et à mesure que les nœuds deviennent assez hauts, puis
        gagnent leur montant, puis leur part du poste dont ils sortent. Clic sur une barre pour cadrer sa branche — le
        fil d&apos;ariane en haut à gauche permet de remonter. Re-cliquer sur la barre courante ressort d&apos;un cran ;
        double-clic sur le fond pour tout réinitialiser.
      </p>
    </div>
  ),
};

export const Compact: Story = {
  name: "Compte de résultat (trois colonnes)",
  render: () => (
    <div style={{ maxWidth: 760 }}>
      <SankeyChart
        nodes={SANKEY_REVENUE_NODES}
        links={SANKEY_REVENUE_LINKS}
        formatValue={(v) => `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k€`}
        height={360}
        nodeWidth={14}
        nodePadding={22}
      />
    </div>
  ),
};

export const DansUneCarte: Story = {
  name: "Dans une carte",
  render: () => (
    <div style={{ maxWidth: 900 }}>
      <Card title="Où part l'argent" meta="SEPTEMBRE 2026">
        <SankeyChart nodes={SANKEY_BUDGET_NODES} links={SANKEY_BUDGET_LINKS} formatValue={euros} height={460} embedded />
      </Card>
    </div>
  ),
};

/** `align="left"` laisse chaque nœud dans la colonne que son plus long chemin entrant lui donne,
 *  au lieu de plaquer toutes les feuilles sur le bord droit. Utile quand la profondeur est
 *  l'information — une chaîne de traitement, pas un budget. */
export const Alignement: Story = {
  name: "Alignement justify / left",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 900 }}>
      <div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>align=&quot;justify&quot; (défaut)</div>
        <SankeyChart nodes={SANKEY_REVENUE_NODES} links={SANKEY_REVENUE_LINKS} height={280} fullscreenToggle={false} />
      </div>
      <div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>align=&quot;left&quot;</div>
        <SankeyChart nodes={SANKEY_REVENUE_NODES} links={SANKEY_REVENUE_LINKS} align="left" height={280} fullscreenToggle={false} />
      </div>
    </div>
  ),
};

/** Couleurs explicites par nœud : la palette cyclée par colonne convient à un diagramme
 *  d'exploration, moins à un schéma où chaque poste a sa couleur dans le reste du tableau de bord. */
export const CouleursExplicites: Story = {
  name: "Couleurs par nœud",
  render: () => (
    <div style={{ maxWidth: 760 }}>
      <SankeyChart
        height={340}
        formatValue={euros}
        nodes={[
          { id: "revenus", label: "Revenus", color: "var(--lq-color-accent)" },
          { id: "epargne", label: "Épargne", color: "var(--lq-color-green)" },
          { id: "depenses", label: "Dépenses", color: "var(--lq-color-rose)" },
          { id: "pea", label: "PEA", color: "var(--lq-color-green)" },
          { id: "livret", label: "Livret A", color: "var(--lq-color-green)" },
          { id: "loyer", label: "Loyer", color: "var(--lq-color-rose)" },
          { id: "courses", label: "Courses", color: "var(--lq-color-rose)" },
          { id: "loisirs", label: "Loisirs", color: "var(--lq-color-amber)" },
        ]}
        links={[
          { source: "revenus", target: "epargne", value: 900 },
          { source: "revenus", target: "depenses", value: 2100 },
          { source: "epargne", target: "pea", value: 600 },
          { source: "epargne", target: "livret", value: 300 },
          { source: "depenses", target: "loyer", value: 1100 },
          { source: "depenses", target: "courses", value: 700 },
          { source: "depenses", target: "loisirs", value: 300 },
        ]}
      />
    </div>
  ),
};

export const Fige: Story = {
  name: "Sans interaction (zoomable={false})",
  render: () => (
    <div style={{ maxWidth: 760 }}>
      <SankeyChart
        nodes={SANKEY_REVENUE_NODES}
        links={SANKEY_REVENUE_LINKS}
        zoomable={false}
        fullscreenToggle={false}
        height={320}
        formatValue={(v) => `${(v / 1000).toFixed(0)} k€`}
      />
    </div>
  ),
};

export const Vide: Story = {
  name: "Aucune donnée",
  render: () => (
    <div style={{ maxWidth: 520 }}>
      <SankeyChart nodes={[]} links={[]} height={200} />
    </div>
  ),
};
