import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { CandlestickChart } from "../../CandlestickChart";
import { generateCandles } from "../../../../test-data/financeSampleData";
import type { ChartTemplate } from "../interfaces/ChartTemplate.interface";

const meta: Meta = {
  title: "Charts/Modèles du graphique",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

const DATA = generateCandles(300, 180, 21);

const SEED_TEMPLATES: ChartTemplate[] = [
  { id: "template-1", name: "Tendance", indicators: [{ id: "sma", kind: "sma", period: 50 }], volumePaneOrder: 0, volumePaneState: "hidden", paneHeightFractions: {} },
  { id: "template-2", name: "Momentum", indicators: [{ id: "rsi", kind: "rsi", period: 14 }], volumePaneOrder: 0, volumePaneState: "hidden", paneHeightFractions: {} },
  { id: "template-3", name: "Volatilité", indicators: [], volumePaneOrder: 0, volumePaneState: "expanded", paneHeightFractions: {} },
];

/**
 * Écraser un modèle existant. Le bouton « + » de l'en-tête (ou « Enregistrer » sans modèle actif) ouvre la fenêtre du nom,
 * qui liste les modèles déjà enregistrés, filtrés par la saisie. En choisir un remplit le nom : le bouton principal passe
 * de « Enregistrer sous » (nouveau modèle) à « Enregistrer » (nom identique, casse et espaces autour ignorés), qui
 * demande confirmation avant de remplacer le contenu du modèle. Le modèle remplacé garde son id, sa place dans la liste
 * et son statut de modèle au démarrage ; la liste rendue par `onTemplatesChange` s'affiche sous le graphique.
 *
 * Clavier : Entrée valide la confirmation, Échap la ferme sans fermer la fenêtre du nom.
 */
export const OverwriteTemplate: Story = {
  name: "Écraser un modèle existant",
  render: function Render() {
    const [saved, setSaved] = useState<ChartTemplate[]>(SEED_TEMPLATES);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ height: 520 }}>
          <CandlestickChart
            data={DATA}
            symbol="DEMO"
            height={520}
            showVolume
            showIndicators
            showTemplates
            defaultIndicators={[{ id: "ema", kind: "ema", period: 20 }]}
            defaultTemplates={SEED_TEMPLATES}
            defaultStartupTemplateId="template-2"
            applyStartupTemplate={false}
            onTemplatesChange={setSaved}
          />
        </div>
        <ol style={{ margin: 0, fontSize: 13, color: "var(--lq-color-text)" }}>
          {saved.map((t) => (
            <li key={t.id}>
              <code>{t.id}</code> « {t.name} » : {t.indicators.length === 0 ? "aucun indicateur" : t.indicators.map((i) => `${i.kind}${"period" in i && i.period ? ` ${i.period}` : ""}`).join(", ")}
            </li>
          ))}
        </ol>
      </div>
    );
  },
};
