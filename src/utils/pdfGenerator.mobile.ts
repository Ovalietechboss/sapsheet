import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

export async function generatePDFMobile(htmlContent: string, filename: string): Promise<void> {
  const isNative = Capacitor.isNativePlatform();
  
  if (!isNative) {
    // Fallback to html2pdf for web
    const html2pdf = (await import('html2pdf.js')).default;
    await html2pdf().from(htmlContent).save(filename);
    return;
  }

  // For mobile, create a simple text file for now (we'll improve this)
  const data = `PDF Content:\n${htmlContent.replace(/<[^>]*>/g, '')}`;
  
  const result = await Filesystem.writeFile({
    path: filename,
    data: btoa(data),
    directory: Directory.Documents,
  });

  await Share.share({
    title: filename,
    url: result.uri,
    dialogTitle: 'Partager le PDF',
  });
}
