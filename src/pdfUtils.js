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
  return { canvas, pdfWidth: viewport.width, pdfHeight: viewport.height, scale };
}

export function canvasToPDF(cx, cy, pdfWidth, pdfHeight, scale) {
  return {
    pdfX: Math.round((cx / scale) * 10) / 10,
    pdfY: Math.round((pdfHeight - cy / scale) * 10) / 10,
  };
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

  for (const [id, coord] of Object.entries(coordinates)) {
    if (offer[id]) stamp(coord.page, coord.pdfX, coord.pdfY, offer[id]);
  }

  // Repeat address + date headers across all header pages
  const ah = coordinates['address_header'];
  const dh = coordinates['date_header'];
  for (const pg of headerPages) {
    if (pg === 5) continue;
    if (ah && offer['address_header']) stamp(pg, ah.pdfX, ah.pdfY, offer['address_header']);
    if (dh && offer['date_header'])    stamp(pg, dh.pdfX, dh.pdfY, offer['date_header']);
  }

  return await pdfDoc.save();
}

export function downloadPDF(bytes, filename) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  Object.assign(document.createElement('a'), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}
