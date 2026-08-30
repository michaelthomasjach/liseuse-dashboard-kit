import { PinIcon } from "../../../../icons";
import { SCRIPT_API_COMPLETIONS } from "../scriptApiCompletions";
import { keywordAnchorId } from "../scriptDocsNav";
import "./ScriptKeywordsIndex.css";

export interface ScriptKeywordsIndexProps {
  query: string;
  pinned: boolean;
  onTogglePin: () => void;
  onKeywordClick: (anchorId: string) => void;
}

/** One entry's own group — namespace prefix for a dotted label (`"market.close"` → `"market.*"`),
 *  a fixed bucket for the handful of bare-dot indicator-handle methods (`.value`, `.line`…, no
 *  namespace of their own to key on), and the two standalone entries (`alert`, `console.log`, which
 *  read oddly as their own single-item "namespace"). Order here is display order, matching
 *  `SCRIPT_API_REFERENCE`'s own section order so the index reads as a condensed table of contents. */
function groupFor(label: string): string {
  if (label.startsWith(".")) return "chart.indicator(id) — méthodes";
  if (label === "alert" || label === "console.log") return "Autres";
  const namespace = label.split(".")[0];
  return `${namespace}.*`;
}
const GROUP_ORDER = ["market.*", "chart.*", "chart.indicator(id) — méthodes", "plot.*", "state.*", "bar.*", "math.*", "ta.*", "Autres"];

/** The documentation's own searchable index of every keyword `SCRIPT_API_COMPLETIONS` knows about
 *  (exigence : « la liste de tout les mots clefs disponibles ») — rendered by
 *  `ScriptDocumentationModal.tsx` as a whole-section override for `id === "keywords"`, the same
 *  pattern `ScriptInteractiveTutorial` already uses for `id === "tutorial"`. `query` is owned by the
 *  parent (shared with the nav's own section/heading filter — one search box, both surfaces filter
 *  together); `pinned` likewise, so the parent can also decide whether this section should stick to
 *  the top of the scrollable content pane while the reader scrolls past it. */
export function ScriptKeywordsIndex({ query, pinned, onTogglePin, onKeywordClick }: ScriptKeywordsIndexProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? SCRIPT_API_COMPLETIONS.filter(
        (c) => c.label.toLowerCase().includes(normalizedQuery) || c.detail.toLowerCase().includes(normalizedQuery)
      )
    : SCRIPT_API_COMPLETIONS;

  const groups = new Map<string, typeof SCRIPT_API_COMPLETIONS>();
  for (const completion of filtered) {
    const group = groupFor(completion.label);
    const existing = groups.get(group);
    if (existing) existing.push(completion);
    else groups.set(group, [completion]);
  }

  return (
    <div className="lq-script-keywords">
      <div className="lq-script-keywords__header">
        <span className="lq-script-keywords__count">
          {filtered.length} mot{filtered.length !== 1 ? "s" : ""}-clé{filtered.length !== 1 ? "s" : ""}
          {normalizedQuery ? ` correspondant${filtered.length !== 1 ? "s" : ""}` : " au total"}
        </span>
        <button
          type="button"
          className={["lq-script-keywords__pin", pinned && "lq-script-keywords__pin--active"].filter(Boolean).join(" ")}
          onClick={onTogglePin}
          aria-pressed={pinned}
          title={pinned ? "Détacher cette section (elle redevient une section normale)" : "Épingler cette section en haut pendant le défilement"}
        >
          <PinIcon size={13} />
          {pinned ? "Épinglé" : "Épingler"}
        </button>
      </div>
      {filtered.length === 0 ? (
        <p className="lq-script-keywords__empty">Aucun mot-clé ne correspond à « {query} ».</p>
      ) : (
        GROUP_ORDER.filter((group) => groups.has(group)).map((group) => (
          <div key={group} className="lq-script-keywords__group">
            <span className="lq-script-keywords__group-title">{group}</span>
            <div className="lq-script-keywords__list">
              {groups.get(group)?.map((completion) => (
                <button
                  key={completion.label}
                  type="button"
                  className="lq-script-keywords__item"
                  onClick={() => onKeywordClick(keywordAnchorId(completion.label))}
                  title={completion.detail}
                >
                  <span className="lq-script-keywords__item-label">{completion.label}</span>
                  <span className="lq-script-keywords__item-detail">{completion.detail}</span>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
