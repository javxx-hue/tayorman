// PDF text extractor using pdfjs-dist. Returns '' when no text layer exists
// (e.g. scanned PDFs) so callers report it instead of sending filler to the AI.
export async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    // Dynamic import keeps pdfjs out of the main bundle
    const pdfjsLib = await import('pdfjs-dist');

    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    }

    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    const maxPages = Math.min(pdfDoc.numPages, 30); // Process up to 30 pages

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str || '')
        .filter((str: string) => str.trim().length > 0)
        .join(' ');
      // Page markers let the AI cite where an answer comes from
      if (pageText.trim()) fullText += `[Sahifa ${pageNum}]\n${pageText}\n\n`;
    }

    return fullText.trim();
  } catch (error) {
    console.warn('PDF parsing failed', error);
    return '';
  }
}
