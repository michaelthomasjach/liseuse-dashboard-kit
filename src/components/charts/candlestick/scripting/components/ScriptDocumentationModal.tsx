import { useEffect, useRef, useState } from "react";
import { Modal } from "../../../../primitives/Modal";
import { CodeBlock } from "../../../../primitives/CodeBlock";
import { SCRIPT_API_REFERENCE } from "../scriptApiReference";
import { SCRIPT_DIAGRAM_REGISTRY } from "../scriptDiagramRegistry";
import { ScriptInteractiveTutorial } from "./ScriptInteractiveTutorial";
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

  // Scroll-spy: highlights whichever section's own heading has scrolled past the content pane's
  // own top edge most recently — a plain scroll listener recomputing "which heading is now
  // topmost" rather than IntersectionObserver, since a section can be taller than the whole
  // viewport (the "example"/"exemples" ones especially), where IntersectionObserver's own
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
      let current = SCRIPT_API_REFERENCE[0]?.id;
      for (const section of SCRIPT_API_REFERENCE) {
        const el = document.getElementById(`lq-script-docs-${section.id}`);
        if (!el) continue;
        // 80px: a heading counts as "current" once it's crossed near the top of the pane, not
        // only once it's exactly flush with it — matches this heading's own `scroll-margin-top`
        // used for the anchor-link jump below, so the two stay visually consistent with each other.
        if (el.getBoundingClientRect().top - containerTop <= 80) current = section.id;
      }
      if (current) setActiveId(current);
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
    document.getElementById(`lq-script-docs-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <Modal open={open} onClose={onClose} title="Documentation de l'éditeur de script" size="fullscreen" footer={null}>
      <div className="lq-script-docs">
        <nav className="lq-script-docs__nav">
          {SCRIPT_API_REFERENCE.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollToSection(section.id)}
              className={["lq-script-docs__nav-item", section.id === activeId && "lq-script-docs__nav-item--active"]
                .filter(Boolean)
                .join(" ")}
            >
              {section.title}
            </button>
          ))}
        </nav>
        <div className="lq-script-docs__content" ref={contentRef}>
          {SCRIPT_API_REFERENCE.map((section) => (
            <section key={section.id} id={`lq-script-docs-${section.id}`} className="lq-script-docs__section">
              <h3 className="lq-script-docs__section-title">{section.title}</h3>
              {section.blocks.map((block, i) => {
                if (block.kind === "heading") return <h4 key={i} className="lq-script-docs__example-heading">{block.text}</h4>;
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
                return <CodeBlock key={i} code={block.code ?? ""} language="JavaScript" className="lq-script-docs__code" />;
              })}
              {/* The "tutorial" section's own live, editable walkthrough — a whole-section override
                  rather than a block kind: unlike every other block, it owns its own running script
                  engine and step state, which plain data (ScriptReferenceBlock) has no way to express. */}
              {section.id === "tutorial" && <ScriptInteractiveTutorial />}
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
}
