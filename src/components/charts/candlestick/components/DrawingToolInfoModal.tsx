import { Modal } from "../../../primitives/Modal";
import type { DrawingToolType } from "../interfaces/DrawingToolType.interface";
import { toolMetaForType } from "../drawingCatalog";
import { DRAWING_TOOL_DESCRIPTIONS } from "../drawingDescriptions";
import { DRAWING_DIAGRAMS } from "../diagrams/drawingDiagramRegistry";

export interface DrawingToolInfoModalProps {
  infoTool: DrawingToolType | null;
  setInfoTool: (tool: DrawingToolType | null) => void;
}

/** The drawing-tool equivalent of IndicatorModals' own `infoKind` modal — opened from each tool
 *  menu row's own info icon (see ToolsRail.tsx) instead of the indicator picker's. Kept as its own
 *  small component rather than folded into IndicatorModals.tsx (already at its own 1000-line
 *  budget) or ChartModals.tsx (a pure aggregator, not meant to carry real content of its own). */
export function DrawingToolInfoModal({ infoTool, setInfoTool }: DrawingToolInfoModalProps) {
  if (!infoTool) return null;
  const { label } = toolMetaForType(infoTool);
  const description = DRAWING_TOOL_DESCRIPTIONS[infoTool];
  const Diagram = DRAWING_DIAGRAMS[infoTool];
  return (
    <Modal open onClose={() => setInfoTool(null)} title={label}>
      {Diagram && <Diagram />}
      {description && <p className="lq-chart__indicator-info-text">{description}</p>}
    </Modal>
  );
}
