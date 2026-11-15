import { ColorPicker } from "../../../forms/ColorPicker";
import { SettingsSection } from "./IndicatorSettingsLayout";

export interface VolumePaneSettingsProps {
  /** Couleurs hausse / baisse que le graphique dessine vraiment quand rien n'est réglé (lues sur le thème), et la
   *  palette E-ink (barres en creux ou pleines, sans couleur). */
  theme: { up: string; down: string; isEink: boolean };
  upColorOverride: string | undefined;
  downColorOverride: string | undefined;
  volumeUpColorOverride: string | undefined;
  setVolumeUpColorOverride: (color: string | undefined) => void;
  volumeDownColorOverride: string | undefined;
  setVolumeDownColorOverride: (color: string | undefined) => void;
}

/** L'onglet « Volume » des paramètres du panneau Volume : la série elle-même n'a pas de paramètre de calcul ; son
 *  style, ce sont les couleurs des barres haussières et baissières (celles des bougies tant qu'elles ne sont pas
 *  réglées). « Réinitialiser aux couleurs des bougies » est dans le pied de la fenêtre. */
export function VolumePaneSettings({
  theme,
  upColorOverride,
  downColorOverride,
  volumeUpColorOverride,
  setVolumeUpColorOverride,
  volumeDownColorOverride,
  setVolumeDownColorOverride,
}: VolumePaneSettingsProps) {
  return (
    <>
      <div className="lq-pane-settings__group">
        <h3 className="lq-pane-settings__group-title">Paramètres</h3>
        <div className="lq-ind-settings">
          <p className="lq-ind-settings__empty">Le volume échangé à chaque bougie : pas de paramètre de calcul.</p>
        </div>
      </div>
      <div className="lq-pane-settings__group">
        <h3 className="lq-pane-settings__group-title">Style</h3>
        <div className="lq-ind-settings">
          <SettingsSection title="Tracé">
            <div className="lq-ind-settings__trace" role="table" aria-label="Éléments tracés">
              <div className="lq-ind-settings__trace-row" role="row">
                <span className="lq-ind-settings__trace-check" role="cell" />
                <span className="lq-ind-settings__trace-name" role="cell">
                  Barres
                </span>
                <span className="lq-ind-settings__trace-colors" role="cell">
                  <span className="lq-ind-settings__swatch">
                    <span className="lq-ind-settings__swatch-label">Hausse</span>
                    <ColorPicker
                      className="lq-chart__color-input"
                      value={volumeUpColorOverride ?? upColorOverride ?? theme.up}
                      onChange={(color) => setVolumeUpColorOverride(color)}
                      disabled={theme.isEink}
                      aria-label="Couleur des barres haussières"
                    />
                  </span>
                  <span className="lq-ind-settings__swatch">
                    <span className="lq-ind-settings__swatch-label">Baisse</span>
                    <ColorPicker
                      className="lq-chart__color-input"
                      value={volumeDownColorOverride ?? downColorOverride ?? theme.down}
                      onChange={(color) => setVolumeDownColorOverride(color)}
                      disabled={theme.isEink}
                      aria-label="Couleur des barres baissières"
                    />
                  </span>
                </span>
              </div>
            </div>
            {theme.isEink && (
              <p className="lq-ind-settings__empty">
                En palette E-ink, les barres sont en creux ou pleines plutôt qu&apos;en couleur : ces couleurs ne changent rien tant
                qu&apos;elle est active.
              </p>
            )}
          </SettingsSection>
        </div>
      </div>
    </>
  );
}
