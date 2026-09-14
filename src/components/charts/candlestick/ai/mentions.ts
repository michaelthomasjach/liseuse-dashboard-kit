/** `@` mentions in the assistant's composer.
 *
 *  A mention names something the chart already knows about — a strategy, a symbol — so a request
 *  like *"compare la stratégie @Momentum sur @MSFT et @AAPL"* points at real things instead of
 *  spelling them out and hoping the model matches them up.
 *
 *  Two deliberate limits. A mention is **plain text**, exactly what the box shows: nothing here is
 *  a hidden instruction the model reads differently from what the user wrote, the same stance the
 *  `/` commands take. And an unresolved mention is not an error — it is written in red and sent
 *  anyway. The user may be naming something the chart has no list for, and refusing to send it
 *  would make the feature a gate rather than a convenience.
 */

/** Something that can be named after an `@`. */
export interface Mentionable {
  kind: "strategy" | "symbol";
  /** What goes into the text after the `@`. Spaces are allowed — see `mentionQueryAt` for how a
   *  multi-word name is still recognised once written. */
  label: string;
  /** Shown beside the label in the menu. */
  hint: string;
}

/** Case- and accent-insensitive: `@strategie` should find "Stratégie 1", and nobody should have to
 *  reproduce a name's capitals to mention it. */
export const foldMention = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** The `@` token the caret is currently inside, if any.
 *
 *  A token runs from its `@` to the caret and may contain single spaces, because the things worth
 *  mentioning have names like "Stratégie 1". That generosity has a cost — every word typed after a
 *  mention would extend it forever — so it stops at the first word that takes the token past
 *  `MAX_WORDS`, and at any punctuation. Beyond that the user has stopped naming something and gone
 *  back to writing a sentence. */
const MAX_WORDS = 4;

export function mentionQueryAt(text: string, caret: number): { query: string; from: number } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;
  // An `@` glued to the end of a word is an email address or a handle, not the start of a mention.
  if (at > 0 && !/[\s([]/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (/[\n,.;:!?]/.test(query)) return null;
  if (query.trim().split(/\s+/).filter(Boolean).length > MAX_WORDS) return null;
  return { query, from: at };
}

export function filterMentions(items: Mentionable[], query: string): Mentionable[] {
  const needle = foldMention(query.trim());
  if (needle === "") return items;
  return items.filter((item) => foldMention(item.label).includes(needle) || foldMention(item.hint).includes(needle));
}

/** Every `@…` in the text, with whether it names something known.
 *
 *  Used to paint the composer: a resolved mention is pale green, an unresolved one pale red. The
 *  longest match wins, so "@Stratégie 1" is one mention rather than "@Stratégie" followed by a
 *  stray "1" — which matters precisely because names have spaces in them. */
export interface MentionSpan {
  from: number;
  to: number;
  text: string;
  resolved: boolean;
}

export function findMentions(text: string, items: Mentionable[]): MentionSpan[] {
  const labels = items.map((item) => ({ folded: foldMention(item.label), length: item.label.length }));
  const spans: MentionSpan[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== "@") continue;
    if (i > 0 && !/[\s([]/.test(text[i - 1])) continue;
    // The longest label that matches from here — checked before falling back to a bare word, so a
    // multi-word name is not cut at its first space.
    const rest = foldMention(text.slice(i + 1));
    let matched = 0;
    for (const label of labels) {
      if (label.folded.length > matched && rest.startsWith(label.folded)) matched = label.length;
    }
    if (matched > 0) {
      spans.push({ from: i, to: i + 1 + matched, text: text.slice(i, i + 1 + matched), resolved: true });
      i += matched;
      continue;
    }
    const word = /^[^\s\n,.;:!?]*/.exec(text.slice(i + 1))?.[0] ?? "";
    if (word === "") continue;
    spans.push({ from: i, to: i + 1 + word.length, text: text.slice(i, i + 1 + word.length), resolved: false });
    i += word.length;
  }
  return spans;
}

/** The text split into mention and non-mention runs, for the highlight layer behind the box. */
export function mentionSegments(text: string, items: Mentionable[]): { text: string; resolved: boolean | null }[] {
  const spans = findMentions(text, items);
  const out: { text: string; resolved: boolean | null }[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.from > cursor) out.push({ text: text.slice(cursor, span.from), resolved: null });
    out.push({ text: span.text, resolved: span.resolved });
    cursor = span.to;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), resolved: null });
  return out;
}
