"use client";

// Get the text of an uploaded letter, free, entirely in the browser:
//   PDF with real text      -> read the text layer directly (exact, instant)
//   photo / scanned PDF     -> clean up the image and run Tesseract OCR (kan+eng)
// The image never leaves the device. First use downloads the OCR engine and
// Kannada language data (~10 MB, version-pinned CDN), then the browser caches it.

let workerPromise = null;
const onProgressRef = { current: null }; // the worker is shared; progress goes to the latest caller

async function getWorker(onProgress) {
  onProgressRef.current = onProgress;
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("kan+eng", 1, {
        logger: (m) => onProgressRef.current?.(m),
      });
      await worker.setParameters({ preserve_interword_spaces: "1" });
      return worker;
    })().catch((err) => {
      workerPromise = null; // allow a retry, e.g. after the network comes back
      throw err;
    });
  }
  return workerPromise;
}

// Same clean-up that raised accuracy on MCC letters in testing:
// ~2400 px wide, greyscale, contrast stretched.
function prepare(source, width, height) {
  const scale = Math.min(3, 2400 / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = img.data;
  let lo = 255;
  let hi = 0;
  for (let i = 0; i < px.length; i += 4) {
    const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = g;
    if (g < lo) lo = g;
    if (g > hi) hi = g;
  }
  const span = Math.max(1, hi - lo);
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((px[i] - lo) / span) * 255 * 1.4 - 40));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

async function pdfFirstPage(file) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"; // self-hosted in /public
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  return doc.getPage(1);
}

async function pdfTextLayer(page) {
  const content = await page.getTextContent();
  return content.items.map((it) => it.str + (it.hasEOL ? "\n" : " ")).join("");
}

const kannadaChars = (s) => (s.match(/[ಀ-೿]/g) || []).length;

/**
 * @param {File} file   image/* or application/pdf
 * @param {(p: {status: string, progress: number}) => void} [onProgress]
 * @returns {Promise<{ text: string, method: "pdf-text" | "ocr", confidence?: number }>}
 */
export async function readLetterText(file, onProgress) {
  let canvas;
  if (file.type === "application/pdf") {
    onProgress?.({ status: "Reading PDF", progress: 0 });
    const page = await pdfFirstPage(file);
    const text = await pdfTextLayer(page);
    // Many Karnataka offices type in Nudi (non-Unicode) fonts: the "text" is
    // then Latin gibberish, so only trust it if it is real Kannada.
    if (kannadaChars(text) > 80) return { text, method: "pdf-text" };
    const viewport = page.getViewport({ scale: 2.5 });
    const raw = document.createElement("canvas");
    raw.width = viewport.width;
    raw.height = viewport.height;
    await page.render({ canvasContext: raw.getContext("2d"), viewport }).promise;
    canvas = prepare(raw, raw.width, raw.height);
  } else {
    const bitmap = await createImageBitmap(file);
    canvas = prepare(bitmap, bitmap.width, bitmap.height);
  }

  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(canvas);
  return { text: data.text, method: "ocr", confidence: data.confidence };
}
