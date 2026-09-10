import type { Candle } from "../../interfaces/Candle.interface";
import type { Indicator } from "../../interfaces/Indicator.interface";
import type { FundamentalDataPoint } from "../../interfaces/FundamentalDataPoint.interface";
import type { ScriptDef } from "../../interfaces/ScriptDef.interface";
import type { ScriptAlertEvent } from "../../interfaces/ScriptAlertEvent.interface";
import type { ScriptRunOutput } from "../interfaces/ScriptRunOutput.interface";
import { ScriptRunner } from "./ScriptRunner";
import type { AiSend, AiServerTool } from "../../ai/interfaces/AiMessage.interface";

export interface ScriptRunnerHostProps {
  scripts: ScriptDef[];
  data: Candle[];
  indicators: Indicator[];
  fundamentals: FundamentalDataPoint[] | undefined;
  lastCandleOpen: boolean;
  availableTimeframes: string[];
  /** The last bar every script here may see, or `null` for the whole history. Replay's own cutoff,
   *  so a script actually replays with the chart rather than staying pinned to what the full
   *  dataset produced — see useScriptEngine's own `runUpToIndex` doc. */
  runUpToIndex: number | null;
  /** The chart's own symbol, and candles for any *other* symbol a `@quant` analysis names — see
   *  `ScriptRunner`'s own props. */
  symbol: string | undefined;
  quantData: Record<string, Candle[]> | undefined;
  /** Forwarded to every runner — see `ScriptRunner`'s own prop. */
  ai: { send: AiSend; serverTools: AiServerTool[] } | null;
  onOutput: (id: string, output: ScriptRunOutput) => void;
  onAlert: ((event: ScriptAlertEvent) => void) | undefined;
}

/** Mounts one `ScriptRunner` (and therefore one Worker) per currently-*enabled* script — a script
 *  disabled or removed simply drops out of the filter below, unmounting its own `ScriptRunner`
 *  and, via that component's own cleanup effect, clearing its contribution to the aggregated
 *  `scriptIndicators`/`scriptDrawings`. Purely a mount/unmount driver; renders nothing itself. */
export function ScriptRunnerHost({ scripts, data, indicators, fundamentals, lastCandleOpen, availableTimeframes, runUpToIndex, symbol, quantData, ai, onOutput, onAlert }: ScriptRunnerHostProps) {
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
            runUpToIndex={runUpToIndex}
            symbol={symbol}
            quantData={quantData}
            ai={ai}
            onOutput={onOutput}
            onAlert={onAlert}
          />
        ))}
    </>
  );
}
