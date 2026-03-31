import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const MARGIN = 10; // mm

export async function generateAndSharePDF(htmlContent: string, filename: string): Promise<void> {
  const isNative = Capacitor.isNativePlatform();
  const pdfFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

  try {
    const containerWidth = 760;

    const container = document.createElement('div');
    container.style.cssText = `position:absolute;left:-9999px;top:0;width:${containerWidth}px;background:white;`;
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    const [html2canvas, { jsPDF }] = await Promise.all([
      import('html2canvas').then((m) => m.default),
      import('jspdf'),
    ]);

    await new Promise((r) => setTimeout(r, 100));

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: containerWidth,
      windowWidth: containerWidth,
    });

    document.body.removeChild(container);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();   // 210mm
    const pageH = pdf.internal.pageSize.getHeight();   // 297mm
    const printW = pageW - 2 * MARGIN;                 // 190mm
    const printH = pageH - 2 * MARGIN;                 // 277mm

    const imgW = printW;
    const imgH = (canvas.height * imgW) / canvas.width;

    // Si ça dépasse d'au max 15% → réduire pour tout mettre sur une page
    if (imgH <= printH * 1.15) {
      const finalH = Math.min(imgH, printH);
      const finalW = imgH <= printH ? imgW : (canvas.width * finalH) / canvas.height;
      const offsetX = imgH <= printH ? MARGIN : MARGIN + (printW - finalW) / 2;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', offsetX, MARGIN, finalW, finalH);
    } else {
      // Vrai multi-page : découper en tranches propres
      const pxPerPage = Math.floor((printH / imgH) * canvas.height);
      const totalPages = Math.ceil(canvas.height / pxPerPage);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();

        const srcY = page * pxPerPage;
        const srcH = Math.min(pxPerPage, canvas.height - srcY);

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = srcH;
        const ctx = sliceCanvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

        const sliceImgH = (srcH * imgW) / canvas.width;
        pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', MARGIN, MARGIN, imgW, sliceImgH);
      }
    }

    if (isNative) {
      const base64 = pdf.output('datauristring').split(',')[1];
      const result = await Filesystem.writeFile({
        path: pdfFilename,
        data: base64,
        directory: Directory.Cache,
      });
      await Share.share({
        title: pdfFilename,
        url: result.uri,
        dialogTitle: 'Partager le PDF',
      });
    } else {
      pdf.save(pdfFilename);
    }
  } catch (error: any) {
    console.error('Erreur génération PDF:', error);
    alert(`Erreur PDF : ${error?.message || 'Impossible de générer le fichier'}`);
  }
}
