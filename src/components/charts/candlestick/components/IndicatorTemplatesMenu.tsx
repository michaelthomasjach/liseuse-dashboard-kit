import { useRef, useState } from "react";
import { DropdownPanel } from "../../../primitives/DropdownPanel";
import { ChevronDownIcon, TrashIcon } from "../../../icons";
import type { IndicatorTemplate } from "../indicatorPresets";

export interface IndicatorTemplatesMenuProps {
  /** Nom du type, pour l'en-tête (« RSI », « MACD »…). */
  kindLabel: string;
  /** Les modèles de ce type d'indicateur. */
  templates: IndicatorTemplate[];
  onApply: (template: IndicatorTemplate) => void;
  /** Enregistre les réglages affichés sous ce nom (un modèle du même nom est remplacé). */
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
  /** « Rétablir les valeurs par défaut » : actif quand un réglage s'en écarte. */
  canReset: boolean;
  onReset: () => void;
}

/**
 * Bouton « Modèles » du pied des paramètres d'un indicateur, comme sur TradingView : les modèles enregistrés pour ce
 * type (un clic applique ses réglages, la corbeille le supprime), « Enregistrer comme modèle… » et « Rétablir les
 * valeurs par défaut ».
 */
export function IndicatorTemplatesMenu({ kindLabel, templates, onApply, onSave, onDelete, canReset, onReset }: IndicatorTemplatesMenuProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const close = () => {
    setOpen(false);
    setNaming(false);
    setName("");
  };
  const trimmed = name.trim().toLowerCase();
  const replaces = trimmed ? templates.find((t) => t.name.trim().toLowerCase() === trimmed) : undefined;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="lq-ind-settings__button lq-ind-settings__templates-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        Modèles
        <ChevronDownIcon size={14} />
      </button>
      <DropdownPanel
        open={open}
        onClose={close}
        anchorRef={anchorRef}
        placement="top"
        width={280}
        header={
          <div className="lq-dropdown-panel__header-row">
            <span>Modèles · {kindLabel}</span>
            <span className="lq-dropdown-panel__header-count">{templates.length}</span>
          </div>
        }
        footer={
          <div className="lq-ind-settings__templates-footer">
            {naming ? (
              <form
                className="lq-chart__styles-menu-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!name.trim()) return;
                  onSave(name);
                  close();
                }}
              >
                <input
                  className="lq-chart__styles-menu-input"
                  value={name}
                  autoFocus
                  placeholder="Nom du modèle"
                  aria-label="Nom du modèle"
                  onChange={(e) => setName(e.target.value)}
                />
                <button type="submit" className="lq-chart__styles-menu-action" disabled={!name.trim()}>
                  {replaces ? "Remplacer" : "Enregistrer"}
                </button>
              </form>
            ) : (
              <button type="button" role="menuitem" className="lq-ind-settings__menu-item" onClick={() => setNaming(true)}>
                Enregistrer comme modèle…
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className="lq-ind-settings__menu-item"
              disabled={!canReset}
              onClick={() => {
                onReset();
                close();
              }}
            >
              Rétablir les valeurs par défaut
            </button>
          </div>
        }
      >
        {templates.length === 0 ? (
          <p className="lq-chart__template-empty">Aucun modèle pour cet indicateur.</p>
        ) : (
          <div role="menu" aria-label={`Modèles · ${kindLabel}`}>
            {templates.map((t) => (
              <div key={t.id} className="lq-chart__template-row">
                <button
                  type="button"
                  role="menuitem"
                  className="lq-chart__template-row-name"
                  title={`Appliquer le modèle « ${t.name} »`}
                  onClick={() => {
                    onApply(t);
                    close();
                  }}
                >
                  {t.name}
                </button>
                <button type="button" className="lq-chart__template-row-delete" onClick={() => onDelete(t.id)} aria-label={`Supprimer le modèle « ${t.name} »`} title="Supprimer">
                  <TrashIcon size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </DropdownPanel>
    </>
  );
}
