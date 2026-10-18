// src/middlewares/uploadAvatar.js
// Optional profile photo on create / edit user: JPG, PNG or WEBP, max 3 MB,
// type checked from the file's bytes. Multer runs before validation, so the
// photo is only sent to Cloudinary by the controller once the rest is valid.

import multer from "multer";
import { Readable } from "node:stream";
import cloudinary, { uploadError } from "../config/cloudinary.js";
import { sniffType } from "./uploadScan.js";
import { HttpError } from "../utils/validate.js";

const MAX = 3 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX, files: 1, fields: 20 },
});

const checkPhoto = (req, res, next) => {
  if (!req.file) return next();
  const type = sniffType(req.file.buffer);
  if (!type || type.mime === "application/pdf") return next(new HttpError(415, "Photo must be a JPG, PNG or WEBP image."));
  req.photoType = type;
  next();
};

export const uploadAvatarFile = [upload.single("photo"), checkPhoto];

// Square, face-centred, 512 px. Profile photos are shown across the app, so
// they're normal (non-signed) assets in their own folder.
export function storeAvatar(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "cctek/users",
        resource_type: "image",
        overwrite: false,
        transformation: [{ width: 512, height: 512, crop: "fill", gravity: "face" }, { quality: "auto" }],
      },
      (err, result) => (err ? reject(uploadError(err)) : resolve(result))
    );
    Readable.from(buffer).pipe(stream);
  });
}

// Best-effort: a failed cleanup must not undo a successful user change.
export async function destroyAvatar(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
  } catch (err) {
    console.error(`Could not delete photo ${publicId}:`, err.message);
  }
}
