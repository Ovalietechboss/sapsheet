import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  alignFor, formatDisplay, formatExcel,
  type ReportColumn, type ReportResult, type ReportRow,
} from './model';

function cellsDisplay(row: ReportRow, cols: ReportColumn[]): string[] {
  return cols.map((c) => formatDisplay(row[c.key], c.format));
}

function isEmpty(r: ReportResult): boolean {
  return r.groups.every((g) => g.rows.length === 0);
}

/** Export PDF paginé « en bandes » (style BIRT). */
export function exportReportPdf(result: ReportResult, fileName: string): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.text(result.title, marginX, 48);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(result.subtitle, marginX, 66);
  doc.setTextColor(0);

  const head = [result.columns.map((c) => c.label)];
  const columnStyles: Record<number, { halign: 'left' | 'right' }> = {};
  result.columns.forEach((c, i) => {
    columnStyles[i] = { halign: c.align || alignFor(c.format) };
  });

  let startY = 84;

  if (isEmpty(result)) {
    doc.setFontSize(11);
    doc.text(result.emptyMessage || 'Aucune donnée.', marginX, startY + 12);
  } else {
    for (const group of result.groups) {
      if (group.rows.length === 0) continue;

      if (group.label) {
        autoTable(doc, {
          startY,
          body: [[group.label]],
          theme: 'plain',
          styles: { fontSize: 12, fontStyle: 'bold', textColor: [37, 99, 235] },
          margin: { left: marginX, right: marginX },
        });
        startY = (doc as any).lastAutoTable.finalY + 2;
      }

      const body = group.rows.map((r) => cellsDisplay(r, result.columns));
      const foot = group.subtotals
        ? [cellsDisplay(group.subtotals, result.columns)]
        : undefined;

      autoTable(doc, {
        startY,
        head,
        body,
        foot,
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [37, 99, 235], halign: 'left' },
        footStyles: { fillColor: [226, 232, 240], textColor: 20, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [247, 249, 252] },
        columnStyles,
        margin: { left: marginX, right: marginX },
      });
      startY = (doc as any).lastAutoTable.finalY + 14;
    }

    if (result.grandTotals) {
      autoTable(doc, {
        startY,
        body: [cellsDisplay(result.grandTotals, result.columns)],
        styles: { fontSize: 10, cellPadding: 5, fontStyle: 'bold', fillColor: [37, 99, 235], textColor: 255 },
        columnStyles,
        margin: { left: marginX, right: marginX },
      });
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    'Domms Analytics — généré le ' + new Date().toLocaleString('fr-FR'),
    marginX,
    doc.internal.pageSize.getHeight() - 24
  );
  // Pagination
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`${i} / ${pages}`, pageW - marginX - 24, doc.internal.pageSize.getHeight() - 24);
  }

  doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

/** Export Excel structuré (groupes, sous-totaux, total). */
export function exportReportExcel(result: ReportResult, fileName: string): void {
  const cols = result.columns;
  const aoa: (string | number)[][] = [];
  aoa.push([result.title]);
  aoa.push([result.subtitle]);
  aoa.push([]);

  const headerRow = cols.map((c) => c.label);

  for (const group of result.groups) {
    if (group.rows.length === 0) continue;
    if (group.label) aoa.push([group.label]);
    aoa.push(headerRow);
    group.rows.forEach((r) => aoa.push(cols.map((c) => formatExcel(r[c.key], c.format) as string | number)));
    if (group.subtotals) {
      aoa.push(cols.map((c) => formatExcel(group.subtotals![c.key], c.format) as string | number));
    }
    aoa.push([]);
  }

  if (result.grandTotals) {
    aoa.push(cols.map((c) => formatExcel(result.grandTotals![c.key], c.format) as string | number));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = cols.map((c) => ({ wch: c.format === 'text' ? 24 : 14 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, result.title.slice(0, 31));
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}
