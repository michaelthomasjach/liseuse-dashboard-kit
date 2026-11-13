import { Fragment, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, GripIcon, SearchIcon } from "../icons";
import { Checkbox } from "../forms/Checkbox";
import { DropdownPanel } from "../primitives/DropdownPanel";
import "./DataTable.css";

export interface DataTableColumn<T> {
  id: string;
  header: string;
  accessor: (row: T) => ReactNode;
  /** Enables sorting on this column; return the primitive to compare on. */
  sortValue?: (row: T) => string | number;
  /** Texte brut de la cellule, pour la recherche et l'export CSV. Par défaut : `sortValue`, sinon ce
   *  que rend `accessor` quand c'est une chaîne ou un nombre. Une cellule qui rend un composant sans
   *  `textValue` ni `sortValue` est ignorée par la recherche et exportée vide. */
  textValue?: (row: T) => string;
  align?: "left" | "right" | "center";
  width?: string;
  /** Masquée au départ, quand le choix des colonnes (`columnPicker`) est actif. */
  defaultHidden?: boolean;
  /** `false` : la colonne ne figure pas dans le choix des colonnes et reste toujours affichée. */
  hideable?: boolean;
}

export interface DataTableLabels {
  search: string;
  columns: string;
  export: string;
  /** Ex. « 11 à 20 sur 57 ». */
  range: (from: number, to: number, total: number) => string;
  previous: string;
  next: string;
  selectAll: string;
  selectRow: string;
  expand: string;
  /** Ex. « 3 sélectionnées ». */
  selected: (count: number) => string;
  /** Poignée de glisser-déposer d'une ligne. */
  move: string;
  /** Poignée quand le réordonnancement est coupé (colonne triée, recherche en cours). */
  moveOff: string;
}

const DEFAULT_LABELS: DataTableLabels = {
  search: "Rechercher",
  columns: "Colonnes",
  export: "Exporter CSV",
  range: (from, to, total) => `${from} à ${to} sur ${total}`,
  previous: "Page précédente",
  next: "Page suivante",
  selectAll: "Tout sélectionner",
  selectRow: "Sélectionner la ligne",
  expand: "Déplier la ligne",
  selected: (n) => `${n} sélectionnée${n > 1 ? "s" : ""}`,
  move: "Déplacer la ligne : glisser, ou flèches haut et bas",
  moveOff: "Retirez le tri et la recherche pour réordonner les lignes",
};

/** Ligne déposée : sa clé, son groupe d'arrivée (null sans `groups`) et sa place dans ce groupe (parmi les lignes
 *  affichées du groupe, elle-même retirée : 0 = en tête). */
export interface DataTableMove {
  key: string;
  group: string | null;
  index: number;
}

/** Section du tableau : un en-tête pleine largeur, puis ses lignes. */
export interface DataTableGroup {
  id: string;
  header: ReactNode;
  /** Replié : l'en-tête seul (on peut encore y déposer une ligne, qui arrive en tête). */
  collapsed?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  className?: string;

  /** `"condensed"` resserre les cellules — listes longues, tableaux secondaires. Défaut `"normal"`. */
  density?: "normal" | "condensed";
  /** Une ligne sur deux teintée. */
  striped?: boolean;
  /** Surligne la ligne survolée, même sans `onRowClick`. */
  hover?: boolean;
  /** Filets verticaux entre les colonnes, et un cadre. */
  bordered?: boolean;

  /** Hauteur maximale du corps ; au-delà il défile et l'en-tête reste figé. Ex. `320` ou `"40vh"`. */
  maxHeight?: number | string;

  /** Une case à cocher par ligne, et une case tri-état dans l'en-tête qui agit sur toutes les lignes
   *  filtrées (toutes les pages, pas seulement la page affichée). */
  selectable?: boolean;
  /** Sélection contrôlée. Sans elle, le tableau garde la sienne. */
  selectedKeys?: string[];
  defaultSelectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;

  /** Rend une ligne dépliable : un chevron en tête, et ce contenu sur toute la largeur dessous. */
  renderExpanded?: (row: T) => ReactNode;
  /** Ne déplie que les lignes pour lesquelles ceci renvoie vrai. Défaut : toutes. */
  isExpandable?: (row: T) => boolean;
  defaultExpandedKeys?: string[];

  /** Pagine par paquets de cette taille. Sans elle, toutes les lignes s'affichent. */
  pageSize?: number;

  /** Un champ de recherche au-dessus : il filtre sur le texte de chaque colonne visible. */
  searchable?: boolean;
  /** Un bouton qui télécharge les lignes filtrées et triées (toutes les pages), colonnes visibles. */
  exportable?: boolean | { filename?: string };
  /** Un menu pour masquer ou réafficher les colonnes. */
  columnPicker?: boolean;
  /** Contenu libre à gauche de la barre d'outils — titre, bouton « Ajouter »… */
  toolbar?: ReactNode;

  /** Textes de l'interface, en français par défaut. */
  labels?: Partial<DataTableLabels>;

  /** Glisser-déposer des lignes : une poignée en tête de chaque ligne, à la souris, au doigt, ou au clavier (flèches
   *  haut et bas sur la poignée ; elles franchissent les sections). Appelé au lâcher ; l'application range ses lignes
   *  et rend le nouvel ordre dans `rows`. Coupé tant qu'une colonne est triée ou qu'une recherche filtre. */
  onReorder?: (move: DataTableMove) => void;
  /** Sections, dans cet ordre, chacune sous un en-tête pleine largeur, même vide (on peut y déposer une ligne). Les
   *  lignes y gardent l'ordre de `rows` ; un tri de colonne trie à l'intérieur de chaque section. Sans pagination. */
  groups?: DataTableGroup[];
  /** Section d'une ligne (identifiant d'un des `groups`) ; inconnue : la première. */
  groupOf?: (row: T) => string;
}

function cellText<T>(col: DataTableColumn<T>, row: T): string {
  if (col.textValue) return col.textValue(row);
  if (col.sortValue) return String(col.sortValue(row));
  const v = col.accessor(row);
  return typeof v === "string" || typeof v === "number" ? String(v) : "";
}

/** Les pages à montrer : la première, la dernière, la courante et ses voisines ; `null` = ellipse. */
function pageList(current: number, count: number): (number | null)[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const keep = new Set([0, count - 1, current - 1, current, current + 1]);
  if (current <= 2) [1, 2, 3].forEach((p) => keep.add(p));
  if (current >= count - 3) [count - 4, count - 3, count - 2].forEach((p) => keep.add(p));
  const pages = [...keep].filter((p) => p >= 0 && p < count).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

function downloadCsv(filename: string, lines: string[][]) {
  // Point-virgule et BOM : c'est ce qu'Excel attend en France pour ouvrir le fichier sans assistant.
  const esc = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const csv = "﻿" + lines.map((l) => l.map(esc).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Sortable, responsive (horizontally scrollable) data table — holdings, orders, transactions.
 *
 * Tout le reste est optionnel et se combine : densité, rayures, survol, bordures, en-tête figé,
 * sélection de lignes, lignes dépliables, recherche, pagination, export CSV, choix des colonnes.
 * Ordre d'application : recherche, puis tri, puis pagination — la sélection et l'export portent sur
 * les lignes filtrées et triées, toutes pages confondues.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyMessage = "Aucune donnée",
  className,
  density = "normal",
  striped,
  hover,
  bordered,
  maxHeight,
  selectable,
  selectedKeys,
  defaultSelectedKeys,
  onSelectionChange,
  renderExpanded,
  isExpandable,
  defaultExpandedKeys,
  pageSize,
  searchable,
  exportable,
  columnPicker,
  toolbar,
  labels: labelsProp,
  onReorder,
  groups,
  groupOf,
}: DataTableProps<T>) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const [sort, setSort] = useState<{ id: string; dir: "asc" | "desc" } | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id)));
  const [ownSelection, setOwnSelection] = useState<Set<string>>(() => new Set(defaultSelectedKeys));
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(defaultExpandedKeys));
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLButtonElement>(null);

  const selection = useMemo(() => (selectedKeys ? new Set(selectedKeys) : ownSelection), [selectedKeys, ownSelection]);
  const visibleColumns = useMemo(() => (columnPicker ? columns.filter((c) => !hidden.has(c.id)) : columns), [columnPicker, columns, hidden]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return rows;
    return rows.filter((row) => visibleColumns.some((col) => cellText(col, row).toLocaleLowerCase().includes(q)));
  }, [rows, query, visibleColumns]);

  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return filteredRows;
    const sv = col.sortValue;
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const av = sv(a);
      const bv = sv(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filteredRows, sort, columns]);

  const grouped = Boolean(groups?.length) && !pageSize;
  // Section de chaque ligne : la première si elle n'est pas connue.
  const groupIds = useMemo(() => new Set((groups ?? []).map((g) => g.id)), [groups]);
  const sectionOf = (row: T): string | null => {
    if (!grouped) return null;
    const g = groupOf?.(row);
    return g !== undefined && groupIds.has(g) ? g : (groups as DataTableGroup[])[0]!.id;
  };
  const canReorder = Boolean(onReorder) && !sort && !query.trim();
  const [drag, setDrag] = useState<{ key: string; overKey: string | null; overGroup: string | null; after: boolean } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  /** Clés affichées d'une section (null : tout le tableau), dans l'ordre. */
  const keysIn = (group: string | null): string[] =>
    group !== null && (groups ?? []).find((g) => g.id === group)?.collapsed
      ? []
      : sortedRows.filter((r) => group === null || sectionOf(r) === group).map(rowKey);

  /** Lâcher : la place visée (au-dessus ou au-dessous d'une ligne, ou en tête d'une section), si elle change quelque chose. */
  function finishDrag(state: { key: string; overKey: string | null; overGroup: string | null; after: boolean }) {
    setDrag(null);
    if (!onReorder) return;
    const moving = sortedRows.find((r) => rowKey(r) === state.key);
    if (!moving) return;
    let group: string | null;
    let index: number;
    if (state.overKey) {
      const target = sortedRows.find((r) => rowKey(r) === state.overKey);
      if (!target || state.overKey === state.key) return;
      group = sectionOf(target);
      const keys = keysIn(group).filter((k) => k !== state.key);
      index = keys.indexOf(state.overKey) + (state.after ? 1 : 0);
    } else if (state.overGroup) {
      group = state.overGroup;
      index = 0;
    } else return;
    const from = sectionOf(moving);
    if (group === from && keysIn(from).indexOf(state.key) === index) return;
    onReorder({ key: state.key, group, index });
  }

  /** Ligne ou en-tête de section sous le pointeur, pendant un glisser. */
  function dropTarget(x: number, y: number): { overKey: string | null; overGroup: string | null; after: boolean } | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-dt-key], [data-dt-group]");
    if (!el || !tableRef.current?.contains(el)) return null;
    if (el.dataset.dtGroup !== undefined) return { overKey: null, overGroup: el.dataset.dtGroup, after: false };
    const r = el.getBoundingClientRect();
    return { overKey: el.dataset.dtKey ?? null, overGroup: null, after: y > r.top + r.height / 2 };
  }

  /** Clavier : une place plus haut ou plus bas ; au bord d'une section, en fin de la précédente ou en tête de la suivante. */
  function moveByKey(key: string, row: T, step: -1 | 1) {
    if (!onReorder) return;
    const group = sectionOf(row);
    const keys = keysIn(group);
    const next = keys.indexOf(key) + step;
    if (next >= 0 && next < keys.length) return onReorder({ key, group, index: next });
    if (!grouped) return;
    const ids = (groups as DataTableGroup[]).map((g) => g.id);
    const other = ids[ids.indexOf(group as string) + step];
    if (other === undefined) return;
    onReorder({ key, group: other, index: step === 1 ? 0 : keysIn(other).length });
  }

  const pageCount = pageSize ? Math.max(1, Math.ceil(sortedRows.length / pageSize)) : 1;
  // Une recherche peut réduire le nombre de pages sous la page courante : on retombe sur la dernière.
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = pageSize ? sortedRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize) : sortedRows;

  function toggleSort(col: DataTableColumn<T>) {
    if (!col.sortValue) return;
    setSort((prev) => {
      if (!prev || prev.id !== col.id) return { id: col.id, dir: "asc" };
      if (prev.dir === "asc") return { id: col.id, dir: "desc" };
      return null;
    });
  }

  function setSelection(next: Set<string>) {
    if (!selectedKeys) setOwnSelection(next);
    onSelectionChange?.([...next]);
  }

  const filteredKeys = sortedRows.map(rowKey);
  const selectedInView = filteredKeys.filter((k) => selection.has(k)).length;
  const allSelected = filteredKeys.length > 0 && selectedInView === filteredKeys.length;

  function toggleAll() {
    const next = new Set(selection);
    if (allSelected) filteredKeys.forEach((k) => next.delete(k));
    else filteredKeys.forEach((k) => next.add(k));
    setSelection(next);
  }

  function toggleRow(key: string) {
    const next = new Set(selection);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelection(next);
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function exportCsv() {
    const filename = (typeof exportable === "object" && exportable.filename) || "export.csv";
    downloadCsv(filename, [visibleColumns.map((c) => c.header), ...sortedRows.map((row) => visibleColumns.map((c) => cellText(c, row)))]);
  }

  const expandable = Boolean(renderExpanded);
  const colSpan = visibleColumns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0) + (onReorder ? 1 : 0);
  const showToolbar = Boolean(toolbar || searchable || exportable || columnPicker);

  const rootClass = [
    "lq-data-table",
    density === "condensed" && "lq-data-table--condensed",
    striped && "lq-data-table--striped",
    hover && "lq-data-table--hover",
    bordered && "lq-data-table--bordered",
    drag && "lq-data-table--dragging",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      {showToolbar && (
        <div className="lq-data-table__toolbar">
          <div className="lq-data-table__toolbar-start">
            {toolbar}
            {selectable && selection.size > 0 && <span className="lq-data-table__selected">{labels.selected(selection.size)}</span>}
          </div>
          <div className="lq-data-table__toolbar-end">
            {searchable && (
              <label className="lq-data-table__search">
                <SearchIcon size={14} />
                <input
                  type="search"
                  value={query}
                  placeholder={labels.search}
                  aria-label={labels.search}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
            )}
            {columnPicker && (
              <>
                <button ref={pickerRef} type="button" className="lq-data-table__tool" aria-expanded={pickerOpen} onClick={() => setPickerOpen((o) => !o)}>
                  {labels.columns}
                  <ChevronDownIcon size={14} />
                </button>
                <DropdownPanel open={pickerOpen} onClose={() => setPickerOpen(false)} anchorRef={pickerRef} placement="bottom" width={220}>
                  <div className="lq-data-table__picker">
                    {columns
                      .filter((c) => c.hideable !== false)
                      .map((c) => (
                        <Checkbox
                          key={c.id}
                          label={c.header}
                          checked={!hidden.has(c.id)}
                          // On garde au moins une colonne : un tableau sans colonne n'a plus d'en-tête à cliquer.
                          disabled={!hidden.has(c.id) && visibleColumns.length === 1}
                          onChange={(on) =>
                            setHidden((prev) => {
                              const next = new Set(prev);
                              if (on) next.delete(c.id);
                              else next.add(c.id);
                              return next;
                            })
                          }
                        />
                      ))}
                  </div>
                </DropdownPanel>
              </>
            )}
            {exportable && (
              <button type="button" className="lq-data-table__tool" onClick={exportCsv}>
                {labels.export}
              </button>
            )}
          </div>
        </div>
      )}

      <div
        className={["lq-data-table__scroll", maxHeight !== undefined && "lq-data-table__scroll--fixed"].filter(Boolean).join(" ")}
        style={maxHeight !== undefined ? { maxHeight } : undefined}
      >
        <table ref={tableRef}>
          <thead>
            <tr>
              {onReorder && <th className="lq-data-table__control" aria-hidden="true" />}
              {expandable && <th className="lq-data-table__control" aria-hidden="true" />}
              {selectable && (
                <th className="lq-data-table__control">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={selectedInView > 0 && !allSelected}
                    onChange={toggleAll}
                    label={<span className="lq-visually-hidden">{labels.selectAll}</span>}
                  />
                </th>
              )}
              {visibleColumns.map((col) => (
                <th
                  key={col.id}
                  style={{ width: col.width, textAlign: col.align ?? "left" }}
                  className={col.sortValue ? "lq-data-table__sortable" : undefined}
                  aria-sort={sort?.id === col.id ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                >
                  {col.sortValue ? (
                    // Un vrai bouton dans le <th> : focalisable, activable à Entrée et Espace, et
                    // annoncé comme tel — un <th onClick> ne l'était pas. Aligné à droite, la flèche
                    // passe devant le libellé : la place qu'elle réserve ne décale plus le texte de
                    // l'en-tête par rapport aux chiffres de la colonne.
                    <button
                      type="button"
                      className={["lq-data-table__header", "lq-data-table__sort", col.align === "right" && "lq-data-table__sort--end"]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => toggleSort(col)}
                    >
                      {col.header}
                      <span className="lq-data-table__sort-icon" aria-hidden="true">
                        {sort?.id === col.id ? (
                          sort.dir === "asc" ? (
                            <ChevronUpIcon size={14} />
                          ) : (
                            <ChevronDownIcon size={14} />
                          )
                        ) : null}
                      </span>
                    </button>
                  ) : (
                    <span className="lq-data-table__header">{col.header}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && !grouped && (
              <tr>
                <td colSpan={colSpan} className="lq-data-table__empty">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {(grouped
              ? (groups as DataTableGroup[]).flatMap((g) => {
                  const inGroup = g.collapsed ? [] : pageRows.filter((r) => sectionOf(r) === g.id);
                  return [{ header: g } as const, ...inGroup.map((row, index) => ({ row, index }))];
                })
              : pageRows.map((row, index) => ({ row, index }))
            ).map((item) => {
              if ("header" in item) {
                const g = item.header;
                return (
                  <tr
                    key={`group:${g.id}`}
                    className={["lq-data-table__group", drag?.overGroup === g.id && "lq-data-table__group--drop"].filter(Boolean).join(" ")}
                    data-dt-group={g.id}
                  >
                    <td colSpan={colSpan}>{g.header}</td>
                  </tr>
                );
              }
              const { row, index } = item;
              const key = rowKey(row);
              const canExpand = expandable && (isExpandable ? isExpandable(row) : true);
              const isOpen = canExpand && expanded.has(key);
              const isSelected = selectable && selection.has(key);
              return (
                <Fragment key={key}>
                  <tr
                    className={[
                      onRowClick && "lq-data-table__row--interactive",
                      isSelected && "lq-data-table__row--selected",
                      isOpen && "lq-data-table__row--open",
                      // La rayure suit la ligne de données, pas le rang dans le DOM : une ligne dépliée
                      // ajoute un <tr> et décalerait sinon toutes les suivantes.
                      index % 2 === 1 && "lq-data-table__row--even",
                      drag?.key === key && "lq-data-table__row--dragged",
                      drag?.overKey === key && drag.key !== key && (drag.after ? "lq-data-table__row--drop-after" : "lq-data-table__row--drop-before"),
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined}
                    data-dt-key={key}
                    onClick={() => onRowClick?.(row)}
                    // Ligne cliquable : atteignable au clavier, Entrée l'active comme un clic. Seule
                    // la ligne elle-même réagit — pas une case ou un bouton qu'elle contient.
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                              e.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                  >
                    {onReorder && (
                      <td className="lq-data-table__control" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="lq-data-table__handle"
                          aria-label={canReorder ? labels.move : labels.moveOff}
                          title={canReorder ? labels.move : labels.moveOff}
                          disabled={!canReorder}
                          onPointerDown={(e) => {
                            if (!canReorder || e.button !== 0) return;
                            e.preventDefault();
                            e.currentTarget.setPointerCapture?.(e.pointerId);
                            setDrag({ key, overKey: null, overGroup: null, after: false });
                          }}
                          onPointerMove={(e) => {
                            if (drag?.key !== key) return;
                            const over = dropTarget(e.clientX, e.clientY);
                            setDrag({ key, overKey: over?.overKey ?? null, overGroup: over?.overGroup ?? null, after: over?.after ?? false });
                          }}
                          onPointerUp={(e) => {
                            if (drag?.key !== key) return;
                            const over = dropTarget(e.clientX, e.clientY) ?? drag;
                            finishDrag({ key, overKey: over.overKey, overGroup: over.overGroup, after: over.after });
                          }}
                          onPointerCancel={() => setDrag(null)}
                          onKeyDown={(e) => {
                            if (!canReorder || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
                            e.preventDefault();
                            moveByKey(key, row, e.key === "ArrowUp" ? -1 : 1);
                          }}
                        >
                          <GripIcon size={14} />
                        </button>
                      </td>
                    )}
                    {expandable && (
                      <td className="lq-data-table__control">
                        {canExpand && (
                          <button
                            type="button"
                            className={["lq-data-table__expander", isOpen && "lq-data-table__expander--open"].filter(Boolean).join(" ")}
                            aria-expanded={isOpen}
                            aria-label={labels.expand}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded(key);
                            }}
                          >
                            <ChevronRightIcon size={14} />
                          </button>
                        )}
                      </td>
                    )}
                    {selectable && (
                      <td className="lq-data-table__control" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={Boolean(isSelected)}
                          onChange={() => toggleRow(key)}
                          label={<span className="lq-visually-hidden">{labels.selectRow}</span>}
                        />
                      </td>
                    )}
                    {visibleColumns.map((col) => (
                      <td key={col.id} style={{ textAlign: col.align ?? "left" }}>
                        {col.accessor(row)}
                      </td>
                    ))}
                  </tr>
                  {isOpen && (
                    <tr className="lq-data-table__detail">
                      <td colSpan={colSpan}>{renderExpanded!(row)}</td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {pageSize && sortedRows.length > 0 && (
        <div className="lq-data-table__footer">
          <span className="lq-data-table__range">
            {labels.range(currentPage * pageSize + 1, Math.min((currentPage + 1) * pageSize, sortedRows.length), sortedRows.length)}
          </span>
          {pageCount > 1 && (
            <nav className="lq-data-table__pages" aria-label="Pagination">
              <button type="button" className="lq-data-table__page" aria-label={labels.previous} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
                <ChevronLeftIcon size={14} />
              </button>
              {pageList(currentPage, pageCount).map((p, i) =>
                p === null ? (
                  <span key={`gap${i}`} className="lq-data-table__gap">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={["lq-data-table__page", p === currentPage && "lq-data-table__page--current"].filter(Boolean).join(" ")}
                    aria-current={p === currentPage ? "page" : undefined}
                    onClick={() => setPage(p)}
                  >
                    {p + 1}
                  </button>
                )
              )}
              <button
                type="button"
                className="lq-data-table__page"
                aria-label={labels.next}
                disabled={currentPage === pageCount - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRightIcon size={14} />
              </button>
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
