import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import { Readable } from "stream";

// Multer memory storage (no files saved locally)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Convert buffer → stream and upload to Cloudinary
const uploadToCloudinary = (req, res, next) => {
  if (!req.file) return next();

  const stream = cloudinary.uploader.upload_stream(
    { folder: "users" }, // all profile pics go into "users" folder
    (err, result) => {
      if (err) return next(err);

      req.cloudinaryResult = result; // store url + public_id
      next();
    }
  );

  // turn buffer into a readable stream
  const bufferStream = new Readable();
  bufferStream.push(req.file.buffer);
  bufferStream.push(null);
  bufferStream.pipe(stream);
};

export const uploadSingleImage = [
  upload.single("image"), // field name in frontend form
  uploadToCloudinary,
];
