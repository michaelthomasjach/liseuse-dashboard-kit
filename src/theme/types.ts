export type LqPalette = "eink" | "color";
export type LqSurface = "light" | "dark";
export type LqFont = "space-grotesk" | "manrope" | "sora" | "inter" | "ibm-plex-sans";

export interface LqThemeState {
  palette: LqPalette;
  surface: LqSurface;
  font: LqFont;
}

export interface LqThemeContextValue extends LqThemeState {
  setPalette: (palette: LqPalette) => void;
  setSurface: (surface: LqSurface) => void;
  setFont: (font: LqFont) => void;
}
