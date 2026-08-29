import { IconBase, type IconProps } from "./IconBase";
import "./icons.css";

/** Icons that support an optional idle-loop animation (sun spinning, rain falling…).
 *  Off by default — pass `animated` on the one instance you want to bring to life. */
export interface AnimatedIconProps extends IconProps {
  animated?: boolean;
}

export const SunIcon = ({ animated, className, ...props }: AnimatedIconProps) => (
  <IconBase className={[animated && "lq-icon-spin", className].filter(Boolean).join(" ") || undefined} {...props}>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.55 1.55M18.25 18.25l1.55 1.55M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.55-1.55M18.25 5.75l1.55-1.55" />
  </IconBase>
);

export const MoonIcon = ({ animated, className, ...props }: AnimatedIconProps) => (
  <IconBase className={[animated && "lq-icon-pulse", className].filter(Boolean).join(" ") || undefined} {...props}>
    <path d="M20 14.2A8.5 8.5 0 1 1 9.8 4a6.6 6.6 0 0 0 10.2 10.2Z" />
  </IconBase>
);

export const CloudIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M7 18h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.5 1.6A3.5 3.5 0 0 0 7 18Z" />
  </IconBase>
);

export const PartlyCloudyIcon = ({ animated, ...props }: AnimatedIconProps) => (
  <IconBase {...props}>
    <g className={animated ? "lq-icon-spin" : undefined}>
      <circle cx="8" cy="8" r="3.2" />
      <path d="M8 2.8v1.6M3.4 8H5M8 12.6v-1M3.75 3.75l1.1 1.1M12.25 3.75l-1.1 1.1" />
    </g>
    <path d="M10 19h7.5a3.5 3.5 0 0 0 0-7 4.7 4.7 0 0 0-8.9 1.4A3 3 0 0 0 10 19Z" />
  </IconBase>
);

export const CloudRainIcon = ({ animated, ...props }: AnimatedIconProps) => (
  <IconBase {...props}>
    <path d="M6.5 15.5h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.4 1.7A3.5 3.5 0 0 0 6.5 15.5Z" />
    <path className={animated ? "lq-icon-raindrop" : undefined} style={animated ? { animationDelay: "0ms" } : undefined} d="M8.5 18.5 7.5 20.5" />
    <path className={animated ? "lq-icon-raindrop" : undefined} style={animated ? { animationDelay: "220ms" } : undefined} d="M12.5 18.5l-1 2" />
    <path className={animated ? "lq-icon-raindrop" : undefined} style={animated ? { animationDelay: "440ms" } : undefined} d="M16.5 18.5l-1 2" />
  </IconBase>
);

export const WindIcon = ({ animated, className, ...props }: AnimatedIconProps) => (
  <IconBase className={[animated && "lq-icon-sway", className].filter(Boolean).join(" ") || undefined} {...props}>
    <path d="M3.5 8.5h11a2.6 2.6 0 1 0-2.4-3.6" />
    <path d="M3.5 13h14.8a2.6 2.6 0 1 1-2.4 3.6" />
    <path d="M3.5 17.3h8.2a2 2 0 1 1-1.8 2.8" />
  </IconBase>
);

export const AlertTriangleIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 3.5 21.5 20h-19L12 3.5Z" />
    <path d="M12 9.5v4.4" />
    <circle cx="12" cy="16.8" r="0.15" fill="currentColor" stroke="none" />
  </IconBase>
);

export const SunriseIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 3v5" />
    <path d="M5.5 11.5 7.6 9.4M18.5 11.5l-2.1-2.1" />
    <circle cx="12" cy="15" r="3.6" />
    <path d="M3 19.5h18M2 15.5h2M20 15.5h2" />
  </IconBase>
);

export const SunsetIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 8V3" />
    <path d="M5.5 11.5 7.6 9.4M18.5 11.5l-2.1-2.1" />
    <circle cx="12" cy="15" r="3.6" />
    <path d="M3 19.5h18M2 15.5h2M20 15.5h2" />
  </IconBase>
);

export const BedIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 19v-8.5A2.5 2.5 0 0 1 5.5 8H14a3 3 0 0 1 3 3v1" />
    <path d="M3 15h18v4" />
    <path d="M6.5 12h4a1.5 1.5 0 0 0 0-3h-2A1.5 1.5 0 0 0 7 10.5" />
    <path d="M21 19v-3.2a1.8 1.8 0 0 0-1.8-1.8H10" />
  </IconBase>
);

export const LogoutIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M15 4.5H7A1.5 1.5 0 0 0 5.5 6v12A1.5 1.5 0 0 0 7 19.5h8" />
    <path d="M11 12h9.5M17 8.5l3.5 3.5-3.5 3.5" />
  </IconBase>
);

export const HomeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 11 12 4l8 7" />
    <path d="M6 9.7V19a1 1 0 0 0 1 1h3.5v-5h3V20H17a1 1 0 0 0 1-1V9.7" />
  </IconBase>
);

export const PlayIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M7 4.8v14.4a1 1 0 0 0 1.53.85l11.4-7.2a1 1 0 0 0 0-1.7L8.53 3.95A1 1 0 0 0 7 4.8Z" />
  </IconBase>
);

export const PauseIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M7.5 4.5h2.8v15H7.5zM13.7 4.5h2.8v15h-2.8z" />
  </IconBase>
);

export const PrevTrackIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M18 5v14L8 12l10-7Z" />
    <path d="M6 5v14" />
  </IconBase>
);

export const NextTrackIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M6 5v14l10-7L6 5Z" />
    <path d="M18 5v14" />
  </IconBase>
);

export const SpeakerIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 9.5h3.2L12 5.8v12.4l-4.8-3.7H4z" />
    <path d="M15.5 9a4 4 0 0 1 0 6" />
  </IconBase>
);

export const SolarPanelIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 10 12 4l8 6" />
    <path d="M4 10h16l1.5 9H2.5L4 10Z" />
    <path d="M4 10 9 19M20 10l-5 9M12 4v15" />
  </IconBase>
);

export const BatteryIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="2.5" y="7" width="16" height="10" rx="2" />
    <path d="M21 10v4" />
    <path d="M6 9.5v5M9.5 9.5v5" />
  </IconBase>
);

export const GridPlugIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 2.5v6" />
    <path d="M7.5 6.5v-2M16.5 6.5v-2" />
    <path d="M5.5 8.5h13a1 1 0 0 1 1 1.1l-1 8.4a1 1 0 0 1-1 .9H6.5a1 1 0 0 1-1-.9l-1-8.4a1 1 0 0 1 1-1.1Z" />
  </IconBase>
);

export const ChevronRightIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M9 5.5 15.5 12 9 18.5" />
  </IconBase>
);

export const CloseIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </IconBase>
);

export const ChevronDownIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5.5 9 12 15.5 18.5 9" />
  </IconBase>
);

export const ChevronUpIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5.5 15 12 8.5 18.5 15" />
  </IconBase>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M15 5.5 8.5 12 15 18.5" />
  </IconBase>
);

export const CheckIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 12.5 9.5 17 19 6.5" />
  </IconBase>
);

export const SearchIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M19 19l-4.3-4.3" />
  </IconBase>
);

export const EyeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </IconBase>
);

export const EyeOffIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3.5 3.5l17 17" />
    <path d="M10.6 5.7A10.4 10.4 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a13.6 13.6 0 0 1-3.2 3.9M6.5 7.1C4 8.8 2.5 12 2.5 12S6 18.5 12 18.5a9.9 9.9 0 0 0 3-.5" />
    <path d="M9.9 10a3 3 0 0 0 4.1 4.1" />
  </IconBase>
);

export const UserIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </IconBase>
);

export const LockIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="1.5" />
    <path d="M7.5 10.5V7.5a4.5 4.5 0 0 1 9 0v3" />
  </IconBase>
);

/** Six small dots in a 2x3 grid — the standard drag-handle affordance, filled rather than the
 *  usual stroke-only outline (overridden per-shape since IconBase's own `fill="none"` is just a
 *  default, not a hard constraint) since a handle this small reads far better solid. */
export const GripIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none" />
  </IconBase>
);

/** A flat diamond with two chevrons stacked underneath — the standard "layers panel" glyph (as
 *  seen in most design tools), reading as "everything currently on the chart, as a stack of
 *  distinct items" rather than a generic list/menu. */
export const LayersIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 3.5 3.5 9 12 14.5 20.5 9 12 3.5Z" />
    <path d="M3.5 12.5 12 18l8.5-5.5" />
    <path d="M3.5 16 12 21.5 20.5 16" />
  </IconBase>
);

/** Badge marking an indicator as drawn directly over the price candles (SMA/EMA/…) — a small
 *  jagged line above a baseline, reading as "a line over the chart" even at badge size. */
export const OverlayBadgeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 16h16" />
    <path d="M6 13l4-5 4 3 4-6" />
  </IconBase>
);

/** Badge marking an indicator as living in its own sub-panel below price (RSI/MACD/CHOP/Volume)
 *  — a tall box over a short one, mirroring the real layout (the price section dwarfing an
 *  oscillator pane below it) rather than two equal-sized rectangles, which read as ambiguous
 *  "two things" instead of specifically "a smaller panel of its own underneath". */
export const PaneBadgeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="3.5" y="3" width="17" height="9" rx="1" />
    <rect x="3.5" y="14.5" width="17" height="6.5" rx="1" />
  </IconBase>
);

export const CalendarIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="1.5" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </IconBase>
);

export const ErrorIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5" />
    <circle cx="12" cy="16.3" r="0.15" fill="currentColor" stroke="none" />
  </IconBase>
);

export const InfoIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5" />
    <circle cx="12" cy="7.8" r="0.15" fill="currentColor" stroke="none" />
  </IconBase>
);

/** Same circle + stem + dot shape as InfoIcon above, a curved question-mark stem instead of a
 *  straight one — "how do I use this" rather than "here's a fact about what you're looking at". */
export const HelpIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.2a2.6 2.6 0 0 1 5 1c0 1.7-2.5 2.2-2.5 3.6" />
    <circle cx="12" cy="16.7" r="0.15" fill="currentColor" stroke="none" />
  </IconBase>
);

export const ArrowUpIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 19V5M6 10.5 12 5l6 5.5" />
  </IconBase>
);

export const ArrowDownIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 5v14M6 13.5 12 19l6-5.5" />
  </IconBase>
);

export const MenuIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />
  </IconBase>
);

export const BellIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M6 10.5a6 6 0 0 1 12 0c0 4 1.5 5.2 1.5 5.7H4.5c0-.5 1.5-1.7 1.5-5.7Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </IconBase>
);

/** A bordered panel with three short rows inside — reads as "a list of things", distinct from
 *  MenuIcon's plain full-width hamburger lines (that one reads as "options menu", a different
 *  concept) — ChartWorkspace's own right-rail watchlist toggle. */
export const WatchlistIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
    <path d="M7 8.5h6M7 12h10M7 15.5h10" />
  </IconBase>
);

export const PieChartIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5V12h8.5" />
  </IconBase>
);

/** A single scalloped outline tracing the whole cog silhouette (teeth fused to the ring, no
 *  gap) plus the inner hole — reads as an actual toothed gear even at small toolbar sizes,
 *  unlike detached spokes radiating from a small circle. */
export const SettingsIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <circle cx="12" cy="12" r="3" />
  </IconBase>
);

export const LinkIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M10 14a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
    <path d="M14 10a5 5 0 0 0-7.07 0L4.1 12.83a5 5 0 0 0 7.07 7.07l1.5-1.5" />
  </IconBase>
);

export const GridIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1" />
    <rect x="13" y="3.5" width="7.5" height="7.5" rx="1" />
    <rect x="3.5" y="13" width="7.5" height="7.5" rx="1" />
    <rect x="13" y="13" width="7.5" height="7.5" rx="1" />
  </IconBase>
);

export const CreditCardIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
    <path d="M2.5 9.5h19M6 15h4" />
  </IconBase>
);

export const PhoneIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5.5 4.5h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 4 5.6a1.5 1.5 0 0 1 1.5-1.1Z" />
  </IconBase>
);

export const RefreshIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4.5 12a7.5 7.5 0 0 1 12.6-5.5M19.5 12a7.5 7.5 0 0 1-12.6 5.5" />
    <path d="M17 3.5v3.5h-3.5M7 20.5V17h3.5" />
  </IconBase>
);

export const UploadCloudIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M7 18.5h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.5 1.6A3.5 3.5 0 0 0 7 18.5Z" />
    <path d="M12 15.5v-6M9.2 12l2.8-2.8 2.8 2.8" />
  </IconBase>
);

export const FileIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M6.5 3.5h7l4 4v13a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
    <path d="M13.5 3.5v4h4" />
  </IconBase>
);

export const SaveIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 3.5h11l3 3v13.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-15.5a1 1 0 0 1 1-1Z" />
    <path d="M8 3.5v5h7v-5" />
    <path d="M7.5 21v-6.5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1V21" />
  </IconBase>
);

export const TrashIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4.5 7h15M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2" />
    <path d="M6.5 7v12.5A1.5 1.5 0 0 0 8 21h8a1.5 1.5 0 0 0 1.5-1.5V7" />
    <path d="M10 11v6M14 11v6" />
  </IconBase>
);

export const FolderIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3.5 6.5a1 1 0 0 1 1-1h4.7l1.6 2h8.7a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1Z" />
  </IconBase>
);

export const MaximizeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M9 3.5H4.5V8M15 3.5h4.5V8M9 20.5H4.5V16M15 20.5h4.5V16" />
  </IconBase>
);

export const MinimizeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4.5 8.5H9V4M19.5 8.5H15V4M4.5 15.5H9V20M19.5 15.5H15V20" />
  </IconBase>
);

export const StarIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8Z" />
  </IconBase>
);

export const ArrowRightIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </IconBase>
);

export const PlusIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 5v14M5 12h14" />
  </IconBase>
);

/** Three filled dots — "more options" (ChartWorkspace's own watchlist column-visibility toggle). */
export const MoreHorizontalIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </IconBase>
);

export const CopyIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="8.5" y="8.5" width="12" height="12" />
    <path d="M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5" />
  </IconBase>
);

export const CursorArrowIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 3.5 18.5 9.8 12.6 12.2 10 18.3Z" strokeLinejoin="round" />
  </IconBase>
);

export const TrendLineIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 18 18 6" />
    <circle cx="4" cy="18" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="18" cy="6" r="1.6" fill="currentColor" stroke="none" />
  </IconBase>
);

export const HorizontalLineIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 12h16" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </IconBase>
);

export const VerticalLineIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 4v16" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </IconBase>
);

export const HorizontalRayIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M7 12h13" />
    <circle cx="7" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </IconBase>
);

/** Like TrendLineIcon, but the line runs past both dots to the edges of the icon instead of
 *  stopping at them — the two dots still mark the two points that actually define its slope. */
export const ExtendedLineIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M2 20 22 4" />
    <circle cx="7" cy="16.5" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="17" cy="7.5" r="1.6" fill="currentColor" stroke="none" />
  </IconBase>
);

export const ChannelIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 19 16 6" />
    <path d="M8 21 21 8" />
    <circle cx="3" cy="19" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="16" cy="6" r="1.4" fill="currentColor" stroke="none" />
  </IconBase>
);

/** Two non-parallel lines converging toward one side, unlike ChannelIcon's parallel pair — the
 *  mirrored, independently-anglable second line "disjoint channel" draws instead. */
export const DisjointChannelIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 5 21 11" />
    <path d="M3 19 21 13" />
    <circle cx="3" cy="5" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="21" cy="11" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="3" cy="19" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="21" cy="13" r="1.3" fill="currentColor" stroke="none" />
  </IconBase>
);

/** Horizontal rungs fanning out then back in — evokes stacked retracement levels rather than
 *  any one specific ratio (the levels themselves are fixed constants, not part of the icon). */
export const FibonacciIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 4h4" />
    <path d="M4 8.5h9" />
    <path d="M4 13h14" />
    <path d="M4 17.5h9" />
    <path d="M4 21h4" />
  </IconBase>
);

/** Same retracement rungs as FibonacciIcon, plus an arrow projecting further out — the
 *  extension tool's levels project *past* its own points instead of sitting between them. */
export const FibonacciExtensionIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M2 6h6" />
    <path d="M2 12h10" />
    <path d="M2 18h6" />
    <path d="M15 12h6" />
    <path d="M18 9l3 3-3 3" />
  </IconBase>
);

/** A 5-swing zigzag with dots at both ends — the shared silhouette for the Elliott Wave
 *  category button, distinct from the labeled-vertex icons of its two specific tools below. */
export const ElliottWaveIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M2 18 7 8 11 13 16 4 22 10" />
    <circle cx="2" cy="18" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="22" cy="10" r="1.3" fill="currentColor" stroke="none" />
  </IconBase>
);

export const ElliottImpulseIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M2 19 6 9 9 14 13 5 17 12 22 4" />
    <circle cx="2" cy="19" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="22" cy="4" r="1.2" fill="currentColor" stroke="none" />
  </IconBase>
);

export const ElliottCorrectionIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 6 9 16 14 10 20 19" />
    <circle cx="3" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="20" cy="19" r="1.2" fill="currentColor" stroke="none" />
  </IconBase>
);

export const ActivityIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M22 12h-4l-3 8-6-16-3 8H2" />
  </IconBase>
);

/** Two hollow candles with visible gaps between their bodies — the baseline "raw" candlestick
 *  look, distinct from HeikinAshiModeIcon's touching/near-continuous bodies below. */
export const CandleModeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M7 3v4M7 15v6" />
    <rect x="4.5" y="7" width="5" height="8" />
    <path d="M17 3v3M17 16v5" />
    <rect x="14.5" y="6" width="5" height="10" />
  </IconBase>
);

export const LineCloseModeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 16 8 10 12 13 21 5" />
    <circle cx="21" cy="5" r="1.4" fill="currentColor" stroke="none" />
  </IconBase>
);

/** Three candle bodies with (almost) no gap between them — Heikin Ashi's smoothing makes each
 *  candle's open track the previous one's close, so real HA bodies read as a continuous zigzag
 *  rather than the separated bodies of CandleModeIcon. */
export const HeikinAshiModeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 2v4M5 15v7M12 1v2M12 17v6M19 4v4M19 13v7" />
    <rect x="2" y="6" width="6" height="9" />
    <rect x="9" y="3" width="6" height="14" />
    <rect x="16" y="8" width="6" height="5" />
  </IconBase>
);

/** An ascending staircase of uniform, alternately filled/hollow bricks — one brick per fixed
 *  price movement, the defining silhouette of a Renko chart. */
export const RenkoModeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="2" y="17" width="5" height="5" fill="currentColor" stroke="none" />
    <rect x="8" y="12" width="5" height="5" />
    <rect x="14" y="7" width="5" height="5" fill="currentColor" stroke="none" />
    <rect x="19" y="2" width="5" height="5" />
  </IconBase>
);

/** Uneven, alternately filled/hollow columns (unlike Renko's uniform staircase) — Line Break
 *  only draws a new line on a fresh high/low or a break past the last few lines' extreme, so
 *  its "bricks" vary far more in height and don't form a steady diagonal. */
export const LineBreakModeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="2" y="10" width="4" height="8" fill="currentColor" stroke="none" />
    <rect x="7" y="4" width="4" height="6" fill="currentColor" stroke="none" />
    <rect x="12" y="10" width="4" height="10" />
    <rect x="17" y="2" width="4" height="8" fill="currentColor" stroke="none" />
  </IconBase>
);

/** Horizontal rungs of varying length (a mini price-distribution histogram, same visual language
 *  as FibonacciIcon's rungs) with a dot marking the busiest one — Time Price Opportunities'
 *  point of control. */
export const TpoModeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M2 4h8M2 8h14M2 12h20M2 16h11M2 20h6" />
    <circle cx="22" cy="12" r="1.3" fill="currentColor" stroke="none" />
  </IconBase>
);

/** An actual ruler — a bar with graduation marks along it, tilted diagonally — rather than a
 *  plain segment with a couple of ticks. */
export const MeasureIcon = (props: IconProps) => (
  <IconBase {...props}>
    <g transform="rotate(-45 12 12)">
      <rect x="3" y="9" width="18" height="6" rx="1" />
      <path d="M6 9v2.2M9.5 9v2.2M13 9v3.5M16.5 9v2.2" />
    </g>
  </IconBase>
);

/** Same magnifying-glass silhouette as SearchIcon, a "+" inside the lens instead — the "zoom in
 *  on this rectangle" drawing tool. */
export const ZoomInIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M19 19l-4.3-4.3" />
    <path d="M7.5 10.5h6M10.5 7.5v6" />
  </IconBase>
);

/** Same magnifying-glass silhouette as SearchIcon, a "-" inside the lens instead — resets the
 *  zoom back to its own default range. */
export const ZoomOutIcon = (props: IconProps) => (
  <IconBase {...props}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M19 19l-4.3-4.3" />
    <path d="M7.5 10.5h6" />
  </IconBase>
);

/** Two faint zigzags (several noisy individual series) collapsing into one bold flat line (their
 *  average) — SeasonalityView's own "années indépendantes" hover-average toggle. */
export const AverageLineIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 7 7 11 11 6 15 12 21 5" strokeWidth={1} opacity={0.45} />
    <path d="M3 17 7 13 11 18 15 12 21 16" strokeWidth={1} opacity={0.45} />
    <path d="M3 12h18" strokeWidth={2.5} />
  </IconBase>
);

/** A horseshoe magnet, outer + inner U with a pole band near each open end. */
export const MagnetIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M6 3H3v9a9 9 0 0 0 18 0V3h-3" />
    <path d="M6 3v9a6 6 0 0 0 12 0V3" />
    <path d="M3 7h3M18 7h3" />
  </IconBase>
);

/** A box with dots at two opposite corners — same "A"/"D" two-point convention TrendLineIcon
 *  uses for its own two dots, just applied to a rectangle's diagonal instead of a segment. */
export const RectangleShapeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="3" y="6" width="18" height="12" />
    <circle cx="3" cy="6" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="21" cy="18" r="1.3" fill="currentColor" stroke="none" />
  </IconBase>
);

/** A multi-segment zigzag ending in an arrowhead — an open-ended clicked polyline (any number of
 *  vertices, not just two), distinct from TrendLineIcon's single diagonal. */
export const ElbowArrowIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M2 18 7 10 10 14 14 6 17 15 20 11 22 7" />
    <path d="M22 7 18.5 8M22 7 20.5 11" />
    <circle cx="2" cy="18" r="1.3" fill="currentColor" stroke="none" />
  </IconBase>
);

export const BrushIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 20c0-3 1.5-4.5 4-4.5S11 18 11 20" />
    <path d="M9.5 14 18 5.5a2 2 0 0 1 3 3L12.5 17" />
  </IconBase>
);

/** Same diagonal segment as TrendLineIcon, but a chevron arrowhead at one end instead of a
 *  second dot — the "line with an arrow" shape distinguishing it from a plain trend line. */
export const ArrowLineIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 18 16 6" />
    <path d="M16 6 10.5 8M16 6 13.5 11.5" />
    <circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none" />
  </IconBase>
);

/** A box split into three horizontal bands by two divider lines, "+" in the top one and "−" in
 *  the bottom one — the positive/neutral/negative zones this tool lays over a price range. */
export const ZonesIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="1" />
    <path d="M3.5 9h17M3.5 15h17" />
    <path d="M12 4.7v2.1M10.95 5.75h2.1" />
    <path d="M10.95 18.25h2.1" />
  </IconBase>
);

/** Three peaks (a shorter, a taller, a shorter again) over a flat neckline — the Head & Shoulders
 *  pattern's own silhouette. */
export const HeadShouldersIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M2 17 6 9l3 4 3-9 3 9 3-4 4 8" />
    <path d="M2 17h20" strokeDasharray="2.5 2.5" />
  </IconBase>
);

/** Same "dashed reference line + solid vertex-to-vertex polyline" shape as HeadShouldersIcon
 *  above — the dashed line marks the cup's own rim level (A/C), the polyline traces its 5 points
 *  (A start of cup, B bottom of cup, C end of cup / start of handle, D bottom of handle, E end of
 *  handle) in order. */
export const CupHandleIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M2 6h19" strokeDasharray="2.5 2.5" />
    <path d="M2 6 7 16 12 6 16 10 21 7" />
  </IconBase>
);

/** A curved (not straight) arrow from a dot to an arrowhead — distinguishing this from
 *  TrendLineIcon's own straight diagonal, matching the tool's actual curved-projection line. */
export const ForecastIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 18C4 10 10 6 19 6" />
    <path d="M19 6 14.5 5.5M19 6 17 10" />
    <circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none" />
  </IconBase>
);

/** Three lines fanning from one point — a "max" (top), dashed "avg" (middle), "min" (bottom) —
 *  same three-level fan a "Range forecast" drawing itself projects, the space between the outer
 *  two tinted to match that drawing's own filled triangle. */
export const RangeForecastIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 20 21 5 21 20Z" fill="currentColor" fillOpacity="0.15" stroke="none" />
    <path d="M3 20 21 5" />
    <path d="M3 20 21 12" strokeDasharray="2 2" />
    <path d="M3 20 21 20" />
    <circle cx="3" cy="20" r="1.4" fill="currentColor" stroke="none" />
  </IconBase>
);

/** A box split by its own entry line, the half above emphasized — "Long position"'s own target
 *  (profit) zone sits above entry, its stop below, so the darker fill goes on top. */
export const LongPositionIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 4h15v8h-15z" fill="currentColor" fillOpacity="0.22" stroke="none" />
    <path d="M4 12h15v8h-15z" fill="currentColor" fillOpacity="0.08" stroke="none" />
    <rect x="4" y="4" width="15" height="16" />
    <path d="M4 12h15" />
  </IconBase>
);

/** Same split box as LongPositionIcon, mirrored — "Short position"'s own target (profit) zone
 *  sits below entry, its stop above, so the darker fill goes on the bottom instead. */
export const ShortPositionIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 4h15v8h-15z" fill="currentColor" fillOpacity="0.08" stroke="none" />
    <path d="M4 12h15v8h-15z" fill="currentColor" fillOpacity="0.22" stroke="none" />
    <rect x="4" y="4" width="15" height="16" />
    <path d="M4 12h15" />
  </IconBase>
);

/** Three lines fanning from one handle point — the median (dashed, the middle one) plus two
 *  parallel "tine" lines — the standard/Andrews' Pitchfork's own silhouette. */
export const PitchforkIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M8 5h13" />
    <path d="M3 12h18" strokeDasharray="2.5 2.5" />
    <path d="M8 19h13" />
    <circle cx="3" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="8" cy="5" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="8" cy="19" r="1.2" fill="currentColor" stroke="none" />
  </IconBase>
);

/** Same fork silhouette as PitchforkIcon, but its own handle sits partway along a faint line back
 *  to the original point — Schiff's own median starts from the *midpoint* of that line instead of
 *  the handle itself. */
export const SchiffPitchforkIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 12v-3.5" strokeDasharray="1.2 1.5" />
    <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" />
    <path d="M8 5h13" />
    <path d="M3 8.5h18" strokeDasharray="2.5 2.5" />
    <path d="M8 19h13" />
    <circle cx="8" cy="5" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="8" cy="19" r="1.2" fill="currentColor" stroke="none" />
  </IconBase>
);

/** Same idea as SchiffPitchforkIcon, its own handle sitting a shorter distance along the faint
 *  line back to the original point — Modified Schiff's median starts closer to the standard
 *  form's own handle than Schiff's does. */
export const ModifiedSchiffPitchforkIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 12 5.5 8.5" strokeDasharray="1.2 1.5" />
    <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" />
    <path d="M8 5h13" />
    <path d="M5.5 8.5h16" strokeDasharray="2.5 2.5" />
    <path d="M8 19h13" />
    <circle cx="8" cy="5" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="8" cy="19" r="1.2" fill="currentColor" stroke="none" />
  </IconBase>
);

/** Same 3-parallel-lines shape as the other three variants, but the median (dashed) sits *between*
 *  its own two tines instead of alongside one of them — Inside Pitchfork's own defining trait, see
 *  pitchforkGeometry.ts's own doc for why (its tines anchor at D/P1 rather than P1/P2). */
export const InsidePitchforkIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3 5h18" />
    <path d="M3 12h18" strokeDasharray="2.5 2.5" />
    <path d="M3 19h18" />
    <circle cx="3" cy="5" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="3" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="3" cy="19" r="1.2" fill="currentColor" stroke="none" />
  </IconBase>
);

/** The floating drawing toolbar's own "line color" control — a pencil, tip pointing down-left
 *  toward where it would be writing. */
export const PencilIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M17.5 3.5a2.1 2.1 0 0 1 3 3L8 19 3 21l2-5Z" />
    <path d="M14.5 6.5 17.5 9.5" />
  </IconBase>
);

/** The floating drawing toolbar's own "text color" control — a plain capital T. */
export const TextIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M5 6h14" />
    <path d="M12 6v13" />
  </IconBase>
);

/** A rounded speech bubble with a small tail at its bottom-left — the "Commentaire" drawing
 *  tool's own icon, matching the tail-pointing-at-the-anchor bubble it actually draws on the
 *  chart (see drawTextAndComment.ts). */
export const CommentIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3.5 5.5h17v11h-11l-4 3.5v-3.5h-2z" />
  </IconBase>
);

/** A plain line leading to a small rounded plate — "Note"'s own icon, matching the line-then-label
 *  shape it actually draws (an anchor connected by a straight line to its own text). */
export const NoteIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 20 11 13" />
    <rect x="11" y="4" width="9" height="6" rx="1.5" />
  </IconBase>
);

/** Same line-to-label shape as NoteIcon, its own plate replaced with a price tag (pointed end,
 *  small hole) — "Note de prix"'s own icon, whose label always leads with a price. */
export const PriceNoteIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 20 11 13" />
    <path d="M11 5h9v6h-9l-4-3Z" />
    <circle cx="12.3" cy="7.3" r="0.9" fill="currentColor" stroke="none" />
  </IconBase>
);

/** A classic map-pin teardrop with a hollow center — "Pin"'s own icon, matching the shape
 *  drawMarkers.ts actually plants at the click, tip-down, at the anchor. */
export const PinIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M12 21s7-7.5 7-12.5A7 7 0 0 0 5 8.5C5 13.5 12 21 12 21Z" />
    <circle cx="12" cy="8.5" r="2.2" fill="currentColor" stroke="none" />
  </IconBase>
);

/** A flag on a pole — "Marque drapeau"'s own icon, matching the shape drawMarkers.ts plants at
 *  the click, its own pole base at the anchor. */
export const FlagMarkIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M6 21V4" />
    <path d="M6 4h12l-4 4 4 4H6" />
  </IconBase>
);

/** A small rounded plate over a dashed vertical drop — "Signpost"'s own icon, matching the label-
 *  over-a-connector-to-the-close shape it actually draws (see drawSignpost.ts). */
export const SignpostIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="7" y="3" width="10" height="6" rx="1.5" />
    <path d="M12 9v11" strokeDasharray="2 2" />
    <circle cx="12" cy="20" r="1.4" fill="currentColor" stroke="none" />
  </IconBase>
);

/** A speech bubble with 3 short lines standing in for digits — "Price label"'s own icon, matching
 *  the always-shows-its-own-price bubble it actually draws (see drawPriceLabel.ts). */
export const PriceLabelIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M3.5 5.5h17v11h-11l-4 3.5v-3.5h-2z" />
    <path d="M7 9h10M7 12.5h6" />
  </IconBase>
);

/** A 2×2 grid — "Tableau"'s own icon, matching the row/column-subdivided box it actually draws
 *  (see drawTable.ts), though the placed default is 3×3. */
export const TableIcon = (props: IconProps) => (
  <IconBase {...props}>
    <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
    <path d="M3.5 12h17M12 4v16" />
  </IconBase>
);

/** The alert modal's own "crossing" condition — two lines crossing, generic direction. */
export const CrossingIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M4 6 20 18" />
    <path d="M20 6 4 18" />
  </IconBase>
);

/** The alert modal's own "greater than" condition. */
export const GreaterThanIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M6 5 18 12 6 19" />
  </IconBase>
);

/** The alert modal's own "less than" condition. */
export const LessThanIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M18 5 6 12 18 19" />
  </IconBase>
);

/** The script editor's own header button (`</>`) — opens `ScriptEditorPanel`. */
export const CodeIcon = (props: IconProps) => (
  <IconBase {...props}>
    <path d="M9 8 4 12 9 16M15 8l5 4-5 4" />
  </IconBase>
);
