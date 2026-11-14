import { Modal } from "../../../primitives/Modal";
import { Toggle } from "../../../primitives/Toggle";
import { Select } from "../../../forms/Select";
import { InputNumber } from "../../../forms/InputNumber";
import { DEFAULT_DAY_SEPARATORS, type DaySeparatorSettings } from "../daySeparators";

/**
 * Réglages des séparateurs de jours (clic droit sur leur bouton dans le rail de gauche) : placement du nom du jour,
 * opacité, couleurs du texte et des traits, style et épaisseur des traits, taille du texte. Appliqués tout de suite.
 */
export function DaySeparatorsModal({
  open,
  onClose,
  settings,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  settings: DaySeparatorSettings;
  onChange: (next: DaySeparatorSettings) => void;
}) {
  if (!open) return null;
  const set = (patch: Partial<DaySeparatorSettings>) => onChange({ ...settings, ...patch });
  return (
    <Modal
      open
      onClose={onClose}
      title="Séparateurs de jours"
      footer={
        <div className="lq-chart__edit-drawing-footer">
          <button type="button" className="lq-chart__reset-button" onClick={() => onChange({ ...DEFAULT_DAY_SEPARATORS, enabled: settings.enabled })}>
            Valeurs par défaut
          </button>
          <button type="button" className="lq-chart__confirm-button" onClick={onClose}>
            Fermer
          </button>
        </div>
      }
    >
      <div className="lq-chart__day-sep">
        <div className="lq-chart__settings-layout-row">
          <Toggle checked={settings.enabled} onChange={() => set({ enabled: !settings.enabled })} ariaLabel="Afficher les séparateurs de jours" />
          <span className="lq-chart__settings-layout-label">Un trait à chaque changement de jour, et le nom du jour entre deux traits</span>
        </div>

        <span className="lq-field__label">Nom du jour</span>
        <div className="lq-chart__edit-drawing-row">
          <Select
            label="Vertical"
            value={settings.vAlign}
            options={[
              { value: "top", label: "Haut" },
              { value: "middle", label: "Centre" },
              { value: "bottom", label: "Bas" },
            ]}
            onChange={(v) => set({ vAlign: v as DaySeparatorSettings["vAlign"] })}
          />
          <Select
            label="Horizontal"
            value={settings.hAlign}
            options={[
              { value: "left", label: "Gauche" },
              { value: "center", label: "Centre" },
              { value: "right", label: "Droite" },
            ]}
            onChange={(v) => set({ hAlign: v as DaySeparatorSettings["hAlign"] })}
          />
        </div>
        <div className="lq-chart__edit-drawing-row">
          <div className="lq-field">
            <label className="lq-field__label">Couleur du texte</label>
            <input type="color" className="lq-chart__color-input" value={settings.textColor} onChange={(e) => set({ textColor: e.target.value })} />
          </div>
          <InputNumber label="Taille du texte" min={8} max={32} step={1} value={settings.fontSize} onChange={(v) => v !== "" && set({ fontSize: v })} />
        </div>

        <span className="lq-field__label">Traits séparateurs</span>
        <div className="lq-chart__edit-drawing-row">
          <div className="lq-field">
            <label className="lq-field__label">Couleur des traits</label>
            <input type="color" className="lq-chart__color-input" value={settings.lineColor} onChange={(e) => set({ lineColor: e.target.value })} />
          </div>
          <Select
            label="Style"
            value={settings.lineStyle}
            options={[
              { value: "solid", label: "Plein" },
              { value: "dashed", label: "Tirets" },
              { value: "dotted", label: "Pointillés" },
            ]}
            onChange={(v) => set({ lineStyle: v as DaySeparatorSettings["lineStyle"] })}
          />
          <InputNumber label="Épaisseur" min={0.5} max={4} step={0.5} value={settings.lineWidth} onChange={(v) => v !== "" && set({ lineWidth: v })} />
        </div>

        <label className="lq-chart__settings-opacity">
          <span>Opacité : {Math.round(settings.opacity * 100)} %</span>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={Math.round(settings.opacity * 100)}
            onChange={(e) => set({ opacity: Number(e.target.value) / 100 })}
            aria-label="Opacité des séparateurs de jours"
          />
        </label>
      </div>
    </Modal>
  );
}
