import { Fragment, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, SearchIcon } from "../icons";
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
};

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
  const colSpan = visibleColumns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0);
  const showToolbar = Boolean(toolbar || searchable || exportable || columnPicker);

  const rootClass = [
    "lq-data-table",
    density === "condensed" && "lq-data-table--condensed",
    striped && "lq-data-table--striped",
    hover && "lq-data-table--hover",
    bordered && "lq-data-table--bordered",
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
        <table>
          <thead>
            <tr>
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
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="lq-data-table__empty">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {pageRows.map((row, index) => {
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
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined}
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
