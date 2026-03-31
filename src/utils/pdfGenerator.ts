import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// Marges en mm
const MARGIN = 10;

export async function generateAndSharePDF(htmlContent: string, filename: string): Promise<void> {
  const isNative = Capacitor.isNativePlatform();
  const pdfFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;

  try {
    // Largeur du conteneur HTML = A4 (210mm) - marges (2×10mm) à 96dpi ≈ 718px
    // On utilise 720px pour un chiffre rond
    const containerWidth = 720;

    const container = document.createElement('div');
    container.style.cssText = `position:absolute;left:-9999px;top:0;width:${containerWidth}px;background:white;padding:20px;box-sizing:border-box;`;
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    const [html2canvas, { jsPDF }] = await Promise.all([
      import('html2canvas').then((m) => m.default),
      import('jspdf'),
    ]);

    // Attendre le rendu complet
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

    // Dimensions de l'image dans le PDF
    const imgW = printW;
    const imgH = (canvas.height * imgW) / canvas.width;

    if (imgH <= printH) {
      // Tout tient sur une page
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', MARGIN, MARGIN, imgW, imgH);
    } else {
      // Multi-page : découper le canvas en tranches
      const totalPages = Math.ceil(imgH / printH);
      const sliceHeight = Math.floor(canvas.height / totalPages);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();

        const srcY = page * sliceHeight;
        const srcH = Math.min(sliceHeight, canvas.height - srcY);

        // Créer un canvas pour cette tranche
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = srcH;
        const ctx = sliceCanvas.getContext('2d')!;
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
