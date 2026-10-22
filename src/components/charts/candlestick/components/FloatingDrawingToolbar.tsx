import { useRef, useState } from "react";
import type { RefObject } from "react";
import { Popover } from "../../../forms/Popover";
import { GripIcon, PencilIcon, TextIcon, HorizontalLineIcon, AlarmClockIcon, TrashIcon, LockIcon, UnlockIcon } from "../../../icons";

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
  /** The selected drawing is locked (can't be dragged by its body or its handles). */
  locked?: boolean;
  /** Locks / unlocks the selected drawing. Like `onDelete`, only passed while a drawing is selected. */
  onToggleLock?: () => void;
  /** Verrou d'angle (0°, 45°, 90°) pour tracer et déplacer les points — l'équivalent de Maj, pour le
   *  doigt qui n'a pas de touche Maj. Le bouton n'apparaît que si `onToggleAngleLock` est passé. */
  angleLock?: boolean;
  onToggleAngleLock?: () => void;
  /** Étiquette d'unité de temps du dessin sélectionné (« 1 semaine ») et si elle est affichée ;
   *  absente si le dessin n'en a pas. */
  timeframeLabel?: { text: string; shown: boolean };
  onToggleTimeframeLabel?: () => void;
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
  locked,
  onToggleLock,
  angleLock,
  onToggleAngleLock,
  timeframeLabel,
  onToggleTimeframeLabel,
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
      {onToggleAngleLock && (
        <button
          type="button"
          className={["lq-chart__icon-button", "lq-chart__floating-toolbar-text", angleLock && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
          onClick={onToggleAngleLock}
          aria-pressed={angleLock ?? false}
          aria-label={angleLock ? "Débloquer l'angle du tracé" : "Bloquer l'angle du tracé à 0°, 45° ou 90°"}
          title={angleLock ? "Angle libre (le verrou est actif : 0°, 45°, 90°)" : "Bloquer l'angle à 0°, 45° ou 90° (comme Maj maintenue)"}
        >
          45°
        </button>
      )}
      {timeframeLabel && onToggleTimeframeLabel && (
        <button
          type="button"
          className={["lq-chart__icon-button", "lq-chart__floating-toolbar-text", timeframeLabel.shown && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
          onClick={onToggleTimeframeLabel}
          aria-pressed={timeframeLabel.shown}
          aria-label={timeframeLabel.shown ? `Masquer l'étiquette « ${timeframeLabel.text} »` : `Afficher l'étiquette « ${timeframeLabel.text} »`}
          title={timeframeLabel.shown ? `Tracé en ${timeframeLabel.text} — masquer l'étiquette` : `Tracé en ${timeframeLabel.text} — afficher l'étiquette`}
        >
          {timeframeLabel.text}
        </button>
      )}
      <button
        type="button"
        className={["lq-chart__icon-button", hasAlert && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
        onClick={onOpenAlert}
        aria-pressed={hasAlert}
        aria-label={hasAlert ? "Alertes sur ce dessin" : "Créer une alerte"}
        title={hasAlert ? "Alertes sur ce dessin" : "Créer une alerte"}
      >
        <AlarmClockIcon size={14} />
      </button>
      {/* Last, and after its own divider: destructive, so kept apart from the styling controls it
          would otherwise sit among, and at the far end where a thumb reaching for the bell won't
          land on it by a few pixels. Same action the Delete key already performs on a hovered
          drawing — this is that action for a finger, which has no Delete key. */}
      {onToggleLock && (
        <>
          <span className="lq-chart__floating-toolbar-divider" aria-hidden="true" />
          <button
            type="button"
            className={["lq-chart__icon-button", locked && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
            onClick={onToggleLock}
            aria-pressed={locked ?? false}
            aria-label={locked ? "Déverrouiller ce dessin" : "Verrouiller ce dessin"}
            title={locked ? "Déverrouiller ce dessin (il pourra de nouveau être déplacé)" : "Verrouiller ce dessin (il ne pourra plus être déplacé par erreur)"}
          >
            {locked ? <LockIcon size={14} /> : <UnlockIcon size={14} />}
          </button>
        </>
      )}
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
