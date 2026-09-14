import type { ReactNode } from "react";
import "./InfoText.css";

/** Turns `**bold**`, `*italic*` and `` `code` `` into real elements.
 *
 *  Hand-rolled rather than a markdown library, and the reason is the bundle: this renders four
 *  inline forms inside explanation text that this library ships itself, and pulling a parser into
 *  the main chart bundle to do it would cost more than every description put together. It is
 *  deliberately not general — there is no link, no image, no nesting of bold inside italic — and
 *  the content it renders is written in this repository, never supplied by a caller. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  // One pass, longest markers first: `**` has to be tried before `*`, or every bold would be read
  // as an empty italic followed by a stray asterisk.
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;
    if (token.startsWith("**")) out.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("`")) out.push(<code key={key}>{token.slice(1, -1)}</code>);
    else out.push(<em key={key}>{token.slice(1, -1)}</em>);
    last = match.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export interface InfoTextProps {
  /** The description, in this library's own small dialect:
   *
   *  - a blank line separates paragraphs;
   *  - a line starting with `## ` is a section heading;
   *  - consecutive lines starting with `- ` are one list;
   *  - `**bold**`, `*italic*` and `` `code` `` inside any of them.
   *
   *  It replaces a single block rendered with `white-space: pre-line`, which could show line
   *  breaks and nothing else: no heading a reader could scan for, and no way to make the one
   *  sentence that matters look like it. */
  children: string;
}

/** One explanation, rendered as real paragraphs, headings and lists.
 *
 *  These texts are read by someone who has just clicked an unfamiliar indicator, wondering what it
 *  is and whether it answers their question. That reader scans before they read, which an unbroken
 *  wall of prose makes impossible — so the shape of the text is part of the explanation, not
 *  decoration on top of it. */
export function InfoText({ children }: InfoTextProps) {
  const blocks: ReactNode[] = [];
  const lines = children.split("\n");
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(" ");
    blocks.push(
      <p key={`p-${blocks.length}`} className="lq-info-text__paragraph">
        {inline(text, `p${blocks.length}`)}
      </p>,
    );
    paragraph = [];
  };
  const flushList = () => {
    if (list.length === 0) return;
    const items = list;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="lq-info-text__list">
        {items.map((item, i) => (
          <li key={i}>{inline(item, `l${blocks.length}-${i}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push(
        <h4 key={`h-${blocks.length}`} className="lq-info-text__heading">
          {inline(line.slice(3), `h${blocks.length}`)}
        </h4>,
      );
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      list.push(line.slice(2));
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();

  return <div className="lq-info-text">{blocks}</div>;
}
