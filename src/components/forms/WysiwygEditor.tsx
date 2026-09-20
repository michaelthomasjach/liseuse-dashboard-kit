import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Select } from "./Select";
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  BulletListIcon,
  CheckIcon,
  ClearFormatIcon,
  CloseIcon,
  CodeIcon,
  ErrorIcon,
  ItalicIcon,
  LinkIcon,
  OrderedListIcon,
  RedoIcon,
  StrikethroughIcon,
  UnderlineIcon,
  UndoIcon,
  UnlinkIcon,
} from "../icons";
import "./field.css";
import "./WysiwygEditor.css";

export type WysiwygTool =
  | "block"
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "bulletList"
  | "orderedList"
  | "alignLeft"
  | "alignCenter"
  | "alignRight"
  | "alignJustify"
  | "link"
  | "code"
  | "clear"
  | "undo"
  | "redo";

export type WysiwygBlock = "p" | "h1" | "h2" | "h3" | "blockquote" | "pre";

/** The toolbar you get when you don't ask for one. The nesting is the grouping: one array per
 *  cluster, drawn with a hairline between clusters. Alignment is deliberately left out — it is the
 *  least used row in most editors and it doubles the toolbar's width on a narrow dashboard column;
 *  pass it explicitly (`alignLeft`…`alignJustify`) when a document really needs it. */
export const WYSIWYG_DEFAULT_TOOLBAR: WysiwygTool[][] = [
  ["block"],
  ["bold", "italic", "underline", "strike"],
  ["bulletList", "orderedList"],
  ["link", "code", "clear"],
  ["undo", "redo"],
];

export interface WysiwygEditorProps {
  /** The document, as an HTML string. Controlled if given — but only *loosely*: the editor is a
   *  contenteditable element, and writing its `innerHTML` back on every keystroke would destroy the
   *  caret, so incoming values are only applied when they differ from what this editor last
   *  emitted. Pass a value that came from `onChange` and nothing moves; pass a different one (a
   *  loaded draft, a reset) and the document is replaced.
   *
   *  It is set as `innerHTML`: whatever you pass is rendered as markup. Sanitise anything that came
   *  from somewhere other than this editor before handing it over — this component does not, and
   *  cannot usefully guess what you consider safe. */
  value?: string;
  /** Initial document for an uncontrolled editor. Ignored once `value` is given. */
  defaultValue?: string;
  /** Fires on every edit with the document's HTML. */
  onChange?: (html: string) => void;
  /** Shown centred in the empty document. */
  placeholder?: string;
  label?: string;
  error?: string;
  helperText?: string;
  /** Which controls the toolbar carries, grouped — see `WYSIWYG_DEFAULT_TOOLBAR`. An empty array
   *  hides the toolbar entirely, which with `readOnly` turns this into a plain rich-text viewer. */
  toolbar?: WysiwygTool[][];
  /** Minimum height of the writing area in px. Default 180. */
  minHeight?: number;
  /** Height at which the writing area stops growing and starts scrolling. Unset by default — the
   *  editor grows with its content. */
  maxHeight?: number;
  /** Paste drops every bit of incoming formatting and inserts plain text. On by default: pasting
   *  from a web page otherwise drags in its fonts, colours and sizes, which is exactly what a kit
   *  with a theme of its own does not want. Set false for a native rich paste. */
  pasteAsPlainText?: boolean;
  disabled?: boolean;
  /** Renders the document without a toolbar and without letting anyone edit it. */
  readOnly?: boolean;
  className?: string;
}

const BLOCK_OPTIONS: { value: WysiwygBlock; label: string }[] = [
  { value: "p", label: "Paragraphe" },
  { value: "h1", label: "Titre 1" },
  { value: "h2", label: "Titre 2" },
  { value: "h3", label: "Titre 3" },
  { value: "blockquote", label: "Citation" },
  { value: "pre", label: "Bloc de code" },
];

const BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "BLOCKQUOTE", "PRE"]);

/** What `queryCommandState` is asked for, keyed by tool. The inline-code and link tools are absent
 *  on purpose: neither has an execCommand state, and both are worked out from the DOM instead. */
const COMMAND_STATE: Partial<Record<WysiwygTool, string>> = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  strike: "strikeThrough",
  bulletList: "insertUnorderedList",
  orderedList: "insertOrderedList",
  alignLeft: "justifyLeft",
  alignCenter: "justifyCenter",
  alignRight: "justifyRight",
  alignJustify: "justifyFull",
};

const COMMAND: Partial<Record<WysiwygTool, string>> = {
  ...COMMAND_STATE,
  undo: "undo",
  redo: "redo",
};

const TOOL_META: Record<Exclude<WysiwygTool, "block">, { label: string; icon: ReactNode }> = {
  bold: { label: "Gras", icon: <BoldIcon size={16} /> },
  italic: { label: "Italique", icon: <ItalicIcon size={16} /> },
  underline: { label: "Souligné", icon: <UnderlineIcon size={16} /> },
  strike: { label: "Barré", icon: <StrikethroughIcon size={16} /> },
  bulletList: { label: "Liste à puces", icon: <BulletListIcon size={16} /> },
  orderedList: { label: "Liste numérotée", icon: <OrderedListIcon size={16} /> },
  alignLeft: { label: "Aligner à gauche", icon: <AlignLeftIcon size={16} /> },
  alignCenter: { label: "Centrer", icon: <AlignCenterIcon size={16} /> },
  alignRight: { label: "Aligner à droite", icon: <AlignRightIcon size={16} /> },
  alignJustify: { label: "Justifier", icon: <AlignJustifyIcon size={16} /> },
  link: { label: "Lien", icon: <LinkIcon size={16} /> },
  code: { label: "Code en ligne", icon: <CodeIcon size={16} /> },
  clear: { label: "Effacer la mise en forme", icon: <ClearFormatIcon size={16} /> },
  undo: { label: "Annuler", icon: <UndoIcon size={16} /> },
  redo: { label: "Rétablir", icon: <RedoIcon size={16} /> },
};

/** Chrome leaves `<br>` (and Firefox `<p><br></p>`) behind in a document that has been typed into
 *  and cleared again. None of those are content, and the placeholder has to come back for them. */
function isBlank(html: string): boolean {
  return html.replace(/<br\s*\/?>/gi, "").replace(/<(p|div)>\s*<\/\1>/gi, "").trim() === "";
}

function closestElement(node: Node | null, selector: string, root: HTMLElement): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== root) {
    if (current.nodeType === 1) {
      const el = current as HTMLElement;
      if (el.matches(selector)) return el;
    }
    current = current.parentNode;
  }
  return null;
}

/** Rich-text editor: a toolbar over a contenteditable document, themed like every other field in
 *  this kit.
 *
 *  It is built on `document.execCommand`, which is formally deprecated and which every browser
 *  still implements — deliberately. The alternative is a document model of one's own (ProseMirror,
 *  Slate, Lexical), which is a dependency several times the size of this entire library and a
 *  second, parallel idea of what a document *is*. What this component is for — a note, a
 *  description, a comment next to a chart — is served by the browser's own editing engine, and the
 *  value it produces is plain HTML rather than a proprietary document tree.
 *
 *  The toolbar never takes focus (every control cancels its own mousedown, and the block dropdown,
 *  which does focus, restores the saved range before acting), so the selection you are looking at
 *  is always the one a command applies to. */
export function WysiwygEditor({
  value,
  defaultValue,
  onChange,
  placeholder,
  label,
  error,
  helperText,
  toolbar = WYSIWYG_DEFAULT_TOOLBAR,
  minHeight = 180,
  maxHeight,
  pasteAsPlainText = true,
  disabled = false,
  readOnly = false,
  className,
}: WysiwygEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  /** The last HTML this editor handed to `onChange`. Incoming `value`s equal to it are the round
   *  trip of our own edit and must not be written back — that is what would eat the caret. */
  const lastEmitted = useRef<string>(value ?? defaultValue ?? "");
  const autoId = useId();

  const [active, setActive] = useState<Record<string, boolean>>({});
  const [block, setBlock] = useState<WysiwygBlock>("p");
  const [empty, setEmpty] = useState(() => isBlank(value ?? defaultValue ?? ""));
  const [linkDraft, setLinkDraft] = useState<string | null>(null);

  const editable = !disabled && !readOnly;
  const showToolbar = editable && toolbar.length > 0;

  // Initial content, once. React never renders children into this node (it is contenteditable and
  // the browser owns its subtree from here on), so the document has to be installed by hand.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = value ?? defaultValue ?? "";
    // `<b>`/`<i>` rather than `<span style="font-weight:bold">`: inline styles would survive into
    // whatever renders this HTML later and fight that page's own typography.
    try {
      document.execCommand("styleWithCSS", false, "false");
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      // Both are best-effort hints; a browser that refuses them still edits fine.
    }
    // Mount only — `value` is reconciled by the effect below, which knows what we last emitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = editorRef.current;
    if (el === null || value === undefined) return;
    if (value === lastEmitted.current || value === el.innerHTML) return;
    el.innerHTML = value;
    lastEmitted.current = value;
    setEmpty(isBlank(value));
  }, [value]);

  const emit = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    lastEmitted.current = html;
    setEmpty(isBlank(html));
    onChange?.(html);
  }, [onChange]);

  /** Where the caret is, and what is switched on around it. Both are refreshed from the same
   *  `selectionchange` listener: one event covers typing, clicking, arrow keys and drag-select,
   *  where wiring each of those separately reliably misses one of them. */
  const sync = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;

    savedRange.current = range.cloneRange();

    const next: Record<string, boolean> = {};
    for (const [tool, command] of Object.entries(COMMAND_STATE)) {
      try {
        next[tool] = document.queryCommandState(command);
      } catch {
        next[tool] = false;
      }
    }
    next.code = closestElement(range.startContainer, "code", el) !== null;
    next.link = closestElement(range.startContainer, "a", el) !== null;
    setActive(next);

    const blockEl = closestElement(range.startContainer, "p,h1,h2,h3,blockquote,pre", el);
    setBlock(blockEl && BLOCK_TAGS.has(blockEl.tagName) ? (blockEl.tagName.toLowerCase() as WysiwygBlock) : "p");
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", sync);
    return () => document.removeEventListener("selectionchange", sync);
  }, [sync]);

  /** Puts the caret back where it was before a control that steals focus (the block dropdown, the
   *  link field) took it, so the command lands on the text the user had selected. */
  const restore = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const range = savedRange.current;
    if (!range || !el.contains(range.commonAncestorContainer)) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const exec = useCallback(
    (command: string, argument?: string) => {
      restore();
      try {
        document.execCommand(command, false, argument);
      } catch {
        return;
      }
      sync();
      emit();
    },
    [emit, restore, sync]
  );

  /** `<code>` has no execCommand of its own, so this one is done by hand: unwrap when the caret is
   *  already inside one, wrap otherwise. `surroundContents` throws on a selection that starts in
   *  one element and ends in another (half a bold run, say); the fallback re-inserts the selected
   *  text wrapped, which loses any nested formatting — acceptable, since inline code is not meant
   *  to carry any. */
  const toggleCode = useCallback(() => {
    const el = editorRef.current;
    restore();
    const selection = window.getSelection();
    if (!el || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const existing = closestElement(range.startContainer, "code", el);

    if (existing) {
      const parent = existing.parentNode;
      if (parent) {
        while (existing.firstChild) parent.insertBefore(existing.firstChild, existing);
        parent.removeChild(existing);
      }
    } else if (!range.collapsed) {
      const code = document.createElement("code");
      try {
        range.surroundContents(code);
      } catch {
        const text = range.toString();
        document.execCommand("insertHTML", false, `<code>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code>`);
      }
    }
    sync();
    emit();
  }, [emit, restore, sync]);

  const openLinkBar = useCallback(() => {
    const el = editorRef.current;
    const selection = window.getSelection();
    const anchor =
      el && selection && selection.rangeCount > 0 ? closestElement(selection.getRangeAt(0).startContainer, "a", el) : null;
    setLinkDraft(anchor?.getAttribute("href") ?? "");
  }, []);

  const applyLink = useCallback(() => {
    const href = (linkDraft ?? "").trim();
    setLinkDraft(null);
    // An emptied field is how you remove a link you had: nothing else in the bar says "remove".
    if (href === "") exec("unlink");
    else exec("createLink", href);
  }, [exec, linkDraft]);

  const runTool = useCallback(
    (tool: WysiwygTool) => {
      if (tool === "link") {
        if (active.link && linkDraft === null) {
          // Already a link, and the bar is closed: the button is an unlink toggle in that state.
          exec("unlink");
          return;
        }
        openLinkBar();
        return;
      }
      if (tool === "code") {
        toggleCode();
        return;
      }
      if (tool === "clear") {
        exec("removeFormat");
        exec("unlink");
        return;
      }
      const command = COMMAND[tool];
      if (command) exec(command);
    },
    [active.link, exec, linkDraft, openLinkBar, toggleCode]
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (!pasteAsPlainText) return;
      event.preventDefault();
      const text = event.clipboardData.getData("text/plain");
      document.execCommand("insertText", false, text);
    },
    [pasteAsPlainText]
  );

  const style: Record<string, string> = { "--lq-wysiwyg-min-height": `${minHeight}px` };
  if (maxHeight !== undefined) style["--lq-wysiwyg-max-height"] = `${maxHeight}px`;

  function toolButton(tool: WysiwygTool) {
    if (tool === "block") {
      return (
        <div key="block" className="lq-wysiwyg__block-select" onMouseDown={restore}>
          <Select
            size="small"
            options={BLOCK_OPTIONS}
            value={block}
            onChange={(next) => exec("formatBlock", `<${next}>`)}
            ariaLabel="Style de bloc"
          />
        </div>
      );
    }
    const meta = TOOL_META[tool];
    const isActive = Boolean(active[tool]);
    const isUnlink = tool === "link" && isActive && linkDraft === null;
    return (
      <button
        key={tool}
        type="button"
        className={["lq-wysiwyg__tool", isActive && "lq-wysiwyg__tool--active"].filter(Boolean).join(" ")}
        // The whole reason the selection survives a click on the toolbar: never let the button take
        // focus in the first place, rather than trying to hand it back afterwards.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => runTool(tool)}
        aria-pressed={COMMAND_STATE[tool] || tool === "code" || tool === "link" ? isActive : undefined}
        title={isUnlink ? "Retirer le lien" : meta.label}
        aria-label={isUnlink ? "Retirer le lien" : meta.label}
      >
        {isUnlink ? <UnlinkIcon size={16} /> : meta.icon}
      </button>
    );
  }

  return (
    <div className={["lq-field", "lq-wysiwyg", className].filter(Boolean).join(" ")} style={style}>
      {label && (
        <span className="lq-field__label" id={`${autoId}-label`}>
          {label}
        </span>
      )}

      <div
        className={[
          "lq-wysiwyg__frame",
          error && "lq-wysiwyg__frame--error",
          disabled && "lq-wysiwyg__frame--disabled",
          readOnly && "lq-wysiwyg__frame--readonly",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {showToolbar && (
          <div className="lq-wysiwyg__toolbar" role="toolbar" aria-label="Mise en forme">
            {toolbar
              .filter((group) => group.length > 0)
              .map((group, i) => (
                <div key={i} className="lq-wysiwyg__group">
                  {group.map(toolButton)}
                </div>
              ))}
          </div>
        )}

        {linkDraft !== null && (
          <div className="lq-wysiwyg__link-bar">
            <input
              className="lq-wysiwyg__link-input"
              value={linkDraft}
              autoFocus
              placeholder="https://exemple.fr"
              aria-label="Adresse du lien"
              onChange={(event) => setLinkDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyLink();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setLinkDraft(null);
                  restore();
                }
              }}
            />
            <button type="button" className="lq-wysiwyg__tool" onClick={applyLink} title="Valider" aria-label="Valider le lien">
              <CheckIcon size={16} />
            </button>
            <button
              type="button"
              className="lq-wysiwyg__tool"
              onClick={() => {
                setLinkDraft(null);
                restore();
              }}
              title="Annuler"
              aria-label="Annuler"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        )}

        <div
          ref={editorRef}
          className="lq-wysiwyg__content"
          contentEditable={editable}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-labelledby={label ? `${autoId}-label` : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${autoId}-error` : helperText ? `${autoId}-helper` : undefined}
          data-placeholder={placeholder}
          data-empty={empty ? "true" : undefined}
          onInput={emit}
          onBlur={emit}
          onPaste={handlePaste}
        />
      </div>

      {error ? (
        <span id={`${autoId}-error`} className="lq-field__error">
          <ErrorIcon size={14} />
          {error}
        </span>
      ) : helperText ? (
        <span id={`${autoId}-helper`} className="lq-field__helper">
          {helperText}
        </span>
      ) : null}
    </div>
  );
}
