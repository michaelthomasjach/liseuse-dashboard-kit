import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { MonthCalendar, type CalendarEvent } from "./MonthCalendar";
import { CALENDAR_BUSY_EVENTS, CALENDAR_COLOR_EVENTS, CALENDAR_EVENTS, CALENDAR_TODAY } from "../../test-data/monthCalendarData";

const meta: Meta<typeof MonthCalendar> = {
  title: "Scheduler/MonthCalendar",
  component: MonthCalendar,
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj<typeof MonthCalendar>;

/** Le mois de novembre : réunions à l'heure, congés et salon en barres continues, clôture qui déborde sur décembre. */
export const Default: Story = {
  render: () => <MonthCalendar events={CALENDAR_EVENTS} today={CALENDAR_TODAY} />,
};

/** `view="week"` : la semaine en agenda, jour par jour, avec heures et descriptions. */
export const WeekAgenda: Story = {
  render: () => <MonthCalendar events={CALENDAR_EVENTS} today={CALENDAR_TODAY} defaultView="week" />,
};

/** Des jours trop chargés pour la case : `maxEventsPerDay` lignes, puis « +N autres » qui ouvre la liste du jour. */
export const BusyDays: Story = {
  render: () => <MonthCalendar events={CALENDAR_BUSY_EVENTS} today={CALENDAR_TODAY} maxEventsPerDay={3} />,
};

/** Double-clic sur un jour, ou le « + » au survol : un événement se crée. Un clic sur un événement le retire. */
export const CreateEvents: Story = {
  render: function Render() {
    const [events, setEvents] = useState<CalendarEvent[]>(CALENDAR_EVENTS.slice(0, 6));
    const [selected, setSelected] = useState<Date | null>(null);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <MonthCalendar
          events={events}
          today={CALENDAR_TODAY}
          selectedDate={selected}
          onSelectedDateChange={setSelected}
          onCreate={(d) =>
            setEvents((list) => [
              ...list,
              { id: `n${list.length}-${d.getTime()}`, title: "Nouvel événement", start: d, allDay: true, tone: "success" },
            ])
          }
          onEventClick={(ev) => setEvents((list) => list.filter((e) => e.id !== ev.id))}
        />
        <p style={{ fontSize: 12, opacity: 0.75, margin: 0 }}>
          {selected ? `Jour sélectionné : ${selected.toLocaleDateString("fr-FR", { dateStyle: "full" })}` : "Cliquez un jour."} Flèches,
          Page préc./suiv., Origine/Fin pour se déplacer au clavier ; Entrée ouvre la liste du jour.
        </p>
      </div>
    );
  },
};

/** `color` plutôt que `tone` : une couleur par agenda. */
export const CustomColors: Story = {
  render: () => <MonthCalendar events={CALENDAR_COLOR_EVENTS} today={CALENDAR_TODAY} showViewSwitch={false} />,
};

/** Dans une colonne étroite : la grille remplit sa largeur, les heures s'effacent devant les titres. */
export const Narrow: Story = {
  render: () => (
    <div style={{ maxWidth: 480 }}>
      <MonthCalendar events={CALENDAR_EVENTS} today={CALENDAR_TODAY} maxEventsPerDay={2} showViewSwitch={false} />
    </div>
  ),
};
