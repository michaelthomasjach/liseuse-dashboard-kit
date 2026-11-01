import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "../primitives/Button";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { Popover } from "../forms/Popover";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "../icons";
import "./MonthCalendar.css";

/** Les tons d'un événement — les mêmes couleurs du thème que les tons pleins de `Card`. */
export type CalendarEventTone = "accent" | "success" | "info" | "danger" | "warning" | "neutral";

/** Une date telle qu'on la passe au calendrier : une `Date`, des millisecondes, ou une chaîne ISO.
 *  `"2026-11-03"` est lue comme **ce jour-là en heure locale** (et non minuit UTC, ce que ferait
 *  `new Date("2026-11-03")`), `"2026-11-03T09:30"` comme cette heure-là en heure locale. */
export type CalendarDateInput = Date | number | string;

export interface CalendarEvent {
  id: string;
  title: string;
  /** Début. Une date sans heure fait un événement « journée entière ». */
  start: CalendarDateInput;
  /** Fin, **incluse** : un congé du 3 au 5 se donne `start: "2026-11-03", end: "2026-11-05"`. Absente,
   *  l'événement tient dans le jour de `start`. */
  end?: CalendarDateInput;
  /** Force « journée entière » (pas d'heure affichée). Par défaut : vrai quand `start` n'a pas d'heure. */
  allDay?: boolean;
  /** Couleur du thème. Défaut : `"accent"`. */
  tone?: CalendarEventTone;
  /** Couleur libre (toute valeur CSS) ; l'emporte sur `tone`. */
  color?: string;
  /** Une seconde ligne, montrée dans l'agenda de la semaine et la liste d'un jour. */
  description?: string;
}

export type MonthCalendarView = "month" | "week";

export interface MonthCalendarLabels {
  previous: string;
  next: string;
  today: string;
  month: string;
  week: string;
  /** Le lien des événements qui ne tiennent pas dans la case. */
  more: (count: number) => string;
  create: string;
  noEvents: string;
  allDay: string;
}

export interface MonthCalendarProps {
  events: CalendarEvent[];
  /** Le jour « aujourd'hui » : marqué dans la grille, cible du bouton Aujourd'hui. Défaut : la date
   *  du système — passez-la pour un rendu déterministe (tests, captures, Storybook). */
  today?: CalendarDateInput;
  /** Un jour quelconque du mois (ou de la semaine) affiché — contrôlé. */
  date?: CalendarDateInput;
  /** Le jour affiché au départ quand `date` n'est pas fourni. Défaut : `today`. */
  defaultDate?: CalendarDateInput;
  /** Appelé par les flèches et le bouton Aujourd'hui, et quand le clavier sort du mois affiché. */
  onDateChange?: (date: Date) => void;
  /** `"month"` : la grille du mois. `"week"` : l'agenda de la semaine, jour par jour. Contrôlé. */
  view?: MonthCalendarView;
  defaultView?: MonthCalendarView;
  onViewChange?: (view: MonthCalendarView) => void;
  /** Montre le sélecteur Mois / Semaine dans la barre. Défaut : vrai. */
  showViewSwitch?: boolean;
  /** Jour sélectionné — contrôlé. `null` : aucun. */
  selectedDate?: CalendarDateInput | null;
  defaultSelectedDate?: CalendarDateInput | null;
  onSelectedDateChange?: (date: Date) => void;
  /** Un clic (ou Entrée) sur un jour. La sélection suit, que ce rappel soit fourni ou non. */
  onDayClick?: (date: Date) => void;
  /** Un clic sur un événement. */
  onEventClick?: (event: CalendarEvent) => void;
  /** Création : un double-clic sur un jour, le « + » qui apparaît au survol d'une case, ou le
   *  bouton de la liste d'un jour. Sans lui, rien de tout cela n'est proposé. */
  onCreate?: (date: Date) => void;
  /** Lignes d'événements par case avant le lien « +N autres ». Défaut : 3. */
  maxEventsPerDay?: number;
  /** Les textes de la barre et des liens. */
  labels?: Partial<MonthCalendarLabels>;
  /** Locale des noms de mois et de jours, et des heures. Défaut : `"fr-FR"`. */
  locale?: string;
  /** Un contenu libre à droite de la barre (un bouton « Nouvel événement », un filtre). */
  actions?: ReactNode;
  className?: string;
}

const DEFAULT_LABELS: MonthCalendarLabels = {
  previous: "Précédent",
  next: "Suivant",
  today: "Aujourd'hui",
  month: "Mois",
  week: "Semaine",
  more: (n) => (n > 1 ? `+${n} autres` : `+${n} autre`),
  create: "Nouvel événement",
  noEvents: "Aucun événement",
  allDay: "Journée",
};

/* ------------------------------------------------------------------ dates */

const DAY_MS = 86_400_000;

function toDate(input: CalendarDateInput): Date {
  if (input instanceof Date) return new Date(input.getTime());
  if (typeof input === "number") return new Date(input);
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(input.trim());
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0, m[6] ? +m[6] : 0);
  return new Date(input);
}

function hasTime(input: CalendarDateInput): boolean {
  if (typeof input === "string") return /[T ]\d{2}:\d{2}/.test(input);
  const d = toDate(input);
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

/** Minuit local du jour de `d`. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Le lundi de la semaine de `d`. */
function startOfWeek(d: Date): Date {
  const offset = (d.getDay() + 6) % 7;
  return addDays(startOfDay(d), -offset);
}

function sameDay(a: Date | null | undefined, b: Date | null | undefined): boolean {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Écart en jours entiers, insensible aux changements d'heure (on arrondit). */
function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ------------------------------------------------------------------ événements */

interface NormalizedEvent {
  event: CalendarEvent;
  start: Date;
  end: Date;
  /** Premier et dernier jour couverts, à minuit. */
  firstDay: Date;
  lastDay: Date;
  allDay: boolean;
  days: number;
}

function normalize(event: CalendarEvent): NormalizedEvent {
  const start = toDate(event.start);
  const rawEnd = event.end !== undefined ? toDate(event.end) : start;
  const end = rawEnd.getTime() < start.getTime() ? start : rawEnd;
  const firstDay = startOfDay(start);
  const lastDay = startOfDay(end);
  return {
    event,
    start,
    end,
    firstDay,
    lastDay,
    allDay: event.allDay ?? !hasTime(event.start),
    days: dayDiff(firstDay, lastDay) + 1,
  };
}

/** Plusieurs jours et journée entière d'abord, puis par début, puis les plus longs : c'est l'ordre
 *  qui garde les barres continues en haut de la case, là où l'œil les suit d'une case à l'autre. */
function compareEvents(a: NormalizedEvent, b: NormalizedEvent): number {
  return (
    a.firstDay.getTime() - b.firstDay.getTime() ||
    b.days - a.days ||
    Number(b.allDay) - Number(a.allDay) ||
    a.start.getTime() - b.start.getTime() ||
    a.event.title.localeCompare(b.event.title)
  );
}

interface WeekSegment {
  item: NormalizedEvent;
  /** Colonnes 0–6 dans la semaine. */
  col: number;
  span: number;
  lane: number;
  /** L'événement commence avant cette semaine / finit après : la barre touche le bord. */
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/** Les morceaux d'événements d'une semaine, rangés en couloirs : chacun prend le premier couloir
 *  libre sur toute sa largeur, pour qu'une barre de plusieurs jours reste d'un seul tenant. */
function layoutWeek(items: NormalizedEvent[], weekStart: Date): WeekSegment[] {
  const weekEnd = addDays(weekStart, 6);
  const lanes: number[] = []; // dernière colonne occupée par couloir
  const segments: WeekSegment[] = [];
  for (const item of items) {
    if (item.lastDay < weekStart || item.firstDay > weekEnd) continue;
    const col = Math.max(0, dayDiff(weekStart, item.firstDay));
    const last = Math.min(6, dayDiff(weekStart, item.lastDay));
    let lane = lanes.findIndex((occupiedTo) => occupiedTo < col);
    if (lane === -1) {
      lane = lanes.length;
      lanes.push(last);
    } else {
      lanes[lane] = last;
    }
    segments.push({
      item,
      col,
      span: last - col + 1,
      lane,
      continuesBefore: item.firstDay < weekStart,
      continuesAfter: item.lastDay > weekEnd,
    });
  }
  return segments;
}

function eventsOn(items: NormalizedEvent[], day: Date): NormalizedEvent[] {
  return items.filter((it) => it.firstDay <= day && it.lastDay >= day);
}

function toneStyle(event: CalendarEvent): CSSProperties {
  return { ["--lq-mc-event" as string]: event.color ?? `var(--lq-mc-tone-${event.tone ?? "accent"})` };
}

/* ------------------------------------------------------------------ composant */

/**
 * Calendrier mensuel d'événements : la grille du mois du lundi au dimanche, les événements en
 * pastilles colorées, ceux de plusieurs jours en barres continues d'une case à l'autre, et un lien
 * « +N autres » quand une case déborde. Une vue `week` les reprend en agenda, jour par jour.
 *
 * À ne pas confondre avec `Scheduler`, qui place des tâches à l'heure près sur des ressources.
 */
export function MonthCalendar({
  events,
  today: todayProp,
  date: dateProp,
  defaultDate,
  onDateChange,
  view: viewProp,
  defaultView = "month",
  onViewChange,
  showViewSwitch = true,
  selectedDate: selectedProp,
  defaultSelectedDate = null,
  onSelectedDateChange,
  onDayClick,
  onEventClick,
  onCreate,
  maxEventsPerDay = 3,
  labels: labelsProp,
  locale = "fr-FR",
  actions,
  className,
}: MonthCalendarProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const today = useMemo(() => startOfDay(todayProp !== undefined ? toDate(todayProp) : new Date()), [todayProp]);

  const [dateState, setDateState] = useState(() => startOfDay(toDate(defaultDate ?? today)));
  const current = dateProp !== undefined ? startOfDay(toDate(dateProp)) : dateState;
  const [viewState, setViewState] = useState<MonthCalendarView>(defaultView);
  const view = viewProp ?? viewState;
  const [selectedState, setSelectedState] = useState<Date | null>(() => (defaultSelectedDate != null ? startOfDay(toDate(defaultSelectedDate)) : null));
  const selected = selectedProp !== undefined ? (selectedProp === null ? null : startOfDay(toDate(selectedProp))) : selectedState;

  /** Le jour qui porte le focus clavier de la grille (tabindex itinérant). */
  const [focusDay, setFocusDay] = useState<Date>(() => selected ?? current);
  const shouldFocus = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const items = useMemo(() => events.map(normalize).sort(compareEvents), [events]);

  const setDate = useCallback(
    (d: Date) => {
      setDateState(d);
      onDateChange?.(d);
    },
    [onDateChange],
  );

  const setView = (v: MonthCalendarView) => {
    setViewState(v);
    onViewChange?.(v);
  };

  const selectDay = (d: Date) => {
    setSelectedState(d);
    onSelectedDateChange?.(d);
    onDayClick?.(d);
  };

  // Les jours affichés.
  const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
  const gridStart = view === "month" ? startOfWeek(monthStart) : startOfWeek(current);
  const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
  const weekCount = view === "month" ? Math.ceil((dayDiff(gridStart, monthEnd) + 1) / 7) : 1;
  const weeks = Array.from({ length: weekCount }, (_, w) => addDays(gridStart, w * 7));

  // Le focus suit le mois : s'il sort de la grille (flèches de la barre), il revient au 1er du mois
  // — ou à aujourd'hui, s'il est dans le mois.
  const gridEnd = addDays(gridStart, weekCount * 7 - 1);
  const focusInGrid = focusDay >= gridStart && focusDay <= gridEnd;
  const effectiveFocus = focusInGrid
    ? focusDay
    : today.getMonth() === current.getMonth() && today.getFullYear() === current.getFullYear()
      ? today
      : view === "month"
        ? monthStart
        : gridStart;

  useEffect(() => {
    if (!shouldFocus.current) return;
    shouldFocus.current = false;
    gridRef.current?.querySelector<HTMLElement>(`[data-day="${dayKey(effectiveFocus)}"]`)?.focus();
  });

  const step = (dir: -1 | 1) => {
    const next = view === "month" ? new Date(current.getFullYear(), current.getMonth() + dir, 1) : addDays(current, dir * 7);
    setDate(next);
  };

  // « +N autres » : la liste d'un jour, dans un Popover ancré sur le lien (ou sur la case au clavier).
  const anchorRef = useRef<HTMLElement | null>(null);
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const openDayList = (day: Date, anchor: HTMLElement) => {
    anchorRef.current = anchor;
    setOpenDay(day);
  };
  const closeDayList = useCallback(() => {
    const day = openDay;
    setOpenDay(null);
    if (!day) return;
    // Rendre le focus à la case d'où la liste est partie — sauf si un clic l'a déjà posé ailleurs.
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active && active !== document.body && document.contains(active)) return;
      gridRef.current?.querySelector<HTMLElement>(`[data-day="${dayKey(day)}"]`)?.focus();
    });
  }, [openDay]);

  const onGridKeyDown = (e: KeyboardEvent<HTMLElement>, day: Date) => {
    if (e.target !== e.currentTarget) return; // un événement ou le « + » a le focus : on le laisse faire
    let next: Date | null = null;
    switch (e.key) {
      case "ArrowLeft":
        next = addDays(day, -1);
        break;
      case "ArrowRight":
        next = addDays(day, 1);
        break;
      case "ArrowUp":
        next = addDays(day, -7);
        break;
      case "ArrowDown":
        next = addDays(day, 7);
        break;
      case "Home":
        next = startOfWeek(day);
        break;
      case "End":
        next = addDays(startOfWeek(day), 6);
        break;
      case "PageUp":
        next = new Date(day.getFullYear(), day.getMonth() - 1, Math.min(day.getDate(), 28));
        break;
      case "PageDown":
        next = new Date(day.getFullYear(), day.getMonth() + 1, Math.min(day.getDate(), 28));
        break;
      case "Enter":
      case " ": {
        e.preventDefault();
        selectDay(day);
        if (eventsOn(items, day).length > 0 || onCreate) openDayList(day, e.currentTarget);
        return;
      }
      default:
        return;
    }
    e.preventDefault();
    setFocusDay(next);
    shouldFocus.current = true;
    if (next.getMonth() !== current.getMonth() || next.getFullYear() !== current.getFullYear()) {
      if (view === "month") setDate(next);
    }
  };

  const monthTitle = capitalize(new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(current));
  const weekTitle = (() => {
    const end = addDays(gridStart, 6);
    const full = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" });
    const sameYear = gridStart.getFullYear() === end.getFullYear();
    const first =
      sameYear && gridStart.getMonth() === end.getMonth()
        ? String(gridStart.getDate())
        : new Intl.DateTimeFormat(locale, sameYear ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" }).format(gridStart);
    return `${first} – ${full.format(end)}`;
  })();
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: "long" });
  const fullFmt = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });

  const visibleLanes = Math.max(1, maxEventsPerDay);

  return (
    <div
      className={["lq-month-calendar", `lq-month-calendar--${view}`, className].filter(Boolean).join(" ")}
      style={{ ["--lq-mc-lanes" as string]: visibleLanes } as CSSProperties}
    >
      <div className="lq-month-calendar__toolbar">
        <div className="lq-month-calendar__nav">
          {/* Des `Button` et non des `IconButton` : ils prennent ainsi la hauteur exacte du bouton
              « Aujourd'hui », quelle que soit celle que le thème donne aux boutons. */}
          <Button className="lq-month-calendar__step" icon={<ChevronLeftIcon size={16} />} aria-label={labels.previous} title={labels.previous} onClick={() => step(-1)}>
            <span className="lq-month-calendar__sr">{labels.previous}</span>
          </Button>
          <Button className="lq-month-calendar__step" icon={<ChevronRightIcon size={16} />} aria-label={labels.next} title={labels.next} onClick={() => step(1)}>
            <span className="lq-month-calendar__sr">{labels.next}</span>
          </Button>
          <Button
            onClick={() => {
              setDate(today);
              setFocusDay(today);
            }}
          >
            {labels.today}
          </Button>
        </div>
        <h2 className="lq-month-calendar__title" id={titleId} aria-live="polite">
          {view === "month" ? monthTitle : weekTitle}
        </h2>
        <div className="lq-month-calendar__actions">
          {actions}
          {showViewSwitch && (
            <SegmentedControl<MonthCalendarView>
              options={[
                { value: "month", label: labels.month },
                { value: "week", label: labels.week },
              ]}
              value={view}
              onChange={setView}
            />
          )}
        </div>
      </div>

      {view === "month" ? (
        <div className="lq-month-calendar__grid" role="grid" aria-labelledby={titleId} ref={gridRef}>
          <div className="lq-month-calendar__head" role="row">
            {Array.from({ length: 7 }, (_, i) => {
              const d = addDays(gridStart, i);
              return (
                <div key={i} className="lq-month-calendar__weekday" role="columnheader" aria-label={weekdayLong.format(d)}>
                  <span aria-hidden="true">{weekdayFmt.format(d).replace(/\.$/, "")}</span>
                </div>
              );
            })}
          </div>
          {weeks.map((weekStart) => {
            const segments = layoutWeek(items, weekStart);
            // Ce qui ne tient pas : un couloir au-delà de la limite, ou le dernier couloir visible
            // quand un autre jour de sa barre déborde (il cède alors sa place au lien « +N »).
            const overflowDays = new Set<number>();
            for (const s of segments) if (s.lane >= visibleLanes) for (let c = s.col; c < s.col + s.span; c++) overflowDays.add(c);
            const shown = segments.filter((s) => {
              if (s.lane < visibleLanes - 1) return true;
              if (s.lane > visibleLanes - 1) return false;
              for (let c = s.col; c < s.col + s.span; c++) if (overflowDays.has(c)) return false;
              return true;
            });
            return (
              <div key={dayKey(weekStart)} className="lq-month-calendar__week" role="row">
                {Array.from({ length: 7 }, (_, col) => {
                  const day = addDays(weekStart, col);
                  const outside = day.getMonth() !== current.getMonth();
                  const isToday = sameDay(day, today);
                  const isSelected = sameDay(day, selected);
                  const total = segments.filter((s) => col >= s.col && col < s.col + s.span).length;
                  const visible = shown.filter((s) => col >= s.col && col < s.col + s.span).length;
                  const more = total - visible;
                  const starting = shown.filter((s) => s.col === col);
                  return (
                    <div
                      key={col}
                      role="gridcell"
                      data-day={dayKey(day)}
                      tabIndex={sameDay(day, effectiveFocus) ? 0 : -1}
                      aria-selected={isSelected}
                      aria-current={isToday ? "date" : undefined}
                      className={[
                        "lq-month-calendar__day",
                        outside && "lq-month-calendar__day--outside",
                        isToday && "lq-month-calendar__day--today",
                        isSelected && "lq-month-calendar__day--selected",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => {
                        setFocusDay(day);
                        selectDay(day);
                      }}
                      onDoubleClick={onCreate ? () => onCreate(day) : undefined}
                      onKeyDown={(e) => onGridKeyDown(e, day)}
                      onFocus={(e) => {
                        if (e.target === e.currentTarget && !sameDay(day, focusDay)) setFocusDay(day);
                      }}
                    >
                      <span className="lq-month-calendar__day-head">
                        <span className="lq-month-calendar__day-number" aria-hidden="true">
                          {day.getDate()}
                        </span>
                        <span className="lq-month-calendar__sr">{fullFmt.format(day)}</span>
                        {onCreate && (
                          <button
                            type="button"
                            tabIndex={-1}
                            className="lq-month-calendar__create"
                            aria-label={`${labels.create} — ${fullFmt.format(day)}`}
                            title={labels.create}
                            onClick={(e) => {
                              e.stopPropagation();
                              onCreate(day);
                            }}
                            onDoubleClick={(e) => e.stopPropagation()}
                          >
                            <PlusIcon size={12} />
                          </button>
                        )}
                      </span>
                      {starting.map((s) => (
                        <EventBar
                          key={s.item.event.id}
                          segment={s}
                          timeFmt={timeFmt}
                          onClick={onEventClick}
                        />
                      ))}
                      {more > 0 && (
                        <button
                          type="button"
                          tabIndex={-1}
                          className="lq-month-calendar__more"
                          style={{ ["--lq-mc-lane" as string]: visibleLanes - 1 } as CSSProperties}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFocusDay(day);
                            openDayList(day, e.currentTarget);
                          }}
                          onDoubleClick={(e) => e.stopPropagation()}
                        >
                          {labels.more(more)}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : (
        <ol className="lq-month-calendar__agenda" aria-labelledby={titleId}>
          {Array.from({ length: 7 }, (_, i) => {
            const day = addDays(gridStart, i);
            const list = eventsOn(items, day);
            const isToday = sameDay(day, today);
            const isSelected = sameDay(day, selected);
            return (
              <li
                key={i}
                className={[
                  "lq-month-calendar__agenda-day",
                  isToday && "lq-month-calendar__agenda-day--today",
                  isSelected && "lq-month-calendar__agenda-day--selected",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <button
                  type="button"
                  className="lq-month-calendar__agenda-date"
                  aria-current={isToday ? "date" : undefined}
                  aria-pressed={isSelected}
                  aria-label={fullFmt.format(day)}
                  onClick={() => selectDay(day)}
                  onDoubleClick={onCreate ? () => onCreate(day) : undefined}
                >
                  <span className="lq-month-calendar__agenda-weekday">{weekdayFmt.format(day).replace(/\.$/, "")}</span>
                  <span className="lq-month-calendar__day-number">{day.getDate()}</span>
                </button>
                <div className="lq-month-calendar__agenda-events">
                  {list.length === 0 ? (
                    <span className="lq-month-calendar__agenda-empty">{labels.noEvents}</span>
                  ) : (
                    list.map((it) => <EventRow key={it.event.id} item={it} day={day} timeFmt={timeFmt} allDayLabel={labels.allDay} onClick={onEventClick} />)
                  )}
                  {onCreate && (
                    <button type="button" className="lq-month-calendar__agenda-create" onClick={() => onCreate(day)} aria-label={`${labels.create} — ${fullFmt.format(day)}`}>
                      <PlusIcon size={12} />
                      <span>{labels.create}</span>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Popover open={openDay !== null} onClose={closeDayList} anchorRef={anchorRef} placement="bottom" className="lq-month-calendar__popover">
        {openDay && (
          <DayList
            day={openDay}
            items={eventsOn(items, openDay)}
            title={capitalize(fullFmt.format(openDay))}
            labels={labels}
            timeFmt={timeFmt}
            onEventClick={(ev) => {
              onEventClick?.(ev);
              closeDayList();
            }}
            onCreate={
              onCreate
                ? (d) => {
                    onCreate(d);
                    closeDayList();
                  }
                : undefined
            }
          />
        )}
      </Popover>
    </div>
  );
}

/* ------------------------------------------------------------------ morceaux */

function eventTime(item: NormalizedEvent, day: Date, timeFmt: Intl.DateTimeFormat): string | null {
  if (item.allDay) return null;
  if (sameDay(item.firstDay, day)) return timeFmt.format(item.start);
  return null;
}

function EventBar({ segment, timeFmt, onClick }: { segment: WeekSegment; timeFmt: Intl.DateTimeFormat; onClick?: (event: CalendarEvent) => void }) {
  const { item, span, lane, continuesBefore, continuesAfter } = segment;
  const time = !continuesBefore && !item.allDay ? timeFmt.format(item.start) : null;
  return (
    <button
      type="button"
      tabIndex={-1}
      className={[
        "lq-month-calendar__event",
        item.days > 1 && "lq-month-calendar__event--multi",
        continuesBefore && "lq-month-calendar__event--from-before",
        continuesAfter && "lq-month-calendar__event--to-after",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ ...toneStyle(item.event), ["--lq-mc-span" as string]: span, ["--lq-mc-lane" as string]: lane } as CSSProperties}
      title={item.event.title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(item.event);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {time && <span className="lq-month-calendar__event-time">{time}</span>}
      <span className="lq-month-calendar__event-title">{item.event.title}</span>
    </button>
  );
}

function EventRow({
  item,
  day,
  timeFmt,
  allDayLabel,
  onClick,
}: {
  item: NormalizedEvent;
  day: Date;
  timeFmt: Intl.DateTimeFormat;
  allDayLabel: string;
  onClick?: (event: CalendarEvent) => void;
}) {
  const time = eventTime(item, day, timeFmt);
  const endTime = !item.allDay && sameDay(item.lastDay, day) && item.end.getTime() > item.start.getTime() ? timeFmt.format(item.end) : null;
  return (
    <button type="button" className="lq-month-calendar__row" style={toneStyle(item.event)} onClick={() => onClick?.(item.event)}>
      <span className="lq-month-calendar__row-dot" aria-hidden="true" />
      <span className="lq-month-calendar__row-time">{time ? (endTime && time !== endTime ? `${time} – ${endTime}` : time) : allDayLabel}</span>
      <span className="lq-month-calendar__row-body">
        <span className="lq-month-calendar__row-title">{item.event.title}</span>
        {item.event.description && <span className="lq-month-calendar__row-description">{item.event.description}</span>}
      </span>
    </button>
  );
}

function DayList({
  day,
  items,
  title,
  labels,
  timeFmt,
  onEventClick,
  onCreate,
}: {
  day: Date;
  items: NormalizedEvent[];
  title: string;
  labels: MonthCalendarLabels;
  timeFmt: Intl.DateTimeFormat;
  onEventClick: (event: CalendarEvent) => void;
  onCreate?: (date: Date) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Le Popover reste `visibility: hidden` le temps de se mesurer, et un élément caché refuse le
  // focus : on réessaie image après image jusqu'à ce qu'il le prenne.
  useEffect(() => {
    let frame = 0;
    let tries = 0;
    const attempt = () => {
      const first = ref.current?.querySelector<HTMLElement>("button");
      first?.focus();
      if (first && document.activeElement !== first && tries++ < 20) frame = requestAnimationFrame(attempt);
    };
    attempt();
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className="lq-month-calendar__day-list" ref={ref} role="dialog" aria-label={title}>
      <div className="lq-month-calendar__day-list-title">{title}</div>
      {items.length === 0 && <span className="lq-month-calendar__agenda-empty">{labels.noEvents}</span>}
      {items.map((it) => (
        <EventRow key={it.event.id} item={it} day={day} timeFmt={timeFmt} allDayLabel={labels.allDay} onClick={onEventClick} />
      ))}
      {onCreate && (
        <button type="button" className="lq-month-calendar__agenda-create" onClick={() => onCreate(day)}>
          <PlusIcon size={12} />
          <span>{labels.create}</span>
        </button>
      )}
    </div>
  );
}
