import { SCRIPT_EXAMPLES } from "../scriptExamples";
import { ScriptExampleRunner } from "./ScriptExampleRunner";

/** The documentation's own "Exemples" section — a whole-section override (same "plain data
 *  references a component" split `ScriptDocumentationModal.tsx` already uses for "tutorial"/
 *  "keywords") rendering `SCRIPT_EXAMPLES` as six real, runnable scripts instead of the static
 *  text/code blocks this used to be. */
export function ScriptExamplesSection() {
  return (
    <>
      <p>
        Six scripts complets, copiables tels quels, chacun illustrant une combinaison différente de l'API ci-dessus — d'un simple croisement de
        moyennes mobiles à un score composite multi-indicateurs. Chacun s'exécute automatiquement ci-dessous contre un petit jeu de données de
        démonstration ; le bouton « Exécuter » relance la même exécution à tout moment.
      </p>
      {SCRIPT_EXAMPLES.map((example) => (
        <ScriptExampleRunner key={example.id} example={example} />
      ))}
    </>
  );
}
