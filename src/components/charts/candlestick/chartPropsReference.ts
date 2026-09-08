/* GÉNÉRÉ — ne pas éditer à la main.
 * Source : interfaces/CandlestickChartProps.interface.ts
 * Régénérer : node scripts/generateChartPropsReference.cjs
 */

/** One prop of `CandlestickChartProps`, as the in-app reference shows it. */
export interface ChartPropDoc {
  name: string;
  /** The declared TypeScript type, verbatim. */
  type: string;
  /** False for an optional prop — most of them; `data` is the only thing the chart cannot do without. */
  required: boolean;
  doc: string;
}

export interface ChartPropSection {
  title: string;
  props: ChartPropDoc[];
}

/** Every prop `CandlestickChart` accepts, grouped by what it is for. */
export const CHART_PROPS_REFERENCE: ChartPropSection[] = [
  {
    title: "Données",
    props: [
      { name: "data", type: "Candle[]", required: true, doc: "The candles to draw, oldest first. This library has no data source of its own — the app fetches them and keeps them up to date; every other data prop here (`events`, `fundamentals`, `symbolSearchResults`) takes the same stance." },
      { name: "symbol", type: "string", required: false, doc: "Instrument name shown top-left of the price plot, followed by the current chart-type label (e.g. \"AAPL · Bougies\") — double-clicking that label opens the chart-settings modal (up/down bar colors, auto-rescale, event visibility). Omit to show just the chart-type label on its own (the settings modal is still reachable by double-clicking it)." },
      { name: "events", type: "ChartEvent[]", required: false, doc: "Markers shown as small badges along the bottom of the price plot (earnings, dividends, product updates…) — each `kind` groups related events and can be shown/hidden independently from the chart-settings modal (double-click the symbol/chart-type label). Purely presentational: positions are derived from `date` via the same index-based X scale everything else uses, so they pan/zoom with the candles." },
      { name: "fundamentals", type: "FundamentalDataPoint[]", required: false, doc: "Reported-period fundamentals (free cash flow, net income, margins, P/E…) — see `FundamentalDataPoint`. Each metric present here shows up as its own entry (category \"Fondamentaux\") in the \"Ajouter un indicateur\" picker, rendering in its own pane exactly like RSI/CHOP/MACD once added. The library doesn't fetch or compute any of this itself (same stance as `timeframes`/`symbolSearchResults`) — it's the app's own data, just plotted." },
      { name: "lastCandleOpen", type: "boolean", required: false, doc: "Whether `data`'s own last candle is still actively forming rather than closed — read by a running script's own `bar.isClosed()`/`bar.isRealtime()` (see the scripting engine's own `ScriptEngineSnapshot.lastCandleOpen` doc for the full reasoning). This library has no way to know the market's own session state on its own, so it defaults to `false` (every bar reported closed) — the conservative choice, so a script gating on \"closed\" never fires early just because this wasn't set." },
      { name: "livePrice", type: "boolean", required: false, doc: "A dashed line across the price plot at the last candle's close, its price on the Y axis (colored up/down against the previous close), and — right below that badge — a MM:SS countdown to the next candle, ticking down every second. The countdown's interval is inferred from the gap between the last two candles (so a 5-minute series counts down from 05:00), not a separate prop — pass data with at least 2 candles for it to show at all. Meant for genuinely live-updating `data` (see the \"Marché ouvert (simulation)\" story); on static historical data the countdown will just sit at 00:00 once it reaches it, since nothing here fetches new candles on its own. Default false." },
    ],
  },
  {
    title: "Taille et apparence",
    props: [
      { name: "width", type: "number", required: false, doc: "Fixed pixel width. Omitted (default): fills 100% of the parent container's width, like every other chart in this library — pass a number only to opt out of that. Ignored while in fullscreen (the toggle always fills the viewport)." },
      { name: "height", type: "number", required: false, doc: "Fixed pixel height. Default 380. Ignored while in fullscreen (the toggle always fills the viewport) or when `fillHeight` is set." },
      { name: "fillHeight", type: "boolean", required: false, doc: "Measures and fills whatever height the wrapper's own container actually has instead of `height`'s fixed-pixel default — the same mechanism `fullscreenToggle` already switches to while active, just driven by this flag instead of that state. `height` alone can't express \"fill the container\" itself: passing `height={undefined}` reads identically to omitting the prop entirely (both fall through to its own 380 default), which is exactly right for a standalone chart wanting a predictable default size, but wrong for e.g. `ChartWorkspace`, which needs every panel to actually stretch to fill its own grid cell — hence this separate flag, which `ChartWorkspace` sets internally rather than relying on `height` to do double duty. Only meaningful when the wrapper's own parent actually gives it a definite height to fill (a CSS grid/flex cell, for instance) — otherwise this falls back to the chart's usual 320px measurement floor, same as `fullscreenToggle`'s own mechanism would in that situation. Default false." },
      { name: "margin", type: "Partial<ChartMargin>", required: false, doc: "Plot margins in pixels — the room reserved around the candles for the axes. Only the keys given are replaced; the rest keep their defaults." },
      { name: "className", type: "string", required: false, doc: "Extra CSS class on the root element, so the host app can style the chart without patching the library." },
      { name: "showVolume", type: "boolean", required: false, doc: "Shows the volume pane under the candles. Default false." },
      { name: "initialVisibleCandles", type: "number", required: false, doc: "How many of the most recent candles are visible when the chart first mounts (applied once, as an initial zoom/pan — the user can still zoom/pan freely afterward). `undefined`/0/a value ≥ `data.length` shows the whole dataset, same as before this prop existed. Default 500." },
      { name: "YAutoScaling", type: "boolean", required: false, doc: "When true, the price axis continuously auto-fits to the min/max of whatever candles are currently visible on the X axis (recalculated on every pan/zoom), instead of a single static domain sized to the whole dataset — until the user manually zooms/pans the Y axis themselves (wheel or drag on the axis, or dragging the plot vertically), at which point auto-fit stops so their adjustment isn't immediately overwritten. Clicking \"Réinitialiser le zoom\" re-engages it. Default true. Also toggleable live from the chart-settings modal (double-click the symbol/chart-type label, top-left of the price plot) — that toggle owns an internal copy seeded from this prop, same uncontrolled pattern as `drawings`/ `indicators`, reported back via `onYAutoScalingChange`." },
      { name: "onYAutoScalingChange", type: "(value: boolean) => void", required: false, doc: "Fired when price auto-scaling turns on or off. It also turns off implicitly the moment the axis is dragged by hand, which this reports too." },
    ],
  },
  {
    title: "Mode d'affichage",
    props: [
      { name: "defaultChartDisplayMode", type: "ChartDisplayMode", required: false, doc: "How the price series itself is drawn — bougies japonaises (défaut), ligne de clôture, Heikin Ashi, Renko, Line Break, ou Time Price Opportunities (bougies + histogramme de distribution des prix avec VAH/POC/VAL). Shown as a header button (icône du mode courant) juste à côté du sélecteur de timeframe, ouvrant un menu des six modes. Uncontrolled, like `drawings`/`indicators` — see `defaultChartDisplayMode`/`onChartDisplayModeChange`." },
      { name: "onChartDisplayModeChange", type: "(mode: ChartDisplayMode) => void", required: false, doc: "Fired when the display mode changes (candles, Heikin-Ashi, Renko, line…), from the header popover or the settings modal alike." },
      { name: "renkoAtrPeriod", type: "number", required: false, doc: "ATR period used to size Renko bricks (a new brick forms every time the close moves this many candles' worth of average true range past the last one) — recomputed from the whole dataset, not just what's visible. Default 14." },
    ],
  },
  {
    title: "Formatage",
    props: [
      { name: "formatDate", type: "(d: Date) => string", required: false, doc: "Formats a date everywhere a human reads one: the date axis, the hover badge, a drawing's own labels. Defaults to a short localized format." },
      { name: "formatPrice", type: "(v: number) => string", required: false, doc: "Formats a price everywhere one is read: the price axis, the header, drawing labels. Defaults to two decimals." },
      { name: "formatVolume", type: "(v: number) => string", required: false, doc: "Formats a volume: the volume pane's own axis and the header. Defaults to compact notation (12k, 3.4M)." },
    ],
  },
  {
    title: "Navigation",
    props: [
      { name: "zoomable", type: "boolean", required: false, doc: "Enables wheel zoom, horizontal drag-to-pan and the zoom shortcuts on the plot. Default false — a thumbnail or a demo chart usually has nothing to explore." },
      { name: "fullscreenToggle", type: "boolean", required: false, doc: "Shows a fullscreen toggle button in the header (\"Focus fenêtre active\"). Default true." },
      { name: "isFullscreen", type: "boolean", required: false, doc: "Controls the fullscreen toggle from outside instead of it managing its own state — pairs with `onFullscreenChange` below. `ChartWorkspace` sets both so only one panel can be \"focused\" at a time (all its panels share one piece of state, so focusing a new one supersedes whichever had it before); a standalone chart has no reason to and keeps its self-contained internal state instead (see `useFullscreen`)." },
      { name: "onFullscreenChange", type: "(value: boolean) => void", required: false, doc: "Fired on every entry into and exit from fullscreen, including one triggered by Escape rather than by the toggle — so a caller mirroring this in its own state never drifts out of sync with it." },
      { name: "timeframes", type: "TimeframeEntry[]", required: false, doc: "Timeframe/interval options shown as a dropdown in the header — flat, or grouped (e.g. one group per \"Minutes\"/\"Heures\"/\"Jours\"), matching a typical trading-platform interval menu. This only renders the picker and reports the choice via `onTimeframeChange`; resampling `data` into the new interval is left to the caller." },
      { name: "timeframe", type: "string", required: false, doc: "Currently selected timeframe's `value`, to highlight it in the menu." },
      { name: "onTimeframeChange", type: "(value: string) => void", required: false, doc: "Fired when another timeframe is picked. The library recomputes nothing: supplying the matching candles is the app's own job, same stance `timeframes` itself takes." },
      { name: "seasonality", type: "boolean", required: false, doc: "Shows a header button that swaps the whole chart body for `SeasonalityView` — the average cumulative return through a reference year, aggregated across `data`'s own historical years (see `computeSeasonality` in `internal/seasonality.ts`, kept independent of this component on purpose). A dedicated small header (symbol name + a \"back\" button) replaces the normal one while active, for a clear, unambiguous way back to the regular chart — rather than trying to keep the regular header's own timeframe/display-mode/indicator controls both visible and meaningful over a view none of them actually apply to. Default false." },
      { name: "replay", type: "boolean", required: false, doc: "Shows a header button that arms \"bar replay\": moving the pointer over the chart dims everything to its right, a click freezes that point as a cutoff — hiding everything past it (candles, volume, indicators) without moving anything still visible — and swaps the button for Lecture/Pause/Vitesse/Quitter le replay controls to step through the hidden history one candle at a time. See `useReplayState.ts`'s own doc for why this is a pure visual cover rather than a `data` truncation. Default false." },
    ],
  },
  {
    title: "Dessins",
    props: [
      { name: "drawingTools", type: "boolean", required: false, doc: "Shows a left-docked toolbar for drawing annotations directly on the chart (currently: trend line). Default false." },
      { name: "defaultDrawings", type: "TrendLineDrawing[]", required: false, doc: "Uncontrolled initial set of trend-line drawings." },
      { name: "onDrawingsChange", type: "(drawings: TrendLineDrawing[]) => void", required: false, doc: "Fires whenever a drawing is added, moved, or edited." },
    ],
  },
  {
    title: "Indicateurs",
    props: [
      { name: "showIndicators", type: "boolean", required: false, doc: "Shows a header button that opens the technical-indicator picker (SMA, EMA, WMA…) and the active-indicator legend in the plot's top-left corner. Default false." },
      { name: "defaultIndicators", type: "Indicator[]", required: false, doc: "Uncontrolled initial set of technical indicators." },
      { name: "onIndicatorsChange", type: "(indicators: Indicator[]) => void", required: false, doc: "Fires whenever an indicator is added, edited, or removed." },
      { name: "customIndicators", type: "CustomIndicatorDef[]", required: false, doc: "The library's own built-in catalog (moving averages, oscillators, the eight fundamentals…) covers a fixed, closed set — this is the open-ended escape hatch for anything else: a fundamentals metric beyond those eight (gross margin, dividend yield, income tax…), a proprietary score, any other \"one number per reporting date\" series. Each entry shows up in the \"Ajouter un indicateur\" picker exactly like a built-in one, grouped by its own `section` — see `CustomIndicatorDef`'s own doc for the full shape (`{ id, label, section, type: \"overlay\" | \"own\", draw: \"line\" | \"area\" | \"histogram\", data: [{ date, value }] }`)." },
    ],
  },
  {
    title: "Modèles",
    props: [
      { name: "showTemplates", type: "boolean", required: false, doc: "Shows a Save button plus a templates dropdown at the right edge of the header — captures the *indicator/pane* layout (which indicators, their own settings, pane order, pane height, the Volume pane's own position/collapse state), not drawings or display/timeframe settings, as a named, reloadable `ChartTemplate`. The Save button opens a \"name this template\" modal only the first time (no template active yet); every save after that overwrites the active one directly, no modal. Loading a different template while the current layout has unsaved changes (including never having saved at all) offers to save first rather than silently discarding it. Default false." },
      { name: "defaultTemplates", type: "ChartTemplate[]", required: false, doc: "Uncontrolled initial list of saved templates." },
      { name: "onTemplatesChange", type: "(templates: ChartTemplate[]) => void", required: false, doc: "Fires whenever a template is saved (new or overwritten) or deleted." },
    ],
  },
  {
    title: "Alertes",
    props: [
      { name: "alerts", type: "ChartAlert[]", required: false, doc: "Every alert attached to a drawing (via `drawingId`) or an indicator directly (`drawingId` null, `conditionIndicatorId` set — see `ChartAlertDraft`'s own doc) — entirely caller-owned, same stance as `drawings`/`indicators`, this library never stores, evaluates, or fires one itself. Drives the bell icon's active state on the floating drawing toolbar and each indicator's own legend row, and which alerts `AlertListModal` shows for a given target. Omit (or pass an empty array) to show every bell in its plain, no-alert state." },
      { name: "onCreateAlert", type: "(alert: ChartAlertDraft) => void", required: false, doc: "Fires when \"Créer\" is clicked in the alert-creation modal (opened from the floating drawing toolbar's own bell button, itself shown while a drawing tool is active or an existing drawing is selected, or an indicator's own legend-row bell). The library only ever collects the form into a `ChartAlertDraft` and hands it here — same \"caller owns the data\" stance as `drawings`/`indicators` — it never stores, evaluates, or fires an alert itself." },
      { name: "onUpdateAlert", type: "(id: string, alert: ChartAlertDraft) => void", required: false, doc: "Fires when \"Enregistrer\" is clicked while editing an existing alert (see `alerts`) — same \"caller owns the data\" stance as `onCreateAlert`, this only reports the intent; applying the patch to the caller's own `alerts` array is up to whatever this does." },
      { name: "onDeleteAlert", type: "(id: string) => void", required: false, doc: "Fires when an alert is deleted, from either `AlertListModal`'s own trash button or the edit-alert form's own \"Supprimer\" — same \"caller owns the data\" stance as `onCreateAlert`." },
      { name: "alertSoundOptions", type: "{ value: string; label: string }[]", required: false, doc: "Options for the alert modal's own \"Son\" (sound) picker — this library ships no audio assets, so it's purely a label picker, never actually played. Defaults to a small built-in list." },
      { name: "onPlaySound", type: "(value: string) => void", required: false, doc: "Plays the given sound option's own value — the create-alert modal's \"Son\" field shows a play button next to it only while this is provided (the library ships no audio assets of its own, see AlertCreateModal's own doc, so there's nothing to play without it)." },
    ],
  },
  {
    title: "Recherche de symbole",
    props: [
      { name: "symbolSearch", type: "boolean", required: false, doc: "Makes `symbol` its own hoverable/clickable zone (background on hover, separate from the chart-type label right next to it) — clicking it opens a \"Symbol search\" modal (search field + category filter pills + a results list you provide). Default false — with `symbol` set but this left off, the label still renders, just as inert text. Ignored entirely if `symbol` itself is omitted (nothing to click)." },
      { name: "symbolSearchResults", type: "SymbolSearchResult[]", required: false, doc: "Results currently shown in the symbol-search modal. Searching/filtering — including for the \"Favoris\" pill, see `defaultFavoriteSymbolIds` — is entirely the caller's job: this is only what actually renders, driven by `onSymbolSearchChange`." },
      { name: "onSymbolSearchChange", type: "(query: string, category: SymbolSearchCategory) => void", required: false, doc: "Fires whenever the search modal's query text or category pill changes (including once, right when the modal opens, with the query/category at their defaults) so the caller can fetch/filter and update `symbolSearchResults` accordingly. `category: \"favorites\"` asks for whichever results the caller currently considers favorited — `query` is meaningless in that case and should be ignored." },
      { name: "onSymbolSelect", type: "(result: SymbolSearchResult) => void", required: false, doc: "Fires when a result row is clicked — the modal closes automatically right after." },
      { name: "onAddSymbolOverlay", type: "(result: SymbolSearchResult) => OverlayDataPoint[] | Promise<OverlayDataPoint[]>", required: false, doc: "Fires when a result row's \"+\" is clicked (hover-revealed, next to its name — the modal stays open, unlike `onSymbolSelect`) to compare that instrument against the main one. Returns (or resolves to) the comparison series itself — the library has no data source of its own, same stance as `data`/`fundamentals`/`symbolSearchResults`. Once it resolves, the chart appends a `symbolOverlay` drawing itself (`drawings` stays uncontrolled, like everywhere else in this file — there's no way for the caller to inject one directly, since fetching is inherently async and `drawings` has no controlled counterpart to `defaultDrawings`) — reported back via `onDrawingsChange` same as any other new drawing. The \"+\" shows a small spinner while the promise is pending, and turns into a checkmark (click to remove) once that symbol is already an active overlay — a plain fire-and-forget callback couldn't support either without the library tracking pending/active state itself, which returning the data instead sidesteps. Each point's `value` (its close) is all a plain line comparison needs; include `open`/ `high`/`low` too (see OverlayDataPoint) if the source data has them and the comparison should also be selectable as candles (`overlayDisplayMode` in the edit modal's Style tab)." },
      { name: "defaultFavoriteSymbolIds", type: "string[]", required: false, doc: "Uncontrolled set of favorited result ids — the star toggle at the far right of each result row (visible on hover, or always once favorited). Persisted the same way as `drawings`/ `indicators`: seeds initial state, changes reported back via `onFavoriteSymbolIdsChange`." },
      { name: "onFavoriteSymbolIdsChange", type: "(ids: string[]) => void", required: false, doc: "Fired when a symbol is starred or unstarred in the search modal." },
    ],
  },
  {
    title: "Synchronisation entre graphiques",
    props: [
      { name: "syncedHoverDate", type: "Date | null", required: false, doc: "An externally-driven hover date — e.g. from `ChartWorkspace` syncing the crosshair across a group of linked charts. While set, this chart draws its own crosshair (vertical line, date badge, OHLC readout) at whichever of its own candles is nearest that date, exactly as if the cursor were there — *unless* the cursor is actually, physically over this chart right now, which always wins. The volume/indicator-pane value badges stay tied to the real cursor's own Y position regardless (see `syncedHoverPrice` below for the main price line's own Y-axis counterpart to this prop). Pass `null`/omit for a chart that isn't part of any sync group." },
      { name: "onHoverDateChange", type: "(date: Date | null) => void", required: false, doc: "Fires whenever *this* chart's own real (not synced-in) hover changes — the date of whichever candle the cursor is over, or `null` once it leaves. This is what a `ChartWorkspace` reads to compute `syncedHoverDate` for every other chart in the same link group." },
      { name: "syncedHoverPrice", type: "number | null", required: false, doc: "The horizontal-axis counterpart to `syncedHoverDate` — an externally-driven hover *price* (not a raw pixel: a pixel Y from another chart's own price scale would be meaningless here, given each panel can have a different symbol, zoom level, or Y-auto-scaling state). While set, this chart draws its own horizontal price line/badge at wherever that price falls on ITS OWN current scale — clamped to stay within the visible pane (same as the live-price/ indicator-value badges already do for an off-scale value) rather than drawn off-canvas when a linked panel's price is out of this one's own visible range. Same real-cursor-always-wins rule as `syncedHoverDate`; independent of it, so a caller can sync one axis without the other. Pass `null`/omit for a chart that isn't part of any sync group, or is but shouldn't sync its Y axis." },
      { name: "onHoverPriceChange", type: "(price: number | null) => void", required: false, doc: "Fires whenever *this* chart's own real (not synced-in) price-pane hover changes — the price at the cursor's Y position, or `null` once it leaves. This is what a `ChartWorkspace` reads to compute `syncedHoverPrice` for every other chart in the same link group." },
      { name: "linkable", type: "boolean", required: false, doc: "Shows a chain-link button in the header (top right, alongside Save/templates if those are also on) — click reports back via `onLinkClick` rather than doing anything on its own, since linking charts together is inherently a multi-chart concept this component has no way to know about by itself (see `ChartWorkspace`, which sets this — a standalone chart has no reason to set it). Default false." },
      { name: "isLinked", type: "boolean", required: false, doc: "Highlights the link button to show this chart is currently part of a link group. Purely cosmetic — `ChartWorkspace` is what actually knows the group membership. Default false." },
      { name: "onLinkClick", type: "() => void", required: false, doc: "Called by the link button. The library synchronizes nothing by itself — it reports the intent and the app decides what \\\"linked\\\" means, the same way `isLinked` is the app's own answer rather than internal state." },
    ],
  },
  {
    title: "Panneau latéral",
    props: [
      { name: "sidePanel", type: "ReactNode", required: false, doc: "Content for a collapsible, resizable panel docked to the chart's own right edge, sharing the same outer bordered widget rather than floating separately — a watchlist, an order ticket, notes, anything the caller wants alongside the chart (same \"structure only, bring your own content\" shape as `ChartWorkspace.children`). Defaults to 1/5 of the chart's own total width, draggable narrower/wider from a handle on its own left edge. Omit entirely for no panel at all (default)." },
      { name: "defaultSidePanelOpen", type: "boolean", required: false, doc: "Uncontrolled initial open/collapsed state for `sidePanel` — collapsing gives the chart back its full width; a header button (shown whenever `sidePanel` is set) toggles it either way. Default true (open)." },
      { name: "onSidePanelOpenChange", type: "(open: boolean) => void", required: false, doc: "Fired whenever the side panel opens or closes, whatever caused it." },
    ],
  },
  {
    title: "Scripts",
    props: [
      { name: "scripts", type: "ScriptDef[]", required: false, doc: "Scripts this chart runs — always supplied from outside (this chart never owns its own script list, never shows a script editor, and has no header button for one). `ChartWorkspace` is the only real source of these: it owns one shared script list and one shared editor for the whole workspace, and routes each panel only the subset of it that targets that panel (see `ScriptDef.targetPanelIndex`'s own doc) — see its own `scripting`/`defaultScripts` props. Scripting is deliberately not a standalone-`CandlestickChart` feature at all: omit this (the common case outside a workspace) for a chart that simply never runs any script." },
      { name: "onScriptsChange", type: "(scripts: ScriptDef[]) => void", required: false, doc: "Reports a script's own `enabled`/other field changes back (e.g. toggling one off from this chart's own \"Mes scripts\" indicator-picker row) — required alongside `scripts` for those changes to actually take effect, since this chart never manages the list itself; `ChartWorkspace` splices the change back into its own shared list." },
      { name: "onScriptRunOutput", type: "(id: string, output: ScriptRunOutput) => void", required: false, doc: "Reports this chart's own scripts' run output (result/error/logs/produced indicators…) back to the caller — this chart already consumes its own copy internally (to render the indicators a script produces), this is purely a *second* recipient for a caller that also wants to read it, same \"controlled prop, not the only consumer\" shape `onScriptsChange` has for the list itself. `ChartWorkspace` wires this to its own shared `useScriptingState`'s `reportRunOutput` so its one shared `ScriptEditorPanel` — which has no `ScriptRunner` of its own, every panel's own scripts actually execute inside that panel, not the editor — can show a script's own error/console output/notebook cell results despite never running it itself." },
      { name: "onScriptAlert", type: "(event: ScriptAlertEvent) => void", required: false, doc: "Fires for every `alert(message)` call a running script makes — this library only ever produces the event (see `ScriptAlertEvent`'s own doc); how it actually reaches the user (toast, sound, the app's own notification system) is entirely up to this callback." },
      { name: "onEditScript", type: "(scriptId: string) => void", required: false, doc: "Fires when the user clicks the \"</>\" shortcut on a script-produced indicator's own pane header (see `PaneHeaders.tsx`) — this chart has no editor of its own to open (see `scripts`'s own doc), so jumping to that script's own tab is entirely up to whichever caller does own the editor; `ChartWorkspace` wires this to focus the right tab in its shared one. Omitted, the button itself never renders — there'd be nothing for a click on it to do." },
      { name: "onCreateScript", type: "(name: string, code: string) => void", required: false, doc: "Fires when the user clicks \"Ouvrir dans l'éditeur\" in the code view of a *built-in* indicator (the \"</>\" button next to a row in \"Ajouter un indicateur\"), which shows that indicator's own script equivalent — \"fork this built-in as a script of my own\". Same reasoning as `onEditScript` above: this chart owns no editor, so creating the script and focusing it is the caller's job, and omitting this hides the button rather than offering a dead one. `code` is the snippet as displayed; `name` is the indicator's own catalog label." },
      { name: "onDeleteScript", type: "(scriptId: string) => void", required: false, doc: "Fires when the user confirms deleting a script from the \"Mes scripts\" section of \"Ajouter un indicateur\". Same reasoning as `onEditScript`/`onCreateScript` above — the script list belongs to whoever owns the editor, not to this chart, so deleting one is that caller's job and omitting this hides the button. `ChartWorkspace` wires it to the same `removeScript` its own editor uses, so a script deleted here also leaves the editor's tab strip." },
      { name: "onCreateStrategyFromIndicator", type: "(scriptId: string) => void", required: false, doc: "Fires when the user asks to build a strategy out of one of their indicator scripts (the picker's own action on a \"Mes scripts\" row). Same reasoning as the three callbacks above: the script list and the editor belong to the caller, so creating the new script and focusing it is its job, and omitting this hides the button." },
    ],
  },
];
