import { memo, useRef, type ComponentType } from "react";

type AnyFn = (...args: unknown[]) => unknown;

/** `React.memo` for a subtree whose props are mostly inline callbacks.
 *
 *  CandlestickChart re-renders on every mouse move (its crosshair follows the cursor), and so did
 *  everything it renders — the tools rail, the header, every closed modal — none of which shows
 *  anything about the cursor. Plain `memo` cannot help there: the parent hands over fresh arrow
 *  functions on every render, so the props never compare equal.
 *
 *  This wraps every function prop in a wrapper that keeps the same identity for the life of the
 *  component and always calls the *latest* function passed (read from a ref updated on each
 *  render). Behaviour is unchanged — a handler never runs a stale closure — while the memoized
 *  child now re-renders only when a non-function prop actually changes.
 *
 *  Only for components that call their function props from event handlers or effects, or whose
 *  render-time calls depend on nothing but their other props: a render-time call is not re-run
 *  when only the function's closure changed. */
export function stableMemo<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  const Inner = memo(Component) as unknown as ComponentType<P>;
  function Stable(props: P) {
    const latest = useRef(props);
    latest.current = props;
    const wrappers = useRef(new Map<string, AnyFn>());
    const next: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      const value = (props as Record<string, unknown>)[key];
      if (typeof value !== "function") {
        next[key] = value;
        continue;
      }
      let wrapper = wrappers.current.get(key);
      if (!wrapper) {
        wrapper = (...args: unknown[]) => {
          const fn = (latest.current as Record<string, unknown>)[key];
          return typeof fn === "function" ? (fn as AnyFn)(...args) : undefined;
        };
        wrappers.current.set(key, wrapper);
      }
      next[key] = wrapper;
    }
    return <Inner {...(next as P)} />;
  }
  Stable.displayName = `Stable(${Component.displayName ?? Component.name})`;
  return Stable;
}
