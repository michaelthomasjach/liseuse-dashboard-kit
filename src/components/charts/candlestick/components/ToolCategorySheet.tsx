import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LqThemeProvider, useLqTheme } from "../../../../theme";
import { InfoIcon } from "../../../icons";
import type { DrawingToolCategory } from "../drawingCatalog";
import type { DrawingToolType } from "../interfaces/DrawingToolType.interface";
import "./ToolCategorySheet.css";

export interface ToolCategorySheetProps {
  /** The category whose tools to list, or `null` for "closed" — the sheet animates itself in and
   *  out off this one prop rather than taking a separate `open` boolean, since there's nothing to
   *  show without a category anyway. */
  category: DrawingToolCategory | null;
  /** Which of `category.tools` the rail's own button currently represents — marked in the list so
   *  reopening the sheet shows what tapping that button would have done. */
  selectedType: DrawingToolType | undefined;
  onSelect: (type: DrawingToolType) => void;
  onClose: () => void;
  onOpenToolInfo: (type: DrawingToolType) => void;
}

/** The mobile rail's stand-in for a tool category's flyout menu (see ToolsRail's own `horizontal`
 *  prop): a sheet that slides up from the bottom edge listing every tool in the category, and
 *  slides back down as soon as one is picked. Same content as the desktop Popover — category name,
 *  the tools in catalog order with a divider wherever `subgroup` changes, an "about" button per
 *  row — laid out for a thumb instead of a cursor, and anchored to the screen rather than to the
 *  26px button that opened it.
 *
 *  Portaled to document.body for exactly the reason Modal documents at length: a ChartWorkspace
 *  panel isolates its own stacking context, so anything rendered inside one can't out-stack a
 *  sibling panel no matter its z-index.
 */
export function ToolCategorySheet({ category, selectedType, onSelect, onClose, onOpenToolInfo }: ToolCategorySheetProps) {
  const theme = useLqTheme();
  // The category still being *rendered*, which lags `category` by one exit animation: picking a
  // tool nulls the prop immediately, and unmounting right then would cut the slide-down off
  // before its first frame. Only ever null while the sheet is genuinely off screen.
  const [shown, setShown] = useState(category);
  const closing = category === null && shown !== null;

  useEffect(() => {
    if (category !== null) {
      setShown(category);
      return;
    }
    if (shown === null) return;
    // The real unmount signal is the sheet's own `animationend` below; this only covers an
    // environment where no animation ever runs (a test renderer, a browser with animations off at
    // the engine level), which would otherwise strand the sheet on screen forever. Comfortably
    // longer than the 260ms slide so it never fires first on a normal device.
    const timer = window.setTimeout(() => setShown(null), 500);
    return () => window.clearTimeout(timer);
  }, [category, shown]);

  useEffect(() => {
    if (category === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [category, onClose]);

  if (shown === null) return null;

  return createPortal(
    // Re-applies the theme's own custom properties past the portal boundary, same as Modal — they
    // are inherited CSS, and a portal moves this subtree out from under whatever themed ancestor
    // was supplying them (React context crosses a portal, the cascade doesn't).
    <LqThemeProvider palette={theme.palette} surface={theme.surface} font={theme.font} style={{ display: "contents" }}>
      <div
        className={["lq-chart__tool-sheet-overlay", closing && "lq-chart__tool-sheet-overlay--closing"].filter(Boolean).join(" ")}
        onClick={onClose}
      >
        <div
          className={["lq-chart__tool-sheet", closing && "lq-chart__tool-sheet--closing"].filter(Boolean).join(" ")}
          role="dialog"
          aria-modal="true"
          aria-label={shown.label}
          onClick={(e) => e.stopPropagation()}
          // Fires for the opening slide too, hence the guard — only the closing one ends with
          // nothing left to show.
          onAnimationEnd={() => {
            if (closing) setShown(null);
          }}
        >
          <div className="lq-chart__tool-sheet-grabber" aria-hidden="true" />
          <div className="lq-chart__tool-sheet-header">{shown.label}</div>
          <div className="lq-chart__tool-sheet-list">
            {shown.tools.map((opt, i) => {
              const OptionIcon = opt.icon;
              // Same subgroup rule as the desktop menu (see ToolsRail) — only "lines" tags its
              // own tools today, so this never fires for any other category.
              const previousSubgroup = i > 0 ? shown.tools[i - 1].subgroup : undefined;
              const showDivider = i > 0 && opt.subgroup !== previousSubgroup;
              return (
                <Fragment key={opt.type}>
                  {showDivider && <div className="lq-chart__tool-sheet-divider" aria-hidden="true" />}
                  <div className="lq-chart__tool-sheet-row">
                    <button
                      type="button"
                      className={["lq-chart__tool-sheet-option", opt.type === selectedType && "lq-chart__tool-sheet-option--selected"]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => onSelect(opt.type)}
                    >
                      <OptionIcon size={18} />
                      {opt.label}
                    </button>
                    {/* Kept from the desktop menu rather than dropped as clutter: the chevron that
                        used to lead to tool info is hidden on this layout (see
                        .lq-chart__tools-rail--horizontal's own rules), so this row is the only
                        remaining way to reach it on a phone. */}
                    <button
                      type="button"
                      className="lq-chart__tool-sheet-info"
                      onClick={() => onOpenToolInfo(opt.type)}
                      aria-label={`À propos de ${opt.label}`}
                    >
                      <InfoIcon size={16} />
                    </button>
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </LqThemeProvider>,
    document.body
  );
}
