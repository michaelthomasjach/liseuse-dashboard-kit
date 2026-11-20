import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, SyntheticEvent } from "react";
import { Popover } from "../../../forms/Popover";
import { InputDropdown } from "../../../forms/InputDropdown";
import { Modal } from "../../../primitives/Modal";
import { BrushIcon, CheckIcon, PencilIcon, TrashIcon } from "../../../icons";

/** Ce que la barre flottante sait des styles enregistrés de l'outil courant. */
export interface DrawingStylesMenuProps {
  /** Bouton carré à icône seule (barre flottante verticale) ; le style actif reste dans l'infobulle. */
  compact?: boolean;
  /** Styles enregistrés pour l'outil du dessin (ou de l'outil armé). Le menu les trie par nom. */
  presets: { id: string; name: string }[];
  /** Style que porte le dessin (null : « Défaut », ou `customLabel`). */
  activeId: string | null;
  /** Nom affiché quand `activeId` est null à la place de « Défaut » (dessin sélectionné dont l'apparence ne
   *  correspond à aucun style enregistré : « Personnalisé »). */
  customLabel?: string;
  /** Nom de l'outil (« Ligne horizontale ») : rappelé dans la fenêtre d'enregistrement, les styles valant par outil. */
  toolLabel?: string;
  /** Un dessin est sélectionné : son style peut être enregistré sous un nom, nouveau ou existant. */
  canSave: boolean;
  /** Applique un style (null : le style par défaut) au dessin et le garde pour les prochains tracés de l'outil. */
  onSelect: (id: string | null) => void;
  /** Enregistre le style du dessin sous un nouveau nom. */
  onSave: (name: string) => void;
  /** Remplace un style existant par celui du dessin. */
  onOverwrite: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
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

const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name, "fr", { sensitivity: "base", numeric: true });
const sameName = (a: string, b: string): boolean => a.trim().localeCompare(b.trim(), "fr", { sensitivity: "base" }) === 0;

/** Une touche traitée ici ne remonte ni au graphique (Suppr y efface le dessin sélectionné, les flèches le font
 *  défiler…) ni au panneau. */
function consume(e: ReactKeyboardEvent) {
  e.preventDefault();
  e.stopPropagation();
  e.nativeEvent.stopPropagation();
}

const stop = (e: SyntheticEvent) => e.stopPropagation();

/**
 * Bouton « Style » de la barre flottante et son menu, sur le modèle des modèles de dessin de TradingView :
 * « Enregistrer le style sous… », « Appliquer le style par défaut », puis les styles enregistrés pour cet outil, triés
 * par nom, celui que porte le dessin coché. Un clic applique un style ; renommer et supprimer restent discrets
 * (icônes au survol ou au focus de la ligne, F2 et Suppr au clavier). « Enregistrer le style sous… » ouvre une petite
 * fenêtre : un nom nouveau crée un style, un nom existant (tapé ou choisi dans la liste) le remplace.
 */
export function DrawingStylesMenu({ compact, presets, activeId, customLabel, toolLabel, canSave, onSelect, onSave, onOverwrite, onRename, onDelete }: DrawingStylesMenuProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const sorted = useMemo(() => [...presets].sort(byName), [presets]);
  const activeName = presets.find((p) => p.id === activeId)?.name ?? customLabel ?? "Défaut";
  const existing = name.trim() ? sorted.find((p) => sameName(p.name, name)) : undefined;

  const closeMenu = () => {
    setOpen(false);
    setRenaming(null);
    setConfirmDelete(null);
  };
  const openSave = () => {
    // Le focus passe d'abord au bouton « Style » : la fenêtre le lui rendra à sa fermeture.
    anchorRef.current?.focus();
    closeMenu();
    setName("");
    setSaveOpen(true);
  };
  const submitSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (existing) onOverwrite(existing.id);
    else onSave(trimmed);
    setSaveOpen(false);
  };

  /** Flèches, Début, Fin : d'une entrée du menu à l'autre. */
  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    if (e.target instanceof HTMLInputElement) return;
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled), [role="menuitemradio"]') ?? []);
    if (items.length === 0) return;
    consume(e);
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : e.key === "ArrowDown" ? (i + 1) % items.length : (i <= 0 ? items.length : i) - 1;
    items[next]?.focus();
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className={["lq-chart__icon-button", "lq-chart__floating-toolbar-text", open && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
        onClick={() => (open ? closeMenu() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Styles enregistrés (style du dessin : ${activeName})`}
        title={`Styles enregistrés — style du dessin : ${activeName}`}
      >
        {compact ? <BrushIcon size={14} /> : <>Style · {activeName}</>}
      </button>
      <Popover
        open={open}
        onClose={closeMenu}
        anchorRef={anchorRef}
        placement="bottom"
        initialFocus={(panel) => panel.querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]') ?? panel.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')}
      >
        <div ref={menuRef} className="lq-chart__tool-menu lq-chart__styles-menu" role="menu" aria-label={toolLabel ? `Styles · ${toolLabel}` : "Styles enregistrés"} onKeyDown={onMenuKeyDown}>
          <button
            type="button"
            role="menuitem"
            className="lq-chart__tool-menu-option"
            disabled={!canSave}
            onClick={openSave}
            title={canSave ? "Enregistrer le style de ce dessin sous un nom, nouveau ou existant" : "Sélectionnez un dessin pour enregistrer son style"}
          >
            Enregistrer le style sous…
          </button>
          <button
            type="button"
            role="menuitem"
            className="lq-chart__tool-menu-option"
            onClick={() => {
              onSelect(null);
              closeMenu();
            }}
            title="Rend au dessin le style par défaut, repris aussi par les prochains dessins de cet outil"
          >
            Appliquer le style par défaut
          </button>
          {sorted.length > 0 && <div className="lq-chart__tool-menu-divider" role="separator" />}
          {sorted.length > 0 && (
            <div className="lq-chart__styles-menu-list" role="group" aria-label="Styles enregistrés pour cet outil">
              {sorted.map((p) => {
                const checked = p.id === activeId;
                if (renaming?.id === p.id) {
                  return (
                    <form
                      key={p.id}
                      className="lq-chart__styles-menu-row lq-chart__styles-menu-rename"
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
                        onFocus={(e) => e.currentTarget.select()}
                        aria-label={`Nouveau nom de « ${p.name} »`}
                        onChange={(e) => setRenaming({ id: p.id, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            consume(e);
                            setRenaming(null);
                          } else if (e.key === "Delete" || e.key === "Backspace") {
                            // Effacer du texte ne doit jamais atteindre le graphique (qui supprimerait le dessin).
                            e.nativeEvent.stopPropagation();
                          }
                        }}
                      />
                      <button type="submit" className="lq-chart__styles-menu-tool" aria-label="Valider le nom" title="Valider (Entrée)" disabled={!renaming.name.trim()}>
                        <CheckIcon size={12} />
                      </button>
                    </form>
                  );
                }
                if (confirmDelete === p.id) {
                  return (
                    <div
                      key={p.id}
                      className="lq-chart__styles-menu-confirm"
                      role="alertdialog"
                      aria-label={`Supprimer le style « ${p.name} » ?`}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          consume(e);
                          setConfirmDelete(null);
                        }
                      }}
                    >
                      <span className="lq-chart__styles-menu-label">Supprimer « {p.name} » ?</span>
                      <button
                        type="button"
                        className="lq-chart__styles-menu-action"
                        autoFocus
                        onClick={() => {
                          onDelete(p.id);
                          setConfirmDelete(null);
                        }}
                      >
                        Supprimer
                      </button>
                      <button type="button" className="lq-chart__styles-menu-action" onClick={() => setConfirmDelete(null)}>
                        Annuler
                      </button>
                    </div>
                  );
                }
                return (
                  <div key={p.id} className={["lq-chart__styles-menu-item", checked && "lq-chart__styles-menu-item--active"].filter(Boolean).join(" ")}>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={checked}
                      aria-keyshortcuts="F2 Delete"
                      className="lq-chart__tool-menu-option"
                      title={`Appliquer « ${p.name} » (F2 : renommer, Suppr : supprimer)`}
                      onClick={() => {
                        onSelect(p.id);
                        closeMenu();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "F2") {
                          consume(e);
                          setRenaming({ id: p.id, name: p.name });
                        } else if (e.key === "Delete" || e.key === "Backspace") {
                          consume(e);
                          setConfirmDelete(p.id);
                        } else if (e.key === "ArrowRight") {
                          consume(e);
                          (e.currentTarget.parentElement?.querySelector(".lq-chart__styles-menu-tool") as HTMLElement | null)?.focus();
                        }
                      }}
                    >
                      <span className="lq-chart__styles-menu-label">{p.name}</span>
                      {/* La coche suit le nom : la liste reste alignée à gauche, sans colonne vide pour les autres lignes. */}
                      {checked && (
                        <span className="lq-chart__styles-menu-check" aria-hidden="true">
                          <CheckIcon size={12} />
                        </span>
                      )}
                    </button>
                    <span
                      className="lq-chart__styles-menu-tools"
                      onKeyDown={(e) => {
                        if (e.key === "ArrowLeft") {
                          consume(e);
                          (e.currentTarget.parentElement?.querySelector('[role="menuitemradio"]') as HTMLElement | null)?.focus();
                        }
                      }}
                    >
                      <button
                        type="button"
                        tabIndex={-1}
                        className="lq-chart__styles-menu-tool"
                        onClick={() => setRenaming({ id: p.id, name: p.name })}
                        aria-label={`Renommer « ${p.name} »`}
                        title="Renommer (F2)"
                      >
                        <PencilIcon size={12} />
                      </button>
                      <button
                        type="button"
                        tabIndex={-1}
                        className="lq-chart__styles-menu-tool"
                        onClick={() => setConfirmDelete(p.id)}
                        aria-label={`Supprimer « ${p.name} »`}
                        title="Supprimer (Suppr)"
                      >
                        <TrashIcon size={12} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Popover>
      {saveOpen && (
        // La fenêtre est dans la barre flottante pour React : ni ses clics ni ses touches ne doivent la déplacer, changer
        // la sélection ou déclencher un raccourci du graphique (Échap y désélectionnerait le dessin, Suppr l'effacerait).
        <span
          style={{ display: "contents" }}
          onPointerDown={stop}
          onMouseDown={stop}
          onClick={stop}
          onDoubleClick={stop}
          onContextMenu={stop}
          onWheel={stop}
          onKeyDown={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopPropagation();
            // Échap ferme la fenêtre, sauf s'il a d'abord refermé la liste des noms.
            if (e.key === "Escape" && !e.defaultPrevented) setSaveOpen(false);
          }}
        >
          <Modal
            open
            onClose={() => setSaveOpen(false)}
            title="Enregistrer le style de dessin"
            className="lq-chart__save-style-modal"
            footer={
              <div className="lq-chart__edit-drawing-footer">
                <button type="button" className="lq-chart__reset-button" onClick={() => setSaveOpen(false)}>
                  Annuler
                </button>
                <button type="button" className="lq-chart__confirm-button" onClick={submitSave} disabled={!name.trim()}>
                  {existing ? "Remplacer" : "Enregistrer"}
                </button>
              </div>
            }
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitSave();
              }}
            >
              <InputDropdown
                label="Nom du style"
                placeholder="Nouveau nom de style"
                inputValue={name}
                onInputChange={setName}
                options={sorted.map((p) => ({ value: p.id, label: p.name, description: p.id === activeId ? "Style actuel de ce dessin" : undefined }))}
                value={existing?.id ?? null}
                onChange={(_id, option) => setName(option.label)}
                emptyMessage="Nouveau nom : le style sera créé"
                helperText={
                  existing
                    ? `« ${existing.name} » existe déjà : il sera remplacé par le style de ce dessin.`
                    : toolLabel
                      ? `Proposé sur les dessins « ${toolLabel} ». La flèche liste les styles existants, pour en remplacer un.`
                      : "La flèche liste les styles existants, pour en remplacer un."
                }
              />
            </form>
          </Modal>
        </span>
      )}
    </>
  );
}
