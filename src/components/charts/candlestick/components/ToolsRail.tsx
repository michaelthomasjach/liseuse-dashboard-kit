import { Fragment, useRef, useState } from "react";
import type { RefObject, Dispatch, SetStateAction } from "react";
import { Popover } from "../../../forms/Popover";
import { Checkbox } from "../../../forms/Checkbox";
import { ChevronDownIcon, MagnetIcon, EyeIcon, EyeOffIcon, LockIcon, BellIcon, LayersIcon, ZoomInIcon, ZoomOutIcon, InfoIcon } from "../../../icons";
import type { DrawingToolType } from "../interfaces/DrawingToolType.interface";
import { DRAWING_TOOL_CATEGORIES } from "../drawingCatalog";
import { capitalize } from "../formatting";
import { TOOLS_RAIL_HEIGHT_MOBILE } from "../constants";

export interface ToolsRailProps {
  drawingTools: boolean;
  dims: { width: number; margin: { left: number } };
  plotHeight: number;
  /** Bottom-docked horizontal row (narrow/mobile layout — see MOBILE_RAIL_BREAKPOINT) instead of
   *  the default left-docked vertical column. Purely a layout switch: every button/toggle/menu
   *  below is identical either way, only the rail's own container flips axis. */
  horizontal: boolean;
  selectedToolByCategory: Record<string, DrawingToolType>;
  openToolMenu: string | null;
  setOpenToolMenu: Dispatch<SetStateAction<string | null>>;
  activeTool: DrawingToolType | null;
  handleToolClick: (tool: DrawingToolType) => void;
  handleSelectToolType: (type: DrawingToolType) => void;
  menuAnchorRefFor: (categoryId: string) => RefObject<HTMLButtonElement>;
  magnetActive: boolean;
  setMagnetActive: Dispatch<SetStateAction<boolean>>;
  drawingsHidden: boolean;
  setDrawingsHidden: Dispatch<SetStateAction<boolean>>;
  drawingsLocked: boolean;
  setDrawingsLocked: Dispatch<SetStateAction<boolean>>;
  zoomable: boolean;
  isZoomed: boolean;
  resetZoom: () => void;
  eventKinds: string[];
  hiddenEventKinds: Set<string>;
  setHiddenEventKinds: Dispatch<SetStateAction<Set<string>>>;
  indicatorsManagerOpen: boolean;
  setIndicatorsManagerOpen: Dispatch<SetStateAction<boolean>>;
  onOpenToolInfo: (tool: DrawingToolType) => void;
}

/** The drawing-tools rail (`drawingTools` prop), left-docked and vertical by default or
 *  bottom-docked and horizontal when `horizontal` is set (see CandlestickChart's own
 *  isMobileRail/MOBILE_RAIL_BREAKPOINT — too narrow to stack every button in a left column): one
 *  button + chevron + flyout menu per tool category (see DRAWING_TOOL_CATEGORIES — Lines/
 *  Fibonacci/Chart patterns/Forecasting/Measure, each menu headed by its own category name and,
 *  for the tall "Lines" one, further broken into smaller visual clusters by a thin divider
 *  wherever DrawingToolDef.subgroup changes), then a separator and the persistent aimant/
 *  hide-drawings/lock-drawings/event-visibility toggles, then the "Dessins et indicateurs"
 *  manager button pinned to the rail's own trailing edge. In horizontal mode the row doesn't try
 *  to fit every button — it scrolls, native touch drag included (`.lq-chart__tools-rail--
 *  horizontal`'s own doc in charts-shared.css), the same overflow-x pattern `.lq-chart__header`
 *  already uses for its own narrow-viewport row. Purely presentational — every interaction is a
 *  callback prop from
 *  `useDrawingState`/`useChartEvents`. */
export function ToolsRail({
  drawingTools,
  dims,
  plotHeight,
  horizontal,
  selectedToolByCategory,
  openToolMenu,
  setOpenToolMenu,
  activeTool,
  handleToolClick,
  handleSelectToolType,
  menuAnchorRefFor,
  magnetActive,
  setMagnetActive,
  drawingsHidden,
  setDrawingsHidden,
  drawingsLocked,
  setDrawingsLocked,
  zoomable,
  isZoomed,
  resetZoom,
  eventKinds,
  hiddenEventKinds,
  setHiddenEventKinds,
  indicatorsManagerOpen,
  setIndicatorsManagerOpen,
  onOpenToolInfo,
}: ToolsRailProps) {
  const [eventsMenuOpen, setEventsMenuOpen] = useState(false);
  const eventsMenuAnchorRef = useRef<HTMLButtonElement>(null);

  if (!drawingTools) return null;
  const railStyle = horizontal ? { width: dims.width, height: TOOLS_RAIL_HEIGHT_MOBILE } : { width: dims.margin.left, height: plotHeight };
  return (
    <div
      className={["lq-chart__tools-rail", horizontal && "lq-chart__tools-rail--horizontal"].filter(Boolean).join(" ")}
      style={railStyle}
    >
      <div className="lq-chart__tools-rail-items">
        {/* One group per category (Lignes/Fibonacci/Vagues d'Elliott) — each button
            represents whichever of its own tools was picked last (defaulting to the
            first). The chevron is invisible until its own group (button or chevron) is
            hovered — see .lq-chart__tool-chevron in charts-shared.css. Picking a tool from
            a category's menu both changes what its button represents *and* activates it
            immediately (see handleSelectToolType) — clicking the button itself afterward
            just toggles that same tool on/off, same as any other tool selection. */}
        {/* "measure" is filtered out here — rendered separately below the separator instead
            (see its own button further down), grouped with the persistent modifier toggles
            rather than the drawing-tool categories, since it doesn't add a drawing to the chart
            the way every other category does. */}
        {DRAWING_TOOL_CATEGORIES.filter((category) => category.id !== "measure").map((category) => {
          const selectedType = selectedToolByCategory[category.id] ?? category.tools[0].type;
          const selectedInCategory = category.tools.find((t) => t.type === selectedType) ?? category.tools[0];
          const CategoryIcon = selectedInCategory.icon;
          const menuOpen = openToolMenu === category.id;
          return (
            <Fragment key={category.id}>
              <div className="lq-chart__tool-group">
              <button
                type="button"
                className={["lq-chart__icon-button", activeTool === selectedInCategory.type && "lq-chart__icon-button--active"]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => handleToolClick(selectedInCategory.type)}
                aria-label={selectedInCategory.label}
                aria-pressed={activeTool === selectedInCategory.type}
              >
                <CategoryIcon size={14} />
              </button>
              {/* Only worth a dropdown once there's actually something to pick between —
                  a single-tool category (e.g. "Mesure" today) has nowhere else for the
                  chevron to lead, so it stays off entirely instead of opening an empty-ish
                  one-item menu. Adding a 2nd tool to that category later makes this
                  reappear on its own, no extra wiring needed. */}
              {category.tools.length > 1 && (
                <>
                  <button
                    ref={menuAnchorRefFor(category.id)}
                    type="button"
                    className={["lq-chart__tool-chevron", menuOpen && "lq-chart__tool-chevron--visible"].filter(Boolean).join(" ")}
                    onClick={() => setOpenToolMenu((o) => (o === category.id ? null : category.id))}
                    aria-label={`Autres outils — ${category.id}`}
                  >
                    <ChevronDownIcon size={8} />
                  </button>
                  <Popover
                    open={menuOpen}
                    onClose={() => setOpenToolMenu(null)}
                    anchorRef={menuAnchorRefFor(category.id)}
                    placement="bottom"
                  >
                    <div className="lq-chart__tool-menu">
                      <div className="lq-chart__tool-menu-header">{category.label}</div>
                      {category.tools.map((opt, i) => {
                        const OptionIcon = opt.icon;
                        // A divider wherever `subgroup` changes from the previous tool — only
                        // ever true within a category that actually tags its own tools with one
                        // (just "lines" today, see DrawingToolDef.subgroup's own doc); every
                        // other category's tools are all `subgroup: undefined`, so this never
                        // fires for them.
                        const previousSubgroup = i > 0 ? category.tools[i - 1].subgroup : undefined;
                        const showDivider = i > 0 && opt.subgroup !== previousSubgroup;
                        return (
                          <Fragment key={opt.type}>
                            {showDivider && <div className="lq-chart__tool-menu-divider" aria-hidden="true" />}
                            <div className="lq-chart__tool-menu-row">
                              <button
                                type="button"
                                className={["lq-chart__tool-menu-option", opt.type === selectedType && "lq-chart__tool-menu-option--selected"]
                                  .filter(Boolean)
                                  .join(" ")}
                                onClick={() => handleSelectToolType(opt.type)}
                              >
                                <OptionIcon size={14} />
                                {opt.label}
                              </button>
                              <button
                                type="button"
                                className="lq-chart__pane-header-action"
                                onClick={() => onOpenToolInfo(opt.type)}
                                aria-label={`À propos de ${opt.label}`}
                              >
                                <InfoIcon size={13} />
                              </button>
                            </div>
                          </Fragment>
                        );
                      })}
                    </div>
                  </Popover>
                </>
              )}
              </div>
            </Fragment>
          );
        })}
        {/* Marks the boundary between the drawing-tool category buttons above (Lines/Fibonacci/
            Chart patterns/Forecasting/Measure) and the persistent modifier toggles below —
            unconditional (always sits right here) rather than tied to whichever category happens
            to render last, so it can't silently disappear if the category list itself changes. */}
        <div className="lq-chart__tool-separator" aria-hidden="true" />
        {/* Moved out of the drawing-tool categories above (see the filter on that map) — doesn't
            add a drawing to the chart the way every other category does, which reads closer to a
            utility tool like the magnet right below it than a "drawing" pick. Still driven by
            the same handleToolClick/activeTool as any other tool, just its own plain button
            instead of a DRAWING_TOOL_CATEGORIES map entry, since it's guaranteed single-tool
            (no chevron/flyout ever applies to it). */}
        {(() => {
          const measureTool = DRAWING_TOOL_CATEGORIES.find((c) => c.id === "measure")!.tools[0];
          const MeasureToolIcon = measureTool.icon;
          return (
            <div className="lq-chart__tool-group">
              <button
                type="button"
                className={["lq-chart__icon-button", activeTool === "measure" && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
                onClick={() => handleToolClick("measure")}
                aria-label={measureTool.label}
                aria-pressed={activeTool === "measure"}
              >
                <MeasureToolIcon size={14} />
              </button>
              {/* No chevron/popover for this one (guaranteed single-tool, see this block's own
                  doc above) — reuses the chevron's own corner-badge positioning/hover-reveal
                  (see .lq-chart__tool-chevron) rather than a plain adjacent button, which would
                  just flow as its own extra icon in the rail's narrow single-column layout
                  instead of overlaying the button it belongs to. */}
              <button
                type="button"
                className="lq-chart__tool-chevron"
                onClick={() => onOpenToolInfo("measure")}
                aria-label={`À propos de ${measureTool.label}`}
              >
                <InfoIcon size={8} />
              </button>
            </div>
          );
        })()}
        {/* A persistent modifier, not a tool of its own — stays on across tool switches
            (see toDataPoint/magnetSnapPrice) until toggled off again, so it lives outside
            DRAWING_TOOL_CATEGORIES' button+chevron+menu pattern as a plain toggle. */}
        <button
          type="button"
          className={["lq-chart__icon-button", magnetActive && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
          onClick={() => setMagnetActive((a) => !a)}
          aria-label="Aimant"
          aria-pressed={magnetActive}
          title="Aimant : accroche les nouveaux points au prix (O/H/L/C) le plus proche"
        >
          <MagnetIcon size={14} />
        </button>
        {/* Hides every drawing without deleting any of them — same eye/eye-off convention
            the indicator legend already uses for a single indicator, applied here to all
            of `drawings` at once. */}
        <button
          type="button"
          className={["lq-chart__icon-button", drawingsHidden && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
          onClick={() => setDrawingsHidden((h) => !h)}
          aria-label={drawingsHidden ? "Afficher les dessins" : "Masquer les dessins"}
          aria-pressed={drawingsHidden}
          title="Masquer/afficher tous les dessins"
        >
          {drawingsHidden ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
        </button>
        {/* Blocks dragging (body, endpoints, and axis handles all check this before
            starting) without touching selectability — hover, Delete, and double-click to
            edit all keep working on a locked drawing, only click-and-drag is refused. */}
        <button
          type="button"
          className={["lq-chart__icon-button", drawingsLocked && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
          onClick={() => setDrawingsLocked((l) => !l)}
          aria-label={drawingsLocked ? "Déverrouiller les dessins" : "Verrouiller les dessins"}
          aria-pressed={drawingsLocked}
          title="Verrouiller/déverrouiller le déplacement des dessins"
        >
          <LockIcon size={14} />
        </button>
        {/* Moved out of the topbar (see ChartHeader.tsx's own git history) so every zoom-related
            control lives in one place — this rail, right below the lock toggle — instead of
            split between here and there. "+" sits above "-" (the order the user actually wants
            them in), not the other way the two were first added in. */}
        {/* "Zoom in on this rectangle" — same click-click placement as the rectangle drawing tool
            (see useDrawingInteractions' own "zoomIn" branch), except the 2nd click zooms with an
            animated transition instead of leaving a drawing behind, and deselects the tool right
            after (same auto-deselect "measure" already does, for the same reason: its own result
            isn't a persistent drawing to keep editing). */}
        {zoomable && (
          <button
            type="button"
            className={["lq-chart__icon-button", activeTool === "zoomIn" && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
            onClick={() => handleToolClick("zoomIn")}
            aria-label="Zoomer sur une zone"
            aria-pressed={activeTool === "zoomIn"}
            title="Zoomer sur une zone : cliquer deux fois pour délimiter un rectangle"
          >
            <ZoomInIcon size={14} />
          </button>
        )}
        {/* Same `zoomable && isZoomed` gate it always had: nothing to reset back to its own
            default range while already at that range, or while zoom/pan themselves are off
            entirely — this is also exactly the "only appears once a zoom has actually happened"
            behavior asked for, already true before this reorder and unchanged by it. */}
        {zoomable && isZoomed && (
          <button type="button" className="lq-chart__icon-button" onClick={resetZoom} aria-label="Réinitialiser le zoom" title="Réinitialiser le zoom">
            <ZoomOutIcon size={14} />
          </button>
        )}
        {/* Per-kind event-marker visibility (Earnings/News/Dividend/Update/…, whatever kinds are
            actually present in `events` — see eventKinds) — a quick toolbar dropdown for the same
            toggles the "Paramètres du graphique" modal also exposes, all shown by default. A
            distinct icon from the hide-drawings eye above, so the two aren't confused for the
            same toggle. Pinned to the rail's own bottom edge (see
            .lq-chart__tools-rail-bottom-button), alongside "Dessins et indicateurs" right below
            it, rather than living inline with the magnet/hide/lock toggles above. */}
        {eventKinds.length > 0 && (
          <>
            <button
              ref={eventsMenuAnchorRef}
              type="button"
              className={["lq-chart__icon-button", "lq-chart__tools-rail-bottom-button", eventsMenuOpen && "lq-chart__icon-button--active"]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setEventsMenuOpen((o) => !o)}
              aria-label="Visibilité des évènements"
              aria-pressed={eventsMenuOpen}
              title="Afficher/masquer les évènements par type"
            >
              <BellIcon size={14} />
            </button>
            <Popover open={eventsMenuOpen} onClose={() => setEventsMenuOpen(false)} anchorRef={eventsMenuAnchorRef} placement="bottom">
              <div className="lq-chart__events-menu">
                {eventKinds.map((kind) => (
                  <Checkbox
                    key={kind}
                    checked={!hiddenEventKinds.has(kind)}
                    onChange={() =>
                      setHiddenEventKinds((prev) => {
                        const next = new Set(prev);
                        if (next.has(kind)) next.delete(kind);
                        else next.add(kind);
                        return next;
                      })
                    }
                    label={capitalize(kind)}
                  />
                ))}
              </div>
            </Popover>
          </>
        )}
        {/* Opens a flat, grouped list of every drawing and indicator currently on the chart
            (overlay and own-pane alike) with a settings/delete action per row, instead of having
            to hunt each one down on the chart itself (hovering a legend entry, or a collapsed
            pane that hides its own actions). Shown whenever the rail itself is (drawingTools)
            regardless of showIndicators — even drawings-only usage benefits from a single place
            to see and clear everything drawn. Only needs the bottom-pin class itself when the
            events button right above it isn't rendered (no event kinds present) — otherwise
            that button's own auto margin already pushes both of them down together. */}
        <button
          type="button"
          className={[
            "lq-chart__icon-button",
            eventKinds.length === 0 && "lq-chart__tools-rail-bottom-button",
            indicatorsManagerOpen && "lq-chart__icon-button--active",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setIndicatorsManagerOpen((o) => !o)}
          aria-label="Dessins et indicateurs"
          aria-pressed={indicatorsManagerOpen}
          title="Voir et gérer tous les dessins et indicateurs actifs"
        >
          <LayersIcon size={14} />
        </button>
      </div>
    </div>
  );
}
