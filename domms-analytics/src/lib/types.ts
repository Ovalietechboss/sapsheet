// Types du domaine Domms (miroir du schéma Supabase, lecture seule).

export type FacturationMode = 'CESU' | 'CLASSICAL';
export type InvoiceStatus = 'draft' | 'sent' | 'paid';
export type TimesheetStatus = 'draft' | 'valide' | string;

export interface Client {
  id: string;
  user_id: string;
  titre: string | null;
  name: string;
  first_name: string | null;
  email: string | null;
  facturation_mode: FacturationMode;
  hourly_rate: number;
  mandataire_id: string | null;
}

export interface Mandataire {
  id: string;
  user_id: string;
  name: string;
  first_name: string | null;
  association_name: string;
}

export interface Timesheet {
  id: string;
  user_id: string;
  client_id: string;
  date_arrival: number; // epoch ms
  date_departure: number; // epoch ms
  duration: number; // heures
  frais_repas: number | null;
  frais_transport: number | null;
  frais_autres: number | null;
  status: TimesheetStatus;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  total_amount: number;
  month: number; // 1-12
  year: number;
}

/** Jeu de données complet chargé pour le reporting. */
export interface DommsDataset {
  clients: Client[];
  mandataires: Mandataire[];
  timesheets: Timesheet[];
  invoices: Invoice[];
}
