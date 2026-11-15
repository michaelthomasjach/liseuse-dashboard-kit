import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { IndicatorStyleRulesEditor } from "./IndicatorStyleRulesEditor";
import { CandleColorRulesEditor } from "./CandleColorRulesEditor";
import { RuleIconModal, RuleIconPicker, RuleIconSettings } from "./RuleIconPicker";
import { MARKER_ICONS, MARKER_ICON_CATEGORIES } from "../../../icons/markerIcons";
import { MarkerIcon } from "../../../icons/MarkerIcon";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorStyleRule, RuleIcon } from "../interfaces/IndicatorStyleRule.interface";
import type { CandleColorRule } from "../interfaces/CandleColorRule.interface";
import "../../charts-shared.css";
import "./IndicatorSettings.css";

const meta: Meta = {
  title: "Charts/Style conditionnel",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

/** Toutes les icônes repères (`MARKER_ICONS`), par catégorie : celles que propose « Ajouter une icône » et qu'accepte
 *  l'option `icon` de `plot.signal` / `plot.point`. */
export const MarkerIcons: Story = {
  name: "Icônes repères",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, color: "var(--lq-color-text)" }}>
      {MARKER_ICON_CATEGORIES.map((cat) => (
        <section key={cat.value}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>{cat.label}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
            {MARKER_ICONS.filter((i) => i.category === cat.value).map((icon) => (
              <div key={icon.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 10, border: "1px solid var(--lq-color-border-subtle)", borderRadius: 6 }}>
                <MarkerIcon icon={icon.id} size={22} />
                <code style={{ fontSize: 11 }}>{icon.id}</code>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};

/** La fenêtre de choix d'une icône : recherche (sans accents, synonymes), catégories, grille. */
export const IconModal: Story = {
  name: "Fenêtre de choix d'une icône",
  render: () => {
    const [value, setValue] = useState("rocket");
    const [open, setOpen] = useState(true);
    return (
      <div>
        <p>
          Icône choisie : <code>{value}</code>{" "}
          <button type="button" onClick={() => setOpen(true)}>
            Rouvrir
          </button>
        </p>
        {open && <RuleIconModal value={value} color="#26a69a" onClose={() => setOpen(false)} onPick={(id) => { setValue(id); setOpen(false); }} />}
      </div>
    );
  },
};

/** Le bouton qui montre l'icône choisie et ouvre la fenêtre, avec la ligne taille / position. */
export const IconPickerButton: Story = {
  name: "Bouton d'icône et réglages",
  render: () => {
    const [icon, setIcon] = useState<RuleIcon>({ name: "triangle-up", size: 14, position: "below" });
    return (
      <div style={{ width: 420, display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="lq-chart__rule-sentence">
          <span className="lq-chart__rule-word">Icône</span>
          <RuleIconPicker value={icon.name} color="#ef5350" ariaLabel="Icône" onChange={(name) => setIcon({ ...icon, name })} />
        </div>
        <RuleIconSettings icon={icon} onCurve ariaPrefix="démo" onChange={(patch) => setIcon({ ...icon, ...patch })} />
        <code style={{ fontSize: 12 }}>{JSON.stringify(icon)}</code>
      </div>
    );
  },
};

const RSI: Indicator = { id: "rsi", kind: "rsi", period: 14 };
const RSI_SMA: Indicator = { id: "rsi-sma", kind: "sma", period: 20, sourceId: "rsi" };

/** L'éditeur des règles d'un indicateur (onglet Style d'un RSI avec une SMA(20) posée dessus). La deuxième règle a été
 *  enregistrée avec l'ancien effet « marquer d'un point » : elle s'affiche en « Ajouter une icône » avec le point. */
export const IndicatorRules: Story = {
  name: "Règles d'un indicateur",
  render: () => {
    const [rules, setRules] = useState<IndicatorStyleRule[]>([
      { id: "r1", a: { source: "indicator" }, condition: "crossUp", b: { source: "indicator", indicatorId: "rsi-sma" }, effect: "icon", icon: { name: "triangle-up", size: 14, position: "below" }, color: "#26a69a" },
      { id: "r2", a: { source: "indicator" }, condition: "crossDown", b: { source: "indicator", indicatorId: "rsi-sma" }, effect: "marker", color: "#ef5350" },
      { id: "r3", a: { source: "indicator" }, condition: "above", b: { source: "value", value: 70 }, effect: "fill", color: "#ef5350", opacity: 30 },
    ]);
    const indicator = { ...RSI, styleRules: rules };
    return (
      <div style={{ width: 460 }} className="lq-ind-settings">
        <IndicatorStyleRulesEditor indicator={indicator} indicators={[indicator, RSI_SMA]} onChange={setRules} />
      </div>
    );
  },
};

/** L'éditeur des règles des bougies, avec une règle qui pose une fusée sans recolorer la bougie. */
export const CandleRules: Story = {
  name: "Règles des bougies",
  render: () => {
    const [rules, setRules] = useState<CandleColorRule[]>([
      { id: "c1", name: "Plus haut 20", conditions: [{ metric: "highest", period: 20 }], color: "#ff9800", recolor: false, icon: { name: "rocket", size: 16, position: "above", color: "#ff9800" } },
      { id: "c2", name: "Volume ×2", conditions: [{ metric: "volume", operator: "gt", value: 2, period: 20 }], color: "#2962ff" },
    ]);
    return (
      <div style={{ width: 520 }}>
        <CandleColorRulesEditor rules={rules} indicators={[]} onChange={setRules} />
      </div>
    );
  },
};

/** « Règles liées » : la SMA(50) porte deux règles qui citent la SMA(20). Les paramètres de la SMA(20) les montrent
 *  sous les siennes (« 0 + 2 liées »), modifiables sur place : chaque modification réécrit les règles de la SMA(50),
 *  visibles à droite dans son propre éditeur. */
export const LinkedRules: Story = {
  name: "Règles liées (définies sur un autre indicateur)",
  render: () => {
    const [sma20, setSma20] = useState<Indicator>({ id: "sma20", kind: "sma", period: 20 });
    const [sma50, setSma50] = useState<Indicator>({
      id: "sma50",
      kind: "sma",
      period: 50,
      styleRules: [
        { id: "l1", a: { source: "indicator" }, condition: "above", b: { source: "indicator", indicatorId: "sma20" }, effect: "fill", color: "#ef5350", elseColor: "#26a69a", opacity: 25 },
        { id: "l2", a: { source: "indicator" }, condition: "crossUp", b: { source: "indicator", indicatorId: "sma20" }, effect: "icon", icon: { name: "rocket", size: 16, position: "below" }, color: "#26a69a" },
      ],
    });
    const all = [sma20, sma50];
    const [opened, setOpened] = useState<string | null>(null);
    return (
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        <div style={{ width: 460 }} className="lq-ind-settings">
          <h4 style={{ margin: "0 0 8px" }}>Paramètres de SMA(20)</h4>
          <IndicatorStyleRulesEditor
            indicator={sma20}
            indicators={all}
            onChange={(styleRules) => setSma20({ ...sma20, styleRules })}
            onChangeOwnerRules={(id, styleRules) => id === "sma50" && setSma50({ ...sma50, styleRules })}
            onOpenIndicator={setOpened}
          />
          {opened && <p style={{ fontSize: 12 }}>« Ouvrir » demandé pour : {opened}</p>}
        </div>
        <div style={{ width: 460 }} className="lq-ind-settings">
          <h4 style={{ margin: "0 0 8px" }}>Paramètres de SMA(50)</h4>
          <IndicatorStyleRulesEditor indicator={sma50} indicators={all} onChange={(styleRules) => setSma50({ ...sma50, styleRules })} />
        </div>
      </div>
    );
  },
};
