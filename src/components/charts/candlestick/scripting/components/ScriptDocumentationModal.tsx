import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "../../../../primitives/Modal";
import { CodeBlock } from "../../../../primitives/CodeBlock";
import { SearchIcon, ChevronRightIcon, CloseIcon } from "../../../../icons";
import { SCRIPT_API_REFERENCE } from "../scriptApiReference";
import { SCRIPT_DIAGRAM_REGISTRY } from "../scriptDiagramRegistry";
import { SCRIPT_DOCS_NAV, headingAnchorId, searchDocsNav } from "../scriptDocsNav";
import { ScriptInteractiveTutorial } from "./ScriptInteractiveTutorial";
import { ScriptKeywordsIndex } from "./ScriptKeywordsIndex";
import { ScriptExamplesSection } from "./ScriptExamplesSection";
import "./ScriptDocumentationModal.css";

export interface ScriptDocumentationModalProps {
  open: boolean;
  onClose: () => void;
}

/** The script editor's own "Documentation" button — an exhaustive, offline reference for every
 *  API surface the sandbox exposes (see `scriptApiReference.ts`, this component's own content
 *  source), not just a quick-start. Plain `Modal size="fullscreen"` — unlike `ScriptEditorPanel`'s
 *  own `ScriptEditorWindow`, reading a reference doc while writing code has no reason to stay
 *  non-blocking or resizable, and a full-height scrollable page is the most readable shape for
 *  genuinely long reference content. */
export function ScriptDocumentationModal({ open, onClose }: ScriptDocumentationModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState(SCRIPT_API_REFERENCE[0]?.id);
  // The specific sub-heading (if any) currently under the reader's eye, *within* the active
  // section — exigence : le menu précédent était « difficile de se retrouver dedans ». Two things
  // fix that: this (so the exact sub-topic you're reading is bolded, not just its whole section —
  // see the scroll-spy effect below) and `showHeadingsFor` further down (only *one* section's own
  // sub-titles are ever visible at a time, instead of all ~13 sections' worth stacked permanently).
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Shared by the nav's own section/heading filter and ScriptKeywordsIndex's own list — one search
  // box, both surfaces narrow down together (exigence : « je veux un input de recherche »).
  const normalizedQuery = query.trim().toLowerCase();
  // Whether the "keywords" section (see scriptApiReference.ts's own doc on that synthetic first
  // entry) stays stuck to the top of the content pane while the rest scrolls past underneath it —
  // exigence : « je peux décider de PIN cette section en haut ». Off by default: pinning is
  // something the reader opts into, not a permanent fixture.
  const [keywordsPinned, setKeywordsPinned] = useState(false);

  // The nav tree narrowed to whatever matches `query` — titles *and* the documentation text under
  // them, see searchDocsNav's own doc. Matching titles alone used to mean a term like `close`
  // returned nothing at all: no heading is named after it, it only ever appears in the prose and
  // the code samples, which is exactly where a reader looking it up expects it to be found.
  const filteredNav = useMemo(() => searchDocsNav(query), [query]);

  // Scroll-spy: highlights whichever section (and, within it, whichever sub-heading) has scrolled
  // past the content pane's own top edge most recently — a plain scroll listener recomputing
  // "what's topmost now" rather than IntersectionObserver, since a section can be taller than the
  // whole viewport (the "example"/"exemples" ones especially), where IntersectionObserver's own
  // "is this element intersecting" boolean stops distinguishing "just started" from "about to end"
  // long before the next section begins. Re-attached on every `open` (Modal unmounts this whole
  // tree while closed, so any previous listener is already gone with it) rather than depending on
  // `contentRef.current` directly, which never itself changes identity in a way an effect can see.
  useEffect(() => {
    if (!open) return;
    const content = contentRef.current;
    if (!content) return;
    function onScroll() {
      if (!content) return;
      const containerTop = content.getBoundingClientRect().top;
      let currentSection = SCRIPT_DOCS_NAV[0]?.id;
      let currentHeading: string | null = null;
      for (const section of SCRIPT_DOCS_NAV) {
        const el = document.getElementById(`lq-script-docs-${section.id}`);
        if (!el) continue;
        // 80px: a heading counts as "current" once it's crossed near the top of the pane, not
        // only once it's exactly flush with it — matches this heading's own `scroll-margin-top`
        // used for the anchor-link jump below, so the two stay visually consistent with each other.
        if (el.getBoundingClientRect().top - containerTop <= 80) {
          currentSection = section.id;
          currentHeading = null; // re-derived just below — a new section starts with none of its own crossed yet
          for (const heading of section.headings) {
            const headingEl = document.getElementById(heading.id);
            if (headingEl && headingEl.getBoundingClientRect().top - containerTop <= 80) currentHeading = heading.id;
          }
        }
      }
      if (currentSection) setActiveId(currentSection);
      setActiveHeadingId(currentHeading);
    }
    content.addEventListener("scroll", onScroll);
    onScroll();
    return () => content.removeEventListener("scroll", onScroll);
  }, [open]);

  // A plain `<a href="#...">` here would trigger the browser's own real hash-navigation on the
  // *whole document* — inside Storybook's own iframe (or any host app with its own router), that
  // reads as this modal randomly redirecting instead of just scrolling to the section, and even
  // without that it'd scroll the whole page rather than just this modal's own content pane.
  // Scrolling the target into view directly, scoped to whichever scrollable ancestor actually
  // contains it (`.lq-script-docs__content` here), avoids touching the URL at all.
  function scrollToSection(id: string) {
    setActiveId(id);
    setActiveHeadingId(null);
    document.getElementById(`lq-script-docs-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Same mechanism as scrollToSection above, generalized to any anchor id — a heading's own id
  // (nav sub-items, see SCRIPT_DOCS_NAV) or a keyword's own resolved target (ScriptKeywordsIndex,
  // see keywordAnchorId — may itself just be a plain section id, which this handles identically).
  // Also updates activeId/activeHeadingId immediately, the same way scrollToSection already does —
  // without this, clicking a sub-title or a keyword wouldn't expand its own section in the nav (see
  // showHeadingsFor below) until the scroll-spy effect caught up on its own, a beat later.
  function scrollToAnchor(anchorId: string) {
    const owningSection = SCRIPT_DOCS_NAV.find((section) => section.headings.some((h) => h.id === anchorId));
    if (owningSection) {
      setActiveId(owningSection.id);
      setActiveHeadingId(anchorId);
    } else {
      setActiveId(anchorId.replace(/^lq-script-docs-/, ""));
      setActiveHeadingId(null);
    }
    document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <Modal open={open} onClose={onClose} title="Documentation de l'éditeur de script" size="fullscreen" footer={null}>
      <div className="lq-script-docs">
        <nav className="lq-script-docs__nav">
          <div className="lq-script-docs__search">
            <SearchIcon size={13} />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              aria-label="Rechercher dans la documentation"
            />
            {/* Rendered only when there is something to clear, so the box doesn't carry a dead
                control at rest. `type="search"` draws a native clear button of its own in some
                engines and none at all in others — this one is there in every engine, and it also
                gives the focus back to the field so a new search can be typed straight away. */}
            {query !== "" && (
              <button
                type="button"
                className="lq-script-docs__search-clear"
                onClick={() => {
                  setQuery("");
                  searchInputRef.current?.focus();
                }}
                aria-label="Effacer la recherche"
                title="Effacer la recherche"
              >
                <CloseIcon size={12} />
              </button>
            )}
          </div>
          {filteredNav.map((section, index) => {
            // Only the active section's own sub-titles show (while not searching) — the previous
            // design showed all ~13 sections' worth stacked permanently, which is exactly what made
            // the menu hard to get your bearings in. Search overrides this: every section kept by
            // the filter above already only carries its own *matching* headings, so showing all of
            // those is the point, not clutter.
            const showHeadings = section.headings.length > 0 && (section.id === activeId || normalizedQuery !== "");
            // A label whenever the group changes from the previous *visible* section (not the
            // previous entry in the unfiltered SCRIPT_DOCS_NAV) — exigence : « organise mieux le
            // menu, avec des groupes ». Recomputed off `filteredNav` itself so a search that hides
            // every section of a group also hides that group's own now-orphaned label.
            const showGroupLabel = index === 0 || filteredNav[index - 1].group !== section.group;
            return (
              <div key={section.id} className="lq-script-docs__nav-section">
                {showGroupLabel && <div className="lq-script-docs__nav-group-label">{section.group}</div>}
                <button
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className={[
                    "lq-script-docs__nav-item",
                    section.id === "tutorial" && "lq-script-docs__nav-item--tutorial",
                    section.id === activeId && "lq-script-docs__nav-item--active",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {section.headings.length > 0 && (
                    <ChevronRightIcon
                      size={11}
                      className={["lq-script-docs__nav-chevron", showHeadings && "lq-script-docs__nav-chevron--open"].filter(Boolean).join(" ")}
                    />
                  )}
                  <span className="lq-script-docs__nav-item-label">{section.title}</span>
                </button>
                {showHeadings && (
                  <div className="lq-script-docs__nav-subitems">
                    {section.headings.map((heading) => (
                      <button
                        key={heading.id}
                        type="button"
                        className={[
                          "lq-script-docs__nav-subitem",
                          heading.id === activeHeadingId && "lq-script-docs__nav-subitem--active",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => scrollToAnchor(heading.id)}
                        title={heading.text}
                      >
                        {heading.text}
                      </button>
                    ))}
                  </div>
                )}
                {/* Separates the keywords index (a *tool* — search/browse everything) from the
                    actual reading order starting right below it — by id, not position, so it
                    still lands in the right place if search ever filters "keywords" itself out. */}
                {section.id === "keywords" && <div className="lq-script-docs__nav-divider" />}
              </div>
            );
          })}
        </nav>
        <div className="lq-script-docs__content" ref={contentRef}>
          {SCRIPT_API_REFERENCE.map((section) => (
            <section
              key={section.id}
              id={`lq-script-docs-${section.id}`}
              className={[
                "lq-script-docs__section",
                section.id === "keywords" && keywordsPinned && "lq-script-docs__section--pinned",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <h3 className="lq-script-docs__section-title">{section.title}</h3>
              {/* "keywords"/"tutorial"/"examples" are each a whole-section override — none of the
                  three owns real `blocks` (see scriptApiReference.ts's own doc on each entry): a
                  searchable index with its own pin state, a live-editable walkthrough with its own
                  running script engine, and six independently-runnable example scripts each with
                  their own — plain data has no way to express any of the three. Every other
                  section renders its blocks normally below. */}
              {section.id === "keywords" && (
                <ScriptKeywordsIndex
                  query={query}
                  pinned={keywordsPinned}
                  onTogglePin={() => setKeywordsPinned((p) => !p)}
                  onKeywordClick={scrollToAnchor}
                />
              )}
              {section.id === "tutorial" && <ScriptInteractiveTutorial />}
              {section.id === "examples" && <ScriptExamplesSection />}
              {section.id !== "keywords" &&
                section.id !== "examples" &&
                section.blocks.map((block, i) => {
                  if (block.kind === "heading")
                    return (
                      <h4 key={i} id={headingAnchorId(section.id, block.text ?? "")} className="lq-script-docs__example-heading">
                        {block.text}
                      </h4>
                    );
                  if (block.kind === "diagram") {
                    const Diagram = block.diagramKey ? SCRIPT_DIAGRAM_REGISTRY[block.diagramKey] : undefined;
                    return Diagram ? <Diagram key={i} /> : null;
                  }
                  if (block.kind === "text") return <p key={i}>{block.text}</p>;
                  if (block.kind === "list")
                    return (
                      <ul key={i}>
                        {block.items?.map((item, j) => <li key={j}>{item}</li>)}
                      </ul>
                    );
                  return <CodeBlock key={i} code={block.code ?? ""} language="JavaScript" highlight="javascript" className="lq-script-docs__code" />;
                })}
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
}
