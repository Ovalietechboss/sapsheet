import { supabase, DOMMS_USER_ID, isSupabaseConfigured } from '../lib/supabase';
import type {
  Client,
  Mandataire,
  Timesheet,
  Invoice,
  DommsDataset,
} from '../lib/types';

async function fetchAll<R>(table: string, columns: string): Promise<R[]> {
  let query = supabase.from(table).select(columns);
  if (DOMMS_USER_ID) query = query.eq('user_id', DOMMS_USER_ID);
  const { data, error } = await query;
  if (error) throw new Error(`Erreur de chargement (${table}) : ${error.message}`);
  return (data ?? []) as R[];
}

/** Charge l'ensemble du jeu de données nécessaire au reporting. */
export async function loadDataset(): Promise<DommsDataset> {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase non configuré. Copiez .env.example en .env et renseignez vos clés.'
    );
  }

  const [clients, mandataires, timesheets, invoices] = await Promise.all([
    fetchAll<Client>(
      'clients',
      'id,user_id,titre,name,first_name,email,facturation_mode,hourly_rate,mandataire_id'
    ),
    fetchAll<Mandataire>(
      'mandataires',
      'id,user_id,name,first_name,association_name'
    ),
    fetchAll<Timesheet>(
      'timesheets',
      'id,user_id,client_id,date_arrival,date_departure,duration,frais_repas,frais_transport,frais_autres,status'
    ),
    fetchAll<Invoice>(
      'invoices',
      'id,user_id,client_id,invoice_number,status,total_amount,month,year'
    ),
  ]);

  return { clients, mandataires, timesheets, invoices };
}
