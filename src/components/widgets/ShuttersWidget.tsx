import type { ReactNode } from "react";
import { Panel } from "../primitives/Panel";
import { ControlList, ControlListRow, type ControlListEntry } from "./internal/ControlRow";

export type ShutterEntry = ControlListEntry;

export interface ShuttersWidgetProps {
  title?: ReactNode;
  meta?: ReactNode;
  shutters: ShutterEntry[];
  className?: string;
}

/** "VOLETS" panel: one row per shutter with a toggle, an aperture gauge, and a status word. */
export function ShuttersWidget({ title = "Volets", meta, shutters, className }: ShuttersWidgetProps) {
  return (
    <Panel title={title} meta={meta} className={className}>
      <ControlList>
        {shutters.map((entry) => (
          <ControlListRow key={entry.id} entry={entry} />
        ))}
      </ControlList>
    </Panel>
  );
}
