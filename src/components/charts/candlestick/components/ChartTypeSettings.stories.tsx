import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { CandlestickChart } from "../../CandlestickChart";
import { ChartTypeSettings } from "./ChartSettingsDialog";
import type { ChartStyleSettings } from "../chartStyle";
import type { ChartDisplayMode } from "../interfaces/ChartDisplayMode.interface";
import { generateCandles } from "../../../../test-data/financeSampleData";
import "../../charts-shared.css";
import "./ChartSettingsDialog.css";
import { SettingIllustration, ILLUSTRATION_IDS } from "./settingsIllustrations";

const meta: Meta = {
  title: "Charts/Paramètres système/Bougies",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

/** L'onglet « Bougies » des paramètres système : un sous-onglet par type de graphique (bougies, barres, ligne de
 *  clôture, Heikin Ashi, Renko, Line Break), branché sur un graphique en direct. Le type choisi au-dessus ouvre son
 *  sous-onglet ; la ligne de clôture part sans remplissage, puis passe en dégradé depuis ses réglages. */
export const CouleursParType: Story = {
  name: "Couleurs de chaque type de graphique",
  render: () => {
    const data = useMemo(() => generateCandles(220), []);
    const [mode, setMode] = useState<ChartDisplayMode>("line");
    const [style, setStyle] = useState<ChartStyleSettings>({ lineColor: "#673ab7", lineWidth: 2 });
    const [up, setUp] = useState<string | undefined>(undefined);
    const [down, setDown] = useState<string | undefined>(undefined);
    return (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 420px", gap: 16 }}>
        <div>
          <select value={mode} onChange={(e) => setMode(e.target.value as ChartDisplayMode)} style={{ marginBottom: 8 }}>
            {["candle", "bar", "line", "heikinAshi", "renko", "lineBreak"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {/* `key` : le graphique relit son apparence de départ quand on change de réglage ici. */}
          <CandlestickChart
            key={`${mode}-${JSON.stringify(style)}-${up}-${down}`}
            data={data}
            symbol="DEMO"
            height={460}
            defaultChartDisplayMode={mode}
            defaultAppearance={{ style, upColor: up, downColor: down }}
          />
        </div>
        <ChartTypeSettings
          key={mode}
          mode={mode}
          theme={{ up: "#26a69a", down: "#ef5350", isEink: false }}
          chartStyle={style}
          setChartStyle={setStyle}
          upColorOverride={up}
          setUpColorOverride={setUp}
          downColorOverride={down}
          setDownColorOverride={setDown}
        />
      </div>
    );
  },
};

/** Les vignettes qui illustrent chaque réglage des paramètres système, toutes ensemble. */
export const Vignettes: Story = {
  name: "Vignettes des réglages",
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
      {ILLUSTRATION_IDS.map((id) => (
        <div key={id} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--lq-color-text-muted)" }}>
          <SettingIllustration id={id} />
          {id}
        </div>
      ))}
    </div>
  ),
};
