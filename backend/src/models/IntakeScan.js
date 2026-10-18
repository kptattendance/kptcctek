// src/models/IntakeScan.js
// A scanned inward letter, before (and after) it becomes a Project.
// The browser only ever gets this record's id: Cloudinary public ids are
// never accepted from the client, so nobody can attach someone else's file.

import mongoose from "mongoose";

const intakeScanSchema = new mongoose.Schema(
  {
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    publicId: { type: String, required: true },
    resourceType: { type: String, enum: ["image", "raw"], default: "image" },
    format: { type: String, default: "" }, // jpg, png, webp, pdf
    bytes: { type: Number, default: 0 },
    originalName: { type: String, default: "" },
    // What the AI read, kept as-is so staff corrections can be compared later.
    extracted: { type: mongoose.Schema.Types.Mixed, default: null },
    extractionError: { type: String, default: "" },
    model: { type: String, default: "" },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null }, // set when saved
  },
  { timestamps: true }
);

export default mongoose.models.IntakeScan || mongoose.model("IntakeScan", intakeScanSchema);
