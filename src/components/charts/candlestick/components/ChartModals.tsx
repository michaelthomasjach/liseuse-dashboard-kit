import { DrawingEditModal } from "./DrawingEditModal";
import type { DrawingEditModalProps } from "./DrawingEditModal";
import { IndicatorModals } from "./IndicatorModals";
import type { IndicatorModalsProps } from "./IndicatorModals";
import { ChartSettingsModals } from "./ChartSettingsModals";
import type { ChartSettingsModalsProps } from "./ChartSettingsModals";
import { SymbolSearchModal } from "./SymbolSearchModal";
import type { SymbolSearchModalProps } from "./SymbolSearchModal";
import { AlertCreateModal } from "./AlertCreateModal";
import type { AlertCreateModalProps } from "./AlertCreateModal";
import { AlertListModal } from "./AlertListModal";
import type { AlertListModalProps } from "./AlertListModal";
import { CorrelationSetupModal } from "./CorrelationSetupModal";
import type { CorrelationSetupModalProps } from "./CorrelationSetupModal";

export type ChartModalsProps = DrawingEditModalProps &
  IndicatorModalsProps &
  ChartSettingsModalsProps &
  SymbolSearchModalProps &
  AlertCreateModalProps &
  AlertListModalProps &
  CorrelationSetupModalProps;

/** Every modal `CandlestickChart` itself owns (drawing edit, indicator picker/manager/settings,
 *  chart/volume settings, symbol search, alert creation), grouped into one component purely to
 *  keep `CandlestickChart.tsx` under its own 1000-line cap — none of these already-independent
 *  modals actually share any state *through* this wrapper, it only exists so their (long,
 *  already-established) prop lists live in one place instead of inline in the main component. */
export function ChartModals(props: ChartModalsProps) {
  return (
    <>
      <DrawingEditModal {...props} />
      <IndicatorModals {...props} />
      <ChartSettingsModals {...props} />
      <SymbolSearchModal {...props} />
      <AlertCreateModal {...props} />
      <AlertListModal {...props} />
      <CorrelationSetupModal {...props} />
    </>
  );
}
