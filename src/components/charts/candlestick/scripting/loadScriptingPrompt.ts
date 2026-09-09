/** Loads the scripting briefing (see `scriptingPrompt.ts`) — 107KB of prose that only the script
 *  assistant ever needs.
 *
 *  A dynamic import, never a static one, for the same reason `propShotImages` is: Vite inlines it
 *  into whichever chunk imports it, and a consumer who never opens the assistant has no business
 *  carrying the entire scripting manual in their bundle. Resolved once and kept, since the text is
 *  fixed for the life of the build. */
let cached: Promise<string> | null = null;

export function loadScriptingPrompt(): Promise<string> {
  cached ??= import("./scriptingPrompt").then((m) => m.SCRIPTING_PROMPT);
  return cached;
}
