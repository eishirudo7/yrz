import { PDFDocument } from 'pdf-lib';

export async function countPagesInBlob(blob: Blob): Promise<number> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    return pdf.getPageCount();
  } catch (error) {
    console.error('Error counting PDF pages:', error);
    return 0;
  }
}

export async function mergePDFs(pdfBlobs: Blob[]): Promise<Blob> {
  if (pdfBlobs.length === 0) {
    throw new Error('No PDFs to merge');
  }

  // Validasi setiap blob
  for (const blob of pdfBlobs) {
    if (!blob || blob.size === 0) {
      throw new Error('Empty PDF blob detected');
    }
  }

  const mergedPdf = await PDFDocument.create();
  const pageCountBefore = 0;
  
  for (const blob of pdfBlobs) {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const pdf = await PDFDocument.load(arrayBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => {
        mergedPdf.addPage(page);
      });
    } catch (error) {
      console.error('Error merging PDF:', error);
      throw new Error(`Failed to merge PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  const mergedPdfBytes = await mergedPdf.save();
  const resultBlob = new Blob([mergedPdfBytes], { type: 'application/pdf' });

  // Validasi hasil
  if (resultBlob.size === 0) {
    throw new Error('Merged PDF is empty');
  }

  return resultBlob;
} 