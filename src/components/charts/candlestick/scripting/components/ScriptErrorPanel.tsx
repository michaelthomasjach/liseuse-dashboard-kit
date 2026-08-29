import { ErrorIcon } from "../../../../icons";
import type { ScriptError } from "../interfaces/ScriptRunResult.interface";
import "./ScriptErrorPanel.css";

export interface ScriptErrorPanelProps {
  error: ScriptError;
}

/** The platform's own required error shape (exigence #24): "ERROR / message / Line X : Y" — line/
 *  column are only shown when the engine actually recovered them (a runtime error mid-script; a
 *  `SyntaxError` from compilation itself carries no usable position at all, see runScript.ts's own
 *  doc), never fabricated. Never crashes the host app either way — this is just a read of the last
 *  `ScriptRunResult.error`, the same graceful "script errors become data, not exceptions" contract
 *  every other part of this engine already follows. */
export function ScriptErrorPanel({ error }: ScriptErrorPanelProps) {
  return (
    <div className="lq-script-error-panel" role="alert">
      <ErrorIcon size={14} />
      <div className="lq-script-error-panel__body">
        <div className="lq-script-error-panel__title">ERREUR</div>
        <div className="lq-script-error-panel__message">{error.message}</div>
        {error.line !== undefined && (
          <div className="lq-script-error-panel__location">
            Ligne {error.line}
            {error.column !== undefined ? ` : ${error.column}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}
