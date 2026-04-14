import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function renderPageToCanvas(pdfBytes, pageIndex, containerWidth) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf  = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
  const page = await pdf.getPage(pageIndex);
  const viewport = page.getViewport({ scale: 1 });
  const scale    = Math.min(containerWidth / viewport.width, 1.6);
  const scaled   = page.getViewport({ scale });
  const canvas   = document.createElement('canvas');
  canvas.width   = Math.floor(scaled.width);
  canvas.height  = Math.floor(scaled.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaled }).promise;
  return { canvas, pdfWidth: viewport.width, pdfHeight: viewport.height, scale, totalPages: pdf.numPages };
}

export function canvasToPDF(cx, cy, pdfWidth, pdfHeight, scale) {
  return {
    pdfX: Math.round((cx / scale) * 10) / 10,
    pdfY: Math.round((pdfHeight - cy / scale) * 10) / 10,
  };
}

/**
 * Normalise the coordinate store so every field is an array of positions.
 * Supports both the old format { page, pdfX, pdfY } and the new
 * array format [{ page, pdfX, pdfY }, ...].
 */
export function normaliseCoords(coordinates) {
  const out = {};
  for (const [id, val] of Object.entries(coordinates)) {
    out[id] = Array.isArray(val) ? val : [val];
  }
  return out;
}

export async function fillPDF(templateBytes, coordinates, offer, headerPages) {
  const pdfDoc = await PDFDocument.load(templateBytes);
  const font   = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages  = pdfDoc.getPages();
  const color  = rgb(0, 0, 0);
  const size   = 9;

  function stamp(pageNum, x, y, text) {
    if (pageNum < 1 || pageNum > pages.length || !text) return;
    pages[pageNum - 1].drawText(String(text), { x, y, size, font, color });
  }

  const norm = normaliseCoords(coordinates);

  // Stamp every position for every field
  for (const [id, positions] of Object.entries(norm)) {
    if (!offer[id]) continue;
    for (const pos of positions) {
      stamp(pos.page, pos.pdfX, pos.pdfY, offer[id]);
    }
  }

  // Repeat address + date headers across all header pages using
  // the FIRST mapped position as the template offset
  const ahPositions = norm['address_header'];
  const dhPositions = norm['date_header'];
  for (const pg of headerPages) {
    if (pg === 5) continue; // already stamped above via the main loop
    if (ahPositions?.[0] && offer['address_header']) {
      stamp(pg, ahPositions[0].pdfX, ahPositions[0].pdfY, offer['address_header']);
    }
    if (dhPositions?.[0] && offer['date_header']) {
      stamp(pg, dhPositions[0].pdfX, dhPositions[0].pdfY, offer['date_header']);
    }
  }

  return await pdfDoc.save();
}

export function downloadPDF(bytes, filename) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}