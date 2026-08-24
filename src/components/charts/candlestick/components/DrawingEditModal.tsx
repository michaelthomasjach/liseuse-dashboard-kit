import { Modal } from "../../../primitives/Modal";
import { Tabs } from "../../../primitives/Tabs";
import { TextField } from "../../../forms/TextField";
import { NumberField } from "../../../forms/NumberField";
import { Checkbox } from "../../../forms/Checkbox";
import { Select } from "../../../forms/Select";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import type { DataPoint } from "../interfaces/DataPoint.interface";
import type { DrawingToolType } from "../interfaces/DrawingToolType.interface";
import { drawingLabel, MULTI_POINT_TOOLS } from "../drawingCatalog";
import { allPointsOf, round4, effectiveExtendOf } from "../drawingGeometry";
import { contrastingTextColor, toDateInputValue, fromDateInputValue } from "../formatting";
import { CHART_DISPLAY_MODES } from "../chartModes";
import { TABLE_DEFAULT_ROWS, TABLE_DEFAULT_COLS } from "../constants";

// Same catalog the main chart's own display-mode menu offers (see ChartHeader).
const OVERLAY_DISPLAY_MODE_OPTIONS = CHART_DISPLAY_MODES.map((m) => ({ value: m.mode, label: m.label }));

export interface DrawingEditModalProps {
  draft: TrendLineDrawing | null;
  setDraft: (d: TrendLineDrawing) => void;
  editModalTab: "coords" | "text" | "style";
  setEditModalTab: (tab: "coords" | "text" | "style") => void;
  closeEditModal: () => void;
  saveEditModal: () => void;
  deleteEditingDrawing: () => void;
  duplicateEditingDrawing: () => void;
  valueAxisLabel: (valueAxis: string | undefined) => string;
  /** The same theme-accent color a drawing with no explicit `color` actually renders in on
   *  canvas (see useDefaultDrawingColor) — seeds the color pickers below so they show what's
   *  really drawn instead of a color that only matches one particular theme. */
  defaultColor: string;
}

/** The "Modifier la ligne" / "Paramètres — <symbol>" modal opened by double-clicking a drawing —
 *  three tabs (Coordonnées/Texte/Style, or Style alone for a symbolOverlay, which has no
 *  meaningful coordinates or text label of its own). Purely a `draft` editor: every field reads
 *  and writes `draft` directly, nothing here touches `drawings` itself until `saveEditModal`. */
export function DrawingEditModal({
  draft,
  setDraft,
  editModalTab,
  setEditModalTab,
  closeEditModal,
  saveEditModal,
  deleteEditingDrawing,
  duplicateEditingDrawing,
  valueAxisLabel,
  defaultColor,
}: DrawingEditModalProps) {
  if (!draft) return null;
  // Every overlayDisplayMode besides "line" needs open/high/low on every point — a plain
  // close-only overlay (see OverlayDataPoint's own doc) has nothing a candle body or brick could
  // be drawn from, so the Style tab's own selector collapses to just "Ligne" then.
  const hasOverlayOHLC =
    (draft.overlayData?.length ?? 0) > 0 && draft.overlayData!.every((p) => p.open !== undefined && p.high !== undefined && p.low !== undefined);
  return (
    <Modal
      open
      onClose={closeEditModal}
      title={draft.lineType === "symbolOverlay" ? `Paramètres — ${drawingLabel(draft)}` : "Modifier la ligne"}
      footer={
        <div className="lq-chart__edit-drawing-footer">
          <button type="button" className="lq-chart__reset-button" onClick={deleteEditingDrawing}>
            Supprimer
          </button>
          {/* Touch's own reachable equivalent of Ctrl/Cmd+C→Ctrl/Cmd+V (see
              duplicateEditingDrawing's own doc) — there's no keyboard shortcut to reach from a
              touch device, and this modal already is one (opened via double-tap). */}
          <button type="button" className="lq-chart__reset-button" onClick={duplicateEditingDrawing}>
            Dupliquer
          </button>
          <button type="button" className="lq-chart__confirm-button" onClick={saveEditModal}>
            Enregistrer
          </button>
        </div>
      }
    >
      {/* Coordonnées/Texte don't apply to a symbolOverlay — x1/y1/x2/y2 aren't real
          coordinates for it (see the lineType's own doc comment) and there's no text label to
          speak of, only Style (thickness/color/line style, plus its own "Visible" toggle)
          does anything — so it skips the tab bar entirely rather than showing two tabs with
          nothing in them. */}
      {draft.lineType !== "symbolOverlay" && (
        <Tabs
          items={[
            { id: "coords", label: "Coordonnées" },
            { id: "text", label: "Texte" },
            { id: "style", label: "Style" },
          ]}
          value={editModalTab}
          onChange={(id) => setEditModalTab(id as "coords" | "text" | "style")}
          className="lq-chart__edit-drawing-tabs"
        />
      )}

      {editModalTab === "coords" && draft.lineType !== "symbolOverlay" && (
        <>
          {/* A horizontal/vertical line only has one degree of freedom (see the single drag
              handle above) — editing its two endpoints independently here would let them
              drift apart and break that invariant, so it gets one field instead of the usual
              two. */}
          {draft.lineType === "horizontal" && (
            <NumberField
              label={valueAxisLabel(draft.valueAxis)}
              step={0.01}
              value={draft.y1}
              onChange={(v) => setDraft({ ...draft, y1: v === "" ? draft.y1 : round4(v), y2: v === "" ? draft.y2 : round4(v) })}
            />
          )}
          {draft.lineType === "vertical" && (
            <div className="lq-field">
              <label className="lq-field__label">Date</label>
              <input
                type="date"
                className="lq-chart__date-input"
                value={toDateInputValue(draft.x1)}
                onChange={(e) => {
                  const next = fromDateInputValue(e.target.value, draft.x1);
                  setDraft({ ...draft, x1: next, x2: next });
                }}
              />
            </div>
          )}
          {/* A ray keeps both its degrees of freedom (unlike horizontal/vertical), so it gets
              both fields — still just one of each, since x2/y2 always mirror x1/y1. Arrow
              markers share this same one-point editor (never a volume value — they're always
              price-anchored). */}
          {(draft.lineType === "ray" || draft.lineType === "arrowUp" || draft.lineType === "arrowDown") && (
            <div className="lq-chart__edit-drawing-row">
              <div className="lq-field">
                <label className="lq-field__label">Date</label>
                <input
                  type="date"
                  className="lq-chart__date-input"
                  value={toDateInputValue(draft.x1)}
                  onChange={(e) => {
                    const next = fromDateInputValue(e.target.value, draft.x1);
                    setDraft({ ...draft, x1: next, x2: next });
                  }}
                />
              </div>
              <NumberField
                label={valueAxisLabel(draft.valueAxis)}
                step={0.01}
                value={draft.y1}
                onChange={(v) => setDraft({ ...draft, y1: v === "" ? draft.y1 : round4(v), y2: v === "" ? draft.y2 : round4(v) })}
              />
            </div>
          )}
          {/* Regular trend line, "extended" (same two points, just drawn further — see the
              canvas draw effect), "channel" (line 1's own two points; its second, parallel
              line is set by the "Décalage" field below instead of its own coordinates),
              "fibonacci" (its retracement levels are all derived from these same two points,
              0% at "Prix début" and 100% at "Prix fin") and "rectangle"/"zones" (opposite
              corners) all share the same two-point editor. */}
          {(!draft.lineType ||
            draft.lineType === "extended" ||
            draft.lineType === "channel" ||
            draft.lineType === "fibonacci" ||
            draft.lineType === "rectangle" ||
            draft.lineType === "zones") && (
            <>
              <div className="lq-chart__edit-drawing-row">
                <div className="lq-field">
                  <label className="lq-field__label">Début</label>
                  <input
                    type="date"
                    className="lq-chart__date-input"
                    value={toDateInputValue(draft.x1)}
                    onChange={(e) => setDraft({ ...draft, x1: fromDateInputValue(e.target.value, draft.x1) })}
                  />
                </div>
                <NumberField
                  label="Prix début"
                  step={0.01}
                  value={draft.y1}
                  onChange={(v) => setDraft({ ...draft, y1: v === "" ? draft.y1 : round4(v) })}
                />
              </div>
              <div className="lq-chart__edit-drawing-row">
                <div className="lq-field">
                  <label className="lq-field__label">Fin</label>
                  <input
                    type="date"
                    className="lq-chart__date-input"
                    value={toDateInputValue(draft.x2)}
                    onChange={(e) => setDraft({ ...draft, x2: fromDateInputValue(e.target.value, draft.x2) })}
                  />
                </div>
                <NumberField
                  label="Prix fin"
                  step={0.01}
                  value={draft.y2}
                  onChange={(v) => setDraft({ ...draft, y2: v === "" ? draft.y2 : round4(v) })}
                />
              </div>
            </>
          )}
          {draft.lineType === "channel" && (
            <NumberField
              label="Décalage (ligne 2)"
              step={0.01}
              value={draft.channelOffset ?? 0}
              onChange={(v) => setDraft({ ...draft, channelOffset: v === "" ? draft.channelOffset : round4(v) })}
            />
          )}
          {/* "disjointChannel"/"fibonacciExtension"/"elliottCorrection"/"elliottImpulse" — a
              date+price row per point (x1/y1, x2/y2, then extraPoints), generic over however
              many that tool needs instead of a fixed "Début"/"Fin" pair. */}
          {draft.lineType &&
            MULTI_POINT_TOOLS[draft.lineType as DrawingToolType]?.labels.map((label, i) => {
              const point = i === 0 ? { x: draft.x1, y: draft.y1 } : i === 1 ? { x: draft.x2, y: draft.y2 } : draft.extraPoints?.[i - 2];
              if (!point) return null;
              const setPointField = (next: Partial<DataPoint>) => {
                if (i === 0) {
                  setDraft({ ...draft, x1: next.x ?? draft.x1, y1: next.y ?? draft.y1 });
                } else if (i === 1) {
                  setDraft({ ...draft, x2: next.x ?? draft.x2, y2: next.y ?? draft.y2 });
                } else {
                  const extra = [...(draft.extraPoints ?? [])];
                  extra[i - 2] = { ...extra[i - 2], ...next };
                  setDraft({ ...draft, extraPoints: extra });
                }
              };
              return (
                <div className="lq-chart__edit-drawing-row" key={i}>
                  <div className="lq-field">
                    <label className="lq-field__label">{label}</label>
                    <input
                      type="date"
                      className="lq-chart__date-input"
                      value={toDateInputValue(point.x)}
                      onChange={(e) => setPointField({ x: fromDateInputValue(e.target.value, point.x) })}
                    />
                  </div>
                  <NumberField
                    label={`Prix (${label})`}
                    step={0.01}
                    value={point.y}
                    onChange={(v) => v !== "" && setPointField({ y: round4(v) })}
                  />
                </div>
              );
            })}
          {/* "elbowArrow" — same date+price-row-per-point idea as the generic multi-point
              block above, but over allPointsOf directly (numbered "Point N") instead of
              MULTI_POINT_TOOLS' fixed labels array, since it can have any number of points
              depending on how many clicks it took before Escape finalized it. */}
          {draft.lineType === "elbowArrow" &&
            allPointsOf(draft).map((point, i) => {
              const setPointField = (next: Partial<DataPoint>) => {
                if (i === 0) {
                  setDraft({ ...draft, x1: next.x ?? draft.x1, y1: next.y ?? draft.y1 });
                } else if (i === 1) {
                  setDraft({ ...draft, x2: next.x ?? draft.x2, y2: next.y ?? draft.y2 });
                } else {
                  const extra = [...(draft.extraPoints ?? [])];
                  extra[i - 2] = { ...extra[i - 2], ...next };
                  setDraft({ ...draft, extraPoints: extra });
                }
              };
              const label = `Point ${i + 1}`;
              return (
                <div className="lq-chart__edit-drawing-row" key={i}>
                  <div className="lq-field">
                    <label className="lq-field__label">{label}</label>
                    <input
                      type="date"
                      className="lq-chart__date-input"
                      value={toDateInputValue(point.x)}
                      onChange={(e) => setPointField({ x: fromDateInputValue(e.target.value, point.x) })}
                    />
                  </div>
                  <NumberField
                    label={`Prix (${label})`}
                    step={0.01}
                    value={point.y}
                    onChange={(v) => v !== "" && setPointField({ y: round4(v) })}
                  />
                </div>
              );
            })}
        </>
      )}

      {editModalTab === "text" && draft.lineType !== "symbolOverlay" && (
        <>
          <TextField
            label="Texte"
            placeholder="Étiquette (optionnel)"
            value={draft.text ?? ""}
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          />
          <Checkbox
            checked={draft.textAlignWithLine ?? false}
            onChange={(textAlignWithLine) => setDraft({ ...draft, textAlignWithLine })}
            label="Aligner le texte avec la ligne"
          />
          <div className="lq-chart__edit-drawing-row">
            <NumberField
              label="Taille du texte"
              min={8}
              max={48}
              step={1}
              value={draft.textSize ?? 11}
              onChange={(v) => setDraft({ ...draft, textSize: v === "" ? 11 : v })}
            />
            <div className="lq-field">
              <label className="lq-field__label">Couleur du texte</label>
              <input
                type="color"
                className="lq-chart__color-input"
                value={draft.textColor ?? draft.color ?? defaultColor}
                onChange={(e) => setDraft({ ...draft, textColor: e.target.value })}
              />
            </div>
          </div>
          <div className="lq-field">
            <label className="lq-field__label">Couleur de fond</label>
            <input
              type="color"
              className="lq-chart__color-input"
              value={draft.textBackgroundColor ?? "#000000"}
              // Auto-picks a contrasting text color every time the background changes, so the
              // label never accidentally lands on an unreadable pairing — still overridable by
              // hand afterward via "Couleur du texte" above, which this doesn't touch again
              // unless the background itself changes once more.
              onChange={(e) => setDraft({ ...draft, textBackgroundColor: e.target.value, textColor: contrastingTextColor(e.target.value) })}
            />
          </div>
          {draft.textBackgroundColor && (
            <button
              type="button"
              className="lq-chart__text-bg-clear"
              onClick={() => setDraft({ ...draft, textBackgroundColor: undefined })}
            >
              Retirer la couleur de fond
            </button>
          )}
          <div className="lq-chart__edit-drawing-row">
            <Checkbox checked={draft.textBold ?? true} onChange={(textBold) => setDraft({ ...draft, textBold })} label="Gras" />
            <Checkbox checked={draft.textItalic ?? false} onChange={(textItalic) => setDraft({ ...draft, textItalic })} label="Italique" />
          </div>
          <div className="lq-chart__edit-drawing-row">
            <Select
              label="Alignement vertical"
              value={draft.textVerticalAlign ?? "top"}
              onChange={(v) => setDraft({ ...draft, textVerticalAlign: v })}
              options={[
                { value: "top", label: "Haut" },
                { value: "center", label: "Centre" },
                { value: "bottom", label: "Bas" },
              ]}
            />
            <Select
              label="Alignement horizontal"
              value={draft.textHorizontalAlign ?? "center"}
              onChange={(v) => setDraft({ ...draft, textHorizontalAlign: v })}
              options={[
                { value: "left", label: "Gauche" },
                { value: "center", label: "Centre" },
                { value: "right", label: "Droite" },
              ]}
            />
          </div>
        </>
      )}

      {editModalTab === "style" && (
        <>
          <div className="lq-chart__edit-drawing-row">
            <NumberField
              label="Épaisseur"
              min={1}
              max={8}
              step={0.5}
              value={draft.strokeWidth ?? 1.5}
              onChange={(v) => setDraft({ ...draft, strokeWidth: v === "" ? 1.5 : v })}
            />
            <div className="lq-field">
              <label className="lq-field__label">Couleur</label>
              <input
                type="color"
                className="lq-chart__color-input"
                value={draft.color ?? defaultColor}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              />
            </div>
          </div>
          <Select
            label="Style de trait"
            value={draft.lineStyle ?? (draft.dashed ? "dashed" : "solid")}
            onChange={(v) => setDraft({ ...draft, lineStyle: v, dashed: undefined })}
            options={[
              { value: "solid", label: "Continu" },
              { value: "dashed", label: "Tirets" },
              { value: "dotted", label: "Pointillés" },
              { value: "dashdot", label: "Tiret-point" },
            ]}
          />
          {/* "extend" only applies to a plain 2-point line — the other line types (channel,
              fibonacci, elliott, disjoint channel, horizontal/ray/vertical) each draw
              themselves with their own fixed geometry and don't read this field (see the
              canvas draw effect's per-lineType branches vs. its generic fallback). */}
          {(!draft.lineType || draft.lineType === "extended") && (
            <Select
              label="Extension"
              value={effectiveExtendOf(draft)}
              onChange={(v) => setDraft({ ...draft, extend: v, lineType: draft.lineType === "extended" ? undefined : draft.lineType })}
              options={[
                { value: "none", label: "Ne pas étendre" },
                { value: "right", label: "Étendre à droite" },
                { value: "left", label: "Étendre à gauche" },
                { value: "both", label: "Étendre des deux côtés" },
              ]}
            />
          )}
          {/* Arrowheads only make sense on a line that actually stops somewhere — offered
              only once "Extension" above is set to "Ne pas étendre" (an infinitely-extended
              end has nothing to put an arrowhead on). "Gauche"/"Droite" are screen positions
              (see arrowLeft/arrowRight's own doc), not tied to which point is x1 vs x2. */}
          {(!draft.lineType || draft.lineType === "extended") && effectiveExtendOf(draft) === "none" && (
            <div className="lq-chart__edit-drawing-row">
              <Checkbox checked={draft.arrowLeft ?? false} onChange={(arrowLeft) => setDraft({ ...draft, arrowLeft })} label="Flèche à gauche" />
              <Checkbox checked={draft.arrowRight ?? false} onChange={(arrowRight) => setDraft({ ...draft, arrowRight })} label="Flèche à droite" />
            </div>
          )}
          {draft.lineType === "zones" && (
            <>
              <Checkbox
                checked={draft.showZoneSides ?? false}
                onChange={(showZoneSides) => setDraft({ ...draft, showZoneSides })}
                label="Afficher les bords verticaux"
              />
              <div className="lq-chart__edit-drawing-row">
                <div className="lq-field">
                  <label className="lq-field__label">Zone positive</label>
                  <input
                    type="color"
                    className="lq-chart__color-input"
                    value={draft.positiveColor ?? "#26a69a"}
                    onChange={(e) => setDraft({ ...draft, positiveColor: e.target.value })}
                  />
                </div>
                <div className="lq-field">
                  <label className="lq-field__label">Zone neutre</label>
                  <input
                    type="color"
                    className="lq-chart__color-input"
                    value={draft.neutralColor ?? "#9e9e9e"}
                    onChange={(e) => setDraft({ ...draft, neutralColor: e.target.value })}
                  />
                </div>
                <div className="lq-field">
                  <label className="lq-field__label">Zone négative</label>
                  <input
                    type="color"
                    className="lq-chart__color-input"
                    value={draft.negativeColor ?? "#ef5350"}
                    onChange={(e) => setDraft({ ...draft, negativeColor: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}
          {/* Every pitchfork variant: independent show/hide for each of the 3 parallel lines
              (the dashed median plus its own two tines — see pitchforkGeometry.ts's own
              PitchforkLines), not the A-B/tine-anchor-pair construction segments alongside them,
              which always draw. */}
          {(draft.lineType === "pitchfork" ||
            draft.lineType === "schiffPitchfork" ||
            draft.lineType === "modifiedSchiffPitchfork" ||
            draft.lineType === "insidePitchfork") && (
            <div className="lq-chart__edit-drawing-row">
              <Checkbox
                checked={draft.pitchforkShowMedian ?? true}
                onChange={(pitchforkShowMedian) => setDraft({ ...draft, pitchforkShowMedian })}
                label="Médiane"
              />
              <Checkbox
                checked={draft.pitchforkShowTine1 ?? true}
                onChange={(pitchforkShowTine1) => setDraft({ ...draft, pitchforkShowTine1 })}
                label="Ligne 1"
              />
              <Checkbox
                checked={draft.pitchforkShowTine2 ?? true}
                onChange={(pitchforkShowTine2) => setDraft({ ...draft, pitchforkShowTine2 })}
                label="Ligne 2"
              />
            </div>
          )}
          {draft.lineType === "table" && (
            <div className="lq-chart__edit-drawing-row">
              <NumberField
                label="Lignes"
                min={1}
                max={20}
                step={1}
                value={draft.tableRows ?? TABLE_DEFAULT_ROWS}
                onChange={(v) => setDraft({ ...draft, tableRows: v === "" ? TABLE_DEFAULT_ROWS : v })}
              />
              <NumberField
                label="Colonnes"
                min={1}
                max={20}
                step={1}
                value={draft.tableCols ?? TABLE_DEFAULT_COLS}
                onChange={(v) => setDraft({ ...draft, tableCols: v === "" ? TABLE_DEFAULT_COLS : v })}
              />
            </div>
          )}
          {draft.lineType === "symbolOverlay" && (
            <>
              {hasOverlayOHLC && (
                <Select
                  label="Mode d'affichage"
                  value={draft.overlayDisplayMode ?? "line"}
                  onChange={(v) => setDraft({ ...draft, overlayDisplayMode: v })}
                  options={OVERLAY_DISPLAY_MODE_OPTIONS}
                />
              )}
              <Checkbox
                checked={!draft.hidden}
                onChange={(visible) => setDraft({ ...draft, hidden: !visible })}
                label="Visible"
              />
            </>
          )}
        </>
      )}
    </Modal>
  );
}
