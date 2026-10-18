import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

// ensure env is loaded
dotenv.config();

if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  throw new Error("❌ Cloudinary environment variables are missing");
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Turn Cloudinary's upload errors into a message staff can act on.
export function uploadError(err) {
  const msg = err?.message || "";
  const e = new Error(
    /signature|api_secret|api key|401/i.test(msg) || err?.http_code === 401
      ? "Photo/file storage is not set up correctly (Cloudinary key or secret is wrong). Ask the administrator to check CLOUDINARY_API_SECRET."
      : "The file could not be stored. Please try again."
  );
  e.status = 502;
  console.error("Cloudinary upload failed:", msg);
  return e;
}

export default cloudinary;
