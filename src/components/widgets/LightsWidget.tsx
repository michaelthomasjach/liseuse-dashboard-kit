import type { ReactNode } from "react";
import { Panel } from "../primitives/Panel";
import { ControlList, ControlListRow, type ControlListEntry } from "./internal/ControlRow";

export type LightEntry = ControlListEntry;

export interface LightsWidgetProps {
  title?: ReactNode;
  meta?: ReactNode;
  lights: LightEntry[];
  className?: string;
}

/** "LUMIÈRES" panel: one row per light with a toggle, a brightness gauge, and a status word.
 *  Give an entry an `onClick` to open a detail view (see `LightDetailModal`) when its row is tapped. */
export function LightsWidget({ title = "Lumières", meta, lights, className }: LightsWidgetProps) {
  return (
    <Panel title={title} meta={meta} className={className}>
      <ControlList>
        {lights.map((entry) => (
          <ControlListRow key={entry.id} entry={entry} />
        ))}
      </ControlList>
    </Panel>
  );
}
