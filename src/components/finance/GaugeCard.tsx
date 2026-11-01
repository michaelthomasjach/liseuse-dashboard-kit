import type { ReactNode } from "react";
import { Panel } from "../primitives/Panel";
import { GaugeChart, type GaugeThreshold } from "../charts/GaugeChart";
import "./GaugeCard.css";

export interface GaugeCardProps {
  title: ReactNode;
  meta?: ReactNode;
  description?: ReactNode;
  value: number;
  min?: number;
  max?: number;
  formatValue?: (value: number) => string;
  thresholds?: GaugeThreshold[];
  /** Prints each threshold band's label around the arc — passed on to `GaugeChart` (it used to be
   *  dropped here). Default false. */
  showBandLabels?: boolean;
  className?: string;
}

/** A `GaugeChart` inside a titled card — risk score, goal progress, allocation drift. */
export function GaugeCard({ title, meta, description, value, min, max, formatValue, thresholds, showBandLabels, className }: GaugeCardProps) {
  return (
    <Panel title={title} meta={meta} className={className}>
      <div className="lq-gauge-card__body">
        <GaugeChart value={value} min={min} max={max} formatValue={formatValue} thresholds={thresholds} showBandLabels={showBandLabels} size={180} />
        {description && <p className="lq-gauge-card__description">{description}</p>}
      </div>
    </Panel>
  );
}
