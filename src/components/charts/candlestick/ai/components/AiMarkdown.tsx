import { Fragment, type ReactNode } from "react";

/**
 * The assistant's answers are Markdown (titles, **bold**, *italics*, `code`, links, lists, tables, quotes). This
 * renders that subset as elements styled by the active theme's tokens (see AiPanel.css, `.lq-ai-md`), instead of
 * showing the raw asterisks and hashes. Deliberately small and dependency-free: no HTML is ever injected, every
 * piece of text goes through React, and only http(s) and mailto links become anchors.
 */

const SAFE_URL = /^(?:https?:\/\/|mailto:)/i;

/** Inline Markdown: links, bare URLs, `code`, **bold**, __bold__, *italic*, _italic_, ~~strike~~. */
const INLINE_SOURCE =
  /(\[([^\]]+)\]\(([^)\s]+)\))|(`([^`]+)`)|(\*\*([^*]+?)\*\*|__([^_]+?)__)|(~~([^~]+?)~~)|((?<![\w*])\*([^*\s][^*]*?)\*(?![\w*])|(?<!\w)_([^_\s][^_]*?)_(?!\w))|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

export function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  // A fresh expression per call: the renderer recurses (bold inside a link…), and a shared /g regex would have its
  // lastIndex reset by the inner call, looping the outer one forever.
  const re = new RegExp(INLINE_SOURCE.source, "g");
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${n++}`;
    if (m[1]) {
      const href = m[3] ?? "";
      out.push(
        SAFE_URL.test(href) ? (
          <a key={key} href={href} target="_blank" rel="noreferrer noopener">
            {renderInline(m[2] ?? "", key)}
          </a>
        ) : (
          <Fragment key={key}>{renderInline(m[2] ?? "", key)}</Fragment>
        ),
      );
    } else if (m[4]) out.push(<code key={key}>{m[5]}</code>);
    else if (m[6]) out.push(<strong key={key}>{renderInline(m[7] ?? m[8] ?? "", key)}</strong>);
    else if (m[9]) out.push(<s key={key}>{renderInline(m[10] ?? "", key)}</s>);
    else if (m[11]) out.push(<em key={key}>{renderInline(m[12] ?? m[13] ?? "", key)}</em>);
    else if (m[14])
      out.push(
        <a key={key} href={m[14]} target="_blank" rel="noreferrer noopener">
          {m[14]}
        </a>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
const TABLE_RULE = /^\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?$/;
const isTableLine = (line: string): boolean => line.trim().startsWith("|") && line.trim().indexOf("|", 1) > 0;

type ListKind = "ul" | "ol";

export function AiMarkdown({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];
  let list: { kind: ListKind; items: string[]; start: number } | null = null;
  let quote: string[] = [];
  let table: string[] = [];
  let code: string[] | null = null;
  const k = () => `b${blocks.length}`;

  const flushPara = () => {
    if (para.length) {
      const key = k();
      blocks.push(
        <p key={key}>
          {para.map((l, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {renderInline(l, `${key}-${i}`)}
            </Fragment>
          ))}
        </p>,
      );
    }
    para = [];
  };
  const flushList = () => {
    if (list) {
      const key = k();
      const items = list.items.map((it, i) => <li key={i}>{renderInline(it, `${key}-${i}`)}</li>);
      blocks.push(
        list.kind === "ol" ? (
          <ol key={key} start={list.start}>
            {items}
          </ol>
        ) : (
          <ul key={key}>{items}</ul>
        ),
      );
    }
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) {
      const key = k();
      blocks.push(<blockquote key={key}>{renderInline(quote.join(" "), key)}</blockquote>);
    }
    quote = [];
  };
  const flushTable = () => {
    if (table.length >= 2) {
      const key = k();
      const rows = table.filter((l) => !TABLE_RULE.test(l.trim())).map(cells);
      const [head = [], ...body] = rows;
      blocks.push(
        <div key={key} className="lq-ai-md__table">
          <table>
            <thead>
              <tr>
                {head.map((h, i) => (
                  <th key={i}>{renderInline(h, `${key}-h${i}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j}>{renderInline(c, `${key}-${i}-${j}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (table.length === 1) para.push(table[0] as string);
    table = [];
  };
  const flushAll = () => {
    flushTable();
    flushPara();
    flushList();
    flushQuote();
  };

  for (const raw of lines) {
    // Fenced code: kept verbatim.
    if (/^\s*```/.test(raw)) {
      if (code) {
        blocks.push(
          <pre key={k()}>
            <code>{code.join("\n")}</code>
          </pre>,
        );
        code = null;
      } else {
        flushAll();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(raw);
      continue;
    }
    const line = raw.trim();
    if (isTableLine(line)) {
      flushPara();
      flushList();
      flushQuote();
      table.push(line);
      continue;
    }
    flushTable();
    if (!line) {
      flushPara();
      flushList();
      flushQuote();
      continue;
    }
    // Titre : « ## … », ou une ligne entièrement en gras (titre que le modèle écrit souvent ainsi).
    const heading = /^(#{1,6})\s+(.*?)\s*#*$/.exec(line) ?? (/^\*\*([^*]+?)\*\*:?$/.test(line) ? ["", "###", line.replace(/^\*\*|\*\*:?$/g, "")] : null);
    if (heading) {
      flushAll();
      const level = Math.min(6, heading[1]!.length + 2);
      const Tag = `h${Math.max(3, level)}` as "h3" | "h4" | "h5" | "h6";
      const key = k();
      // Titre numéroté (« 1. Titre — thème ») : numéro en grand, façon magazine (« 01. »), aussi haut que le titre et
      // son sous-titre réunis ; le sous-titre est ce qui suit « — » (ou « | »).
      const numbered = /^(\d{1,2})[.)]\s+(.+)$/.exec(heading[2] ?? "");
      if (numbered) {
        const [title, kicker] = numbered[2]!.split(/\s+[—|]\s+/, 2) as [string, string | undefined];
        blocks.push(
          <Tag key={key} className={`lq-ai-md__h lq-ai-md__h--${heading[1]!.length} lq-ai-md__h--numbered`}>
            <span className="lq-ai-md__h-num" aria-hidden="true">{numbered[1]!.padStart(2, "0")}.</span>
            <span className="lq-ai-md__h-title">{renderInline(title, key)}</span>
            {kicker && <span className="lq-ai-md__h-kicker">{renderInline(kicker, `${key}k`)}</span>}
          </Tag>,
        );
        continue;
      }
      blocks.push(
        <Tag key={key} className={`lq-ai-md__h lq-ai-md__h--${heading[1]!.length}`}>
          {renderInline(heading[2] ?? "", key)}
        </Tag>,
      );
      continue;
    }
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushAll();
      blocks.push(<hr key={k()} />);
      continue;
    }
    const q = /^>\s?(.*)$/.exec(line);
    if (q) {
      flushPara();
      flushList();
      quote.push(q[1] ?? "");
      continue;
    }
    const ul = /^[-*•+]\s+(.*)$/.exec(line);
    const ol = /^(\d+)[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushPara();
      flushQuote();
      const kind: ListKind = ul ? "ul" : "ol";
      if (!list || list.kind !== kind) {
        flushList();
        list = { kind, items: [], start: ol ? Number(ol[1]) : 1 };
      }
      list.items.push((ul ? ul[1] : ol![2]) ?? "");
      continue;
    }
    flushList();
    flushQuote();
    para.push(line);
  }
  if (code) blocks.push(<pre key={k()}><code>{(code as string[]).join("\n")}</code></pre>);
  flushAll();
  return <div className={["lq-ai-md", className].filter(Boolean).join(" ")}>{blocks}</div>;
}
