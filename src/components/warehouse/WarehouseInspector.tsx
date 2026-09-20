import type { RefObject } from "react";
import { Popover } from "../forms/Popover";
import { NumberField } from "../forms/NumberField";
import { TextField } from "../forms/TextField";
import { RefreshIcon, TrashIcon } from "../icons";
import { WAREHOUSE_KINDS, clampSlots, rotateItem, type WarehouseItem } from "./warehouseModel";

export interface WarehouseInspectorProps {
  item: WarehouseItem;
  /** The element the panel hangs off — the item's own box on the plan. */
  anchorRef: RefObject<HTMLElement | null>;
  onChange: (item: WarehouseItem) => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * The panel that opens on the item you just clicked: turn it, resize it, say how many racks and
 * shelves it holds, rename it, delete it.
 *
 * Built on this library's own `Popover`, the same engine behind `Select`, `DatePicker` and the
 * chart's own floating panels — so it flips above the item when there is no room below, shifts
 * sideways at the edge of the screen, closes on Escape or an outside click, and carries the active
 * theme through the portal. Re-deriving any of that here would have been a second, worse copy.
 *
 * Every control commits on the spot. There is no "Apply": the item is right there behind the
 * panel, so a change you cannot see until you confirm it is a change you have to guess at.
 */
export function WarehouseInspector({ item, anchorRef, onChange, onDelete, onClose }: WarehouseInspectorProps) {
  const preset = WAREHOUSE_KINDS[item.kind];

  /** Resizing has to take the slots with it: a rack made shorter otherwise keeps stock addressed
   *  to bays it no longer has, and `clampSlots` is what drops those rather than drawing them
   *  outside their own rack. */
  const patch = (next: Partial<WarehouseItem>) => {
    const merged = { ...item, ...next };
    onChange(merged.slots ? { ...merged, slots: clampSlots(merged) } : merged);
  };

  const size = (value: number | "") => (value === "" ? 1 : Math.max(1, Math.round(value)));

  return (
    <Popover open onClose={onClose} anchorRef={anchorRef} placement="bottom" className="lq-wh__inspector">
      <div className="lq-wh__inspector-head">
        <span className="lq-wh__inspector-kind">{preset.label}</span>
        <div className="lq-wh__inspector-actions">
          <button
            type="button"
            className="lq-wh__inspector-icon"
            title="Pivoter d'un quart de tour"
            aria-label="Pivoter"
            onClick={() => onChange(rotateItem(item))}
          >
            <RefreshIcon size={14} />
            <span className="lq-wh__inspector-rotation">{item.rotation ?? 0}°</span>
          </button>
          <button
            type="button"
            className="lq-wh__inspector-icon lq-wh__inspector-icon--danger"
            title="Supprimer"
            aria-label="Supprimer"
            onClick={onDelete}
          >
            <TrashIcon size={14} />
          </button>
        </div>
      </div>

      <TextField
        size="small"
        label="Libellé"
        value={item.label ?? ""}
        onChange={(event) => patch({ label: event.target.value })}
      />

      <div className="lq-wh__inspector-row">
        {/* "Longueur" and "Largeur" rather than width/height: these are the item's own sides, and
            once it is turned a quarter, its length is the plan's vertical. Calling them width and
            height would make the panel disagree with the screen every other rotation. */}
        <NumberField
          size="small"
          label="Longueur"
          min={1}
          step={1}
          suffix="c"
          value={item.width}
          onChange={(value) => patch({ width: size(value), bays: item.bays === undefined ? undefined : size(value) })}
        />
        <NumberField
          size="small"
          label="Largeur"
          min={1}
          step={1}
          suffix="c"
          value={item.height}
          onChange={(value) => patch({ height: size(value) })}
        />
      </div>

      {preset.storage && (
        <div className="lq-wh__inspector-row">
          <NumberField
            size="small"
            label="Racks"
            min={1}
            step={1}
            value={item.bays ?? 1}
            // Bays and length move together: a rack twice as long with the same number of bays is
            // a drawing of nothing real, and so is one whose bays outnumber the cells it covers.
            onChange={(value) => patch({ bays: size(value), width: size(value) })}
          />
          <NumberField
            size="small"
            label="Niveaux"
            min={1}
            step={1}
            value={item.levels ?? 1}
            onChange={(value) => patch({ levels: size(value) })}
          />
        </div>
      )}

      <p className="lq-wh__inspector-hint">
        {preset.storage
          ? `${(item.bays ?? 0) * (item.levels ?? 0)} emplacements · ${clampSlots(item).filter((s) => s.status === "occupied").length} occupés`
          : `${item.width} × ${item.height} cases`}
      </p>
    </Popover>
  );
}
