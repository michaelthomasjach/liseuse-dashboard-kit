import type { ReactNode } from "react";
import "./DeviceFrames.css";

export interface DeviceFrameProps {
  children: ReactNode;
  /** Short line under the device, e.g. "ChartWorkspace — palette color, surface sombre". */
  caption?: ReactNode;
  className?: string;
}

/** Laptop mock-up: lid, screen, hinge lip and a tapered base, with a soft floor shadow.
 *
 *  Drawn entirely in CSS rather than shipped as a screenshot, for three reasons that matter on
 *  this particular page: the screen holds *live* components (the hero's candlestick chart is the
 *  real one, zoomable and drawable), so a bitmap would contradict what sits next to it; a
 *  screenshot freezes one palette × surface out of four, while the frame below reads its colours
 *  from the theme tokens and follows the Storybook toolbar; and there is nothing to keep in sync
 *  when a component's own look changes. The chrome colour is mixed from `--lq-color-text` rather
 *  than pinned to a grey so the device still reads as a device on a dark surface. */
export function Laptop({ children, caption, className }: DeviceFrameProps) {
  return (
    <figure className={["lqx-device", "lqx-laptop", className].filter(Boolean).join(" ")}>
      <div className="lqx-laptop__lid">
        <span className="lqx-laptop__camera" aria-hidden="true" />
        <div className="lqx-laptop__screen">{children}</div>
      </div>
      <div className="lqx-laptop__base" aria-hidden="true">
        <span className="lqx-laptop__notch" />
      </div>
      <div className="lqx-device__shadow" aria-hidden="true" />
      {caption && <figcaption className="lqx-device__caption">{caption}</figcaption>}
    </figure>
  );
}

/** Tablet mock-up — the form factor the e-ink dashboards are actually built for. */
export function Tablet({ children, caption, className }: DeviceFrameProps) {
  return (
    <figure className={["lqx-device", "lqx-tablet", className].filter(Boolean).join(" ")}>
      <div className="lqx-tablet__body">
        <span className="lqx-tablet__camera" aria-hidden="true" />
        <div className="lqx-tablet__screen">{children}</div>
      </div>
      <div className="lqx-device__shadow" aria-hidden="true" />
      {caption && <figcaption className="lqx-device__caption">{caption}</figcaption>}
    </figure>
  );
}

/** Phone mock-up, notch included. */
export function Phone({ children, caption, className }: DeviceFrameProps) {
  return (
    <figure className={["lqx-device", "lqx-phone", className].filter(Boolean).join(" ")}>
      <div className="lqx-phone__body">
        <span className="lqx-phone__notch" aria-hidden="true" />
        <div className="lqx-phone__screen">{children}</div>
        <span className="lqx-phone__bar" aria-hidden="true" />
      </div>
      <div className="lqx-device__shadow" aria-hidden="true" />
      {caption && <figcaption className="lqx-device__caption">{caption}</figcaption>}
    </figure>
  );
}

/** Browser window: chrome bar with its dots and an address, then the page itself.
 *
 *  For the screens that are a *page* rather than a device — an app shell, a chart workspace. The
 *  address is decorative text, not a link: it says what you are looking at. */
export function BrowserWindow({
  address,
  children,
  caption,
  className,
}: DeviceFrameProps & { address: string }) {
  return (
    <figure className={["lqx-device", "lqx-window", className].filter(Boolean).join(" ")}>
      <div style={{ width: "100%" }}>
        <div className="lqx-window__chrome">
          <span className="lqx-window__dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="lqx-window__address">{address}</span>
        </div>
        <div className="lqx-window__viewport">{children}</div>
      </div>
      {caption && <figcaption className="lqx-device__caption">{caption}</figcaption>}
    </figure>
  );
}
