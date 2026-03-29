import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export async function generateAndSharePDF(htmlContent: string, filename: string): Promise<void> {
  const isNative = Capacitor.isNativePlatform();

  if (!isNative) {
    // Web : ouvrir dans une nouvelle fenêtre et lancer l'impression
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => {
        setTimeout(() => printWindow.print(), 500);
      };
    }
    return;
  }

  // Android : générer un vrai PDF via html2canvas + jsPDF puis partager
  try {
    // Injecter le HTML dans un conteneur temporaire hors écran
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;background:white;';
    container.innerHTML = htmlContent;
    document.body.appendChild(container);

    // Importer les libs dynamiquement (évite de les charger au démarrage)
    const [html2canvas, { jsPDF }] = await Promise.all([
      import('html2canvas').then((m) => m.default),
      import('jspdf'),
    ]);

    // Rendre le HTML en canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
    });

    document.body.removeChild(container);

    // Construire le PDF A4
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const imgData = canvas.toDataURL('image/png');

    let yOffset = 0;
    let remaining = imgH;

    pdf.addImage(imgData, 'PNG', 0, yOffset, imgW, imgH);
    remaining -= pageH;

    while (remaining > 0) {
      yOffset -= pageH;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, yOffset, imgW, imgH);
      remaining -= pageH;
    }

    // Sauvegarder dans le cache et partager
    const pdfFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
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
  } catch (error: any) {
    console.error('Erreur génération PDF:', error);
    alert(`Erreur PDF : ${error?.message || 'Impossible de générer le fichier'}`);
  }
}
