import { Modal } from "../primitives/Modal";
import { Button } from "../primitives/Button";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { Select } from "../forms/Select";
import { TextField } from "../forms/TextField";
import { NumberField } from "../forms/NumberField";
import { DateTimePicker } from "../forms/DateTimePicker";
import { PlusIcon, TrashIcon } from "../icons";
import {
  MINUTE,
  formatDuration,
  normaliseTask,
  segmentTask,
  type SchedulerResource,
  type SchedulerTask,
  type SchedulerTaskPattern,
  type SchedulerTaskStatus,
  type SchedulerSubtask,
} from "./schedulerModel";
import "./SchedulerTaskModal.css";

export interface SchedulerTaskModalProps {
  task: SchedulerTask;
  resources: SchedulerResource[];
  onChange: (task: SchedulerTask) => void;
  onDelete: () => void;
  onClose: () => void;
  snapMinutes: number;
  locale?: string;
}

const STATUSES: { value: SchedulerTaskStatus; label: string }[] = [
  { value: "planned", label: "Prévue" },
  { value: "running", label: "En cours" },
  { value: "done", label: "Terminée" },
  { value: "late", label: "En retard" },
  { value: "blocked", label: "Bloquée" },
];

const PATTERNS: { value: SchedulerTaskPattern; label: string }[] = [
  { value: "solid", label: "Plein" },
  { value: "striped", label: "Rayé" },
  { value: "hatched", label: "Hachuré" },
];

/**
 * A task's own dialog: what it is, when it runs, how it is drawn, and the steps it breaks into.
 *
 * Everything commits as it is typed. There is no Save, for the same reason the warehouse's
 * inspector has none — the board is behind the dialog and moves with the edit, so a change you
 * cannot see until you confirm it is a change you have to guess at. `Escape` closes; nothing is
 * pending when it does.
 *
 * The one thing this dialog will not let you express is a task whose parts do not add up to the
 * task. Segment lengths are the authority once a task has segments (see `SchedulerTask.subtasks`),
 * so editing one moves the task's end rather than leaving a discrepancy to be noticed later.
 */
export function SchedulerTaskModal({ task, resources, onChange, onDelete, onClose, snapMinutes, locale = "fr-FR" }: SchedulerTaskModalProps) {
  const patch = (next: Partial<SchedulerTask>) => onChange(normaliseTask({ ...task, ...next }));
  const steps = task.subtasks ?? [];

  const setStep = (id: string, next: Partial<SchedulerSubtask>) =>
    patch({ subtasks: steps.map((step) => (step.id === id ? { ...step, ...next } : step)) });

  return (
    <Modal
      open
      onClose={onClose}
      size="wide"
      title={task.label || "Tâche"}
      footer={
        <div className="lq-sched-modal__footer">
          <Button onClick={onDelete}>
            <TrashIcon size={14} /> Supprimer
          </Button>
          <Button selected onClick={onClose}>
            Fermer
          </Button>
        </div>
      }
    >
      <div className="lq-sched-modal">
        <TextField size="small" label="Titre" value={task.label} onChange={(event) => patch({ label: event.target.value })} />

        <label className="lq-field lq-sched-modal__description">
          <span className="lq-field__label">Description</span>
          <textarea
            className="lq-sched-modal__textarea"
            rows={3}
            value={task.description ?? ""}
            placeholder="Ce qu'il faut savoir avant de commencer…"
            onChange={(event) => patch({ description: event.target.value })}
          />
        </label>

        <div className="lq-sched-modal__row">
          <DateTimePicker
            size="small"
            label="Début"
            value={new Date(task.start)}
            minuteStep={snapMinutes}
            onChange={(date) => {
              // Moving the start moves the whole task: its length is a property of the work, not
              // of where it happens to sit. Pulling the end back is what the grip and the fields
              // below are for.
              const shift = date.getTime() - task.start;
              patch({ start: task.start + shift, end: task.end + shift });
            }}
          />
          <DateTimePicker
            size="small"
            label="Fin"
            value={new Date(task.end)}
            minuteStep={snapMinutes}
            minDate={new Date(task.start + snapMinutes * MINUTE)}
            disabled={steps.length > 0}
            onChange={(date) => patch({ end: Math.max(task.start + snapMinutes * MINUTE, date.getTime()) })}
          />
        </div>

        <p className="lq-sched-modal__duration">
          Durée : <strong>{formatDuration(task.end - task.start)}</strong>
          {steps.length > 0 && " — fixée par la somme des étapes"}
        </p>

        <div className="lq-sched-modal__row">
          <Select
            size="small"
            label="Ressource"
            options={resources.map((resource) => ({ value: resource.id, label: resource.label }))}
            value={task.resourceId}
            onChange={(resourceId) => patch({ resourceId })}
          />
          <Select
            size="small"
            label="État"
            options={STATUSES}
            value={task.status ?? "planned"}
            onChange={(status) => patch({ status: status as SchedulerTaskStatus })}
          />
        </div>

        <div className="lq-sched-modal__field">
          <span className="lq-field__label">Rayures</span>
          <SegmentedControl
            options={PATTERNS}
            value={task.pattern ?? "solid"}
            onChange={(pattern) => patch({ pattern: pattern as SchedulerTaskPattern })}
          />
        </div>

        <section className="lq-sched-modal__steps">
          <header className="lq-sched-modal__steps-head">
            <span className="lq-field__label">Étapes</span>
            {steps.length === 0 ? (
              <Button onClick={() => onChange(segmentTask(task, 2))}>Segmenter</Button>
            ) : (
              <Button
                onClick={() =>
                  patch({
                    subtasks: [
                      ...steps,
                      // A new step takes one snap of its own rather than a share of the others:
                      // adding a step lengthens the task, it does not silently shorten the work
                      // already described.
                      { id: `${task.id}-s${steps.length + 1}`, label: `Étape ${steps.length + 1}`, minutes: snapMinutes },
                    ],
                  })
                }
              >
                <PlusIcon size={14} /> Ajouter
              </Button>
            )}
          </header>

          {steps.length === 0 ? (
            <p className="lq-sched-modal__hint">
              Une tâche segmentée est dessinée en parts sur son bloc, et sa durée devient la somme de ses étapes.
            </p>
          ) : (
            <ul className="lq-sched-modal__step-list">
              {steps.map((step) => (
                <li key={step.id} className="lq-sched-modal__step">
                  <TextField
                    size="small"
                    value={step.label}
                    aria-label="Nom de l'étape"
                    onChange={(event) => setStep(step.id, { label: event.target.value })}
                  />
                  <NumberField
                    size="small"
                    value={step.minutes}
                    min={1}
                    step={snapMinutes}
                    suffix="min"
                    aria-label="Durée de l'étape"
                    onChange={(value) => setStep(step.id, { minutes: value === "" ? 1 : Math.max(1, Math.round(value)) })}
                  />
                  <Select
                    size="small"
                    options={STATUSES}
                    value={step.status ?? task.status ?? "planned"}
                    ariaLabel="État de l'étape"
                    onChange={(status) => setStep(step.id, { status: status as SchedulerTaskStatus })}
                  />
                  <button
                    type="button"
                    className="lq-sched-modal__step-remove"
                    aria-label={`Retirer ${step.label}`}
                    onClick={() => {
                      const rest = steps.filter((other) => other.id !== step.id);
                      // Removing the last step gives the task its plain span back rather than
                      // leaving it with an empty list, which would read as "segmented into
                      // nothing" and make its length undefined.
                      patch({ subtasks: rest.length === 0 ? undefined : rest });
                    }}
                  >
                    <TrashIcon size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="lq-sched-modal__meta">
          {new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(new Date(task.start))}
        </p>
      </div>
    </Modal>
  );
}
