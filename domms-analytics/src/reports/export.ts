import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ReportTable {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface ReportPayload {
  title: string;
  subtitle?: string;
  tables: ReportTable[];
}

/** Génère et télécharge un rapport PDF (titre + tables). */
export function exportPdf(payload: ReportPayload, fileName: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  let y = 48;

  doc.setFontSize(18);
  doc.text(payload.title, marginX, y);
  y += 18;
  if (payload.subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(payload.subtitle, marginX, y);
    doc.setTextColor(0);
    y += 12;
  }

  payload.tables.forEach((t) => {
    autoTable(doc, {
      startY: y + 14,
      head: [[t.title]],
      body: [],
      theme: 'plain',
      headStyles: { fontSize: 12, fontStyle: 'bold', textColor: [37, 99, 235] },
    });
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 2,
      head: [t.columns],
      body: t.rows,
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { left: marginX, right: marginX },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  });

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    'Domms Analytics — généré le ' + new Date().toLocaleString('fr-FR'),
    marginX,
    doc.internal.pageSize.getHeight() - 24
  );

  doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

/** Génère et télécharge un classeur Excel (une feuille par table). */
export function exportExcel(payload: ReportPayload, fileName: string): void {
  const wb = XLSX.utils.book_new();
  payload.tables.forEach((t, idx) => {
    const aoa = [t.columns, ...t.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const sheetName = (t.title || `Feuille ${idx + 1}`).slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}
