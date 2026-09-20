import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Scheduler } from "./Scheduler";
import { HOUR, formatDuration, type SchedulerTask } from "./schedulerModel";
import { SCHEDULE_DAY, SCHEDULE_NOW, SCHEDULE_RESOURCES, SCHEDULE_TASKS } from "./schedulerSampleData";

const meta: Meta<typeof Scheduler> = {
  title: "Scheduler/Planning de ressources",
  component: Scheduler,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof Scheduler>;

export const Default: Story = {
  name: "Journée de production",
  render: function Render() {
    const [tasks, setTasks] = useState<SchedulerTask[]>(SCHEDULE_TASKS);
    const [selected, setSelected] = useState<string | null>(null);
    const picked = tasks.find((task) => task.id === selected);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100dvh", padding: 12, boxSizing: "border-box" }}>
        <Scheduler
          resources={SCHEDULE_RESOURCES}
          tasks={tasks}
          onTasksChange={setTasks}
          from={SCHEDULE_DAY}
          to={SCHEDULE_DAY + 14 * HOUR}
          now={SCHEDULE_NOW}
          selectedTaskId={selected}
          onSelectedTaskIdChange={setSelected}
          height="100%"
        />
        <p style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5, margin: 0 }}>
          Glisser un bloc pour le déplacer dans le temps — ou sur une autre ligne, la rangée visée s&apos;éclaire avant
          qu&apos;on lâche. Tirer un bord pour l&apos;allonger. Tout s&apos;accroche au quart d&apos;heure. Les blocs
          tiretés sont verrouillés.{" "}
          {picked ? (
            <strong>
              Sélection : {picked.label} · {formatDuration(picked.end - picked.start)}
            </strong>
          ) : (
            "Cliquez un bloc."
          )}
        </p>
      </div>
    );
  },
};

/** Deux tâches sur la même ligne au même moment : la rangée se dédouble et le conflit est hachuré.
 *  Les empiler l'une sur l'autre rendrait le tableau le plus discret là où il devrait crier. */
export const Conflits: Story = {
  name: "Conflits",
  render: function Render() {
    const [tasks, setTasks] = useState<SchedulerTask[]>([
      { id: "a", resourceId: "l1", label: "Série A", start: SCHEDULE_DAY, end: SCHEDULE_DAY + 4 * HOUR, status: "running" },
      { id: "b", resourceId: "l1", label: "Série B", start: SCHEDULE_DAY + 2 * HOUR, end: SCHEDULE_DAY + 6 * HOUR, status: "late" },
      { id: "c", resourceId: "l1", label: "Série C", start: SCHEDULE_DAY + 3 * HOUR, end: SCHEDULE_DAY + 5 * HOUR, status: "planned" },
      { id: "d", resourceId: "l2", label: "Sans conflit", start: SCHEDULE_DAY + HOUR, end: SCHEDULE_DAY + 5 * HOUR },
    ]);
    return (
      <div style={{ height: 320, padding: 12, boxSizing: "border-box" }}>
        <Scheduler
          resources={SCHEDULE_RESOURCES.slice(0, 2)}
          tasks={tasks}
          onTasksChange={setTasks}
          from={SCHEDULE_DAY}
          to={SCHEDULE_DAY + 8 * HOUR}
          height="100%"
        />
      </div>
    );
  },
};

/** Sans `onTasksChange`, plus rien ne se saisit : un tableau d'affichage. */
export const LectureSeule: Story = {
  name: "Lecture seule",
  render: () => (
    <div style={{ height: 380, padding: 12, boxSizing: "border-box" }}>
      <Scheduler
        resources={SCHEDULE_RESOURCES}
        tasks={SCHEDULE_TASKS}
        from={SCHEDULE_DAY}
        to={SCHEDULE_DAY + 14 * HOUR}
        now={SCHEDULE_NOW}
        height="100%"
      />
    </div>
  ),
};

/** Une semaine : les graduations passent toutes seules de l'heure au jour, en choisissant le pas
 *  dans une échelle fixe — on va d'heures en demi-heures en quarts d'heure, jamais « toutes les
 *  37 minutes », ce que donnerait un calcul d'espacement régulier. */
export const Semaine: Story = {
  name: "Une semaine",
  render: function Render() {
    const [tasks, setTasks] = useState<SchedulerTask[]>(
      SCHEDULE_TASKS.map((task, i) => ({
        ...task,
        start: task.start + (i % 5) * 24 * HOUR,
        end: task.end + (i % 5) * 24 * HOUR,
      }))
    );
    return (
      <div style={{ height: 420, padding: 12, boxSizing: "border-box" }}>
        <Scheduler
          resources={SCHEDULE_RESOURCES}
          tasks={tasks}
          onTasksChange={setTasks}
          from={SCHEDULE_DAY}
          to={SCHEDULE_DAY + 7 * 24 * HOUR}
          now={SCHEDULE_NOW + 2 * 24 * HOUR}
          pxPerHour={8}
          snapMinutes={30}
          height="100%"
        />
      </div>
    );
  },
};
