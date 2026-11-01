import type { CalendarEvent } from "../components/scheduler/MonthCalendar";

/** Le « aujourd'hui » des stories : fixé, pour que les captures ne bougent pas d'un jour à l'autre. */
export const CALENDAR_TODAY = "2026-11-12";

/** Un mois de novembre d'équipe : réunions à l'heure, congés et salon sur plusieurs jours, dont un
 *  qui enjambe deux semaines et un qui déborde sur décembre. */
export const CALENDAR_EVENTS: CalendarEvent[] = [
  { id: "e1", title: "Revue mensuelle", start: "2026-11-02T09:30", end: "2026-11-02T11:00", tone: "accent", description: "Salle Garonne — budget et indicateurs" },
  { id: "e2", title: "Salon Equip'Auto", start: "2026-11-03", end: "2026-11-05", tone: "info", description: "Stand B12, Paris Expo" },
  { id: "e3", title: "Point produit", start: "2026-11-04T14:00", end: "2026-11-04T15:00", tone: "neutral" },
  { id: "e4", title: "Livraison v2.4", start: "2026-11-06", tone: "success", description: "Mise en production à 18 h" },
  { id: "e5", title: "Congés — Claire", start: "2026-11-09", end: "2026-11-13", tone: "warning" },
  { id: "e6", title: "Comité de direction", start: "2026-11-10T08:30", end: "2026-11-10T10:00", tone: "accent" },
  { id: "e7", title: "Déjeuner client Arvel", start: "2026-11-12T12:30", end: "2026-11-12T14:00", tone: "success" },
  { id: "e8", title: "Incident facturation", start: "2026-11-12T16:00", end: "2026-11-12T17:00", tone: "danger", description: "Post-mortem avec l'équipe paiement" },
  { id: "e9", title: "Entretiens annuels", start: "2026-11-12T10:00", end: "2026-11-12T12:00", tone: "neutral" },
  { id: "e10", title: "Formation sécurité", start: "2026-11-16", end: "2026-11-17", tone: "info" },
  { id: "e11", title: "Clôture comptable", start: "2026-11-27", end: "2026-12-02", tone: "danger", description: "Arrêté des comptes de novembre" },
  { id: "e12", title: "Séminaire équipe", start: "2026-11-19", end: "2026-11-20", tone: "accent" },
  { id: "e13", title: "Webinaire partenaires", start: "2026-11-24T17:00", end: "2026-11-24T18:00", tone: "success" },
  { id: "e14", title: "Bilan trimestriel", start: "2026-11-25T09:00", end: "2026-11-25T10:30", tone: "warning" },
];

/** Une journée chargée de plus, pour montrer le lien « +N autres ». */
export const CALENDAR_BUSY_EVENTS: CalendarEvent[] = [
  ...CALENDAR_EVENTS,
  { id: "b1", title: "Stand-up", start: "2026-11-12T09:00", end: "2026-11-12T09:15", tone: "neutral" },
  { id: "b2", title: "Revue de code", start: "2026-11-12T15:00", end: "2026-11-12T15:45", tone: "info" },
  { id: "b3", title: "Appel fournisseur", start: "2026-11-12T18:00", end: "2026-11-12T18:30", tone: "warning" },
  { id: "b4", title: "Atelier UX", start: "2026-11-18T10:00", end: "2026-11-18T12:00", tone: "accent" },
  { id: "b5", title: "Démo client", start: "2026-11-18T14:00", end: "2026-11-18T15:00", tone: "success" },
  { id: "b6", title: "Recrutement", start: "2026-11-18T16:00", end: "2026-11-18T17:00", tone: "neutral" },
  { id: "b7", title: "Afterwork", start: "2026-11-18T18:30", end: "2026-11-18T21:00", tone: "danger" },
];

/** Des couleurs libres (`color`) plutôt que des tons — un agenda par personne, par exemple. */
export const CALENDAR_COLOR_EVENTS: CalendarEvent[] = [
  { id: "c1", title: "Agenda de Léa", start: "2026-11-02", end: "2026-11-04", color: "#7c6fd8" },
  { id: "c2", title: "Agenda de Marc", start: "2026-11-05", end: "2026-11-06", color: "#e0884f" },
  { id: "c3", title: "Agenda de Sami", start: "2026-11-10T11:00", end: "2026-11-10T12:00", color: "#2f9e8f" },
  { id: "c4", title: "Agenda de Léa", start: "2026-11-17T09:00", end: "2026-11-17T10:00", color: "#7c6fd8" },
  { id: "c5", title: "Agenda de Marc", start: "2026-11-23", end: "2026-11-26", color: "#e0884f" },
];
