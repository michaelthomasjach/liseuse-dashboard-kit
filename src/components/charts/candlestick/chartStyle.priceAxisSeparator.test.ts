import { describe, expect, it } from "vitest";
import { CANVAS_STYLE_KEYS, MODE_COLOR_KEYS, chartStyleCssVars, effectiveChartStyle, resolveChartStyle } from "./chartStyle";

describe("séparateur de l'axe des prix (Toile)", () => {
  it("est enregistré avec les autres réglages de la Toile, sa couleur par mode jour / nuit", () => {
    expect(CANVAS_STYLE_KEYS).toEqual(expect.arrayContaining(["priceAxisSeparatorVisible", "priceAxisSeparatorColor", "priceAxisSeparatorWidth"]));
    expect(MODE_COLOR_KEYS).toContain("priceAxisSeparatorColor");
  });

  it("est désactivé par défaut et retiré quand la Toile avancée n'est pas offerte", () => {
    expect(resolveChartStyle({}, "light").priceAxisSeparatorVisible).toBeUndefined();
    const style = { priceAxisSeparatorVisible: true, priceAxisSeparatorColor: "#ff0000", priceAxisSeparatorWidth: 3 };
    expect(effectiveChartStyle(style, false).priceAxisSeparatorVisible).toBeUndefined();
    expect(effectiveChartStyle(style, true).priceAxisSeparatorVisible).toBe(true);
  });

  it("passe sa couleur et son épaisseur en variables CSS, couleur jour / nuit résolue dans le mode affiché", () => {
    const light = chartStyleCssVars(resolveChartStyle({ priceAxisSeparatorVisible: true, priceAxisSeparatorColor: "light-dark(#111111, #eeeeee)", priceAxisSeparatorWidth: 2 }, "light")) as Record<string, string>;
    expect(light["--lq-chart-price-axis-separator-color"]?.toLowerCase()).toBe("#111111");
    expect(light["--lq-chart-price-axis-separator-width"]).toBe("2px");
    const dark = chartStyleCssVars(resolveChartStyle({ priceAxisSeparatorColor: "light-dark(#111111, #eeeeee)" }, "dark")) as Record<string, string>;
    expect(dark["--lq-chart-price-axis-separator-color"]?.toLowerCase()).toBe("#eeeeee");
    // Mode nuit imposé sur un site en jour : la couleur suit celle des séparateurs de panneaux du mode.
    const forced = chartStyleCssVars(resolveChartStyle({ colorMode: "dark" }, "light")) as Record<string, string>;
    expect(forced["--lq-chart-price-axis-separator-color"]).toBe(forced["--lq-chart-pane-separator-color"]);
  });
});
