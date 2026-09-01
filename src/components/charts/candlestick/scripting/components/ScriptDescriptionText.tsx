import type { ReactNode } from "react";
import "./ScriptDescriptionText.css";

/** Inline marks, longest opener first so `**gras**` is never read as an empty `*` followed by
 *  `*gras*`. Each alternative captures its own content, and the group that matched decides the
 *  element — which is why the order here and the order of the checks below have to stay in step. */
const INLINE_RE = /\*\*(.+?)\*\*|__(.+?)__|--(.+?)--|\*(.+?)\*/g;

const BIG_TITLE_RE = /^\s*\/\/\/(.+?)\/\/\/\s*$/;
const SUBTITLE_RE = /^\s*\/\/(.+?)\/\/\s*$/;

/** Applies the inline marks to one line of text. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;

  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${match.index}`;
    const [, bold, underline, strike, italic] = match;
    if (bold !== undefined) nodes.push(<strong key={key}>{bold}</strong>);
    else if (underline !== undefined) nodes.push(<u key={key}>{underline}</u>);
    else if (strike !== undefined) nodes.push(<s key={key}>{strike}</s>);
    else if (italic !== undefined) nodes.push(<em key={key}>{italic}</em>);
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export interface ScriptDescriptionTextProps {
  text: string;
}

/** Renders a script's own `@description` text (see scriptDescription.ts) in this library's own
 *  lightweight markup — deliberately not Markdown: the set is small and closed (two heading levels
 *  and four inline marks), which keeps it explainable in one table of the docs and keeps a Markdown
 *  parser out of the bundle.
 *
 *  A blank line starts a new paragraph; a single newline is a line break within one. Author-written
 *  text is only ever rendered as these elements — never as HTML — so a description can't inject
 *  markup into the page it's shown in. */
export function ScriptDescriptionText({ text }: ScriptDescriptionTextProps) {
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    const key = `p-${blocks.length}`;
    blocks.push(
      <p className="lq-script-description__paragraph" key={key}>
        {paragraph.map((line, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {renderInline(line, `${key}-${i}`)}
          </span>
        ))}
      </p>
    );
    paragraph = [];
  }

  for (const line of text.split("\n")) {
    if (line.trim() === "") {
      flushParagraph();
      continue;
    }
    // `///` before `//` — a big title also matches the subtitle pattern, never the other way round.
    const big = BIG_TITLE_RE.exec(line);
    if (big) {
      flushParagraph();
      blocks.push(
        <h3 className="lq-script-description__title" key={`h3-${blocks.length}`}>
          {renderInline(big[1].trim(), `h3-${blocks.length}`)}
        </h3>
      );
      continue;
    }
    const sub = SUBTITLE_RE.exec(line);
    if (sub) {
      flushParagraph();
      blocks.push(
        <h4 className="lq-script-description__subtitle" key={`h4-${blocks.length}`}>
          {renderInline(sub[1].trim(), `h4-${blocks.length}`)}
        </h4>
      );
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();

  return <div className="lq-script-description">{blocks}</div>;
}
