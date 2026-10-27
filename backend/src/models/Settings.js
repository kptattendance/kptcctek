// src/models/Settings.js
// One record ("cctek") with the details printed on every bill and statement.

import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "cctek" },
    orgName: { type: String, trim: true, default: "CCTEK, Karnataka (Govt.) Polytechnic", maxlength: 200 },
    orgSubtitle: { type: String, trim: true, default: "Third Party Inspection Cell", maxlength: 200 },
    address: { type: String, trim: true, default: "Kadri Hills, Mangaluru - 575004", maxlength: 500 },
    phone: { type: String, trim: true, default: "", maxlength: 40 },
    email: { type: String, trim: true, lowercase: true, default: "", maxlength: 120 },
    gstin: { type: String, trim: true, uppercase: true, default: "", match: [/^$|^[0-9A-Z]{15}$/, "Invalid GSTIN"] },
    pan: { type: String, trim: true, uppercase: true, default: "", match: [/^$|^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN"] },
    sacCode: { type: String, trim: true, default: "998346", maxlength: 10 }, // technical inspection services
    bankName: { type: String, trim: true, default: "", maxlength: 120 },
    bankBranch: { type: String, trim: true, default: "", maxlength: 120 },
    accountName: { type: String, trim: true, default: "", maxlength: 120 },
    accountNo: { type: String, trim: true, default: "", maxlength: 30 },
    ifsc: { type: String, trim: true, uppercase: true, default: "", match: [/^$|^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC"] },
    billNote: {
      type: String,
      trim: true,
      default: "Please pay by cheque / DD in favour of the account above, quoting the bill number.",
      maxlength: 500,
    },
    billSignatory: { type: String, trim: true, default: "CCTEK Manager", maxlength: 80 },
    // bill no. = prefix / year / bill date / running no.
    billPrefix: { type: String, trim: true, default: "ಸಂ.ಕೆಪಿಎಂ/ಸಿಸಿಟೆಕ್/ಟಿ.ಪಿ.ಐ.ಆರ್", maxlength: 80 },
    groupSignatory: { type: String, trim: true, default: "Principal", maxlength: 80 }, // Statement of Bills
    statementSignatories: { type: [String], default: ["Prepared by", "CCTEK Manager", "Principal"] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const Settings = mongoose.models.Settings || mongoose.model("Settings", settingsSchema);

export async function getSettings() {
  return (await Settings.findById("cctek").lean()) || new Settings().toObject();
}

export default Settings;
