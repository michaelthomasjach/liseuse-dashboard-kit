import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "../finance/Badge";
import { Button } from "../primitives/Button";
import { Card } from "../primitives/Card";
import { Skeleton } from "./Skeleton";
import { Text } from "../primitives/Text";
import { ORDERS, statutTone } from "../../test-data/storyDemoData";

const euro = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/**
 * Le bloc fantôme : la forme du contenu à venir, le temps qu'il arrive.
 */
const meta = {
  title: "Feedback/Skeleton",
  component: Skeleton,
  parameters: {
    docs: {
      description: {
        component: [
          "Un bloc gris parcouru d'un reflet lent, qui tient la place d'un contenu en cours de chargement. On compose plusieurs blocs pour dessiner la **silhouette** de ce qui arrive : une ligne de titre, deux lignes de texte, un avatar rond.",
          "",
          "**Quand l'utiliser** — un contenu dont la forme est connue d'avance (une liste, une carte, une ligne de tableau) et qui met plus d'un instant à venir. La page ne saute pas quand les données arrivent, et l'œil sait déjà où regarder. Pour une attente sans forme connue, un `Spinner` ; pour une progression mesurable, une `ProgressBar`.",
          "",
          "**Anatomie** — `width` (100 % par défaut) et `height` (16 px) acceptent un nombre de pixels ou une valeur CSS (`\"60%\"`) ; `circle` arrondit le bloc en disque — donnez-lui alors la même largeur et hauteur. C'est un élément en ligne (`inline-block`) : pour empiler des blocs, mettez-les dans un conteneur en colonne.",
          "",
          "**Accessibilité** — chaque bloc est masqué aux lecteurs d'écran (`aria-hidden`) : il ne dit rien. Signalez le chargement autrement, par exemple `aria-busy` sur la zone qui se remplit.",
          "",
          "**Mouvement** — le reflet traverse le bloc en 1,6 s. Sous `prefers-reduced-motion`, il s'arrête et le bloc devient un aplat.",
          "",
          "**Thème** — un dégradé de `--lq-color-border-subtle` à `--lq-color-hover`, angles `--lq-radius-sm`.",
        ].join("\n"),
      },
    },
  },
  args: { width: 240, height: 16 },
  // La légende sous le bloc rappelle ses dimensions : un bloc fantôme seul ne dit rien de lui-même.
  render: (args) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
      <Skeleton {...args} />
      <Text size="xs" muted>
        {args.circle ? "circle · " : ""}
        {String(args.width ?? "100%")} × {String(args.height ?? 16)}
      </Text>
    </div>
  ),
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Défaut" };

export const Circle: Story = {
  name: "Disque",
  args: { circle: true, width: 40, height: 40 },
  parameters: { docs: { description: { story: "La place d'un avatar ou d'une icône ronde." } } },
};

export const TextBlock: Story = {
  name: "Paragraphe",
  render: () => (
    <div style={{ maxWidth: 420 }}>
      <Card title="Note de dossier">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skeleton width="45%" height={18} />
          <Skeleton width="100%" height={12} />
          <Skeleton width="92%" height={12} />
          <Skeleton width="70%" height={12} />
        </div>
      </Card>
    </div>
  ),
  parameters: { docs: { description: { story: "Un titre puis trois lignes de longueurs inégales : des blocs tous égaux se liraient comme un tableau." } } },
};

export const List: Story = {
  name: "Liste en chargement",
  parameters: { docs: { description: { story: "La silhouette d'une liste de commandes, puis la liste elle-même : basculez pour voir que rien ne saute." } } },
  render: function Render() {
    const [loading, setLoading] = useState(true);
    const rows = ORDERS.slice(0, 4);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
        <Card title="Dernières commandes">
          <div aria-busy={loading} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {loading
              ? rows.map((o) => (
                  <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, height: 36 }}>
                    <Skeleton circle width={32} height={32} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                      <Skeleton width="55%" height={12} />
                      <Skeleton width="35%" height={10} />
                    </div>
                    <Skeleton width={64} height={20} />
                  </div>
                ))
              : rows.map((o) => (
                  <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, height: 36 }}>
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "var(--lq-color-hover)",
                        fontSize: 12,
                      }}
                    >
                      {o.client.slice(0, 2).toUpperCase()}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                      <Text size="sm" weight="medium">
                        {o.client}
                      </Text>
                      <Text size="xs" muted>
                        {o.id} · {euro(o.montant)}
                      </Text>
                    </div>
                    <Badge tone={statutTone(o.statut)}>{o.statut}</Badge>
                  </div>
                ))}
          </div>
        </Card>
        <div>
          <Button onClick={() => setLoading((l) => !l)}>{loading ? "Terminer le chargement" : "Recharger"}</Button>
        </div>
      </div>
    );
  },
};

export const KpiTiles: Story = {
  name: "Tuiles d'indicateurs",
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 720 }}>
      {["Chiffre d'affaires", "Nouveaux clients", "Taux d'attrition"].map((titre) => (
        <Card key={titre} title={titre}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Skeleton width="70%" height={28} />
            <Skeleton width="100%" height={36} />
          </div>
        </Card>
      ))}
    </div>
  ),
  parameters: { docs: { description: { story: "Le titre est connu d'avance et s'affiche tout de suite ; seules la valeur et la courbe attendent." } } },
};
