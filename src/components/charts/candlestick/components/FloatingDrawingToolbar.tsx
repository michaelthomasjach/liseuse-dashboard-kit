import { useRef, useState } from "react";
import type { RefObject } from "react";
import { Popover } from "../../../forms/Popover";
import { GripIcon, PencilIcon, TextIcon, HorizontalLineIcon, BellIcon, TrashIcon } from "../../../icons";

const STROKE_WIDTH_OPTIONS = [1, 2, 3, 4];

export interface FloatingDrawingToolbarProps {
  position: { x: number; y: number };
  toolbarRef: RefObject<HTMLDivElement>;
  startDrag: (e: React.PointerEvent) => void;
  /** false for the two tools with no persistent styled drawing of their own (measure/zoomIn) —
   *  the pencil/text/stroke-width sections simply don't apply to them, only the grip and bell do. */
  showStyleControls: boolean;
  color: string;
  textColor: string;
  strokeWidth: number;
  onColorChange: (color: string) => void;
  onTextColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onOpenAlert: () => void;
  /** Whether the current target (the selected drawing) already has at least one alert — shows
   *  the bell in its active state (see `.lq-chart__icon-button--active`) so it's clear at a
   *  glance the moment a drawing carrying one is selected, not just while hovering the bell. */
  hasAlert: boolean;
  /** Removes the selected drawing. Absent while the toolbar is up for an *armed tool* rather than
   *  a selected drawing — there is nothing to delete yet, and a trash button that did nothing
   *  would be worse than none — so the button renders only when this is passed. */
  onDelete?: () => void;
}

/** The small floating, draggable toolbar that appears the moment a drawing tool becomes active or
 *  an existing drawing is selected (see CandlestickChart's own selectedDrawingId/activeTool
 *  wiring) — a drag grip, line-color and text-color swatches, a stroke-width picker, and a bell
 *  that opens the alert-creation modal. Purely presentational, same as ToolsRail/PaneHeaders:
 *  every value and every change handler is a prop, the caller decides whether it's editing the
 *  selected drawing's own fields or the *next* drawing's default style. */
export function FloatingDrawingToolbar({
  position,
  toolbarRef,
  startDrag,
  showStyleControls,
  color,
  textColor,
  strokeWidth,
  onColorChange,
  onTextColorChange,
  onStrokeWidthChange,
  onOpenAlert,
  hasAlert,
  onDelete,
}: FloatingDrawingToolbarProps) {
  const [strokeMenuOpen, setStrokeMenuOpen] = useState(false);
  const strokeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div ref={toolbarRef} className="lq-chart__floating-toolbar" style={{ left: position.x, top: position.y }}>
      {/* 6 dots across 2 columns (GripIcon), at reduced opacity until hovered — press-and-hold
          drags the whole toolbar via useFloatingToolbarPosition.startDrag. */}
      <button type="button" className="lq-chart__floating-toolbar-grip" onPointerDown={startDrag} aria-label="Déplacer la barre d'outils" title="Glisser pour déplacer">
        <GripIcon size={14} />
      </button>
      {showStyleControls && (
        <>
          <div className="lq-chart__floating-toolbar-divider" aria-hidden="true" />
          {/* Each swatch's own color bar *is* a native color input (same convention
              DrawingEditModal's own Style tab already uses, just restyled as a thin bar under the
              icon instead of a full-width box) — clicking it opens the browser's own picker
              directly, no bespoke color-picker component needed. */}
          <label className="lq-chart__floating-toolbar-swatch" title="Couleur du trait">
            <PencilIcon size={14} />
            <input
              type="color"
              className="lq-chart__floating-toolbar-color-bar"
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
              aria-label="Couleur du trait"
            />
          </label>
          <label className="lq-chart__floating-toolbar-swatch" title="Couleur du texte">
            <TextIcon size={14} />
            <input
              type="color"
              className="lq-chart__floating-toolbar-color-bar"
              value={textColor}
              onChange={(e) => onTextColorChange(e.target.value)}
              aria-label="Couleur du texte"
            />
          </label>
          <div className="lq-chart__floating-toolbar-divider" aria-hidden="true" />
          <button
            ref={strokeButtonRef}
            type="button"
            className="lq-chart__icon-button"
            onClick={() => setStrokeMenuOpen((o) => !o)}
            aria-label="Épaisseur du trait"
            aria-pressed={strokeMenuOpen}
            title="Épaisseur du trait"
          >
            <HorizontalLineIcon size={14} />
            <span>{strokeWidth}px</span>
          </button>
          <Popover open={strokeMenuOpen} onClose={() => setStrokeMenuOpen(false)} anchorRef={strokeButtonRef} placement="bottom">
            <div className="lq-chart__tool-menu">
              {STROKE_WIDTH_OPTIONS.map((w) => (
                <button
                  key={w}
                  type="button"
                  className={["lq-chart__tool-menu-option", w === strokeWidth && "lq-chart__tool-menu-option--selected"].filter(Boolean).join(" ")}
                  onClick={() => {
                    onStrokeWidthChange(w);
                    setStrokeMenuOpen(false);
                  }}
                >
                  {w}px
                </button>
              ))}
            </div>
          </Popover>
          <div className="lq-chart__floating-toolbar-divider" aria-hidden="true" />
        </>
      )}
      <button
        type="button"
        className={["lq-chart__icon-button", hasAlert && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
        onClick={onOpenAlert}
        aria-pressed={hasAlert}
        aria-label={hasAlert ? "Alertes sur ce dessin" : "Créer une alerte"}
        title={hasAlert ? "Alertes sur ce dessin" : "Créer une alerte"}
      >
        <BellIcon size={14} />
      </button>
      {/* Last, and after its own divider: destructive, so kept apart from the styling controls it
          would otherwise sit among, and at the far end where a thumb reaching for the bell won't
          land on it by a few pixels. Same action the Delete key already performs on a hovered
          drawing — this is that action for a finger, which has no Delete key. */}
      {onDelete && (
        <>
          <span className="lq-chart__floating-toolbar-divider" aria-hidden="true" />
          <button type="button" className="lq-chart__icon-button" onClick={onDelete} aria-label="Supprimer ce dessin" title="Supprimer ce dessin">
            <TrashIcon size={14} />
          </button>
        </>
      )}
    </div>
  );
}
