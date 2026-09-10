import { useState } from "react";
import { ScriptGraphEditor } from "../components/charts/candlestick/scripting/components/ScriptGraphEditor";
import { NOCODE_CODE } from "./cinemaScript";

/** The same script as blocks on a canvas.
 *
 *  The graph is not stored anywhere: `ScriptGraphEditor` reads it out of the `@block(...)` header
 *  lines in the code itself (see `parseScriptGraph`), which is why switching between the two views
 *  can never show two different programs. Editing is left on, so the boxes can be dragged around;
 *  the body of a block renders as plain highlighted-free text here rather than pulling the whole
 *  CodeMirror bundle into a landing page. */
export function NoCodeShowcase() {
  const [code, setCode] = useState(NOCODE_CODE);

  return (
    <div className="lqx-nocode">
      <header className="lqx-nocode__head">
        <h3 className="lqx-nocode__title">Le même script, sans écrire une ligne.</h3>
        <p className="lqx-nocode__lead">
          Chaque bloc est une cellule du script, et les flèches sont l'ordre d'exécution. Le canevas
          se déduit du code, donc les deux vues ne peuvent pas diverger.
        </p>
      </header>
      <div className="lqx-nocode__canvas">
        <ScriptGraphEditor
          code={code}
          onChange={setCode}
          onRunBlock={() => {}}
          renderBodyEditor={(value, onChange, blockId) => (
            <textarea
              key={blockId}
              className="lqx-nocode__body"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              spellCheck={false}
            />
          )}
        />
      </div>
    </div>
  );
}
