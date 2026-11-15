import { useId, useRef, useState, type ReactNode } from "react";
import { Tooltip } from "../../../primitives/Tooltip";
import { DropdownPanel } from "../../../primitives/DropdownPanel";
import { ChevronDownIcon, HelpIcon } from "../../../icons";
import type { Indicator } from "../interfaces/Indicator.interface";
import { indicatorCatalogEntry } from "../indicatorCatalog";
import { ATTACHED_DEFAULT_PERIOD } from "../attachedIndicators";
import "./IndicatorSettings.css";

/*
 * La grille des fenêtres de paramètres d'indicateur (intégrés, scriptés, posés sur un panneau, Volume) : des sections
 * titrées et courtes, et dans chacune une ligne par réglage, « libellé à gauche (colonne fixe) / contrôle à droite »,
 * contrôles de 32 px. Sous 480 px de large, le libellé passe au-dessus de son contrôle (voir IndicatorSettings.css).
 */

/** Une section titrée : « Entrées », « Tracé », « Valeurs », « Affichage »… `help` : une aide courte dans une
 *  infobulle « ? » à côté du titre, plutôt qu'un paragraphe. */
export function SettingsSection({ title, help, aside, children }: { title: string; help?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section className="lq-ind-settings__section" aria-labelledby={id}>
      <header className="lq-ind-settings__section-head">
        <h3 className="lq-ind-settings__section-title" id={id}>
          {title}
        </h3>
        {help && <HelpTip label={`Aide : ${title}`}>{help}</HelpTip>}
        {aside && <span className="lq-ind-settings__section-aside">{aside}</span>}
      </header>
      <div className="lq-ind-settings__rows">{children}</div>
    </section>
  );
}

/** Une section repliable (« Couleurs conditionnelles ») : son titre est un bouton, `count` dit ce qu'elle contient
 *  quand elle est repliée. Ouverte au départ si `defaultOpen`. */
export function CollapsibleSection({
  title,
  help,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  help?: ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <section className={["lq-ind-settings__section", "lq-ind-settings__section--collapsible", open && "lq-ind-settings__section--open"].filter(Boolean).join(" ")}>
      <header className="lq-ind-settings__section-head">
        <button type="button" className="lq-ind-settings__section-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((o) => !o)}>
          <ChevronDownIcon size={14} className="lq-ind-settings__section-chevron" />
          <span className="lq-ind-settings__section-title">{title}</span>
          {count !== undefined && count > 0 && <span className="lq-ind-settings__count">{count}</span>}
        </button>
        {help && <HelpTip label={`Aide : ${title}`}>{help}</HelpTip>}
      </header>
      {open && (
        <div className="lq-ind-settings__rows" id={bodyId}>
          {children}
        </div>
      )}
    </section>
  );
}

/** Une ligne « libellé / contrôle ». `htmlFor` relie le libellé à un champ (clic sur le libellé = focus) ; `hint` :
 *  une précision discrète sous le contrôle ; `trailing` : ce qui suit le contrôle sur la même ligne (aperçu, valeur
 *  par défaut). */
export function SettingRow({
  label,
  htmlFor,
  hint,
  trailing,
  children,
  wide = false,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
  /** Le contrôle prend toute la colonne (un menu au texte long) au lieu de sa largeur compacte. */
  wide?: boolean;
}) {
  return (
    <div className={["lq-ind-settings__row", wide && "lq-ind-settings__row--wide"].filter(Boolean).join(" ")}>
      {htmlFor ? (
        <label className="lq-ind-settings__label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className="lq-ind-settings__label">{label}</span>
      )}
      <div className="lq-ind-settings__control">
        {children}
        {trailing}
      </div>
      {hint && <p className="lq-ind-settings__hint">{hint}</p>}
    </div>
  );
}

/** Une ligne qui n'a pas de libellé à gauche : une case à cocher qui se décrit elle-même, alignée sur les contrôles. */
export function SettingCheckRow({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="lq-ind-settings__row lq-ind-settings__row--check">
      <div className="lq-ind-settings__control">{children}</div>
      {hint && <p className="lq-ind-settings__hint">{hint}</p>}
    </div>
  );
}

/** La valeur par défaut d'un champ, visible dès qu'on s'en écarte, et qui la rétablit d'un clic. */
export function DefaultValue({ value, defaultValue, onReset }: { value: unknown; defaultValue: number | string; onReset: () => void }) {
  if (value === undefined || value === "" || value === defaultValue) return null;
  const text = String(defaultValue);
  return (
    <button type="button" className="lq-ind-settings__default" onClick={onReset} title={`Revenir à la valeur par défaut (${text})`}>
      défaut&nbsp;: {text}
    </button>
  );
}

/** Une aide détaillée derrière un « ? » : au survol et au focus clavier (infobulle), et au clic (un doigt n'a pas de
 *  survol). */
export function HelpTip({ label, children }: { label: string; children: ReactNode }) {
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Tooltip content={pinned ? null : <span className="lq-ind-settings__help-text">{children}</span>} placement="top">
        <button ref={ref} type="button" className="lq-ind-settings__help" aria-label={label} aria-expanded={pinned} onClick={() => setPinned((p) => !p)}>
          <HelpIcon size={14} />
        </button>
      </Tooltip>
      <DropdownPanel open={pinned} onClose={() => setPinned(false)} anchorRef={ref} width={280}>
        <p className="lq-ind-settings__help-text lq-ind-settings__help-text--panel">{children}</p>
      </DropdownPanel>
    </>
  );
}

/** Un menu déroulant d'actions (« Partir d'un modèle ▾ »). */
export function ActionMenu({ label, items }: { label: string; items: { id: string; label: string; onSelect: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  if (items.length === 0) return null;
  return (
    <>
      <button ref={ref} type="button" className="lq-ind-settings__button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label}
        <ChevronDownIcon size={14} />
      </button>
      <DropdownPanel open={open} onClose={() => setOpen(false)} anchorRef={ref} width={260}>
        <div className="lq-ind-settings__menu" role="menu" aria-label={label}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="lq-ind-settings__menu-item"
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </DropdownPanel>
    </>
  );
}

/** Ce qu'un indicateur redevient avec « Réinitialiser les valeurs par défaut » : ce qu'il était à son ajout. Garde ce
 *  qui fait son identité et sa place (id, type, définition d'un script, panneau d'accueil, unité de temps, symbole
 *  corrélé, visibilité, panneau replié) ; tout le reste (périodes, couleurs, format, filigrane, règles…) repart des
 *  valeurs du catalogue. */
export function indicatorDefaults(ind: Indicator): Indicator {
  const entry = indicatorCatalogEntry(ind);
  const period = ind.sourceId ? ATTACHED_DEFAULT_PERIOD : entry.defaultPeriod;
  const base: Indicator = {
    id: ind.id,
    kind: ind.kind,
    period: ind.customData ? ind.period : period,
    stdDev: entry.hasStdDev ? 2 : undefined,
    ...(ind.kind === "macd" ? { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } : {}),
  };
  const keep: (keyof Indicator)[] = [
    "customData",
    "sourceId",
    "timeframe",
    "hidden",
    "paneCollapsed",
    "correlationSymbol",
    "correlationSymbolName",
    "correlationData",
  ];
  for (const key of keep) if (ind[key] !== undefined) (base as unknown as Record<string, unknown>)[key] = ind[key];
  // Script ou indicateur fourni par l'application : la couleur de sa définition reste la sienne (voir
  // scriptIndicatorToChartIndicator, addCustomIndicator).
  if (ind.customData?.color) base.color = ind.customData.color;
  return base;
}

/** Vrai quand un indicateur porte au moins un réglage qui s'écarte de ses valeurs par défaut. */
export function differsFromDefaults(ind: Indicator): boolean {
  const def = indicatorDefaults(ind) as unknown as Record<string, unknown>;
  const cur = ind as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(def), ...Object.keys(cur)]);
  for (const key of keys) {
    const a = cur[key];
    const b = def[key];
    if (a === b || (a === undefined && b === undefined)) continue;
    if (JSON.stringify(a) !== JSON.stringify(b)) return true;
  }
  return false;
}
