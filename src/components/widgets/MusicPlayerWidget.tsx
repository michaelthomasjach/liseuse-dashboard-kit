import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { IconButton } from "../primitives/IconButton";
import { LevelGauge } from "../primitives/LevelGauge";
import { PlayIcon, PauseIcon, PrevTrackIcon, NextTrackIcon, SpeakerIcon } from "../icons";
import "./MusicPlayerWidget.css";

export interface MusicPlayerWidgetProps {
  /** Cover art URL. Omit and pass `coverFallback` for a placeholder. */
  cover?: string;
  coverFallback?: ReactNode;
  title: string;
  artist: string;
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  /** 0-100. Omit to hide the volume row entirely. */
  volume?: number;
  /** Makes the volume adjustable — click or drag along the gauge, arrows / Page up-down / Home / End
   *  on the keyboard. Called with the new level, 0-100. Without it the gauge is a read-out. */
  onVolumeChange?: (volume: number) => void;
  /** Sound cut, the level kept: the gauge goes dim and reads "Muet". Default false. */
  muted?: boolean;
  /** Shows the speaker as a working mute toggle. Without it there is no speaker button at all — it
   *  used to be a permanently disabled button that looked broken. */
  onMuteChange?: (muted: boolean) => void;
  className?: string;
}

/** The speaker struck through — local, it only exists for the mute toggle. */
function SpeakerMutedIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.5h3.2L12 5.8v12.4l-4.8-3.7H4z" />
      <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
    </svg>
  );
}

const clampVolume = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

/** Compact "now playing" card with transport controls and a volume gauge — adjustable with
 *  `onVolumeChange`, with a mute toggle with `onMuteChange`. */
export function MusicPlayerWidget({
  cover,
  coverFallback,
  title,
  artist,
  isPlaying,
  onPlayPause,
  onPrev,
  onNext,
  volume,
  onVolumeChange,
  muted = false,
  onMuteChange,
  className,
}: MusicPlayerWidgetProps) {
  const sliderRef = useRef<HTMLSpanElement>(null);
  const dragging = useRef(false);

  /** The level under the pointer, from the gauge's own bars (the label beside them is not part of
   *  the scale). */
  const levelAt = (clientX: number) => {
    const bars = sliderRef.current?.querySelector(".lq-gauge__bars") ?? sliderRef.current;
    if (!bars) return volume ?? 0;
    const rect = bars.getBoundingClientRect();
    return clampVolume(((clientX - rect.left) / Math.max(1, rect.width)) * 100);
  };

  const onPointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    if (!onVolumeChange) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    onVolumeChange(levelAt(event.clientX));
  };
  const onPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    if (dragging.current && onVolumeChange) onVolumeChange(levelAt(event.clientX));
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (!onVolumeChange || volume === undefined) return;
    const steps: Record<string, number> = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 10, PageDown: -10 };
    let next: number | null = null;
    if (event.key in steps) next = volume + steps[event.key];
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = 100;
    if (next === null) return;
    event.preventDefault();
    onVolumeChange(clampVolume(next));
  };

  const volumeLabel = muted ? "Muet" : `${volume ?? 0} %`;

  return (
    <div className={["lq-music", className].filter(Boolean).join(" ")}>
      <div className="lq-music__track">
        <span className="lq-music__cover">
          {cover ? <img src={cover} alt="" /> : coverFallback}
        </span>
        <span className="lq-music__meta">
          <span className="lq-music__title">{title}</span>
          <span className="lq-music__artist">{artist}</span>
        </span>
      </div>

      <div className="lq-music__controls">
        <IconButton icon={<PrevTrackIcon />} ariaLabel="Piste précédente" onClick={onPrev} disabled={!onPrev} />
        <IconButton
          icon={isPlaying ? <PauseIcon /> : <PlayIcon />}
          ariaLabel={isPlaying ? "Pause" : "Lecture"}
          onClick={onPlayPause}
        />
        <IconButton icon={<NextTrackIcon />} ariaLabel="Piste suivante" onClick={onNext} disabled={!onNext} />
      </div>

      {volume !== undefined && (
        <div className={["lq-music__volume", muted && "lq-music__volume--muted"].filter(Boolean).join(" ")}>
          {onMuteChange && (
            <IconButton
              icon={muted ? <SpeakerMutedIcon /> : <SpeakerIcon />}
              ariaLabel={muted ? "Rétablir le son" : "Couper le son"}
              aria-pressed={muted}
              size="sm"
              onClick={() => onMuteChange(!muted)}
            />
          )}
          {onVolumeChange ? (
            <span
              ref={sliderRef}
              className="lq-music__slider"
              role="slider"
              tabIndex={0}
              aria-label="Volume"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={volume}
              aria-valuetext={volumeLabel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onKeyDown={onKeyDown}
            >
              <span className="lq-music__slider-gauge" aria-hidden="true">
                <LevelGauge value={volume} segments={16} label={volumeLabel} />
              </span>
            </span>
          ) : (
            <LevelGauge value={volume} segments={16} label={volumeLabel} ariaLabel="Volume" />
          )}
        </div>
      )}
    </div>
  );
}
