/** A `ResizeObserver` built from the constructor of *this element's own* document.
 *
 *  The global `ResizeObserver` belongs to the window this bundle was loaded in. A component
 *  portalled into a second browser window (see `DetachedWindow`) renders into a different
 *  document, and observations there are delivered to that document's own observer — so the global
 *  one fires once, if at all, and then goes quiet. Every chart in a detached window was therefore
 *  frozen at whatever width it happened to have when the popup first opened: the symbol-detail
 *  window laid its charts out at the popup's initial size and never re-measured, which is exactly
 *  the "the chart still doesn't use the full width" report.
 *
 *  Falls back to the global constructor when the element has no view of its own (a detached node,
 *  or a non-DOM test environment), so callers need no branch of their own.
 *
 *  @returns The observer, or null when the environment has none. */
function observerFor(el: Element, callback: ResizeObserverCallback): ResizeObserver | null {
  const view = el.ownerDocument?.defaultView as (Window & typeof globalThis) | null | undefined;
  const Ctor = view?.ResizeObserver ?? (typeof ResizeObserver === "undefined" ? undefined : ResizeObserver);
  return Ctor === undefined ? null : new Ctor(callback);
}

/** Watches one element's size. See `observerFor` for why the observer is not the global one.
 *
 *  @returns A disconnect function, ready to be returned straight from an effect. */
export function observeElementSize(el: Element, onResize: (entry: ResizeObserverEntry) => void): () => void {
  const observer = observerFor(el, (entries) => {
    const entry = entries[0];
    if (entry) onResize(entry);
  });
  if (observer === null) return () => {};
  observer.observe(el);
  return () => observer.disconnect();
}

/** Watches several elements at once, calling back on any of them — a strip and each of its items,
 *  say, where the strip's own box can stay put while its contents change width.
 *
 *  The document is taken from the first element, so they must share one; that is the case wherever
 *  this is used (a parent and its own children). */
export function observeElementSizes(elements: Element[], onResize: () => void): () => void {
  const first = elements[0];
  if (first === undefined) return () => {};
  const observer = observerFor(first, onResize);
  if (observer === null) return () => {};
  for (const el of elements) observer.observe(el);
  return () => observer.disconnect();
}
