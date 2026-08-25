import {
  createContext,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { LqFont, LqPalette, LqSurface, LqThemeContextValue } from "./types";
import "./tokens.css";
import "./scrollActivity";

const FONT_VARS: Record<LqFont, string> = {
  "space-grotesk": "var(--lq-font-space-grotesk)",
  manrope: "var(--lq-font-manrope)",
  sora: "var(--lq-font-sora)",
  inter: "var(--lq-font-inter)",
  "ibm-plex-sans": "var(--lq-font-ibm-plex-sans)",
};

const LqThemeContext = createContext<LqThemeContextValue | null>(null);

export interface LqThemeProviderProps {
  /** Rendering surface: raw e-ink / monochrome tablet, or a backlit color tablet. Default "eink". */
  palette?: LqPalette;
  /** Light or dark surface. Default "light". */
  surface?: LqSurface;
  /** Display typeface. The consumer app must load the actual webfont; this only selects the stack. Default "manrope". */
  font?: LqFont;
  /** Called whenever a component inside calls the theme setters (e.g. from a settings panel you build). */
  onPaletteChange?: (palette: LqPalette) => void;
  onSurfaceChange?: (surface: LqSurface) => void;
  onFontChange?: (font: LqFont) => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * Wraps a subtree with the design tokens for the given palette/surface/font.
 * Multiple providers can be nested (e.g. to preview two modes side by side).
 */
export function LqThemeProvider({
  palette: paletteProp,
  surface: surfaceProp,
  font: fontProp,
  onPaletteChange,
  onSurfaceChange,
  onFontChange,
  className,
  style,
  children,
}: LqThemeProviderProps) {
  const [paletteState, setPaletteState] = useState<LqPalette>(paletteProp ?? "eink");
  const [surfaceState, setSurfaceState] = useState<LqSurface>(surfaceProp ?? "light");
  const [fontState, setFontState] = useState<LqFont>(fontProp ?? "manrope");

  const palette = paletteProp ?? paletteState;
  const surface = surfaceProp ?? surfaceState;
  const font = fontProp ?? fontState;

  const value = useMemo<LqThemeContextValue>(
    () => ({
      palette,
      surface,
      font,
      setPalette: (next) => {
        setPaletteState(next);
        onPaletteChange?.(next);
      },
      setSurface: (next) => {
        setSurfaceState(next);
        onSurfaceChange?.(next);
      },
      setFont: (next) => {
        setFontState(next);
        onFontChange?.(next);
      },
    }),
    [palette, surface, font, onPaletteChange, onSurfaceChange, onFontChange]
  );

  return (
    <LqThemeContext.Provider value={value}>
      <div
        className={["lq-root", className].filter(Boolean).join(" ")}
        data-lq-palette={palette}
        data-lq-surface={surface}
        data-lq-font={font}
        style={{ ...style, ["--lq-font-family" as string]: FONT_VARS[font] }}
      >
        {children}
      </div>
    </LqThemeContext.Provider>
  );
}

/** Read the active palette/surface/font, and switch them from inside the tree (e.g. a settings widget). */
// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with its provider on purpose
export function useLqTheme(): LqThemeContextValue {
  const ctx = useContext(LqThemeContext);
  if (!ctx) {
    throw new Error("useLqTheme must be used within an <LqThemeProvider>");
  }
  return ctx;
}
