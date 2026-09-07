import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface DetachedWindowProps {
  /** The already-open window to render into.
   *
   *  Opened by the caller, inside the click that asked for it, and not here: a `window.open` that
   *  runs from an effect happens after the gesture has ended, and every browser treats that as an
   *  unsolicited popup and blocks it. Passing the window in is what makes detaching work at all. */
  target: Window;
  title: string;
  /** Called when the window goes away, so the caller can put back whatever was detached. */
  onClose: () => void;
  /** The element whose theme the detached content should inherit — normally the nearest `.lq-root`
   *  above whatever is being detached.
   *
   *  Every colour in this library is a CSS variable defined on that element's own selector (see
   *  theme/tokens.css), not on `:root`. A popup starts with a bare document, so without copying its
   *  class and `data-lq-*` attributes onto the portal host, every one of those variables resolves
   *  to nothing: borders vanish, panels go transparent, and the window renders as unstyled text on
   *  white. */
  themeSource?: HTMLElement | null;
  children: ReactNode;
}

/** Renders its children into a real second browser window.
 *
 *  A portal rather than a re-mount: the detached content keeps the same React state and the same
 *  props flowing into it, so a strategy panel torn off into its own window keeps updating from the
 *  chart it left behind — which is the entire point of detaching it rather than opening a static
 *  copy.
 *
 *  Styles are cloned into the new document because a popup inherits nothing: no stylesheet, and
 *  none of the theme attributes this library's own CSS variables hang off. Cloned once at open —
 *  a dev server that later swaps a `<style>` tag will not reach the detached window, which is a
 *  hot-reload artifact rather than something a user meets. */
export function DetachedWindow({ target, title, onClose, themeSource, children }: DetachedWindowProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const child = target;
    child.document.title = title;

    for (const node of Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))) {
      child.document.head.appendChild(node.cloneNode(true));
    }
    // Anything set on the opener's own root/body — a color-scheme class, a data attribute — first,
    // so media queries and document-level rules behave the same here.
    for (const [from, to] of [
      [document.documentElement, child.document.documentElement],
      [document.body, child.document.body],
    ] as const) {
      for (const attr of Array.from(from.attributes)) {
        if (attr.name === "class" || attr.name.startsWith("data-")) to.setAttribute(attr.name, attr.value);
      }
    }
    child.document.body.style.margin = "0";

    const host = child.document.createElement("div");
    host.className = "lq-detached-window";
    // Then the theme scope itself, copied onto the host so every `--lq-*` variable the content
    // reads resolves exactly as it does in the opener.
    if (themeSource) {
      for (const attr of Array.from(themeSource.attributes)) {
        if (attr.name === "class") host.className = `${attr.value} lq-detached-window`;
        else if (attr.name.startsWith("data-")) host.setAttribute(attr.name, attr.value);
      }
    }
    child.document.body.appendChild(host);
    setContainer(host);

    // Either window closing takes the other's content with it: a detached panel outliving the
    // chart it reads from would keep showing numbers nothing is updating any more.
    const handleChildUnload = () => onClose();
    child.addEventListener("beforeunload", handleChildUnload);
    const closeChild = () => child.close();
    window.addEventListener("beforeunload", closeChild);

    return () => {
      child.removeEventListener("beforeunload", handleChildUnload);
      window.removeEventListener("beforeunload", closeChild);
      child.close();
    };
    // Opened once per mount. Re-running on a changed title would tear down the window and lose
    // everything in it; the title effect below handles that case instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (container) container.ownerDocument.title = title;
  }, [container, title]);

  return container === null ? null : createPortal(children, container);
}
