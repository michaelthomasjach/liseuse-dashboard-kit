import { useState } from "react";
import { CheckIcon, CopyIcon } from "../icons";
import { highlightJavaScript } from "./highlightJavaScript";
import "./CodeBlock.css";

export interface CodeBlockProps {
  code: string;
  /** Shown in the header when `filename` isn't set, e.g. "TypeScript". */
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  /** Opt-in syntax colouring. Off by default so every existing call site keeps the plain rendering
   *  it was written against; the documentation turns it on. The colours come from the `--lq-code-*`
   *  tokens, which are the one palette that stays coloured under the e-ink theme — see tokens.css. */
  highlight?: "javascript";
  className?: string;
}

/** Monospace code snippet with a copy-to-clipboard button, optionally syntax-coloured.
 *
 *  Highlighting is opt-in (`highlight="javascript"`) and stays off by default. It originally didn't
 *  exist here at all, to keep the bundle from pulling in a highlighter — but this library now ships
 *  the Lezer JavaScript grammar anyway for the script editor and its `Variable` analysis, so
 *  colouring a snippet costs nothing extra and reuses the very same grammar the editor does. */
export function CodeBlock({ code, language, filename, showLineNumbers = false, highlight, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = code.replace(/\n$/, "").split("\n");
  const highlighted = highlight === "javascript" ? highlightJavaScript(code) : null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API unavailable or permission denied — nothing else to do.
    }
  }

  return (
    <div className={["lq-code-block", className].filter(Boolean).join(" ")}>
      <div className="lq-code-block__header">
        <span className="lq-code-block__label">{filename ?? language ?? "code"}</span>
        <button type="button" className="lq-code-block__copy" onClick={handleCopy}>
          {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <pre className="lq-code-block__pre">
        <code>
          {lines.map((line, i) => (
            <span key={i} className="lq-code-block__line">
              {showLineNumbers && <span className="lq-code-block__line-number">{i + 1}</span>}
              <span className="lq-code-block__line-content">
                {highlighted
                  ? (highlighted[i] ?? []).map((token, t) => (
                      <span key={t} className={token.className ?? undefined}>
                        {token.text}
                      </span>
                    ))
                  : line.length > 0
                    ? line
                    : " "}
                {highlighted && line.length === 0 ? " " : null}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
