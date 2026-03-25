import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export async function generateAndSharePDF(htmlContent: string, filename: string): Promise<void> {
  const isNative = Capacitor.isNativePlatform();

  if (!isNative) {
    // Web: ouvrir pour impression
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

  // Mobile: créer fichier HTML en base64 et partager
  try {
    const htmlFilename = `${filename.replace('.pdf', '')}.html`;
    
    // Convertir en base64 pour Android
    const base64Data = btoa(unescape(encodeURIComponent(htmlContent)));
    
    // Écrire le fichier
    const result = await Filesystem.writeFile({
      path: htmlFilename,
      data: base64Data,
      directory: Directory.Cache,
    });

    console.log('File created:', result.uri);

    // Partager le fichier
    await Share.share({
      title: 'Facture',
      text: 'Ouvrez avec Chrome pour imprimer en PDF',
      url: result.uri,
      dialogTitle: 'Partager la facture',
    });
  } catch (error: any) {
    console.error('Share error:', error);
    alert(`Erreur: ${error?.message || 'Impossible de créer le fichier'}`);
  }
}
