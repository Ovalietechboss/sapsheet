import { Timesheet } from '../stores/timesheetStore.supabase';

export interface MonthlyReport {
  month: string;
  assistantId: string;
  totalHoursWorked: number;
  totalEarnings: number;
  totalFraisAnnexes: number;
  clientBreakdown: {
    clientId: string;
    clientName: string;
    hoursWorked: number;
    earnings: number;
    lastIntervention: string;
  }[];
  timesheetSummary: {
    date: string;
    duration: number;
    clients: string[];
    frais: number;
  }[];
  generatedAt: number;
}

export class ReportService {
  /**
   * Generate monthly report from timesheets
   */
  static generateMonthlyReport(
    month: string,
    timesheets: Timesheet[],
    assistantId: string,
    clientMap: { [id: string]: string } // clientId => clientName
  ): MonthlyReport {
    // Filter timesheets for month & assistant
    const monthTimesheets = timesheets.filter((ts) => {
      const d = new Date(ts.date_arrival);
      const tsMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return tsMonth === month && ts.user_id === assistantId;
    });

    // Calculate totals
    const totalHoursWorked = monthTimesheets.reduce((sum, ts) => sum + ts.duration, 0);
    const totalFraisAnnexes = monthTimesheets.reduce(
      (sum, ts) => sum + (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0),
      0
    );

    // Group by client
    const clientBreakdownMap: {
      [clientId: string]: {
        hours: number;
        earnings: number;
        lastDate: string;
      };
    } = {};

    monthTimesheets.forEach((ts) => {
      if (!clientBreakdownMap[ts.client_id]) {
        clientBreakdownMap[ts.client_id] = {
          hours: 0,
          earnings: 0,
          lastDate: '',
        };
      }
      clientBreakdownMap[ts.client_id].hours += ts.duration;
      clientBreakdownMap[ts.client_id].earnings +=
        (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0);
      clientBreakdownMap[ts.client_id].lastDate = new Date(ts.date_arrival).toISOString();
    });

    const clientBreakdown = Object.entries(clientBreakdownMap).map(
      ([clientId, data]) => ({
        clientId,
        clientName: clientMap[clientId] || clientId,
        hoursWorked: Math.round(data.hours * 100) / 100,
        earnings: Math.round(data.earnings * 100) / 100,
        lastIntervention: data.lastDate,
      })
    );

    // Chronological summary
    const timesheetSummary = monthTimesheets
      .sort((a, b) => a.date_arrival - b.date_arrival)
      .map((ts) => ({
        date: new Date(ts.date_arrival).toISOString().substring(0, 10),
        duration: ts.duration,
        clients: [clientMap[ts.client_id] || ts.client_id],
        frais: (ts.frais_repas || 0) + (ts.frais_transport || 0) + (ts.frais_autres || 0),
      }));

    return {
      month,
      assistantId,
      totalHoursWorked: Math.round(totalHoursWorked * 100) / 100,
      totalEarnings: 0, // To be calculated from invoices
      totalFraisAnnexes: Math.round(totalFraisAnnexes * 100) / 100,
      clientBreakdown,
      timesheetSummary,
      generatedAt: Date.now(),
    };
  }

  /**
   * Export report to CSV format
   */
  static exportToCSV(report: MonthlyReport): string {
    let csv = 'SAP Sheet - Rapport Mensuel\n';
    csv += `Mois,${report.month}\n`;
    csv += `Heures totales,${report.totalHoursWorked}\n`;
    csv += `Frais annexes,${report.totalFraisAnnexes}\n\n`;

    csv += 'Détail par client\n';
    csv += 'Client,Heures,Frais,Dernière intervention\n';
    report.clientBreakdown.forEach((client) => {
      csv += `${client.clientName},${client.hoursWorked},${client.earnings},${client.lastIntervention}\n`;
    });

    csv += '\nChronologie\n';
    csv += 'Date,Durée,Frais\n';
    report.timesheetSummary.forEach((summary) => {
      csv += `${summary.date},${summary.duration},${summary.frais}\n`;
    });

    return csv;
  }
}

export default ReportService;
