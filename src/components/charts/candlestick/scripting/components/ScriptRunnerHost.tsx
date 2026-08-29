import type { Candle } from "../../interfaces/Candle.interface";
import type { Indicator } from "../../interfaces/Indicator.interface";
import type { FundamentalDataPoint } from "../../interfaces/FundamentalDataPoint.interface";
import type { ScriptDef } from "../../interfaces/ScriptDef.interface";
import type { ScriptAlertEvent } from "../../interfaces/ScriptAlertEvent.interface";
import type { ScriptRunOutput } from "../interfaces/ScriptRunOutput.interface";
import { ScriptRunner } from "./ScriptRunner";

export interface ScriptRunnerHostProps {
  scripts: ScriptDef[];
  data: Candle[];
  indicators: Indicator[];
  fundamentals: FundamentalDataPoint[] | undefined;
  lastCandleOpen: boolean;
  availableTimeframes: string[];
  onOutput: (id: string, output: ScriptRunOutput) => void;
  onAlert: ((event: ScriptAlertEvent) => void) | undefined;
}

/** Mounts one `ScriptRunner` (and therefore one Worker) per currently-*enabled* script — a script
 *  disabled or removed simply drops out of the filter below, unmounting its own `ScriptRunner`
 *  and, via that component's own cleanup effect, clearing its contribution to the aggregated
 *  `scriptIndicators`/`scriptDrawings`. Purely a mount/unmount driver; renders nothing itself. */
export function ScriptRunnerHost({ scripts, data, indicators, fundamentals, lastCandleOpen, availableTimeframes, onOutput, onAlert }: ScriptRunnerHostProps) {
  return (
    <>
      {scripts
        .filter((s) => s.enabled !== false)
        .map((s) => (
          <ScriptRunner
            key={s.id}
            script={s}
            data={data}
            indicators={indicators}
            fundamentals={fundamentals}
            lastCandleOpen={lastCandleOpen}
            availableTimeframes={availableTimeframes}
            onOutput={onOutput}
            onAlert={onAlert}
          />
        ))}
    </>
  );
}
