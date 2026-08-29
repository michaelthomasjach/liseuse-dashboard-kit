import { Modal } from "../../../../primitives/Modal";
import { CodeBlock } from "../../../../primitives/CodeBlock";
import { SCRIPT_API_REFERENCE } from "../scriptApiReference";
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
  return (
    <Modal open={open} onClose={onClose} title="Documentation de l'éditeur de script" size="fullscreen" footer={null}>
      <div className="lq-script-docs">
        <nav className="lq-script-docs__nav">
          {SCRIPT_API_REFERENCE.map((section) => (
            <a key={section.id} href={`#lq-script-docs-${section.id}`} className="lq-script-docs__nav-item">
              {section.title}
            </a>
          ))}
        </nav>
        <div className="lq-script-docs__content">
          {SCRIPT_API_REFERENCE.map((section) => (
            <section key={section.id} id={`lq-script-docs-${section.id}`} className="lq-script-docs__section">
              <h3 className="lq-script-docs__section-title">{section.title}</h3>
              {section.blocks.map((block, i) => {
                if (block.kind === "text") return <p key={i}>{block.text}</p>;
                if (block.kind === "list")
                  return (
                    <ul key={i}>
                      {block.items?.map((item, j) => <li key={j}>{item}</li>)}
                    </ul>
                  );
                return <CodeBlock key={i} code={block.code ?? ""} language="JavaScript" className="lq-script-docs__code" />;
              })}
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
}
