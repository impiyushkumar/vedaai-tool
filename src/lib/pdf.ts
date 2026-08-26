// pdfjs-dist is imported lazily everywhere in this file: it touches browser-only
// globals (DOMMatrix) at module evaluation, which breaks server prerendering.

async function loadPdfjs() {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  return pdfjsLib;
}

export async function getPageCount(file: File): Promise<number> {
  try {
    const pdfjsLib = await loadPdfjs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  } catch {
    return 0;
  }
}

/** On-screen display: crisp enough to zoom into a highlight. */
export const DISPLAY_SCALE = 2.0;
export const DISPLAY_QUALITY = 0.85;

/**
 * Images sent to Gemini. Vercel rejects request bodies over 4.5MB before the
 * function runs, so these are deliberately small — the model reads printed and
 * handwritten text fine at this size, and base64 adds a further ~33%.
 */
export const API_SCALE = 0.75;
export const API_QUALITY = 0.6;

/**
 * Renders every page of `file` to a base64 JPEG data URL.
 * OffscreenCanvas is deliberately not used — it has no toDataURL.
 */
export async function renderPdfPages(
  file: File,
  scale = DISPLAY_SCALE,
  quality = DISPLAY_QUALITY
): Promise<string[]> {
  const pdfjsLib = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not acquire a 2D canvas context');

    // JPEG has no alpha, so an unpainted background renders black.
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvas, canvasContext: context, viewport }).promise;

    pages.push(canvas.toDataURL('image/jpeg', quality));

    page.cleanup();
  }

  return pages;
}

export function stripDataUrlPrefix(dataUrl: string): string {
  return dataUrl.replace(/^data:image\/\w+;base64,/, '');
}
