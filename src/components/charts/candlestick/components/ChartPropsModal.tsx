import { useMemo, useState } from "react";
import { Modal } from "../../../primitives/Modal";
import { SearchIcon, CloseIcon } from "../../../icons";
import { CHART_PROPS_REFERENCE } from "../chartPropsReference";
import "./ChartPropsModal.css";

export interface ChartPropsModalProps {
  open: boolean;
  onClose: () => void;
}

/** Every prop `CandlestickChart` accepts, grouped by what it is for, searchable by name, type or
 *  description.
 *
 *  Reads from a file generated out of the interface's own doc comments (see
 *  `chartPropsReference.ts`) rather than a hand-written copy: those comments are already the
 *  truth, and a second copy would drift the first time a prop changed — a reference that lies
 *  about the API is worse than no reference.
 *
 *  Grouped rather than alphabetical because the question this answers is almost never "what does
 *  `onScriptAlert` do" — it is "what can I hand this chart about alerts", which an alphabetical
 *  list scatters across the page. */
export function ChartPropsModal({ open, onClose }: ChartPropsModalProps) {
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return CHART_PROPS_REFERENCE;
    // Matched on the description too, not just the name: someone looking for "plein écran" should
    // find `fullscreenToggle` without already knowing it is called that.
    return CHART_PROPS_REFERENCE.map((section) => ({
      ...section,
      props: section.props.filter(
        (p) => p.name.toLowerCase().includes(q) || p.type.toLowerCase().includes(q) || p.doc.toLowerCase().includes(q),
      ),
    })).filter((section) => section.props.length > 0);
  }, [query]);

  const total = useMemo(() => CHART_PROPS_REFERENCE.reduce((n, s) => n + s.props.length, 0), []);
  const shown = sections.reduce((n, s) => n + s.props.length, 0);

  return (
    <Modal open={open} onClose={onClose} title="Props du graphique" size="fullscreen" footer={null}>
      <div className="lq-chart-props">
        <div className="lq-chart-props__toolbar">
          <div className="lq-chart-props__search">
            <SearchIcon size={13} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un nom, un type, une description…"
              aria-label="Rechercher dans les props"
              autoFocus
            />
            {query !== "" && (
              <button type="button" onClick={() => setQuery("")} aria-label="Effacer la recherche">
                <CloseIcon size={11} />
              </button>
            )}
          </div>
          <span className="lq-chart-props__count">
            {shown === total ? `${total} props` : `${shown} sur ${total}`}
          </span>
        </div>

        {sections.length === 0 && <p className="lq-chart-props__empty">Aucune prop ne correspond à cette recherche.</p>}

        {sections.map((section) => (
          <section key={section.title} className="lq-chart-props__section">
            <h3 className="lq-chart-props__section-title">{section.title}</h3>
            <div className="lq-chart-props__list">
              {section.props.map((prop) => (
                <article key={prop.name} className="lq-chart-props__item">
                  <div className="lq-chart-props__head">
                    <code className="lq-chart-props__name">{prop.name}</code>
                    {/* Only "requis" is marked. Nearly every prop is optional, so labelling those
                        would be a badge on almost every row saying nothing. */}
                    {prop.required && <span className="lq-chart-props__required">requis</span>}
                  </div>
                  <code className="lq-chart-props__type">{prop.type}</code>
                  <p className="lq-chart-props__doc">{prop.doc}</p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}
