// src/middlewares/uploadScan.js
// Accept ONE scanned letter: JPEG / PNG / WEBP up to 5 MB, PDF up to 10 MB.
// The type is decided from the file's first bytes, not from its name or the
// browser's claim, so a renamed file can't slip through.

import multer from "multer";
import { Readable } from "node:stream";
import cloudinary, { uploadError } from "../config/cloudinary.js";
import { HttpError } from "../utils/validate.js";

const MAX_IMAGE = 5 * 1024 * 1024; // the vision API's per-image limit
const MAX_PDF = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF, files: 1, fields: 5 },
});

export function sniffType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", format: "jpg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: "image/png", format: "png" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP")
    return { mime: "image/webp", format: "webp" };
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return { mime: "application/pdf", format: "pdf" };
  return null;
}

const checkFile = (req, res, next) => {
  if (!req.file) return next(new HttpError(400, "Please attach the scanned letter."));
  const type = sniffType(req.file.buffer);
  if (!type) return next(new HttpError(415, "Only JPG, PNG, WEBP images or PDF files are allowed."));
  if (type.mime !== "application/pdf" && req.file.size > MAX_IMAGE)
    return next(new HttpError(413, "Image is larger than 5 MB. Please retake it at a lower resolution."));
  req.fileType = type;
  next();
};

// Private storage: "authenticated" assets can't be opened by URL guessing;
// viewing needs a short-lived signed link from our API.
export function storePrivately(buffer, { folder, resourceType }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, type: "authenticated", resource_type: resourceType, overwrite: false },
      (err, result) => (err ? reject(uploadError(err)) : resolve(result))
    );
    Readable.from(buffer).pipe(stream);
  });
}

// Expiring download link (default 5 minutes)
export function signedViewUrl({ publicId, format, resourceType }, seconds = 300) {
  return cloudinary.utils.private_download_url(publicId, format, {
    type: "authenticated",
    resource_type: resourceType,
    expires_at: Math.floor(Date.now() / 1000) + seconds,
  });
}

export const uploadScanFile = [upload.single("file"), checkFile];
