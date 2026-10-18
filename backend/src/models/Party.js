// src/models/Party.js
// The client who sends work: MCC, Pilikula, Kateelu, NMPA, Ambedkar, Venloc...
// Bills go to the party, so its billing address and GSTIN live here.

import mongoose from "mongoose";

const partySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 20 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    // MCC: fee includes GST. Direct clients (Pilikula, Kateelu): GST added on top.
    gstMode: { type: String, enum: ["inclusive", "exclusive"], default: "inclusive" },
    gstin: { type: String, trim: true, uppercase: true, default: "", match: [/^$|^[0-9A-Z]{15}$/, "Invalid GSTIN"] },
    billingAddress: { type: String, trim: true, default: "", maxlength: 500 },
    contactPerson: { type: String, trim: true, default: "" },
    contactEmail: { type: String, trim: true, lowercase: true, default: "" },
    contactPhone: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.Party || mongoose.model("Party", partySchema);
