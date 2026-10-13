import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CloseIcon, CheckIcon, ErrorIcon, AlertTriangleIcon, InfoIcon } from "../icons";
import { LqThemeProvider, useLqTheme } from "../../theme";
import "./Notification.css";

export type NotificationVariant = "corner" | "bar" | "modal";
export type NotificationCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type NotificationBarPosition = "top" | "bottom";
export type NotificationTone = "neutral" | "success" | "error" | "warning" | "info";

const TONE_ICON: Record<NotificationTone, ReactNode> = {
  neutral: null,
  success: <CheckIcon size={18} />,
  error: <ErrorIcon size={18} />,
  warning: <AlertTriangleIcon size={18} />,
  info: <InfoIcon size={18} />,
};

export interface NotificationCardConfig {
  tone?: NotificationTone;
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  /** Buttons row, e.g. "Annuler" / "Voir" — a plain link (e.g. "Lire la suite" on a news card,
   *  see `NotificationSource`) works here too, not just `<button>`s. */
  actions?: ReactNode;
  /** Small text rendered opposite `actions` on the same row, e.g. a timestamp ("22:03") — omit
   *  for no footer row at all when `actions` is also unset. */
  meta?: ReactNode;
  /** Shows a close (×) button. Default true. */
  dismissible?: boolean;
  /** Auto-close after this many ms. Omit or pass 0 to require manual dismissal. */
  autoDismissMs?: number;
  /** Countdown progress bar while auto-dismissing. Default true whenever `autoDismissMs` is set. */
  showProgress?: boolean;
  /** Makes the whole card clickable (e.g. "take me to the alert/article this is about"): called on a
   *  click or Enter/Space anywhere on the card except its close button and `actions`, then the card
   *  closes. */
  onClick?: () => void;
}

export interface NotificationSourceProps {
  /** Small badges shown before the source name — logos, verification marks, ratings; their
   *  content and meaning are entirely up to the caller, this just lays them out in a row. */
  badges?: ReactNode[];
  /** The publisher/source name, e.g. "Mace News". */
  name: string;
}

/** A small "badges + source name" row — for a news-style notification's own byline, placed as
 *  (part of) `description` above the headline itself. Doesn't render a card of its own; it's
 *  meant to be composed into a regular `notify({ title, description: <>...</> })` call, e.g.:
 *  `description: <><NotificationSource badges={[...]} name="Mace News" /><p>{headline}</p></>`. */
export function NotificationSource({ badges, name }: NotificationSourceProps) {
  return (
    <span className="lq-notification-source">
      {badges?.map((badge, i) => (
        <span key={i} className="lq-notification-source__badge">
          {badge}
        </span>
      ))}
      <span className="lq-notification-source__name">{name}</span>
    </span>
  );
}

export interface NotificationProps extends NotificationCardConfig {
  open: boolean;
  onClose: () => void;
  /** "corner" (default) — a popin anchored to one of the 4 corners. "bar" — a full-width sticky bar. "modal" — a centered dialog with an overlay. */
  variant?: NotificationVariant;
  /** Anchor corner, used when `variant="corner"`. Default "bottom-right". */
  corner?: NotificationCorner;
  /** Sticky edge, used when `variant="bar"`. Default "top". */
  barPosition?: NotificationBarPosition;
  className?: string;
}

/** Timer + visible countdown for auto-dismissing notifications; pauses while the pointer is over the card. */
function useAutoDismiss(autoDismissMs: number | undefined, onClose: () => void) {
  const [paused, setPaused] = useState(false);
  const [generation, setGeneration] = useState(0);
  const remainingRef = useRef(autoDismissMs ?? 0);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const durationRef = useRef(autoDismissMs ?? 0);

  const arm = useCallback((duration: number) => {
    remainingRef.current = duration;
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(() => onCloseRef.current(), duration);
  }, []);

  /** A fresh countdown: new progress bar (new `key`) over the full duration. */
  const start = useCallback(
    (duration: number) => {
      durationRef.current = duration;
      arm(duration);
      setGeneration((g) => g + 1);
    },
    [arm]
  );

  useEffect(() => {
    if (!autoDismissMs) return;
    start(autoDismissMs);
    return () => clearTimeout(timerRef.current);
  }, [autoDismissMs, start]);

  function pause() {
    if (!autoDismissMs || paused) return;
    clearTimeout(timerRef.current);
    remainingRef.current -= Date.now() - startedAtRef.current;
    setPaused(true);
  }

  /** Picks up exactly where `pause` stopped: same progress bar (its CSS animation simply resumes from
   *  the paused frame) and a timer armed for the time that was left — not a restart from full. */
  function resume() {
    if (!autoDismissMs || !paused) return;
    setPaused(false);
    arm(Math.max(300, remainingRef.current));
  }

  return { paused, generation, durationAtStart: durationRef.current, pause, resume };
}

/** The visual card shared by the standalone `Notification` and the `NotificationProvider` stacks. */
function NotificationCard({
  tone = "neutral",
  icon,
  title,
  description,
  actions,
  meta,
  dismissible = true,
  autoDismissMs,
  showProgress = true,
  onClick,
  onClose,
  bar = false,
  className,
}: NotificationCardConfig & { onClose: () => void; bar?: boolean; className?: string }) {
  const { paused, generation, durationAtStart, pause, resume } = useAutoDismiss(autoDismissMs, onClose);
  const resolvedIcon = icon ?? TONE_ICON[tone];

  return (
    <div
      className={["lq-notification-card", `lq-notification-card--${tone}`, bar && "lq-notification-card--bar", className]
        .filter(Boolean)
        .join(" ")}
      role="status"
      onPointerEnter={pause}
      onPointerLeave={resume}
      {...(onClick
        ? {
            "data-clickable": "",
            tabIndex: 0,
            onClick: () => {
              onClick();
              onClose();
            },
            onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
                onClose();
              }
            },
          }
        : {})}
    >
      {resolvedIcon && <span className="lq-notification-card__icon">{resolvedIcon}</span>}
      <div className="lq-notification-card__body">
        {title && <strong className="lq-notification-card__title">{title}</strong>}
        {/* A `<div>`, not a `<p>` — `description` is free-form `ReactNode` (e.g.
            `NotificationSource` + a headline paragraph for a news-style card), and a `<p>`
            wrapping block content would auto-close early, producing broken markup. */}
        {description && <div className="lq-notification-card__description">{description}</div>}
        {(actions || meta) && (
          <div className="lq-notification-card__footer">
            {actions && (
              <div className="lq-notification-card__actions" onClick={(e) => e.stopPropagation()}>
                {actions}
              </div>
            )}
            {meta && <span className="lq-notification-card__meta">{meta}</span>}
          </div>
        )}
      </div>
      {dismissible && (
        <button
          type="button"
          className="lq-notification-card__close"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Fermer"
        >
          <CloseIcon size={14} />
        </button>
      )}
      {autoDismissMs && showProgress && (
        <span
          key={generation}
          className="lq-notification-card__progress"
          style={{ animationDuration: `${durationAtStart}ms`, animationPlayState: paused ? "paused" : "running" }}
        />
      )}
    </div>
  );
}

/**
 * Self-contained, fully controlled notification: pass `open`/`onClose` directly, no provider needed.
 * Great for a single persistent banner or one-off alert. For a queue of transient messages, use
 * `NotificationProvider` + `useNotification()` instead — it stacks multiple corner/bar notifications correctly.
 */
export function Notification({ open, onClose, variant = "corner", corner = "bottom-right", barPosition = "top", className, ...card }: NotificationProps) {
  if (!open) return null;

  if (variant === "modal") {
    return (
      <div className="lq-notification-modal-overlay" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()}>
          <NotificationCard {...card} onClose={onClose} className={className} />
        </div>
      </div>
    );
  }

  if (variant === "bar") {
    return (
      <div className={`lq-notification-bar-anchor lq-notification-bar-anchor--${barPosition}`}>
        <NotificationCard {...card} onClose={onClose} bar className={className} />
      </div>
    );
  }

  return (
    <div className={`lq-notification-anchor lq-notification-anchor--${corner}`}>
      <NotificationCard {...card} onClose={onClose} className={className} />
    </div>
  );
}

export interface NotificationOptions extends NotificationCardConfig {
  variant?: NotificationVariant;
  corner?: NotificationCorner;
  barPosition?: NotificationBarPosition;
}

interface NotificationItem extends NotificationOptions {
  id: string;
}

interface NotificationContextValue {
  notify: (options: NotificationOptions) => string;
  dismiss: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const CORNERS: NotificationCorner[] = ["top-left", "top-right", "bottom-left", "bottom-right"];
const BAR_POSITIONS: NotificationBarPosition[] = ["top", "bottom"];

/** Wrap your app (or a layout) once; call `useNotification().notify(...)` anywhere below it. Stacks
 *  multiple corner/bar notifications correctly (unlike rendering several standalone `<Notification>`s). */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const theme = useLqTheme();

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback((options: NotificationOptions) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setItems((prev) => [
      ...prev,
      { id, variant: "corner", corner: "bottom-right", barPosition: "top", tone: "neutral", autoDismissMs: 4000, ...options },
    ]);
    return id;
  }, []);

  const modals = items.filter((n) => n.variant === "modal");

  return (
    <NotificationContext.Provider value={{ notify, dismiss }}>
      {children}
      {createPortal(
        <LqThemeProvider palette={theme.palette} surface={theme.surface} font={theme.font} style={{ display: "contents" }}>
          {CORNERS.map((c) => {
            const group = items.filter((n) => n.variant !== "modal" && n.variant !== "bar" && n.corner === c);
            if (group.length === 0) return null;
            return (
              <div key={c} className={`lq-notification-stack lq-notification-stack--${c}`}>
                {group.map((n) => (
                  <NotificationCard key={n.id} {...n} onClose={() => dismiss(n.id)} />
                ))}
              </div>
            );
          })}

          {BAR_POSITIONS.map((p) => {
            const group = items.filter((n) => n.variant === "bar" && n.barPosition === p);
            if (group.length === 0) return null;
            return (
              <div key={p} className={`lq-notification-bar-anchor lq-notification-bar-anchor--${p}`}>
                <div className="lq-notification-bar-stack">
                  {group.map((n) => (
                    <NotificationCard key={n.id} {...n} onClose={() => dismiss(n.id)} bar />
                  ))}
                </div>
              </div>
            );
          })}

          {modals.map((n) => (
            <div key={n.id} className="lq-notification-modal-overlay" onClick={() => dismiss(n.id)}>
              <div onClick={(e) => e.stopPropagation()}>
                <NotificationCard {...n} onClose={() => dismiss(n.id)} />
              </div>
            </div>
          ))}
        </LqThemeProvider>,
        document.body
      )}
    </NotificationContext.Provider>
  );
}

/** `notify(options)` pushes a notification and returns its id; `dismiss(id)` closes it early. */
// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with its provider on purpose
export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification must be used within a <NotificationProvider>");
  return ctx;
}
