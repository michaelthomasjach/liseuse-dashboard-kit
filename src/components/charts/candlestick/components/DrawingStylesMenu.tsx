import { useRef, useState } from "react";
import { Popover } from "../../../forms/Popover";
import { BrushIcon, CheckIcon, PencilIcon, TrashIcon } from "../../../icons";

/** Ce que la barre flottante sait des styles enregistrés de l'outil courant. */
export interface DrawingStylesMenuProps {
  /** Bouton carré à icône seule (barre flottante verticale) ; le style actif reste dans l'infobulle. */
  compact?: boolean;
  /** Styles enregistrés pour l'outil du dessin (ou de l'outil armé). */
  presets: { id: string; name: string }[];
  /** Style actif (null : « Défaut »). */
  activeId: string | null;
  /** Un dessin est sélectionné : son style peut être enregistré ou écraser un style existant. */
  canSave: boolean;
  onSelect: (id: string | null) => void;
  onSave: (name: string) => void;
  onOverwrite: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  /** L'outil a un style mémorisé (dernier style utilisé ou style enregistré actif) : « Réinitialiser » est proposé. */
  hasRememberedStyle?: boolean;
  /** Oublie le dernier style de l'outil : ses prochains dessins reprennent le style par défaut. */
  onResetToolStyle?: () => void;
}

/** Champ « nom + Enregistrer » d'un nouveau style (paramètres du dessin). */
export function SaveStyleField({ placeholder, onSave }: { placeholder: string; onSave: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <form
      className="lq-chart__styles-menu-row lq-chart__styles-menu-save"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(name || placeholder);
        setName("");
      }}
    >
      <input className="lq-chart__styles-menu-input" value={name} placeholder={placeholder} aria-label="Nom du nouveau style" onChange={(e) => setName(e.target.value)} />
      <button type="submit" className="lq-chart__styles-menu-action">
        Enregistrer ce style
      </button>
    </form>
  );
}

/**
 * Bouton « Styles » de la barre flottante et son menu : « Défaut » puis les styles enregistrés pour cet
 * outil (un clic l'applique au dessin sélectionné et le garde pour les prochains tracés), avec
 * écraser / renommer / supprimer par ligne, et l'enregistrement du style du dessin sous un nom.
 */
export function DrawingStylesMenu({ compact, presets, activeId, canSave, onSelect, onSave, onOverwrite, onRename, onDelete, hasRememberedStyle, onResetToolStyle }: DrawingStylesMenuProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const activeName = presets.find((p) => p.id === activeId)?.name ?? "Défaut";

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={["lq-chart__icon-button", "lq-chart__floating-toolbar-text", open && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Styles enregistrés (actif : ${activeName})`}
        title={`Styles enregistrés — actif : ${activeName}`}
      >
        {compact ? <BrushIcon size={14} /> : <>Style · {activeName}</>}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} placement="bottom">
        <div className="lq-chart__tool-menu lq-chart__styles-menu" role="menu" aria-label="Styles enregistrés">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={activeId === null}
            className={["lq-chart__tool-menu-option", activeId === null && "lq-chart__tool-menu-option--selected"].filter(Boolean).join(" ")}
            onClick={() => onSelect(null)}
          >
            <span className="lq-chart__styles-menu-check">{activeId === null && <CheckIcon size={12} />}</span>
            Défaut
          </button>
          {presets.map((p) =>
            renaming?.id === p.id ? (
              <form
                key={p.id}
                className="lq-chart__styles-menu-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  onRename(p.id, renaming.name);
                  setRenaming(null);
                }}
              >
                <input
                  className="lq-chart__styles-menu-input"
                  value={renaming.name}
                  autoFocus
                  aria-label="Nouveau nom du style"
                  onChange={(e) => setRenaming({ id: p.id, name: e.target.value })}
                  onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
                />
                <button type="submit" className="lq-chart__icon-button" aria-label="Valider le nom">
                  <CheckIcon size={12} />
                </button>
              </form>
            ) : (
              <div key={p.id} className="lq-chart__styles-menu-row">
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={activeId === p.id}
                  className={["lq-chart__tool-menu-option", activeId === p.id && "lq-chart__tool-menu-option--selected"].filter(Boolean).join(" ")}
                  onClick={() => onSelect(p.id)}
                >
                  <span className="lq-chart__styles-menu-check">{activeId === p.id && <CheckIcon size={12} />}</span>
                  {p.name}
                </button>
                {canSave && (
                  <button type="button" className="lq-chart__styles-menu-action" onClick={() => onOverwrite(p.id)} title={`Remplacer « ${p.name} » par le style de ce dessin`}>
                    Écraser
                  </button>
                )}
                <button type="button" className="lq-chart__icon-button" onClick={() => setRenaming({ id: p.id, name: p.name })} aria-label={`Renommer « ${p.name} »`} title="Renommer">
                  <PencilIcon size={12} />
                </button>
                <button type="button" className="lq-chart__icon-button" onClick={() => onDelete(p.id)} aria-label={`Supprimer « ${p.name} »`} title="Supprimer">
                  <TrashIcon size={12} />
                </button>
              </div>
            ),
          )}
          {canSave && (
            <form
              className="lq-chart__styles-menu-row lq-chart__styles-menu-save"
              onSubmit={(e) => {
                e.preventDefault();
                onSave(name || `Style ${presets.length + 1}`);
                setName("");
              }}
            >
              <input
                className="lq-chart__styles-menu-input"
                value={name}
                placeholder={`Style ${presets.length + 1}`}
                aria-label="Nom du nouveau style"
                onChange={(e) => setName(e.target.value)}
              />
              <button type="submit" className="lq-chart__styles-menu-action">
                Enregistrer
              </button>
            </form>
          )}
          {onResetToolStyle && hasRememberedStyle && (
            <button
              type="button"
              role="menuitem"
              className="lq-chart__tool-menu-option"
              onClick={() => {
                onResetToolStyle();
                setOpen(false);
              }}
              title="Les prochains dessins de cet outil reprennent le style par défaut (le dessin sélectionné garde le sien)"
            >
              Réinitialiser le style par défaut de cet outil
            </button>
          )}
        </div>
      </Popover>
    </>
  );
}
