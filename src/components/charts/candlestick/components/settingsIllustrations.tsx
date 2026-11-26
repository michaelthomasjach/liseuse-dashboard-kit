import { createContext, useContext, useRef, type ReactNode } from "react";

/**
 * Vignettes schématiques des paramètres système du graphique : une petite image (72 × 44) par réglage, qui montre
 * l'élément du graphique concerné. L'élément réglé est dessiné en couleur (accent, hausse / baisse ou couleur choisie
 * par l'utilisateur), le reste du décor en gris discret. Traits fins, sans effet lumineux.
 */
export type SettingIllustrationId =
  | "chartType"
  | "pulse"
  | "candleBody"
  | "candleBorder"
  | "candleWick"
  | "haBody"
  | "bars"
  | "barWidth"
  | "lineStroke"
  | "lineColorMode"
  | "lineFill"
  | "lineFillType"
  | "renkoBody"
  | "renkoBorder"
  | "renkoAtr"
  | "lineBreakBody"
  | "lineBreakBorder"
  | "lineBreakLines"
  | "candleColors"
  | "statusLine"
  | "legendSymbol"
  | "legendDescription"
  | "legendOhlc"
  | "legendChange"
  | "legendVolume"
  | "legendIndicatorTitles"
  | "legendIndicatorValues"
  | "priceScaleMode"
  | "autoScale"
  | "priceAxis"
  | "paneAxes"
  | "scalePlacement"
  | "lastPriceLabel"
  | "lastPriceLine"
  | "highLow"
  | "indicatorValues"
  | "countdown"
  | "seriesLabels"
  | "crosshairPriceLabel"
  | "crosshairTimeLabel"
  | "timeAxis"
  | "weekday"
  | "dateFormat"
  | "timeFormat"
  | "touchLayout"
  | "colorMode"
  | "modeColors"
  | "background"
  | "backgroundOpacity"
  | "edgeToEdge"
  | "vertGrid"
  | "horzGrid"
  | "paneSeparators"
  | "crosshair"
  | "watermark"
  | "watermarkSize"
  | "scaleText"
  | "scaleLines"
  | "navigationButtons"
  | "paneButtons"
  | "marginTop"
  | "marginBottom"
  | "marginRight"
  | "resetZoom"
  | "pastZone"
  | "futureZone"
  | "events"
  | "integration";

/** Tous les identifiants, dans l'ordre (galerie Storybook). */
export const ILLUSTRATION_IDS: SettingIllustrationId[] = ["chartType", "pulse", "candleBody", "candleBorder", "candleWick", "haBody", "bars", "barWidth", "lineStroke", "lineColorMode", "lineFill", "lineFillType", "renkoBody", "renkoBorder", "renkoAtr", "lineBreakBody", "lineBreakBorder", "lineBreakLines", "candleColors", "statusLine", "legendSymbol", "legendDescription", "legendOhlc", "legendChange", "legendVolume", "legendIndicatorTitles", "legendIndicatorValues", "priceScaleMode", "autoScale", "priceAxis", "paneAxes", "scalePlacement", "lastPriceLabel", "lastPriceLine", "highLow", "indicatorValues", "countdown", "seriesLabels", "crosshairPriceLabel", "crosshairTimeLabel", "timeAxis", "weekday", "dateFormat", "timeFormat", "touchLayout", "colorMode", "modeColors", "background", "backgroundOpacity", "edgeToEdge", "vertGrid", "horzGrid", "paneSeparators", "crosshair", "watermark", "watermarkSize", "scaleText", "scaleLines", "navigationButtons", "paneButtons", "marginTop", "marginBottom", "marginRight", "resetZoom", "pastZone", "futureZone", "events", "integration"];

/** Couleurs choisies par l'utilisateur, reprises par les vignettes (sinon celles du thème). */
export interface IllustrationColors {
  up?: string;
  down?: string;
  line?: string;
  /** Remplissage sous la ligne de clôture : uni ou dégradé. */
  lineFillGradient?: boolean;
  /** Fond de la toile : uni ou dégradé. */
  backgroundGradient?: boolean;
}

const IllustrationColorsContext = createContext<IllustrationColors>({});

export function IllustrationColorsProvider({ value, children }: { value: IllustrationColors; children: ReactNode }) {
  return <IllustrationColorsContext.Provider value={value}>{children}</IllustrationColorsContext.Provider>;
}

const W = 72;
const H = 44;
const MUTED = "var(--lq-color-text-muted)";
const ACCENT = "var(--lq-color-accent)";
const SOFT = 0.4;

/** Bougie : x centre, o/c ouverture/clôture, h/l extrêmes (en px, y vers le bas). */
type Candle = { x: number; o: number; c: number; h: number; l: number };
const CANDLES: Candle[] = [
  { x: 10, o: 30, c: 22, h: 18, l: 34 },
  { x: 20, o: 22, c: 27, h: 19, l: 31 },
  { x: 30, o: 27, c: 17, h: 13, l: 29 },
  { x: 40, o: 17, c: 21, h: 14, l: 25 },
  { x: 50, o: 21, c: 12, h: 8, l: 23 },
  { x: 60, o: 12, c: 15, h: 9, l: 19 },
];

function candles(c: { up: string; down: string }, emphasis: "body" | "border" | "wick" | "all" | "none", list = CANDLES, w = 6) {
  return list.map((k) => {
    const isUp = k.c < k.o;
    const col = isUp ? c.up : c.down;
    const top = Math.min(k.o, k.c);
    const hgt = Math.max(1.5, Math.abs(k.o - k.c));
    const dim = (part: "body" | "border" | "wick") => (emphasis === "all" || emphasis === part ? 1 : emphasis === "none" ? SOFT : 0.3);
    return (
      <g key={k.x}>
        <line x1={k.x} x2={k.x} y1={k.h} y2={top} stroke={col} strokeWidth={emphasis === "wick" ? 1.5 : 1} opacity={dim("wick")} />
        <line x1={k.x} x2={k.x} y1={top + hgt} y2={k.l} stroke={col} strokeWidth={emphasis === "wick" ? 1.5 : 1} opacity={dim("wick")} />
        <rect x={k.x - w / 2} y={top} width={w} height={hgt} fill={col} fillOpacity={emphasis === "border" ? 0.15 : dim("body")} />
        <rect
          x={k.x - w / 2}
          y={top}
          width={w}
          height={hgt}
          fill="none"
          stroke={col}
          strokeWidth={emphasis === "border" ? 1.5 : 1}
          opacity={emphasis === "border" ? 1 : 0}
        />
      </g>
    );
  });
}

const LINE_PTS = "6,30 16,26 24,28 34,18 44,21 54,12 66,10";
function line(color: string, opts: { width?: number; dash?: string; opacity?: number } = {}) {
  return <polyline points={LINE_PTS} fill="none" stroke={color} strokeWidth={opts.width ?? 1.5} strokeDasharray={opts.dash} strokeLinejoin="round" strokeLinecap="round" opacity={opts.opacity} />;
}

/** Fond discret de la zone de tracé (pas de contour). */
const plot = (w = W, h = H) => <rect x={0} y={0} width={w} height={h} rx={4} fill="color-mix(in srgb, var(--lq-color-text) 6%, transparent)" />;
/** Petite barre de texte (un mot). */
const txt = (x: number, y: number, w: number, color = MUTED, op = SOFT, h = 3) => <rect x={x} y={y} width={w} height={h} rx={1} fill={color} opacity={op} />;
/** Axe des prix à droite (graduations). */
const priceAxis = (color = MUTED, op = SOFT) => (
  <g>
    <line x1={58} x2={58} y1={3} y2={41} stroke={color} strokeWidth={1} opacity={op} />
    {[9, 19, 29, 39].map((y) => txt(61, y - 1.5, 8, color, op))}
  </g>
);
/** Pastille de prix sur l'axe. */
const pill = (y: number, color: string, w = 14, x = 57) => (
  <g>
    <rect x={x} y={y - 4} width={w} height={8} rx={2} fill={color} />
    <rect x={x + 3} y={y - 1} width={w - 6} height={2} rx={1} fill="var(--lq-color-accent-contrast)" />
  </g>
);

function draw(id: SettingIllustrationId, col: Required<Pick<IllustrationColors, "up" | "down" | "line">> & IllustrationColors, gid: string): ReactNode {
  const ud = { up: col.up, down: col.down };
  const soft = { up: MUTED, down: MUTED };
  const small = CANDLES.map((k) => ({ ...k, x: k.x * 0.85 }));
  switch (id) {
    case "chartType":
    case "candleColors":
      return candles(ud, "all");
    case "pulse":
      return (
        <>
          {line(col.line)}
          <circle cx={66} cy={10} r={2.2} fill={col.line} />
          <circle cx={66} cy={10} r={5.5} fill="none" stroke={col.line} strokeWidth={1} opacity={0.6} />
          <circle cx={66} cy={10} r={9} fill="none" stroke={col.line} strokeWidth={1} opacity={0.3} />
        </>
      );
    case "candleBody":
    case "haBody":
      return candles(ud, "body", id === "haBody" ? CANDLES.map((k, i) => ({ ...k, o: i < 3 ? 31 - i * 5 : 22 - (i - 3) * 4, c: i < 3 ? 26 - i * 5 : 17 - (i - 3) * 4 })) : CANDLES);
    case "candleBorder":
      return candles(ud, "border", CANDLES, 8);
    case "candleWick":
      return candles(ud, "wick");
    case "bars":
    case "barWidth":
      return CANDLES.map((k) => {
        const color = k.c < k.o ? col.up : col.down;
        const sw = id === "barWidth" ? (k.x > 35 ? 2.5 : 1) : 1.25;
        return (
          <g key={k.x} stroke={color} strokeWidth={sw}>
            <line x1={k.x} x2={k.x} y1={k.h} y2={k.l} />
            <line x1={k.x - 3.5} x2={k.x} y1={k.o} y2={k.o} />
            <line x1={k.x} x2={k.x + 3.5} y1={k.c} y2={k.c} />
          </g>
        );
      });
    case "lineStroke":
      return (
        <>
          <polyline points="6,14 30,14 54,14" fill="none" stroke={col.line} strokeWidth={1} />
          <polyline points="6,24 54,24" fill="none" stroke={col.line} strokeWidth={2} strokeDasharray="4 3" />
          <polyline points="6,34 54,34" fill="none" stroke={col.line} strokeWidth={3} strokeDasharray="0.1 4" strokeLinecap="round" />
          {txt(58, 12.5, 9)}
          {txt(58, 22.5, 9)}
          {txt(58, 32.5, 9)}
        </>
      );
    case "lineColorMode":
      return (
        <>
          <defs>
            <linearGradient id={`${gid}-lc`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={col.up} />
              <stop offset="1" stopColor={col.down} />
            </linearGradient>
          </defs>
          <polyline points="4,24 12,20 18,22 26,12 34,15" fill="none" stroke={col.line} strokeWidth={1.75} strokeLinejoin="round" />
          <polyline points="38,30 46,26 52,28 60,10 68,14" fill="none" stroke={`url(#${gid}-lc)`} strokeWidth={1.75} strokeLinejoin="round" />
          <line x1={36} x2={36} y1={6} y2={38} stroke={MUTED} strokeWidth={1} opacity={0.25} />
        </>
      );
    case "lineFill":
    case "lineFillType": {
      const grad = id === "lineFillType" ? (col.lineFillGradient ?? false) : false;
      return (
        <>
          <defs>
            <linearGradient id={`${gid}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={col.line} stopOpacity={0.45} />
              <stop offset="1" stopColor={col.line} stopOpacity={0} />
            </linearGradient>
          </defs>
          {id === "lineFillType" ? (
            <>
              <polygon points="4,40 4,28 12,24 18,26 26,16 34,18 34,40" fill={col.line} fillOpacity={0.22} opacity={grad ? 0.45 : 1} />
              <polyline points="4,28 12,24 18,26 26,16 34,18" fill="none" stroke={col.line} strokeWidth={1.5} opacity={grad ? 0.45 : 1} />
              <polygon points="38,40 38,28 46,24 52,26 60,16 68,18 68,40" fill={`url(#${gid}-fill)`} opacity={grad ? 1 : 0.45} />
              <polyline points="38,28 46,24 52,26 60,16 68,18" fill="none" stroke={col.line} strokeWidth={1.5} opacity={grad ? 1 : 0.45} />
            </>
          ) : (
            <>
              <polygon points={`${LINE_PTS} 66,40 6,40`} fill={`url(#${gid}-fill)`} />
              {line(col.line)}
            </>
          )}
        </>
      );
    }
    case "renkoBody":
    case "renkoBorder":
    case "renkoAtr": {
      const bricks = [
        [6, 28, true],
        [14, 22, true],
        [22, 16, true],
        [30, 22, false],
        [38, 16, true],
        [46, 10, true],
        [54, 4, true],
      ] as const;
      return (
        <>
          {bricks.map(([x, y, isUp]) => (
            <rect
              key={x}
              x={x}
              y={y}
              width={7}
              height={6}
              fill={isUp ? col.up : col.down}
              fillOpacity={id === "renkoBorder" ? 0.15 : id === "renkoAtr" ? 0.35 : 1}
              stroke={id === "renkoBorder" ? (isUp ? col.up : col.down) : "none"}
              strokeWidth={1.25}
            />
          ))}
          {id === "renkoAtr" && (
            <g stroke={ACCENT} strokeWidth={1}>
              <line x1={66} x2={66} y1={4} y2={10} />
              <line x1={64} x2={68} y1={4} y2={4} />
              <line x1={64} x2={68} y1={10} y2={10} />
            </g>
          )}
        </>
      );
    }
    case "lineBreakBody":
    case "lineBreakBorder":
    case "lineBreakLines": {
      const blocks = [
        [6, 26, 10, true],
        [14, 18, 8, true],
        [22, 12, 6, true],
        [30, 12, 16, false],
        [38, 20, 6, true],
        [46, 10, 10, true],
        [54, 4, 6, true],
      ] as const;
      return (
        <>
          {blocks.map(([x, y, h, isUp], i) => (
            <rect
              key={x}
              x={x}
              y={y}
              width={7}
              height={h}
              fill={isUp ? col.up : col.down}
              fillOpacity={id === "lineBreakBorder" ? 0.15 : id === "lineBreakLines" ? (i < 3 ? 0.9 : 0.3) : 1}
              stroke={id === "lineBreakBorder" ? (isUp ? col.up : col.down) : "none"}
              strokeWidth={1.25}
            />
          ))}
          {id === "lineBreakLines" && <path d="M6 41 H28" stroke={ACCENT} strokeWidth={1} />}
        </>
      );
    }
    case "statusLine":
    case "legendSymbol":
    case "legendDescription":
    case "legendOhlc":
    case "legendChange":
    case "legendVolume":
    case "legendIndicatorTitles":
    case "legendIndicatorValues": {
      const on = (k: SettingIllustrationId) => (id === "statusLine" || id === k ? 1 : 0.3);
      const strong = (k: SettingIllustrationId) => (id === k ? ACCENT : "var(--lq-color-text)");
      return (
        <>
          <g opacity={0.3}>{candles(soft, "none", small.map((k) => ({ ...k, o: k.o + 8, c: k.c + 8, h: k.h + 8, l: Math.min(k.l + 8, 42) })))}</g>
          <g opacity={on("legendSymbol")}>{txt(4, 4, 10, strong("legendSymbol"), 1, 3.5)}</g>
          <g opacity={on("legendDescription")}>{txt(16, 4, 8, strong("legendDescription"), 0.8, 3.5)}</g>
          <g opacity={on("legendOhlc")}>
            {txt(27, 4, 6, strong("legendOhlc"), 0.8, 3.5)}
            {txt(35, 4, 6, strong("legendOhlc"), 0.8, 3.5)}
            {txt(43, 4, 6, strong("legendOhlc"), 0.8, 3.5)}
          </g>
          <g opacity={on("legendChange")}>{txt(51, 4, 9, col.up, 1, 3.5)}</g>
          <g opacity={on("legendVolume")}>{txt(62, 4, 7, strong("legendVolume"), 0.8, 3.5)}</g>
          <g opacity={id === "legendIndicatorTitles" || id === "legendIndicatorValues" ? 1 : 0.3}>
            {txt(4, 10, 12, id === "legendIndicatorTitles" ? ACCENT : MUTED, id === "legendIndicatorTitles" ? 1 : 0.6, 3)}
            {txt(18, 10, 8, id === "legendIndicatorValues" ? ACCENT : MUTED, id === "legendIndicatorValues" ? 1 : 0.6, 3)}
          </g>
        </>
      );
    }
    case "priceScaleMode":
      return (
        <>
          <line x1={58} x2={58} y1={3} y2={41} stroke={MUTED} opacity={SOFT} />
          {[38, 30, 21, 13, 6].map((y, i) => (
            <line key={y} x1={58} x2={62} y1={y} y2={y} stroke={ACCENT} strokeWidth={1} opacity={0.4 + i * 0.12} />
          ))}
          <path d="M6 38 C24 37 38 30 52 6" fill="none" stroke={col.line} strokeWidth={1.5} />
        </>
      );
    case "autoScale":
      return (
        <>
          {candles(ud, "none", small)}
          <g stroke={ACCENT} strokeWidth={1}>
            <path d="M64 6 V38" />
            <path d="M61 9 L64 6 L67 9" fill="none" />
            <path d="M61 35 L64 38 L67 35" fill="none" />
          </g>
        </>
      );
    case "priceAxis":
    case "scaleText":
    case "scaleLines":
      return (
        <>
          <g opacity={0.5}>{candles(soft, "none", small)}</g>
          <line x1={58} x2={58} y1={3} y2={41} stroke={id === "scaleLines" || id === "priceAxis" ? ACCENT : MUTED} strokeWidth={1} opacity={id === "scaleText" ? SOFT : 1} />
          {[9, 19, 29, 39].map((y) => (
            <g key={y}>
              <line x1={56} x2={58} y1={y} y2={y} stroke={id === "scaleLines" ? ACCENT : MUTED} opacity={id === "scaleLines" ? 1 : SOFT} />
              {txt(61, y - 1.5, 8, id === "scaleText" || id === "priceAxis" ? ACCENT : MUTED, id === "scaleText" || id === "priceAxis" ? 1 : SOFT)}
            </g>
          ))}
        </>
      );
    case "paneAxes":
      return (
        <>
          <g opacity={0.5}>{candles(soft, "none", small.map((k) => ({ ...k, o: k.o * 0.7, c: k.c * 0.7, h: k.h * 0.7, l: k.l * 0.7 })))}</g>
          <line x1={2} x2={70} y1={27} y2={27} stroke={MUTED} opacity={0.3} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={5 + i * 8} y={42 - [6, 10, 4, 12, 7, 9][i]} width={5} height={[6, 10, 4, 12, 7, 9][i]} fill={MUTED} opacity={0.35} />
          ))}
          <line x1={58} x2={58} y1={29} y2={42} stroke={ACCENT} />
          {txt(61, 31, 8, ACCENT, 1)}
          {txt(61, 38, 8, ACCENT, 1)}
          {priceAxis(MUTED, 0.25)}
        </>
      );
    case "scalePlacement":
      return (
        <>
          <g opacity={0.5}>{candles(soft, "none", CANDLES.map((k) => ({ ...k, x: k.x * 0.7 + 12 })))}</g>
          <line x1={10} x2={10} y1={3} y2={41} stroke={ACCENT} />
          {[9, 19, 29, 39].map((y) => txt(1, y - 1.5, 7, ACCENT, 1))}
          <line x1={60} x2={60} y1={3} y2={41} stroke={MUTED} opacity={SOFT} />
          {[9, 19, 29, 39].map((y) => txt(63, y - 1.5, 7))}
        </>
      );
    case "lastPriceLabel":
    case "lastPriceLine":
    case "countdown":
      return (
        <>
          {candles(ud, "none", small)}
          {priceAxis(MUTED, 0.3)}
          <line x1={2} x2={56} y1={15} y2={15} stroke={col.up} strokeWidth={1} strokeDasharray="2 2" opacity={id === "lastPriceLine" ? 1 : 0.35} />
          <g opacity={id === "lastPriceLine" ? 0.5 : 1}>{pill(15, col.up)}</g>
          {id === "countdown" && (
            <g>
              <rect x={57} y={20} width={14} height={7} rx={2} fill={col.up} opacity={0.85} />
              <rect x={60} y={22.5} width={8} height={2} rx={1} fill="var(--lq-color-accent-contrast)" />
            </g>
          )}
        </>
      );
    case "highLow":
      return (
        <>
          {candles(ud, "none", small)}
          <line x1={4} x2={56} y1={8} y2={8} stroke={ACCENT} strokeDasharray="2 2" />
          <line x1={4} x2={56} y1={34} y2={34} stroke={ACCENT} strokeDasharray="2 2" />
          {pill(8, ACCENT, 13)}
          {pill(34, ACCENT, 13)}
        </>
      );
    case "indicatorValues":
    case "seriesLabels":
      return (
        <>
          <g opacity={0.5}>{candles(soft, "none", small)}</g>
          <path d="M4 30 C18 26 30 22 54 18" fill="none" stroke="var(--lq-color-violet)" strokeWidth={1.5} />
          {priceAxis(MUTED, 0.3)}
          {pill(18, "var(--lq-color-violet)")}
          {id === "seriesLabels" && pill(10, col.up)}
        </>
      );
    case "crosshair":
    case "crosshairPriceLabel":
    case "crosshairTimeLabel":
      return (
        <>
          <g opacity={0.45}>{candles(soft, "none", small)}</g>
          <g stroke={id === "crosshair" ? ACCENT : MUTED} strokeWidth={1} strokeDasharray="2 2" opacity={id === "crosshair" ? 1 : 0.6}>
            <line x1={34} x2={34} y1={2} y2={34} />
            <line x1={2} x2={56} y1={20} y2={20} />
          </g>
          {id === "crosshairPriceLabel" && pill(20, ACCENT)}
          {id === "crosshairTimeLabel" && (
            <g>
              <rect x={24} y={35} width={20} height={8} rx={2} fill={ACCENT} />
              <rect x={28} y={38} width={12} height={2} rx={1} fill="var(--lq-color-accent-contrast)" />
            </g>
          )}
        </>
      );
    case "timeAxis":
    case "weekday":
    case "dateFormat":
    case "timeFormat": {
      const hl = id === "timeAxis" ? [6, 24, 42] : [];
      return (
        <>
          <g opacity={0.45}>{candles(soft, "none", small.map((k) => ({ ...k, o: k.o * 0.8, c: k.c * 0.8, h: k.h * 0.8, l: k.l * 0.8 })))}</g>
          <line x1={3} x2={69} y1={33} y2={33} stroke={id === "timeAxis" ? ACCENT : MUTED} opacity={id === "timeAxis" ? 1 : SOFT} />
          {[6, 28, 50].map((x) => (
            <g key={x}>
              {hl.length > 0 && txt(x, 37, 14, ACCENT, 1)}
              {id === "weekday" && (
                <>
                  {txt(x, 37, 5, ACCENT, 1)}
                  {txt(x + 7, 37, 9)}
                </>
              )}
              {id === "dateFormat" && (
                <>
                  {txt(x, 37, 4, ACCENT, 1)}
                  {txt(x + 5, 37, 4, ACCENT, 1)}
                  {txt(x + 10, 37, 6, ACCENT, 1)}
                </>
              )}
              {id === "timeFormat" && (
                <>
                  {txt(x, 37, 5, ACCENT, 1)}
                  <circle cx={x + 7} cy={37.5} r={0.6} fill={ACCENT} />
                  <circle cx={x + 7} cy={39.5} r={0.6} fill={ACCENT} />
                  {txt(x + 9, 37, 5, ACCENT, 1)}
                </>
              )}
            </g>
          ))}
        </>
      );
    }
    case "touchLayout":
      return (
        <>
          <rect x={6} y={6} width={34} height={32} rx={3} fill="none" stroke={MUTED} opacity={SOFT} />
          <g opacity={0.6}>{candles(soft, "none", [12, 18, 24, 30].map((x, i) => ({ x, o: 28 - i * 3, c: 24 - i * 3, h: 21 - i * 3, l: 31 - i * 3 })), 3)}</g>
          <rect x={46} y={4} width={20} height={36} rx={4} fill="none" stroke={ACCENT} />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={49 + i * 5.5} y={33} width={4} height={4} rx={1} fill={ACCENT} opacity={0.8} />
          ))}
          <g>{candles(ud, "none", [51, 56, 61].map((x, i) => ({ x, o: 24 - i * 3, c: 20 - i * 3, h: 17 - i * 3, l: 27 - i * 3 })), 2.5)}</g>
        </>
      );
    case "colorMode":
    case "modeColors":
      return (
        <>
          <rect x={4} y={4} width={31} height={36} rx={3} fill="#ffffff" stroke={MUTED} strokeOpacity={0.3} />
          <rect x={37} y={4} width={31} height={36} rx={3} fill="#1b1d22" />
          {candles(ud, "all", [10, 17, 24, 31].map((x, i) => ({ x, o: 30 - i * 4 + (i === 1 ? -6 : 0), c: 24 - i * 4, h: 20 - i * 4, l: 33 - i * 4 })), 4)}
          {candles(ud, "all", [43, 50, 57, 64].map((x, i) => ({ x, o: 30 - i * 4 + (i === 1 ? -6 : 0), c: 24 - i * 4, h: 20 - i * 4, l: 33 - i * 4 })), 4)}
        </>
      );
    case "background":
    case "backgroundOpacity":
      return (
        <>
          <defs>
            <linearGradient id={`${gid}-bg`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={ACCENT} stopOpacity={0.35} />
              <stop offset="1" stopColor={ACCENT} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {id === "background" ? (
            <>
              <rect x={3} y={3} width={32} height={38} rx={3} fill={ACCENT} fillOpacity={0.18} opacity={col.backgroundGradient ? 0.5 : 1} />
              <rect x={37} y={3} width={32} height={38} rx={3} fill={`url(#${gid}-bg)`} opacity={col.backgroundGradient ? 1 : 0.5} />
            </>
          ) : (
            [0, 1, 2, 3].map((i) => <rect key={i} x={3 + i * 17} y={3} width={15} height={38} rx={2} fill={ACCENT} fillOpacity={0.08 + i * 0.12} />)
          )}
          {line(col.line, { opacity: 0.7 })}
        </>
      );
    case "edgeToEdge":
      return (
        <>
          <rect x={0} y={0} width={W} height={H} fill={ACCENT} fillOpacity={0.12} />
          <g stroke={ACCENT} strokeWidth={1}>
            <path d="M3 22 H12 M9 19 L12 22 L9 25" fill="none" transform="rotate(180 7.5 22)" />
            <path d="M60 22 H69 M66 19 L69 22 L66 25" fill="none" />
          </g>
          {line(col.line, { opacity: 0.7 })}
        </>
      );
    case "vertGrid":
    case "horzGrid":
      return (
        <>
          <g stroke={ACCENT} strokeWidth={1} opacity={0.8}>
            {id === "vertGrid"
              ? [12, 24, 36, 48, 60].map((x) => <line key={x} x1={x} x2={x} y1={3} y2={41} />)
              : [9, 18, 27, 36].map((y) => <line key={y} x1={3} x2={69} y1={y} y2={y} />)}
          </g>
          <g stroke={MUTED} strokeWidth={1} opacity={0.2}>
            {id === "horzGrid"
              ? [12, 24, 36, 48, 60].map((x) => <line key={x} x1={x} x2={x} y1={3} y2={41} />)
              : [9, 18, 27, 36].map((y) => <line key={y} x1={3} x2={69} y1={y} y2={y} />)}
          </g>
          {line(col.line, { opacity: 0.6 })}
        </>
      );
    case "paneSeparators":
      return (
        <>
          <g opacity={0.5}>{candles(soft, "none", small.map((k) => ({ ...k, o: k.o * 0.6, c: k.c * 0.6, h: k.h * 0.6, l: k.l * 0.6 })))}</g>
          <line x1={2} x2={70} y1={24} y2={24} stroke={ACCENT} strokeWidth={1.5} />
          <path d="M4 36 C14 30 22 40 34 32 S54 30 68 34" fill="none" stroke={MUTED} strokeWidth={1.25} opacity={0.6} />
        </>
      );
    case "watermark":
    case "watermarkSize":
      return (
        <>
          <text
            x={W / 2}
            y={H / 2 + (id === "watermarkSize" ? 6 : 4)}
            textAnchor="middle"
            fontSize={id === "watermarkSize" ? 17 : 12}
            fontWeight={700}
            fontFamily="inherit"
            fill={ACCENT}
            opacity={0.35}
          >
            ABC
          </text>
          {line(col.line, { width: 1.25, opacity: 0.7 })}
        </>
      );
    case "navigationButtons":
    case "paneButtons":
      return (
        <>
          <g opacity={0.4}>{candles(soft, "none", small)}</g>
          {id === "navigationButtons" ? (
            <g>
              {[0, 1, 2, 3].map((i) => (
                <g key={i}>
                  <rect x={18 + i * 9.5} y={33} width={8} height={8} rx={2} fill={ACCENT} opacity={0.85} />
                  <rect x={20 + i * 9.5} y={36.5} width={4} height={1} fill="var(--lq-color-accent-contrast)" />
                </g>
              ))}
            </g>
          ) : (
            <g>
              {[0, 1, 2].map((i) => (
                <g key={i}>
                  <rect x={4 + i * 9} y={4} width={7.5} height={7.5} rx={2} fill={ACCENT} opacity={0.85} />
                  <rect x={6 + i * 9} y={7.25} width={3.5} height={1} fill="var(--lq-color-accent-contrast)" />
                </g>
              ))}
            </g>
          )}
        </>
      );
    case "marginTop":
    case "marginBottom":
    case "marginRight": {
      const y = id === "marginTop" ? 3 : 33;
      return (
        <>
          {id === "marginRight" ? (
            <rect x={50} y={3} width={18} height={38} rx={2} fill={ACCENT} fillOpacity={0.15} />
          ) : (
            <rect x={3} y={y} width={66} height={8} rx={2} fill={ACCENT} fillOpacity={0.15} />
          )}
          {candles(
            ud,
            "none",
            CANDLES.map((k) => ({ ...k, x: id === "marginRight" ? k.x * 0.75 : k.x, o: k.o * 0.55 + 7, c: k.c * 0.55 + 7, h: k.h * 0.55 + 7, l: k.l * 0.55 + 7 })),
            id === "marginRight" ? 4.5 : 6,
          )}
        </>
      );
    }
    case "resetZoom":
      return (
        <>
          {candles(ud, "none", small)}
          <g stroke={ACCENT} strokeWidth={1} fill="none">
            <path d="M4 41 H58" />
            <path d="M4 38 V43 M58 38 V43" />
          </g>
        </>
      );
    case "pastZone":
    case "futureZone": {
      const x = id === "pastZone" ? 3 : 46;
      return (
        <>
          <defs>
            <pattern id={`${gid}-hatch`} width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1={0} y1={0} x2={0} y2={4} stroke={ACCENT} strokeWidth={1} opacity={0.6} />
            </pattern>
          </defs>
          <rect x={x} y={3} width={23} height={38} rx={2} fill={`url(#${gid}-hatch)`} />
          {candles(ud, "none", (id === "pastZone" ? [32, 40, 48, 56, 64] : [8, 16, 24, 32, 40]).map((cx, i) => ({ ...CANDLES[i + 1], x: cx })), 5)}
        </>
      );
    }
    case "events":
      return (
        <>
          <g opacity={0.45}>{candles(soft, "none", small)}</g>
          {[14, 34, 52].map((x, i) => (
            <g key={x}>
              <line x1={x} x2={x} y1={30} y2={36} stroke={MUTED} opacity={0.5} />
              <circle cx={x} cy={39} r={3.2} fill={["var(--lq-color-sky)", "var(--lq-color-amber)", "var(--lq-color-violet)"][i]} />
            </g>
          ))}
        </>
      );
    case "integration":
      return (
        <g stroke={ACCENT} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M26 14 L16 22 L26 30" />
          <path d="M46 14 L56 22 L46 30" />
          <path d="M39 11 L33 33" opacity={0.6} />
        </g>
      );
  }
}

let seq = 0;
const nextId = () => `lq-si-${++seq}`;

export function SettingIllustration({ id, colors }: { id: SettingIllustrationId; colors?: IllustrationColors }) {
  const ctx = useContext(IllustrationColorsContext);
  const merged = { ...ctx, ...colors };
  const col = {
    ...merged,
    up: merged.up ?? "var(--lq-color-up)",
    down: merged.down ?? "var(--lq-color-down)",
    line: merged.line ?? ACCENT,
  };
  // Identifiant stable par instance pour les dégradés et motifs (pas de collision entre vignettes).
  const gid = useStableId();
  return (
    <svg className="lq-chart-settings__illus" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" focusable="false">
      {plot()}
      {draw(id, col, gid)}
    </svg>
  );
}

function useStableId() {
  const ref = useRef<string>(undefined);
  if (!ref.current) ref.current = nextId();
  return ref.current;
}
