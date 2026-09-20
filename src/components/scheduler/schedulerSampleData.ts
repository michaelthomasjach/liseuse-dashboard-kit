import { HOUR, MINUTE, type SchedulerResource, type SchedulerTask } from "./schedulerModel";

/** A day on a small production floor, anchored to a fixed date so the fixture never drifts. */
export const SCHEDULE_DAY = new Date("2026-09-21T06:00:00").getTime();

export const SCHEDULE_RESOURCES: SchedulerResource[] = [
  { id: "l1", label: "Ligne 1", meta: "Assemblage" },
  { id: "l2", label: "Ligne 2", meta: "Assemblage" },
  { id: "cnc", label: "CNC-04", meta: "Usinage" },
  { id: "peinture", label: "Cabine peinture", meta: "Finition" },
  { id: "controle", label: "Contrôle qualité", meta: "2 opérateurs" },
  { id: "expedition", label: "Expédition", meta: "Quai A" },
];

const at = (hours: number) => SCHEDULE_DAY + hours * HOUR;

export const SCHEDULE_TASKS: SchedulerTask[] = [
  { id: "t1", resourceId: "l1", label: "Série A — 400 pièces", start: at(0), end: at(3.5), status: "done" },
  { id: "t2", resourceId: "l1", label: "Changement d'outil", start: at(3.5), end: at(4), status: "done", locked: true },
  { id: "t3", resourceId: "l1", label: "Série B — 250 pièces", start: at(4), end: at(8), status: "running" },

  { id: "t4", resourceId: "l2", label: "Série C", start: at(1), end: at(5), status: "running" },
  // Deux tâches qui se chevauchent sur la même ligne : la rangée se dédouble pour que le conflit
  // se voie, au lieu qu'une barre en cache une autre.
  { id: "t5", resourceId: "l2", label: "Reprise urgente", start: at(4), end: at(6.5), status: "late" },
  { id: "t6", resourceId: "l2", label: "Série D", start: at(7), end: at(11), status: "planned" },

  { id: "t7", resourceId: "cnc", label: "Lot 118", start: at(0.5), end: at(2), status: "done" },
  { id: "t8", resourceId: "cnc", label: "Lot 119", start: at(2.25), end: at(5.75), status: "running" },
  { id: "t9", resourceId: "cnc", label: "Maintenance préventive", start: at(6), end: at(7.5), status: "blocked", locked: true },

  { id: "t10", resourceId: "peinture", label: "Apprêt série A", start: at(3.5), end: at(5), status: "done" },
  { id: "t11", resourceId: "peinture", label: "Laque série A", start: at(5.25), end: at(7.25), status: "running" },

  { id: "t12", resourceId: "controle", label: "Contrôle série A", start: at(7.5), end: at(9), status: "planned" },
  { id: "t13", resourceId: "controle", label: "Audit client", start: at(9.5), end: at(11), status: "planned" },

  { id: "t14", resourceId: "expedition", label: "Chargement camion 1", start: at(9), end: at(10.5), status: "planned" },
  { id: "t15", resourceId: "expedition", label: "Chargement camion 2", start: at(11), end: at(12), status: "planned" },
];

/** Milieu de la journée simulée, pour le repère « maintenant ». */
export const SCHEDULE_NOW = at(5) + 20 * MINUTE;
